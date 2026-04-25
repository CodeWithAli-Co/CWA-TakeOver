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
  /**
   * Continuous listen mode: once armed by the wake word, stay armed
   * until the operator says a stand-down phrase. Every utterance
   * becomes a command without needing to re-say "hey axon". Default
   * true — the single biggest UX unlock for hands-free use.
   */
  continuousAfterWake?: boolean;
  /**
   * Phrases that exit continuous mode back to standby (still listening
   * for the wake word, but not acting on every utterance). The classic
   * military-style "stand down" is the primary.
   */
  standDownPhrases?: string[];
  /**
   * Forced sleep — overrides everything. No wake word, no resume
   * phrase, no command dispatch. The user toggles this from Settings.
   */
  forceSleep?: boolean;
  /**
   * Early-dispatch silence threshold (ms). When the recognizer's interim
   * transcript stops growing for this long AND the engine is armed, we
   * force-finalize and dispatch the command instead of waiting for the
   * browser's much slower endpointing (typically 1.5–2s of trailing
   * silence). Default 750ms — feels instant, almost no false-cuts.
   */
  earlyDispatchSilenceMs?: number;
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as MediaTrackConstraints,
    });
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

  // Early-dispatch — interim stability tracking.
  /** Most recent normalized interim transcript while armed. */
  private lastInterimNorm = "";
  /** Last time the interim text actually changed. */
  private lastInterimChangedAt = 0;
  /** Pending early-dispatch timer id. */
  private earlyDispatchTimer: number | null = null;

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

  /** Called by the provider while AXON speaks OR thinks. Keeps the
   *  recognition session alive but ignores results. Also clears the
   *  early-dispatch state so a stale interim doesn't leak across the
   *  mute boundary and re-fire as a duplicate command. */
  setMuted(m: boolean) {
    this.muted = m;
    // Always clear pending early-dispatch and interim memory — both on
    // mute (any in-flight stuff is now stale) and on unmute (start fresh
    // from the next real interim chunk).
    this.clearEarlyDispatchTimer();
    this.lastInterimNorm = "";
    this.lastInterimChangedAt = 0;
    if (m) {
      // Suppress any imminent isFinal that might land just after the mute.
      this.suppressUntil = Date.now() + 500;
    } else {
      // After unmute, give the recognizer a brief grace period before
      // the next dispatch — covers tail audio leaking from TTS
      // (~250ms) plus the operator's own breath/click.
      this.suppressUntil = Math.max(this.suppressUntil, Date.now() + 350);
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

      // ── Early-dispatch: respond before the browser endpointer
      //    decides the user is done. We only do this when armed and
      //    not muted, with at least a few words.
      if (!finalText && interim) {
        this.scheduleEarlyDispatch(interim, confidence);
      }

      if (!finalText) return;

      // Real final result — cancel any pending early-dispatch timer.
      this.clearEarlyDispatchTimer();
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

    // Forced sleep — absolute silence. No wake, no resume, no interrupt,
    // no command dispatch. User must toggle off in Settings to re-enable.
    if (this.config.forceSleep) {
      if (this.state !== "dormant") this.setState("dormant");
      return;
    }

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

    // ── stand-down (continuous mode exit) ──
    // In continuous-listen mode, "stand down" / "that's all" drops Axon
    // back to standby (passive wake-word listening). Checked BEFORE the
    // generic sleep phrase so "stand down" doesn't also dormant us.
    const standDownPhrases =
      this.config.standDownPhrases ?? [
        "stand down",
        "that's all",
        "that will be all",
        "thanks axon",
        "at ease",
      ];
    const hasStandDown = standDownPhrases.some((p) => containsPhrase(text, p));
    if (hasStandDown && this.state === "armed") {
      this.setState("standby");
      this.dispatch({ kind: "sleep" }, n, now);
      return;
    }

    // ── sleep phrase (from any awake state) — full dormant ──
    if (hasSleep) {
      this.dispatch({ kind: "sleep" }, n, now);
      return;
    }

    const continuous = this.config.continuousAfterWake !== false;

    // ── standby: must hear wake phrase, nothing else ──
    if (this.state === "standby") {
      if (hasWake) {
        // Is there content after the wake phrase?
        const after = this.stripWakePrefix(text);
        if (after.length > 2) {
          // "Hey Axon, brief me" — wake + command in one utterance.
          this.dispatch({ kind: "wake" }, n, now);
          this.suppressUntil = 0;
          this.dispatch(
            { kind: "command", text: after, confidence },
            norm(after),
            now
          );
          // Continuous: stay armed to accept follow-up utterances as
          // commands. Legacy: drop back to standby after one.
          if (continuous) {
            this.setState("armed");
            this.armedAt = now;
          } else {
            this.setState("standby");
          }
        } else {
          // Just "Hey Axon" — arm for the next utterance.
          this.setState("armed");
          this.armedAt = now;
          this.dispatch({ kind: "wake" }, n, now);
        }
      }
      return;
    }

    // ── armed: next utterance is a command ──
    if (this.state === "armed") {
      // In legacy mode the armed state times out after 10s of silence.
      // In continuous mode we NEVER time out — only "stand down" or a
      // sleep phrase exits.
      if (!continuous && now - this.armedAt > 10_000) {
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
      if (continuous) {
        // Refresh the armed-at timestamp so any future legacy-style
        // timeout doesn't fire mid-conversation.
        this.armedAt = now;
        // Stay armed — the next utterance is another command.
      } else {
        this.setState("standby");
      }
    }
  }

  private dispatch(intent: VoiceIntent, normalized: string, now: number) {
    this.lastDispatched = normalized;
    this.lastDispatchedAt = now;
    this.suppressUntil = now + this.config.dispatchCooldownMs;
    this.callbacks.onIntent?.(intent);
  }

  /** Schedule a one-shot timer that promotes a stable interim transcript
   *  into a command faster than browser endpointing would. Called on every
   *  fresh interim chunk while the engine is armed. */
  private scheduleEarlyDispatch(interim: string, confidence: number) {
    if (this.muted) return;
    if (this.state !== "armed") return;
    if (Date.now() < this.suppressUntil) return;
    const silenceMs = this.config.earlyDispatchSilenceMs ?? 750;
    const now = Date.now();
    const n = norm(interim);
    const changed = n !== this.lastInterimNorm;
    if (changed) {
      this.lastInterimNorm = n;
      this.lastInterimChangedAt = now;
    }
    // Need a few real words before we'll early-dispatch — single-word
    // false alarms are too easy.
    const wordCount = n.split(" ").filter(Boolean).length;
    if (wordCount < 2) return;
    // CRITICAL: only (re)schedule the timer when the interim text
    // actually changed. Chrome occasionally re-emits the SAME interim
    // chunk every ~200ms while you're silent — without this guard, each
    // repeat resets the timer back to silenceMs and the dispatch never
    // fires.
    if (!changed && this.earlyDispatchTimer !== null) return;
    this.clearEarlyDispatchTimer();
    this.earlyDispatchTimer = window.setTimeout(() => {
      this.earlyDispatchTimer = null;
      // Re-check conditions at fire time — operator may have started
      // talking again, or we may have been muted by TTS startup.
      if (this.muted) return;
      if (this.state !== "armed") return;
      const elapsed = Date.now() - this.lastInterimChangedAt;
      if (elapsed < silenceMs - 30) return;
      const text = this.lastInterimNorm;
      if (!text) return;
      // Strip wake prefix if it's still in there.
      const cleaned = hasWakeIntent(text, this.config.wakeWord)
        ? this.stripWakePrefix(text)
        : text;
      if (cleaned.trim().length < 2) return;
      this.dispatch(
        { kind: "command", text: cleaned.trim(), confidence },
        cleaned.trim(),
        Date.now(),
      );
      // Extend the suppress window so the eventual real isFinal (which
      // arrives 1-2s later) doesn't re-fire the same command.
      this.suppressUntil = Date.now() + 3000;
      this.lastInterimNorm = "";
      this.lastInterimChangedAt = 0;
    }, silenceMs);
  }

  private clearEarlyDispatchTimer() {
    if (this.earlyDispatchTimer !== null) {
      clearTimeout(this.earlyDispatchTimer);
      this.earlyDispatchTimer = null;
    }
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
      // Rich constraints so the meter reads clean audio and STT gets
      // echo-cancelled input. Makes wake-word detection far more
      // reliable (esp. when there's music/TV in the room).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        } as MediaTrackConstraints,
      });
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
