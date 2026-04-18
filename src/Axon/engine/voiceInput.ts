// ───────────────────────────────────────────────────────────────────
// Voice Input Engine — v2
//
// Design goals this rewrite addresses:
//   1. No duplicate dispatches — a single utterance must never fire
//      onCommand more than once, even if the browser emits repeated
//      final results (a known Chrome quirk).
//   2. No self-listening — recognition pauses while AXON is speaking
//      and resumes cleanly after.
//   3. State machine: dormant / standby / armed.
//        dormant  — only a resume phrase ("axon wake up") is acted on.
//        standby  — listens for the wake phrase; all other speech
//                   is ignored (background chatter doesn't register).
//        armed    — wake phrase heard, next phrase is the command.
//   4. Sleep phrases from standby put the engine into dormant.
// ───────────────────────────────────────────────────────────────────

export type VoiceState = "dormant" | "standby" | "armed";

export type VoiceIntent =
  | { kind: "wake" }
  | { kind: "sleep" }
  | { kind: "resume" }
  | { kind: "interrupt" }
  | { kind: "command"; text: string; confidence: number }
  | { kind: "ignore" };

export interface VoiceInputCallbacks {
  onStart?: () => void;
  onStop?: () => void;
  /** Interim/final transcript for the UI. */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Fires once per fully-classified utterance. */
  onIntent?: (intent: VoiceIntent) => void;
  /** Audio level 0..1 for visualizers. */
  onAudioLevel?: (level: number) => void;
  /** State transitions — for UI / logging. */
  onStateChange?: (state: VoiceState) => void;
  onError?: (message: string) => void;
}

export interface VoiceInputConfig {
  wakeWord: string;
  sleepPhrases: string[];
  resumePhrases: string[];
  /** Phrases that cut AXON off mid-speech. Detected even while speaking. */
  interruptPhrases: string[];
  /** Cooldown after a successful dispatch — ms. Prevents duplicates. */
  dispatchCooldownMs: number;
}

type SpeechRecognitionLike = any;

function getRecognitionClass(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function isVoiceInputSupported(): boolean {
  return getRecognitionClass() !== null;
}

/** Proactively request microphone permission. Returns the permission result. */
export async function ensureMicPermission(): Promise<"granted" | "denied" | "unavailable"> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We don't need the stream here — just wanted to trigger the permission flow.
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e: any) {
    console.warn("[AXON] Mic permission:", e?.name ?? e);
    return "denied";
  }
}

/** Normalize a phrase for robust matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsPhrase(hay: string, needle: string): boolean {
  const h = ` ${norm(hay)} `;
  const n = ` ${norm(needle)} `;
  return h.includes(n);
}

// ── Fuzzy wake-word matching ──────────────────────────────────────
// Browser STT mangles "axon" constantly. These are real transcripts
// observed in testing plus common phonetic relatives.
const AXON_VARIANTS = new Set([
  "axon", "axons",
  "exxon", "exxons",
  "action",
  "axel", "axle",
  "ax on", "acts on", "axe on",
  "hacks on", "hexon", "hex on",
  "atsun", "aksam",
  "akshan", "akshun",
  "hey xon", "hey zon",
  "aksen", "exon",
  "access", "access on",
  "acton",
]);

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] =
        a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
          ? prev
          : Math.min(prev, row[j - 1], row[j]) + 1;
      prev = temp;
    }
  }
  return row[n];
}

/** The key word in the wake phrase — last non-empty token. "hey axon" → "axon". */
function wakeKeyword(wakeWord: string): string {
  const toks = norm(wakeWord).split(" ").filter(Boolean);
  return toks[toks.length - 1] ?? "axon";
}

/** Check if text contains the wake phrase OR a fuzzy phonetic match. */
function hasWakeIntent(text: string, wakeWord: string): boolean {
  const n = norm(text);
  // 1. Literal substring (fastest path, most common when STT is accurate).
  if (containsPhrase(text, wakeWord)) return true;
  // 2. Variant whole-phrase match (covers "ax on", "hey exxon", etc.).
  for (const v of AXON_VARIANTS) {
    if (n.includes(v)) return true;
  }
  // 3. Per-token Levenshtein fallback for words close to the key word.
  const key = wakeKeyword(wakeWord); // "axon"
  const threshold = key.length <= 4 ? 1 : 2;
  for (const tok of n.split(" ")) {
    if (tok.length < 3) continue;
    if (levenshtein(tok, key) <= threshold) return true;
  }
  return false;
}

