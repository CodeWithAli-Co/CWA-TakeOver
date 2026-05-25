/**
 * src/Axon/personality/settings.ts
 *
 * localStorage-backed persistence + per-turn live-read helpers for
 * the personality engine. No React state, no provider context — the
 * runTurn caller invokes these synchronously every turn so flag
 * flips and slider changes pick up without a reload.
 *
 * Keys (all under axon: namespace, all optional):
 *   axon:settings:personalityEnabled  boolean  master kill switch
 *   axon:settings:personality         JSON     persisted PersonalitySettings
 *   axon:relationship:firstSeenAt     number   ms epoch; set on first turn
 *
 * When the flag key is missing or false, callers pass undefined for
 * all three personality fields and brain.ts emits the 1-block
 * cached system — production-equivalent behavior.
 */

import {
  DEFAULT_PERSONALITY_SETTINGS,
  toTimeOfDay,
  type PersonalityContext,
  type PersonalityDimensions,
  type PersonalitySettings,
} from "./types";
import { PRESETS } from "./personality-prompts.config";
import { classifyMood } from "./mood";

const ENABLED_KEY = "axon:settings:personalityEnabled";
const SETTINGS_KEY = "axon:settings:personality";
const RELATIONSHIP_KEY = "axon:relationship:firstSeenAt";

// ── Feature flag ─────────────────────────────────────────────

/** Live read every turn — no caching, no memoization. Returns
 *  false when key missing, malformed, or storage unavailable. */
export function isPersonalityEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Programmatic flip — settings UI will call this once it lands. */
export function setPersonalityEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    /* private mode / quota — drop silently */
  }
}

// ── Persisted PersonalitySettings ────────────────────────────

/** Returns the persisted PersonalitySettings, or DEFAULT when none
 *  exist yet. Shallow-merges over defaults so partial saves can\'t
 *  brick callers expecting full shape. */
export function readPersonalitySettings(): PersonalitySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PERSONALITY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PersonalitySettings>;
    if (!parsed?.dimensions || typeof parsed.dimensions !== "object") {
      return DEFAULT_PERSONALITY_SETTINGS;
    }
    return {
      ...DEFAULT_PERSONALITY_SETTINGS,
      ...parsed,
      dimensions: {
        ...DEFAULT_PERSONALITY_SETTINGS.dimensions,
        ...parsed.dimensions,
      },
    } as PersonalitySettings;
  } catch {
    return DEFAULT_PERSONALITY_SETTINGS;
  }
}

export function writePersonalitySettings(s: PersonalitySettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ── Dimension resolution ─────────────────────────────────────

/** Returns the dimensions the composer should use this turn.
 *  When a preset is selected we always use the preset\'s canonical
 *  values — even if the user nudged sliders since picking the preset,
 *  the preset key is the source of truth. Custom uses saved sliders. */
export function resolveDimensions(s: PersonalitySettings): PersonalityDimensions {
  if (s.preset !== "custom" && PRESETS[s.preset]) {
    return PRESETS[s.preset].dimensions;
  }
  return s.dimensions;
}

// ── PersonalityContext builder ───────────────────────────────

/** Inputs the provider already has — userName from the operator,
 *  latestUserMessage from the inbound voice/chat. Everything else
 *  derives from clock + localStorage. */
export interface BuildContextArgs {
  userName?: string;
  latestUserMessage?: string;
  /** Optional override for unit tests. */
  now?: Date;
}

export function buildPersonalityContext(args: BuildContextArgs): PersonalityContext {
  const now = args.now ?? new Date();
  const mood = args.latestUserMessage
    ? classifyMood(args.latestUserMessage)
    : "neutral";
  return {
    userName: args.userName,
    relationshipDays: readRelationshipDays(now),
    recentMoodSignal: mood,
    timeOfDay: toTimeOfDay(now.getHours()),
    // recentMemories / insideJokes / statedPreferences land when the
    // memory pipeline ships (Pillar 3 of the spec). Composer no-ops
    // gracefully on the missing fields until then.
  };
}

// ── Relationship age ─────────────────────────────────────────

/** Returns whole days since first turn (clamped ≥0). Stamps the
 *  current time on first call so the next read picks it up. */
function readRelationshipDays(now: Date): number {
  try {
    let raw = localStorage.getItem(RELATIONSHIP_KEY);
    if (!raw) {
      raw = String(now.getTime());
      localStorage.setItem(RELATIONSHIP_KEY, raw);
    }
    const firstSeenMs = Number(raw);
    if (!Number.isFinite(firstSeenMs)) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((now.getTime() - firstSeenMs) / dayMs));
  } catch {
    return 0;
  }
}

/** Reset the relationship clock — for dev / debugging. Settings UI
 *  exposes this when memory transparency lands. */
export function resetRelationshipClock(): void {
  try { localStorage.removeItem(RELATIONSHIP_KEY); } catch { /* ignore */ }
}

/** Stamp `firstSeenAt` now if no stamp exists. Called when the
 *  master toggle flips ON for the first time, so the relationship
 *  clock measures "how long has this user had personality enabled"
 *  rather than "how long since their first composed turn." */
export function stampFirstSeenIfMissing(): void {
  try {
    if (!localStorage.getItem(RELATIONSHIP_KEY)) {
      localStorage.setItem(RELATIONSHIP_KEY, String(Date.now()));
    }
  } catch { /* ignore */ }
}

/** Wipe persisted personality settings (preset + sliders). Does NOT
 *  touch the master enabled flag, the relationship clock, or the
 *  opening-history tracker — those are separate concerns per the
 *  namespace contract. The "Reset to defaults" button in the
 *  Personality section calls this. */
export function resetPersonalitySettings(): void {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* ignore */ }
}

// ── Convenience: one-call payload for the runTurn caller ─────

/** Returns the three personality fields to splat into BrainRunOpts.
 *  When the flag is OFF, all three are undefined and brain.ts emits
 *  the 1-block cached system. Call this LIVE every turn. */
export interface PersonalityTurnPayload {
  personalityDimensions?: PersonalityDimensions;
  personalityContext?: PersonalityContext;
  personalityPresetKey?: PersonalitySettings["preset"];
}

export function getPersonalityTurnPayload(args: BuildContextArgs): PersonalityTurnPayload {
  if (!isPersonalityEnabled()) return {};
  const settings = readPersonalitySettings();
  return {
    personalityDimensions: resolveDimensions(settings),
    personalityContext: buildPersonalityContext(args),
    personalityPresetKey: settings.preset,
  };
}
