// ───────────────────────────────────────────────────────────────────
// Voice Catalog — curated TTS presets for AXON.
//
// Each preset bundles:
//   • ElevenLabs voice id (when available — best quality)
//   • A list of Web Speech name patterns to try as fallback
//   • Default rate/pitch tuned for the preset (smoother cadence)
//
// Picking a preset via `set_voice` or the Settings panel writes the
// preset's id, the matching ElevenLabs id, AND the preset's tuned
// rate/pitch into AxonSettings — so switching voices feels like
// switching voice actors, not just relabeling.
// ───────────────────────────────────────────────────────────────────

export type VoiceAccent = "british" | "american" | "australian" | "neutral";
export type VoiceGender = "male" | "female" | "neutral";

export interface VoicePreset {
  /** Stable identifier — used in actions and settings. */
  id: string;
  /** Display label for UI + voice prompts. */
  label: string;
  /** One-line personality cue. */
  description: string;
  accent: VoiceAccent;
  gender: VoiceGender;
  /** Public ElevenLabs voice id (or null = Web-Speech only). */
  elevenLabsVoiceId: string | null;
  /** Web Speech voice name candidates (matched in order). */
  webSpeechCandidates: string[];
  /** Preferred rate (0.5–2). */
  rate: number;
  /** Preferred pitch (0–2). */
  pitch: number;
  /** ElevenLabs voice_settings — tuned per preset for smoothness. */
  elevenLabsSettings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  /** Sort order in pickers. */
  sort: number;
}

// Smooth defaults — higher stability, lower style = less jitter.
const SMOOTH_TUNED = {
  stability: 0.55,
  similarity_boost: 0.8,
  style: 0.1,
  use_speaker_boost: true,
} as const;

// Slightly more expressive for personalities (Charlotte, Dorothy).
const EXPRESSIVE_TUNED = {
  stability: 0.45,
  similarity_boost: 0.78,
  style: 0.25,
  use_speaker_boost: true,
} as const;

export const VOICE_PRESETS: VoicePreset[] = [
  // ─── BRITISH ──────────────────────────────────────────────────────
  {
    id: "british-george",
    label: "George — British warm",
    description:
      "Warm British male. Calm, measured, slightly aristocratic. Default for British accent requests.",
    accent: "british",
    gender: "male",
    elevenLabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
    webSpeechCandidates: [
      "Google UK English Male",
      "Daniel",
      "Daniel (Enhanced)",
      "Microsoft George - English (United Kingdom)",
      "Oliver",
      "Arthur",
    ],
    rate: 0.96,
    pitch: 0.92,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 10,
  },
  {
    id: "british-daniel",
    label: "Daniel — British news",
    description:
      "Authoritative British male, BBC-newsreader cadence. Crisp, professional.",
    accent: "british",
    gender: "male",
    elevenLabsVoiceId: "onwK4e9ZLuTAKqWW03F9",
    webSpeechCandidates: [
      "Daniel",
      "Google UK English Male",
      "Microsoft Ryan - English (United Kingdom)",
      "Oliver",
    ],
    rate: 1.0,
    pitch: 0.95,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 11,
  },
  {
    id: "british-lily",
    label: "Lily — British calm",
    description:
      "Soft British female, calm and articulate. Great for long readouts.",
    accent: "british",
    gender: "female",
    elevenLabsVoiceId: "pFZP5JQG7iQjIQuC4Bku",
    webSpeechCandidates: [
      "Google UK English Female",
      "Kate",
      "Microsoft Sonia - English (United Kingdom)",
      "Microsoft Libby - English (United Kingdom)",
      "Serena",
    ],
    rate: 0.97,
    pitch: 1.0,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 12,
  },
  {
    id: "british-charlotte",
    label: "Charlotte — British expressive",
    description:
      "Lightly accented English female with personality and warmth.",
    accent: "british",
    gender: "female",
    elevenLabsVoiceId: "XB0fDUnXU5powFXDhCwa",
    webSpeechCandidates: [
      "Google UK English Female",
      "Microsoft Sonia - English (United Kingdom)",
      "Kate",
    ],
    rate: 1.0,
    pitch: 1.02,
    elevenLabsSettings: EXPRESSIVE_TUNED,
    sort: 13,
  },
  {
    id: "british-dorothy",
    label: "Dorothy — British storyteller",
    description:
      "Pleasant British young-female voice with a storyteller's lilt.",
    accent: "british",
    gender: "female",
    elevenLabsVoiceId: "ThT5KcBeYPX3keUQqHPh",
    webSpeechCandidates: [
      "Google UK English Female",
      "Kate",
      "Microsoft Libby - English (United Kingdom)",
    ],
    rate: 1.0,
    pitch: 1.05,
    elevenLabsSettings: EXPRESSIVE_TUNED,
    sort: 14,
  },

  // ─── AMERICAN ─────────────────────────────────────────────────────
  {
    id: "american-adam",
    label: "Adam — American deep",
    description:
      "Deep, measured American male. Movie-trailer presence.",
    accent: "american",
    gender: "male",
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB",
    webSpeechCandidates: [
      "Microsoft Guy Online (Natural) - English (United States)",
      "Alex",
      "Microsoft David - English (United States)",
      "Daniel (English (United States))",
    ],
    rate: 1.0,
    pitch: 0.9,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 20,
  },
  {
    id: "american-brian",
    label: "Brian — American resonant",
    description: "Resonant, calm American male. Smoother than Adam.",
    accent: "american",
    gender: "male",
    elevenLabsVoiceId: "nPczCjzI2devNBz1zQrb",
    webSpeechCandidates: [
      "Microsoft Guy Online (Natural) - English (United States)",
      "Alex",
      "Microsoft David - English (United States)",
    ],
    rate: 1.0,
    pitch: 0.95,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 21,
  },
  {
    id: "american-rachel",
    label: "Rachel — American calm",
    description: "Calm, professional American female.",
    accent: "american",
    gender: "female",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
    webSpeechCandidates: [
      "Microsoft Aria Online (Natural) - English (United States)",
      "Samantha",
      "Microsoft Zira - English (United States)",
    ],
    rate: 1.0,
    pitch: 1.0,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 22,
  },
  {
    id: "american-matilda",
    label: "Matilda — American friendly",
    description: "Friendly, conversational American female.",
    accent: "american",
    gender: "female",
    elevenLabsVoiceId: "XrExE9yKIg1WjnnlVkGX",
    webSpeechCandidates: [
      "Microsoft Aria Online (Natural) - English (United States)",
      "Samantha",
    ],
    rate: 1.02,
    pitch: 1.05,
    elevenLabsSettings: EXPRESSIVE_TUNED,
    sort: 23,
  },

  // ─── AUSTRALIAN ───────────────────────────────────────────────────
  {
    id: "australian-charlie",
    label: "Charlie — Australian casual",
    description: "Casual, conversational Australian male.",
    accent: "australian",
    gender: "male",
    elevenLabsVoiceId: "IKne3meq5aSn9XLyUdCD",
    webSpeechCandidates: [
      "Karen",
      "Microsoft William - English (Australia)",
      "Lee",
    ],
    rate: 1.0,
    pitch: 0.95,
    elevenLabsSettings: SMOOTH_TUNED,
    sort: 30,
  },
];