export class VoiceInput {
  private recognition: SpeechRecognitionLike | null = null;
  private config: VoiceInputConfig;
  private callbacks: VoiceInputCallbacks;

  private running = false;
  /** True once the caller wants us listening. Survives auto-restart cycles. */
  private wantRunning = false;
  /** True while AXON is speaking — we don't accept commands then. */
  private muted = false;
  private restartTimer: number | null = null;

  private state: VoiceState = "standby";
  private armedAt = 0;
  /** After a dispatch, ignore new final results until this moment. */
  private suppressUntil = 0;
  /** Last dispatched normalized text + timestamp — secondary dedup. */
  private lastDispatched = "";
  private lastDispatchedAt = 0;

  // Audio metering
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private meterRaf: number | null = null;

  constructor(config: VoiceInputConfig, callbacks: VoiceInputCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  updateConfig(patch: Partial<VoiceInputConfig>) {
    this.config = { ...this.config, ...patch };
  }

  getState(): VoiceState {
    return this.state;
  }

  setState(next: VoiceState) {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onStateChange?.(next);
  }

  /** Called by the provider while AXON speaks. Keeps recognition alive but quiet. */
  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      // Drop any in-flight interim so the resume is clean.
      this.suppressUntil = Date.now() + 500;
    }
  }

  start() {
    this.wantRunning = true;
    this.ensureRunning();
  }

  stop() {
    this.wantRunning = false;
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
      this.recognition = null;
    }
    this.stopMeter();
    this.running = false;
  }

  /** One-shot push-to-talk. Treats whatever is next said as a direct command. */
  pushToTalk() {
    // Arm immediately and accept next final transcript as a command, no wake word needed.
    this.setState("armed");
    this.armedAt = Date.now();
    this.start();
  }

  private ensureRunning() {
    if (!this.wantRunning) return;
    if (this.running) return;
    const RC = getRecognitionClass();
    if (!RC) {
      this.callbacks.onError?.("Speech recognition not supported here.");
      return;
    }

    const r: SpeechRecognitionLike = new RC();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;

    r.onstart = () => {
      this.running = true;
      this.callbacks.onStart?.();
      this.startMeter();
    };

    r.onend = () => {
      this.running = false;
      this.stopMeter();
      this.callbacks.onStop?.();
      // Auto-restart if still wanted.
      if (this.wantRunning && this.restartTimer === null) {
        this.restartTimer = window.setTimeout(() => {
          this.restartTimer = null;
          this.ensureRunning();
        }, 250);
      }
    };

    r.onerror = (e: any) => {
      const err = e?.error ?? "unknown";
      // Benign errors — ignore.
      if (err === "no-speech" || err === "aborted" || err === "audio-capture") return;
      this.callbacks.onError?.(`Speech error: ${err}`);
    };

    r.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      let confidence = 1;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const alt = res[0];
        if (res.isFinal) {
          finalText += alt.transcript;
          confidence = Math.min(confidence, alt.confidence ?? 1);
        } else {
          interim += alt.transcript;
        }
      }

      const live = (finalText + " " + interim).trim();
      if (live) this.callbacks.onTranscript?.(live, !!finalText);
      if (!finalText) return;

      this.handleFinal(finalText.trim(), confidence);
    };

    this.recognition = r;
    try {
      r.start();
    } catch {
      // Race — recognition.start while another instance is finishing. Retry on next tick.
      window.setTimeout(() => this.ensureRunning(), 150);
    }
  }

  private handleFinal(text: string, confidence: number) {
    const now = Date.now();
    const n = norm(text);

    // Interrupt phrases fire EVEN when muted (while AXON is speaking).
    // That's the whole point of an interrupt.
    const hasInterrupt = this.config.interruptPhrases.some((p) => containsPhrase(text, p));
    if (hasInterrupt) {
      this.dispatch({ kind: "interrupt" }, n, now);
      return;
    }

    // Muted (AXON speaking) or in cooldown — drop non-interrupt speech.
    if (this.muted) return;
    if (now < this.suppressUntil) return;

    // Secondary dedup: identical normalized string within 2.5s is a duplicate echo.
    if (n === this.lastDispatched && now - this.lastDispatchedAt < 2500) return;

    const has = (arr: string[]) => arr.some((p) => containsPhrase(text, p));
    // Fuzzy match on the wake phrase — tolerates "hey exxon", "hey action", etc.
    const hasWake = hasWakeIntent(text, this.config.wakeWord);
    const hasSleep = has(this.config.sleepPhrases);
    const hasResume = has(this.config.resumePhrases);

    // ── dormant state: only a resume phrase matters ──
    if (this.state === "dormant") {
      if (hasResume) {
        this.dispatch({ kind: "resume" }, n, now);
      }
      return;
    }

    // ── sleep phrase (from any awake state) ──
    if (hasSleep) {
      this.dispatch({ kind: "sleep" }, n, now);
      return;
    }

    // ── standby: must hear wake phrase, nothing else ──
    if (this.state === "standby") {
      if (hasWake) {
        // Is there content after the wake phrase?
        const after = this.stripWakePrefix(text);
        if (after.length > 2) {
          // "Hey Axon, brief me" — wake + command in one utterance.
          this.dispatch({ kind: "wake" }, n, now);
          // Dispatch as command immediately after, but back-to-back — bypass cooldown
          // for this chained dispatch since it's intentional.
          this.suppressUntil = 0;
          this.dispatch(
            { kind: "command", text: after, confidence },
            norm(after),
            now
          );
          // Wake chained to command — return to standby.
          this.setState("standby");
        } else {
          // Just "Hey Axon" — arm for the next utterance.
          this.setState("armed");
          this.armedAt = now;
          this.dispatch({ kind: "wake" }, n, now);
        }
      }
      return;
    }

    // ── armed: next utterance is the command ──
    if (this.state === "armed") {
      // Arm timeout — if the operator took longer than 10s, fall back to standby.
      if (now - this.armedAt > 10_000) {
        this.setState("standby");
        return;
      }
      // Strip an accidental wake word at the front.
      const cleaned = hasWake ? this.stripWakePrefix(text) : text;
      if (cleaned.trim().length === 0) return;
      this.dispatch(
        { kind: "command", text: cleaned.trim(), confidence },
        norm(cleaned),
        now
      );
      this.setState("standby");
    }
  }

  private dispatch(intent: VoiceIntent, normalized: string, now: number) {
    this.lastDispatched = normalized;
    this.lastDispatchedAt = now;
    this.suppressUntil = now + this.config.dispatchCooldownMs;
    this.callbacks.onIntent?.(intent);
  }

  private stripWakePrefix(text: string): string {
    const lower = text.toLowerCase();
    const wake = this.config.wakeWord.toLowerCase();

    // Try literal wake first.
    let idx = lower.indexOf(wake);
    let matched = wake.length;

    // Then try each variant.
    if (idx === -1) {
      for (const v of AXON_VARIANTS) {
        const vi = lower.indexOf(v);
        if (vi !== -1) {
          idx = vi;
          matched = v.length;
          break;
        }
      }
    }

    // Then try fuzzy: find any token with edit distance ≤ 2 of key.
    if (idx === -1) {
      const key = wakeKeyword(this.config.wakeWord);
      const tokens = lower.split(/\s+/);
      let runningIdx = 0;
      for (const tok of tokens) {
        const tokIdx = lower.indexOf(tok, runningIdx);
        if (tokIdx === -1) break;
        if (tok.length >= 3 && levenshtein(tok, key) <= (key.length <= 4 ? 1 : 2)) {
          idx = tokIdx;
          matched = tok.length;
          break;
        }
        runningIdx = tokIdx + tok.length;
      }
    }

    if (idx === -1) return text;
    return text.slice(idx + matched).replace(/^[\s,!?.-]+/, "");
  }

  // ── Audio metering ──────────────────────────────────────────────
  private async startMeter() {
    if (!this.callbacks.onAudioLevel) return;
    if (this.micStream) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      const ctx = new AudioContext();
      this.audioCtx = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      this.analyser = analyser;

      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Dampen when muted so the visualizer doesn't dance.
        const level = this.muted ? 0 : Math.min(1, rms * 3);
        this.callbacks.onAudioLevel?.(level);
        this.meterRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* user declined mic; no visualizer */
    }
  }

  private stopMeter() {
    if (this.meterRaf !== null) {
      cancelAnimationFrame(this.meterRaf);
      this.meterRaf = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.callbacks.onAudioLevel?.(0);
  }
}
