// ───────────────────────────────────────────────────────────────────
// Voice Output Engine — v3
//
// Two modes:
//   1. Web Speech Synthesis — picks the best available deep voice.
//   2. ElevenLabs — uses the /stream endpoint for low-latency playback.
//
// New in v3: a sentence queue. Brain streams sentences into queueSentence()
// as they're generated, and playback starts on the FIRST one while the rest
// are still being produced. onStart fires when playback begins; onEnd fires
// when the queue fully drains.
// ───────────────────────────────────────────────────────────────────

import { ELEVENLABS_API_KEY } from "../config";
import {
  getVoicePreset,
  pickWebSpeechVoiceForPreset,
  type VoicePreset,
} from "./voiceCatalog";

const PREFERRED_VOICE_ORDER = [
  "Google UK English Male",
  "Daniel",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Alex",
  "Microsoft David - English (United States)",
];

export interface VoiceOutputConfig {
  /** Preset id from voiceCatalog (e.g. "british-george"). Optional —
   *  if set, takes precedence over `preferredVoice`/`elevenLabsVoiceId`
   *  and overrides per-preset rate/pitch/voice_settings. */
  voicePresetId?: string | null;
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

// ── voice catalog ─────────────────────────────────────────────
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

function pickVoice(
  preset: VoicePreset | null,
  preferred: string | null,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  // Preset wins when present.
  if (preset) {
    const m = pickWebSpeechVoiceForPreset(preset, voices);
    if (m) return m;
  }
  if (preferred) {
    const explicit = voices.find((v) => v.name === preferred);
    if (explicit) return explicit;
  }
  for (const name of PREFERRED_VOICE_ORDER) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  const guess = voices.find(
    (v) => /en(-|_)/i.test(v.lang) && /(male|guy|daniel|alex|david|mark|fred)/i.test(v.name)
  );
  return guess ?? voices.find((v) => /^en/i.test(v.lang)) ?? voices[0];
}

/** Strip markdown + stray symbols before TTS so nothing is read literally. */
function sanitizeForSpeech(text: string): string {
  let t = text;

  // Code fences / blocks — keep the content, drop the fences.
  t = t.replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1");
  // Inline code `foo` → foo
  t = t.replace(/`([^`]+)`/g, "$1");
  // Bold / italic markers
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*\n]+)\*/g, "$1");
  t = t.replace(/_([^_\n]+)_/g, "$1");
  // Strikethrough
  t = t.replace(/~~([^~]+)~~/g, "$1");
  // Markdown links [label](url) → label
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Bare URLs — drop them (TTS reading URLs is ugly).
  t = t.replace(/https?:\/\/\S+/g, "");
  // Leading headings
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Bullet list markers at line start
  t = t.replace(/^\s*[*\-+•]\s+/gm, "");
  // Numbered list markers
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  // Tables — strip pipes (rough but fine)
  t = t.replace(/^\s*\|.*\|\s*$/gm, "");
  // Block quotes
  t = t.replace(/^\s*>\s?/gm, "");
  // Em/en dashes into commas (Web Speech reads them weirdly)
  t = t.replace(/—/g, ", ");
  t = t.replace(/–/g, ", ");
  // Leftover stray asterisks / underscores / pipes / pound signs / backticks
  t = t.replace(/[*_`|#~]+/g, "");
  // Ellipses — shorten long runs to keep cadence
  t = t.replace(/\.{4,}/g, "...");
  // Collapse 3+ blank lines
  t = t.replace(/\n{3,}/g, "\n\n");
  // Trim stray whitespace lines
  t = t.replace(/[ \t]+\n/g, "\n");
  // Multiple spaces → one
  t = t.replace(/[ \t]{2,}/g, " ");
  // Normalize commas
  t = t.replace(/,\s*/g, ", ");
  return t.trim();
}

/** Punctuation-to-pause normalization. Calls sanitizer first. */
function cadence(text: string): string {
  return sanitizeForSpeech(text);
}

// ═════════════════════════════════════════════════════════════════
export class VoiceOutput {
  private config: VoiceOutputConfig;
  private callbacks: VoiceOutputCallbacks;
  private currentAudio: HTMLAudioElement | null = null;

  /** Serial queue of pending sentences. */
  private queue: string[] = [];
  /** True when the queue is actively being drained. */
  private draining = false;
  /** Generation counter — any interrupt() bumps it so stale work exits cleanly. */
  private gen = 0;

