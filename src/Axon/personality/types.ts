/**
 * src/Axon/personality/types.ts
 *
 * Foundation types for the Axon personality engine. Pure types +
 * a couple of helpers — no prose lives here. The prose lives in
 * personality-prompts.config.ts and is the source of truth for
 * what each band emits.
 *
 * Five bands per dimension (VERY_LOW / LOW / MID / HIGH / VERY_HIGH)
 * matches the operator preference: the middle band carries its own
 * distinct prose because most users will sit there. Linear scaling
 * was rejected because it produces mushy, non-reviewable prompts.
 */

// ── Dimensions ────────────────────────────────────────────────

/** 10 personality axes, each 0–100. */
export interface PersonalityDimensions {
  /** clinical ↔ affectionate */
  warmth: number;
  /** none ↔ constantly cracking jokes */
  humor: number;
  /** sincere ↔ dry/biting */
  sarcasm: number;
  /** casual buddy ↔ professional butler */
  formality: number;
  /** terse ↔ verbose */
  verbosity: number;
  /** waits to be asked ↔ anticipates needs */
  proactivity: number;
  /** neutral ↔ hype-man */
  encouragement: number;
  /** diplomatic ↔ brutally honest */
  directness: number;
  /** serious ↔ playful */
  playfulness: number;
  /** focused on task ↔ asks about your life */
  curiosity: number;
}

export type DimensionKey = keyof PersonalityDimensions;

export const DIMENSION_KEYS: readonly DimensionKey[] = [
  "warmth", "humor", "sarcasm", "formality", "verbosity",
  "proactivity", "encouragement", "directness", "playfulness", "curiosity",
] as const;

// ── Bands ─────────────────────────────────────────────────────

/** Five behavioral bands per dimension. Middle band gets its own
 *  prose so the most common values still produce a distinct voice. */
export type Band = "VERY_LOW" | "LOW" | "MID" | "HIGH" | "VERY_HIGH";

export const BANDS: readonly Band[] = [
  "VERY_LOW", "LOW", "MID", "HIGH", "VERY_HIGH",
] as const;

/** Bucket a 0–100 slider value to one of the five bands.
 *  Spec boundaries: VL 0–20, L 21–40, M 41–60, H 61–80, VH 81–100. */
export function toBand(value: number): Band {
  const v = Math.max(0, Math.min(100, value));
  if (v <= 20) return "VERY_LOW";
  if (v <= 40) return "LOW";
  if (v <= 60) return "MID";
  if (v <= 80) return "HIGH";
  return "VERY_HIGH";
}

// ── Presets ───────────────────────────────────────────────────

export type PresetKey =
  | "jarvis"
  | "samantha"
  | "hal_lite"
  | "best_friend"
  | "professor"
  | "operator"
  | "custom";

export const PRESET_KEYS: readonly PresetKey[] = [
  "jarvis", "samantha", "hal_lite", "best_friend",
  "professor", "operator", "custom",
] as const;

/** Each non-custom preset ships a fixed identity line + dimension
 *  values that pre-fill the sliders. "custom" reuses the operator's
 *  last-saved dimensions and a default identity. */
export interface PresetDefinition {
  key: PresetKey;
  displayName: string;
  tagline: string;
  /** One-line identity sentence that overrides the default
   *  "You are Axon" opener. Read before any dimension band prose. */
  identity: string;
  dimensions: PersonalityDimensions;
}

// ── Mood (envelope modifier on top of the base personality) ─

export type MoodTag =
  | "neutral"
  | "frustrated"
  | "excited"
  | "tired"
  | "sad"
  | "focused";

export const MOOD_TAGS: readonly MoodTag[] = [
  "neutral", "frustrated", "excited", "tired", "sad", "focused",
] as const;

// ── Time of day (used by relationship templates) ────────────

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late_night";

/** Local hour → TimeOfDay bucket. Mirrors the spec's four-bucket
 *  split; only morning and late_night emit prose (others stay
 *  neutral default). */
export function toTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late_night";
}

// ── Personality context (passed to composePersonalityPrompt) ─

/** Full context the composer needs to assemble a prompt. All fields
 *  are optional except mood + dimensions; the composer no-ops on
 *  missing values rather than rendering empty sections. */
export interface PersonalityContext {
  /** First name the operator wants to be called. Used in
   *  relationship + mood prose; composer no-ops if absent. */
  userName?: string;
  /** Days since first conversation. Drives the four relationship-
   *  age buckets (0-1 / 2-14 / 15-90 / 90+). */
  relationshipDays?: number;
  /** Mood tag derived from the latest user message. The composer
   *  appends a mood modifier section when non-neutral. */
  recentMoodSignal?: MoodTag;
  /** Pre-summarised memory blurbs ready to drop into the prompt
   *  verbatim. Cap to ~5 to keep the token budget sane. */
  recentMemories?: string[];
  /** Inside jokes / shared phrases. Cap to ~3. */
  insideJokes?: string[];
  /** Stated user preferences ("call me Ali"). Cap to ~5. */
  statedPreferences?: string[];
  /** Local time bucket. Only morning + late_night emit prose. */
  timeOfDay?: TimeOfDay;
}

/** @deprecated retained for callers using the old name; prefer
 *  PersonalityContext. */
export type RelationshipContext = PersonalityContext;

// ── Active settings (lives in localStorage; read by the composer) ─

export interface PersonalitySettings {
  /** The preset the operator picked. "custom" means they hand-tuned. */
  preset: PresetKey;
  /** Always present and complete; presets pre-fill it on selection. */
  dimensions: PersonalityDimensions;
  /** Reuses the existing voiceCatalog id from voiceOutput.ts. */
  voicePresetId?: string;
  /** ElevenLabs voice id override (already supported by voiceOutput). */
  elevenLabsVoiceId?: string;
  /** SSML upgrades land when this flips true (v3 model). For v2.5
   *  the post-processor only emits internal markers, not SSML. */
  ssmlEnabled?: boolean;
}

/** Default dimensions used when nothing has been saved yet. Every
 *  slider lands at 50 — squarely in the MID band per the
 *  0-20/21-40/41-60/61-80/81-100 boundaries — so a flag-on-
 *  untouched user gets the maximally neutral version of every
 *  dimension. Any personality the user sees from here on is a
 *  personality they chose, not one I smuggled in as a default. */
export const DEFAULT_DIMENSIONS: PersonalityDimensions = {
  warmth: 50,
  humor: 50,
  sarcasm: 50,
  formality: 50,
  verbosity: 50,
  proactivity: 50,
  encouragement: 50,
  directness: 50,
  playfulness: 50,
  curiosity: 50,
};

/** Default top-level settings when no localStorage value exists. */
export const DEFAULT_PERSONALITY_SETTINGS: PersonalitySettings = {
  preset: "custom",
  dimensions: DEFAULT_DIMENSIONS,
};
