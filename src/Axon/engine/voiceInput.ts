// ───────────────────────────────────────────────────────────────────
// Voice Input Engine
// Wraps the browser's Web Speech Recognition API.
// Two modes:
//   1. Wake-word mode (continuous listen; when the wake phrase is heard,
//      the live transcription is forwarded to the dispatcher).
//   2. Push-to-talk mode (start / stop from the UI).
//
// Chrome, Edge and the Tauri WebView on Windows all support
// `webkitSpeechRecognition`. If unsupported, the engine gracefully
// no-ops and the operator can still type commands.
// ───────────────────────────────────────────────────────────────────

export interface VoiceInputCallbacks {
  onStart?: () => void;
  onStop?: () => void;
  /** Fires on every interim / final transcript update. */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Fires when a final transcript is ready for dispatch. */
  onCommand?: (transcript: string, confidence: number) => void;
  /** Fires when the wake word is heard and capture begins. */
  onWake?: () => void;
  onError?: (message: string) => void;
  /** Fires with an approximate audio level 0..1 for the visualizer. */
  onAudioLevel?: (level: number) => void;
}

export interface VoiceInputConfig {
  wakeWord: string;
  /** When true, continuous listen mode. When false, single-shot PTT. */
  continuous: boolean;
}

type SpeechRecognitionLike = any; // vendor-prefixed, no official DOM types

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

export class VoiceInput {
  private recognition: SpeechRecognitionLike | null = null;
  private config: VoiceInputConfig;
  private callbacks: VoiceInputCallbacks;
  private running = false;
  private armed = false; // wake word heard, now capturing the command
  private restartTimer: number | null = null;

  // Audio-level metering
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

  start() {
    const RC = getRecognitionClass();
    if (!RC) {
      this.callbacks.onError?.("Speech recognition not supported in this environment.");
      return;
    }
    if (this.running) return;

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
      // Auto-restart if continuous mode still desired.
      if (this.config.continuous && this.restartTimer === null) {
        this.restartTimer = window.setTimeout(() => {
          this.restartTimer = null;
          if (this.config.continuous) this.start();
        }, 300);
      }
    };

    r.onerror = (e: any) => {
      // "no-speech" and "aborted" are benign.
      const err = e?.error ?? "unknown";
      if (err !== "no-speech" && err !== "aborted") {
        this.callbacks.onError?.(`Speech error: ${err}`);
      }
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

      const lowered = finalText.toLowerCase().trim();
      const wake = this.config.wakeWord.toLowerCase();

      if (this.config.continuous && !this.armed) {
        // In continuous mode, wait for wake word.
        if (lowered.includes(wake)) {
          this.armed = true;
          this.callbacks.onWake?.();
          // If the wake word arrived along with a command in the same utterance,
          // strip the wake word and forward the rest.
          const after = finalText
            .toLowerCase()
            .split(wake)
            .slice(1)
            .join(wake)
            .trim();
          if (after.length > 2) {
            this.callbacks.onCommand?.(this.stripLeadingPunctuation(after), confidence);
            this.armed = false;
          }
        }
        return;
      }

      // Push-to-talk, or we've already been armed.
      const stripped = this.config.continuous
        ? this.stripWakePrefix(finalText, wake)
        : finalText;
      if (stripped.trim().length > 0) {
        this.callbacks.onCommand?.(stripped.trim(), confidence);
        this.armed = false;
      }
    };

    this.recognition = r;
    try {
      r.start();
    } catch (e) {
      // Sometimes fires "InvalidStateError" on rapid restart.
      console.warn("[AXON] Recognition start error:", e);
    }
  }

  stop() {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.config = { ...this.config, continuous: false };
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.stopMeter();
    this.running = false;
    this.armed = false;
  }

  /** PTT — listen for a single command, no wake word required. */
  pushToTalk(done: (text: string, confidence: number) => void) {
    const previousContinuous = this.config.continuous;
    this.stop();
    this.config = { ...this.config, continuous: false };
    const cb = this.callbacks;
    const oneShot: VoiceInputCallbacks = {
      ...cb,
      onCommand: (t, c) => {
        done(t, c);
        cb.onCommand?.(t, c);
        // Restore previous mode
        this.callbacks = cb;
        if (previousContinuous) {
          this.config = { ...this.config, continuous: true };
          this.start();
        }
      },
    };
    this.callbacks = oneShot;
    this.start();
  }

  private stripWakePrefix(text: string, wake: string): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(wake);
    if (idx === -1) return text;
    return text.slice(idx + wake.length).replace(/^[\s,!?.-]+/, "");
  }

  private stripLeadingPunctuation(s: string): string {
    return s.replace(/^[\s,!?.-]+/, "");
  }

  // ── Audio metering for the orb visualizer ─────────────────────────

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
        this.callbacks.onAudioLevel?.(Math.min(1, rms * 3));
        this.meterRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // User declined mic or unsupported — just skip metering.
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
