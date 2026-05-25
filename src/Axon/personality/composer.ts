/**
 * src/Axon/personality/composer.ts  (v2)
 *
 * Pure string assembly — every word it emits comes from
 * personality-prompts.config.ts. Composer changes are mechanical;
 * personality changes are config edits.
 *
 * v2 changes (operator review):
 *   - DIMENSION_BUCKETS now exposes { label, prose } per band;
 *     composer reads .prose only. Labels never reach Claude.
 *   - "PERSONALITY DIMENSIONS:" and "RELATIONSHIP CONTEXT:"
 *     ALL-CAPS section headers removed. Prose flows as paragraphs.
 *   - "That\'s the shape of you. Underneath:" bridge inserted
 *     between preset identity and CORE_IDENTITY when a non-custom
 *     preset resolves.
 *   - Mood prose hoisted into the relationship section as its
 *     final paragraph (no "MOOD OVERRIDE — " prefix, no separate
 *     block). Reads as context, not a constitutional rule.
 *
 * Assembly order (v2):
 *   1. preset.identity        (if non-custom preset resolves)
 *   2. PRESET_BRIDGE          (if 1 emitted)
 *   3. CORE_IDENTITY
 *   4. per-dimension prose    (no headers, no labels)
 *   5. DIMENSION_HARD_RULES   (currently encouragement only)
 *   6. relationship + mood    (mood is the final paragraph here)
 *   7. HARD_CONSTRAINTS
 */

import {
  DIMENSION_KEYS,
  toBand,
  type DimensionKey,
  type PersonalityContext,
  type PersonalityDimensions,
  type PresetKey,
} from "./types";
import {
  CORE_IDENTITY,
  DIMENSION_BUCKETS,
  DIMENSION_HARD_RULES,
  HARD_CONSTRAINTS,
  MOOD_MODIFIERS,
  PRESETS,
  PRESET_BRIDGE,
  RELATIONSHIP_TEMPLATES,
  relationshipAgeBucket,
} from "./personality-prompts.config";

const TOKEN_BUDGET_CHAR_WARN = 2400;

/**
 * Compose the full personality system prompt.
 *
 * @param dimensions  10 sliders, 0–100 each. Required.
 * @param context     Optional user/relationship/mood context.
 * @param presetKey   Optional preset hint. When provided and not
 *                    "custom", the preset\'s identity line prepends
 *                    CORE_IDENTITY (with the bridge between).
 *                    Without it, the composer attempts to recover
 *                    the preset by exact dimension match.
 */
export function composePersonalityPrompt(
  dimensions: PersonalityDimensions,
  context: PersonalityContext = {},
  presetKey?: PresetKey,
): string {
  const sections: string[] = [];

  // 1 + 2. Preset identity + bridge.
  const identity = resolvePresetIdentity(dimensions, presetKey);
  if (identity) {
    sections.push(identity);
    sections.push(PRESET_BRIDGE);
  }

  // 3. Core identity.
  sections.push(CORE_IDENTITY);

  // 4. Dimension prose — no headers, no labels, just paragraphs.
  for (const key of DIMENSION_KEYS) {
    const band = toBand(dimensions[key]);
    const entry = DIMENSION_BUCKETS[key]?.[band];
    if (entry?.prose) sections.push(entry.prose);
  }

  // 5. Dimension hard rules (always-on, band-agnostic).
  for (const key of DIMENSION_KEYS) {
    const rule = DIMENSION_HARD_RULES[key];
    if (rule) sections.push(rule);
  }

  // 6. Relationship + mood (merged — mood is the closing paragraph).
  const rel = composeRelationshipAndMood(context);
  if (rel) sections.push(rel);

  // 7. Hard constraints (always last).
  sections.push(HARD_CONSTRAINTS);

  const out = sections.join("\n\n");

  if (out.length > TOKEN_BUDGET_CHAR_WARN) {
    console.warn(
      `[personality] composed prompt is ${out.length} chars ` +
      `(>${TOKEN_BUDGET_CHAR_WARN}). Consider trimming bucket prose ` +
      `or relationship context.`,
    );
  }

  return out;
}

// ── Helpers ──────────────────────────────────────────────────