export function getVoicePreset(id: string | null | undefined): VoicePreset | null {
  if (!id) return null;
  return VOICE_PRESETS.find((p) => p.id === id) ?? null;
}

export function getDefaultPresetId(): string {
  return "british-george";
}

/**
 * Match a Web Speech voice from the available list, in preset's preferred
 * order. Falls back to any voice tagged en-GB / en-US matching gender hint.
 */
export function pickWebSpeechVoiceForPreset(
  preset: VoicePreset,
  available: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (available.length === 0) return null;
  // Exact name match against the preset's candidate list.
  for (const candidate of preset.webSpeechCandidates) {
    const v = available.find(
      (x) => x.name === candidate || x.name.startsWith(candidate)
    );
    if (v) return v;
  }
  // Fall back to language-tag match (en-GB for British, en-US for American).
  const langTag =
    preset.accent === "british"
      ? "en-GB"
      : preset.accent === "australian"
        ? "en-AU"
        : "en-US";
  const langMatch = available.filter((v) => v.lang.replace("_", "-") === langTag);
  if (langMatch.length > 0) {
    // Prefer one whose name hints at the same gender.
    const genderRegex =
      preset.gender === "male"
        ? /(male|man|guy|daniel|alex|david|mark|fred|george|oliver)/i
        : preset.gender === "female"
          ? /(female|woman|girl|sonia|aria|zira|samantha|kate|emma|lily|libby)/i
          : /./;
    const gendered = langMatch.find((v) => genderRegex.test(v.name));
    return gendered ?? langMatch[0];
  }
  // Final fallback — any English voice.
  return available.find((v) => /^en/i.test(v.lang)) ?? available[0];
}

export function presetsByAccent(): Record<VoiceAccent, VoicePreset[]> {
  const out: Record<VoiceAccent, VoicePreset[]> = {
    british: [],
    american: [],
    australian: [],
    neutral: [],
  };
  for (const p of VOICE_PRESETS) out[p.accent].push(p);
  for (const k of Object.keys(out) as VoiceAccent[]) {
    out[k].sort((a, b) => a.sort - b.sort);
  }
  return out;
}
