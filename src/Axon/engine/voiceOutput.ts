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

// ── Startup diagnostic ────────────────────────────────────────
// Loud, one-shot log of the ElevenLabs key state so this entire
// class of "voice silently fell back" bug never reaches a test
// session unannounced again. Module-level: fires once at import.
if (typeof window !== "undefined") {
  if (!ELEVENLABS_API_KEY) {
    console.error(
      "[voiceOutput] VITE_ELEVENLABS_API_KEY is MISSING. Axon will " +
      "fall back to the browser's Web Speech API for ALL voice output. " +
      "Voice quality will be degraded — no ElevenLabs voices, no audio " +
      "tags, no v3 model. Add the key to .env at the project root and " +
      "RESTART `vite dev` (env is captured at server boot).",
    );
  } else {
    // Light info on the happy path so we can spot the key going stale
    // if it ever stops working mid-session for a different reason.
    console.info(
      "[voiceOutput] ElevenLabs API key loaded (length=" +
      ELEVENLABS_API_KEY.length + "). v3 path active.",
    );
  }
}

/** One-shot guard so the per-turn fallback log doesn't spam every
 *  sentence with the same warning. Each unique reason logs once
 *  per page load. */
const loggedFallbackReasons = new Set<string>();
function logFallbackOnce(reason: string, detail: Record<string, unknown> = {}): void {
  if (loggedFallbackReasons.has(reason)) return;
  loggedFallbackReasons.add(reason);
  console.error(`[voiceOutput] falling back to Web Speech — ${reason}`, detail);
}

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

  /** Resolve which voice path (ElevenLabs vs Web Speech) to use this turn.
   *  Centralized so drain() + the prefetch path agree, and the
   *  fallback diagnostic only logs in one place. */
  private resolveVoicePath(): { kind: "eleven"; voiceId: string } | { kind: "web" } {
    const presetEleven =
      getVoicePreset(this.config.voicePresetId ?? null)?.elevenLabsVoiceId ?? null;
    const effectiveEleven = presetEleven ?? this.config.elevenLabsVoiceId;
    if (effectiveEleven && ELEVENLABS_API_KEY) {
      return { kind: "eleven", voiceId: effectiveEleven };
    }
    if (!ELEVENLABS_API_KEY) {
      logFallbackOnce("VITE_ELEVENLABS_API_KEY env var not set", {
        presetVoiceId: presetEleven,
        configVoiceId: this.config.elevenLabsVoiceId,
        activePreset: this.config.voicePresetId,
      });
    } else if (!effectiveEleven) {
      logFallbackOnce("no ElevenLabs voice id resolved", {
        activePreset: this.config.voicePresetId,
        presetHasVoiceId: presetEleven !== null,
        configVoiceId: this.config.elevenLabsVoiceId,
      });
    }
    return { kind: "web" };
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    const myGen = this.gen;
    this.callbacks.onStart?.();

    // ── Prefetch buffer ───────────────────────────────────────
    // Holds the next sentence's decoded ElevenLabs blob ready-to-play.
    // While sentence N is audibly playing, we eagerly fetch sentence
    // N+1 in parallel so the next playback starts the instant the
    // previous one ends — closing the network-round-trip gap that
    // was being heard as "Axon pauses too long between sentences."
    // Only used on the ElevenLabs path; Web Speech can't prefetch
    // (browser API doesn't expose the synthesized audio).
    let prefetched: Promise<HTMLAudioElement | null> | null = null;

    const startFetch = (text: string, voiceId: string): Promise<HTMLAudioElement | null> => {
      return this.fetchElevenLabsAudio(text, myGen, voiceId).catch((e) => {
        console.error("[voiceOutput] prefetch failed:", e, {
          text: text.slice(0, 120),
        });
        return null;
      });
    };

    while ((this.queue.length > 0 || prefetched) && this.gen === myGen) {
      // Acquire the current sentence's audio. Either it was already
      // prefetched while the prior one played, or this is the first
      // pass through and we have to kick the fetch off now.
      let audioPromise: Promise<HTMLAudioElement | null> | null = null;
      let nextText: string | null = null;
      const path = this.resolveVoicePath();

      if (prefetched) {
        audioPromise = prefetched;
        prefetched = null;
      } else if (this.queue.length > 0) {
        nextText = this.queue.shift()!;
        if (path.kind === "eleven") {
          audioPromise = startFetch(nextText, path.voiceId);
        }
      }

      // Kick off the NEXT sentence's fetch in parallel (only on the
      // ElevenLabs path — Web Speech doesn't pre-synthesize). This is
      // the bit that erases the inter-sentence network gap.
      if (path.kind === "eleven" && this.queue.length > 0) {
        const lookahead = this.queue.shift()!;
        prefetched = startFetch(lookahead, path.voiceId);
      }

      try {
        if (audioPromise) {
          const audio = await audioPromise;
          if (this.gen !== myGen) break;
          if (audio) {
            await this.playPreparedAudio(audio, myGen);
          }
        } else if (nextText !== null) {
          // Web Speech path (no prefetch possible).
          await this.speakWebSpeech(nextText, myGen);
        }
      } catch (e) {
        // Bumped from warn to error — voice failures should be loud.
        // Includes the failing text so the operator can correlate
        // with what they just heard (or didn't hear).
        console.error("[voiceOutput] sentence playback failed:", e, {
          text: (nextText ?? "").slice(0, 120),
        });
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
      console.error("[voiceOutput] Web Speech API also unavailable — Axon will be silent.");
      this.callbacks.onError?.("Speech synthesis not available.");
      return;
    }
    if (this.gen !== genAtCall) return;
    const voices = await getAvailableVoices();
    const preset = getVoicePreset(this.config.voicePresetId ?? null);
    const voice = pickVoice(preset, this.config.preferredVoice, voices);
    // Only logs the first time per page load to avoid spamming. The
    // voice name + lang tells the operator which OS voice is being
    // used as the fallback (Microsoft David, Google UK English Male,
    // etc.) — useful when diagnosing "why does Axon sound like X."
    logFallbackOnce("Web Speech voice selected", {
      name: voice?.name ?? "(none — browser default)",
      lang: voice?.lang ?? "(unknown)",
      presetId: this.config.voicePresetId,
    });
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

  /** Sentence-end punctuation strip for the voice path. v3 treats a
   *  trailing period / question mark / exclamation as "end of utterance"
   *  and pads the synthesized audio with ~400ms of dead silence. Stripping
   *  the terminal punctuation just before the API call removes most of
   *  that padding while keeping the natural prosodic contour intact
   *  (the model still infers statement/question shape from word order).
   *  Display text is unaffected — only the voice payload. */
  private trimTerminalPunctForVoice(text: string): string {
    return text.replace(/[\.!\?…]+\s*$/u, "").trim();
  }

  /** Fetch the ElevenLabs blob for a sentence and prep an Audio
   *  element ready to play. Returns null if the gen counter rolled
   *  (caller interrupted) or the API errored. Pure fetch — no
   *  playback side effects. */
  private async fetchElevenLabsAudio(
    text: string,
    genAtCall: number,
    voiceId: string,
  ): Promise<HTMLAudioElement | null> {
    if (!ELEVENLABS_API_KEY || !voiceId) {
      throw new Error("ElevenLabs not configured");
    }
    if (this.gen !== genAtCall) return null;

    const preset = getVoicePreset(this.config.voicePresetId ?? null);
    // v3 fallback when a preset doesn't carry an elevenLabsSettings
    // override. Matches SMOOTH_TUNED in voiceCatalog.ts. v3 doesn't
    // honor use_speaker_boost; speed is controlled via audio tags
    // rather than a slider, so both are omitted from the request.
    const voice_settings = preset?.elevenLabsSettings ?? {
      stability: 0.50,
      similarity_boost: 0.75,
      style: 0.40,
    };

    const voicePayload = this.trimTerminalPunctForVoice(cadence(text));

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: voicePayload,
          model_id: "eleven_v3",
          voice_settings,
        }),
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      // Loud — most common cause is invalid/expired key (401), tier
      // mismatch (403), rate limit (429), or model deprecation (400).
      // The msg body usually carries the specific reason.
      console.error("[voiceOutput] ElevenLabs HTTP error", {
        status: res.status,
        statusText: res.statusText,
        body: msg.slice(0, 400),
        voiceId,
        model_id: "eleven_v3",
      });
      throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 160)}`);
    }

    const blob = await res.blob();
    if (this.gen !== genAtCall) return null;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = this.config.volume;
    // Rate influences speed on HTMLAudio too. Preset rate wins.
    const effectiveRate = preset?.rate ?? this.config.rate;
    audio.playbackRate = Math.max(0.5, Math.min(2, effectiveRate));
    // Stash the URL on the element so playPreparedAudio can revoke
    // it after playback (or after a skipped interrupt). Avoids a
    // closure-over-url leak.
    (audio as any).__cwaBlobUrl = url;
    return audio;
  }

  /** Play an Audio element that was already prepared (and possibly
   *  prefetched while the previous sentence was still speaking).
   *  Resolves when playback ends or errors. */
  private async playPreparedAudio(audio: HTMLAudioElement, genAtCall: number): Promise<void> {
    if (this.gen !== genAtCall) {
      const url = (audio as any).__cwaBlobUrl as string | undefined;
      if (url) URL.revokeObjectURL(url);
      return;
    }
    this.currentAudio = audio;
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        const url = (audio as any).__cwaBlobUrl as string | undefined;
        if (url) URL.revokeObjectURL(url);
        if (this.currentAudio === audio) this.currentAudio = null;
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        console.error("[voiceOutput] HTMLAudio playback failed for ElevenLabs blob", {
          audioError: audio.error,
        });
        this.callbacks.onError?.("ElevenLabs playback error");
        resolve();
      };
      audio.play().catch((e) => {
        cleanup();
        this.callbacks.onError?.(`Playback: ${e?.message ?? e}`);
        resolve();
      });
    });
  }
}