/** Resolves the preset identity line that prepends CORE_IDENTITY.
 *  Returns null when no identity override should apply. */
function resolvePresetIdentity(
  dimensions: PersonalityDimensions,
  presetKey: PresetKey | undefined,
): string | null {
  if (presetKey && presetKey !== "custom") {
    return PRESETS[presetKey]?.identity ?? null;
  }
  if (presetKey === "custom") return null;

  for (const def of Object.values(PRESETS)) {
    if (dimensionsExactlyMatch(dimensions, def.dimensions)) {
      return def.identity;
    }
  }
  return null;
}

function dimensionsExactlyMatch(
  a: PersonalityDimensions,
  b: PersonalityDimensions,
): boolean {
  for (const key of DIMENSION_KEYS) {
    if (a[key as DimensionKey] !== b[key as DimensionKey]) return false;
  }
  return true;
}

/** Builds the relationship block as a single flowing section,
 *  with mood prose appended as the final paragraph. Returns "" when
 *  nothing relevant exists (no name, no days, no memories, no
 *  jokes, no prefs, no timeOfDay, neutral mood). */
function composeRelationshipAndMood(ctx: PersonalityContext): string {
  const lines: string[] = [];
  const userName = ctx.userName?.trim();
  const subs = {
    userName: userName ?? "the user",
    relationshipDays: String(ctx.relationshipDays ?? 0),
  };

  if (userName) {
    lines.push(substitute(RELATIONSHIP_TEMPLATES.userName, subs));
  }

  if (typeof ctx.relationshipDays === "number" && ctx.relationshipDays >= 0) {
    const bucketKey = relationshipAgeBucket(ctx.relationshipDays);
    const template = RELATIONSHIP_TEMPLATES.ageBuckets[bucketKey];
    if (template) lines.push(substitute(template, subs));
  }

  const memories = (ctx.recentMemories ?? []).slice(0, 5);
  if (memories.length > 0) {
    lines.push(
      [
        substitute(RELATIONSHIP_TEMPLATES.recentMemoriesHeader, subs),
        ...memories.map((m) => `- ${m.trim()}`),
        RELATIONSHIP_TEMPLATES.recentMemoriesFooter,
      ].join("\n"),
    );
  }

  const jokes = (ctx.insideJokes ?? []).slice(0, 3);
  if (jokes.length > 0) {
    lines.push(
      [
        substitute(RELATIONSHIP_TEMPLATES.insideJokesHeader, subs),
        ...jokes.map((j) => `- ${j.trim()}`),
        RELATIONSHIP_TEMPLATES.insideJokesFooter,
      ].join("\n"),
    );
  }

  const prefs = (ctx.statedPreferences ?? []).slice(0, 5);
  if (prefs.length > 0) {
    lines.push(
      [
        substitute(RELATIONSHIP_TEMPLATES.statedPreferencesHeader, subs),
        ...prefs.map((p) => `- ${p.trim()}`),
      ].join("\n"),
    );
  }

  if (ctx.timeOfDay) {
    const template = RELATIONSHIP_TEMPLATES.timeOfDay[ctx.timeOfDay];
    if (template) lines.push(substitute(template, subs));
  }

  // Mood — flows as the closing paragraph of this section. No
  // separate header, no "MOOD OVERRIDE —" prefix. Reads as the
  // most recent piece of context.
  const moodTag = ctx.recentMoodSignal;
  if (moodTag && moodTag !== "neutral") {
    const moodTemplate = MOOD_MODIFIERS[moodTag];
    if (moodTemplate) lines.push(substitute(moodTemplate, subs));
  }

  if (lines.length === 0) return "";
  return lines.join("\n\n");
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ── Public re-exports for the playground / debug surfaces ────

export {
  CORE_IDENTITY,
  DIMENSION_BUCKETS,
  DIMENSION_HARD_RULES,
  HARD_CONSTRAINTS,
  MOOD_MODIFIERS,
  PRESETS,
  PRESET_BRIDGE,
  RELATIONSHIP_TEMPLATES,
  SPEC_VERSION,
} from "./personality-prompts.config";

export { toBand, toTimeOfDay, DIMENSION_KEYS, BANDS, MOOD_TAGS, PRESET_KEYS } from "./types";