  constructor(config: VoiceOutputConfig, callbacks: VoiceOutputCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  updateConfig(patch: Partial<VoiceOutputConfig>) {
    this.config = { ...this.config, ...patch };
  }

  /** One-shot: clear queue, speak this text as a single block. */
  async speak(text: string): Promise<void> {
    if (!text || !text.trim()) return;
    this.interrupt();
    this.queue = [text];
    await this.drain();
  }

  /** Append a sentence for immediate-ish playback. Starts draining if idle. */
  queueSentence(text: string) {
    const s = text.trim();
    if (!s) return;
    this.queue.push(s);
    if (!this.draining) {
      void this.drain();
    }
  }

  /** Cut off any currently-speaking output and drop the queue. */
  interrupt(): void {
    this.gen++;
    this.queue = [];
    this.draining = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  isSpeaking(): boolean {
    if (this.draining) return true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) return true;
    }
    return this.currentAudio !== null;
  }

  // ── private ─────────────────────────────────────────────────
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    const myGen = this.gen;
    this.callbacks.onStart?.();

    while (this.queue.length > 0 && this.gen === myGen) {
      const next = this.queue.shift()!;
      try {
        // Preset wins; fall back to operator-set elevenLabsVoiceId.
        const presetEleven =
          getVoicePreset(this.config.voicePresetId ?? null)?.elevenLabsVoiceId ?? null;
        const effectiveEleven = presetEleven ?? this.config.elevenLabsVoiceId;
        if (effectiveEleven && ELEVENLABS_API_KEY) {
          await this.speakElevenLabs(next, myGen, effectiveEleven);
        } else {
          await this.speakWebSpeech(next, myGen);
        }
      } catch (e) {
        console.warn("[AXON] sentence playback failed:", e);
        // Fall through to next sentence; don't abort entire queue.
      }
    }

    if (this.gen === myGen) {
      this.draining = false;
      this.callbacks.onEnd?.();
    }
  }

  private async speakWebSpeech(text: string, genAtCall: number): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.callbacks.onError?.("Speech synthesis not available.");
      return;
    }
    if (this.gen !== genAtCall) return;
    const voices = await getAvailableVoices();
    const preset = getVoicePreset(this.config.voicePresetId ?? null);
    const voice = pickVoice(preset, this.config.preferredVoice, voices);
    const utt = new SpeechSynthesisUtterance(cadence(text));
    if (voice) utt.voice = voice;
    // Preset rate/pitch take precedence — keeps each voice in character.
    utt.rate = preset?.rate ?? this.config.rate;
    utt.pitch = preset?.pitch ?? this.config.pitch;
    utt.volume = this.config.volume;

    return new Promise<void>((resolve) => {
      utt.onend = () => resolve();
      utt.onerror = (e) => {
        if ((e as any).error !== "canceled") {
          this.callbacks.onError?.((e as any).error ?? "speech error");
        }
        resolve();
      };
      window.speechSynthesis.speak(utt);
    });
  }

  /** ElevenLabs streaming endpoint — lower latency than the regular TTS.
   *  voiceId is resolved by the caller (preset wins over config). */
  private async speakElevenLabs(text: string, genAtCall: number, voiceId: string): Promise<void> {
    if (!ELEVENLABS_API_KEY || !voiceId) {
      throw new Error("ElevenLabs not configured");
    }
    if (this.gen !== genAtCall) return;

    const preset = getVoicePreset(this.config.voicePresetId ?? null);
    // Smoother default than v3's hardcoded values.
    const voice_settings = preset?.elevenLabsSettings ?? {
      stability: 0.55,
      similarity_boost: 0.8,
      style: 0.1,
      use_speaker_boost: true,
    };

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`,
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
          voice_settings,
        }),
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 160)}`);
    }

    const blob = await res.blob();
    if (this.gen !== genAtCall) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = this.config.volume;
    // Rate influences speed on HTMLAudio too. Preset rate wins.
    const effectiveRate = preset?.rate ?? this.config.rate;
    audio.playbackRate = Math.max(0.5, Math.min(2, effectiveRate));
    this.currentAudio = audio;

    return new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
        this.callbacks.onError?.("ElevenLabs playback error");
        resolve();
      };
      audio.play().catch((e) => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
        this.callbacks.onError?.(`Playback: ${e?.message ?? e}`);
        resolve();
      });
    });
  }
}
