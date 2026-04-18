// ───────────────────────────────────────────────────────────────────
// Voice Output Engine
// Primary: Web Speech Synthesis, picks the best available deep male
// voice (Google UK English Male / Daniel / Alex / etc).
// Optional: ElevenLabs streaming, activated when a voice id is set
// in settings AND the API key is present.
// ───────────────────────────────────────────────────────────────────

import { ELEVENLABS_API_KEY } from "../config";

const PREFERRED_VOICE_ORDER = [
  "Google UK English Male",
  "Daniel",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Alex",
  "Microsoft David - English (United States)",
];

export interface VoiceOutputConfig {
  preferredVoice: string | null;
  rate: number;
  pitch: number;
  volume: number;
  elevenLabsVoiceId: string | null;
}

export interface VoiceOutputCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/** Cache of loaded voices so we don't reflow on every speak call. */
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      voicesLoaded = true;
      resolve(existing);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
  });
}

export async function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesLoaded && cachedVoices.length > 0) return cachedVoices;
  return loadVoices();
}

function pickVoice(preferred: string | null, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  if (preferred) {
    const explicit = voices.find((v) => v.name === preferred);
    if (explicit) return explicit;
  }
  for (const name of PREFERRED_VOICE_ORDER) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  // Fallback — first English male-ish voice by name.
  const guess = voices.find(
    (v) => /en(-|_)/i.test(v.lang) && /(male|guy|daniel|alex|david|mark|fred)/i.test(v.name)
  );
  return guess ?? voices.find((v) => /^en/i.test(v.lang)) ?? voices[0];
}

/**
 * Add micro-pauses around commas and hyphens so synthesis sounds measured
 * rather than robotic. Also break long runs into clauses.
 */
function cadence(text: string): string {
  return text
    .replace(/—/g, ", ")
    .replace(/\.\s+/g, ". ")
    .replace(/,\s*/g, ", ")
    .trim();
}

export class VoiceOutput {
  private config: VoiceOutputConfig;
  private callbacks: VoiceOutputCallbacks;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(config: VoiceOutputConfig, callbacks: VoiceOutputCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  updateConfig(patch: Partial<VoiceOutputConfig>) {
    this.config = { ...this.config, ...patch };
  }

  async speak(text: string): Promise<void> {
    if (!text || !text.trim()) return;

    // Always cancel anything in-flight first so AXON never talks over itself.
    this.interrupt();

    // ElevenLabs path — only if both a voice id is set AND the key is present.
    if (this.config.elevenLabsVoiceId && ELEVENLABS_API_KEY) {
      try {
        await this.speakElevenLabs(text);
        return;
      } catch (e) {
        console.warn("[AXON] ElevenLabs failed, falling back to Web Speech:", e);
        // fall through to Web Speech
      }
    }

    return this.speakWebSpeech(text);
  }

  private async speakWebSpeech(text: string): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.callbacks.onError?.("Speech synthesis not available in this environment.");
      return;
    }
    const voices = await getAvailableVoices();
    const voice = pickVoice(this.config.preferredVoice, voices);
    const utt = new SpeechSynthesisUtterance(cadence(text));
    if (voice) utt.voice = voice;
    utt.rate = this.config.rate;
    utt.pitch = this.config.pitch;
    utt.volume = this.config.volume;

    return new Promise<void>((resolve) => {
      utt.onstart = () => this.callbacks.onStart?.();
      utt.onend = () => {
        this.callbacks.onEnd?.();
        resolve();
      };
      utt.onerror = (e) => {
        // Chrome sometimes emits benign "canceled" events — swallow.
        if ((e as any).error !== "canceled") {
          this.callbacks.onError?.((e as any).error ?? "speech error");
        }
        resolve();
      };
      window.speechSynthesis.speak(utt);
    });
  }

  private async speakElevenLabs(text: string): Promise<void> {
    if (!ELEVENLABS_API_KEY || !this.config.elevenLabsVoiceId) {
      throw new Error("ElevenLabs not configured");
    }
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenLabsVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cadence(text),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 160)}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = this.config.volume;
    this.currentAudio = audio;

    return new Promise<void>((resolve) => {
      audio.onplay = () => this.callbacks.onStart?.();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.callbacks.onEnd?.();
        this.currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.callbacks.onError?.("ElevenLabs playback error");
        this.currentAudio = null;
        resolve();
      };
      audio.play().catch((e) => {
        URL.revokeObjectURL(url);
        this.callbacks.onError?.(`Playback error: ${e?.message ?? e}`);
        resolve();
      });
    });
  }

  /** Cut off any currently-speaking output. */
  interrupt(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  isSpeaking(): boolean {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) return true;
    }
    return this.currentAudio !== null;
  }
}
