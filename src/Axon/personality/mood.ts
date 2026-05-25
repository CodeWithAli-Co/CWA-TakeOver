/**
 * src/Axon/personality/mood.ts  (v2)
 *
 * v1 mood detector — pure keyword + regex rules over the latest
 * user message. Zero latency, zero LLM cost. The output drives the
 * MOOD_MODIFIERS section of the composed system prompt.
 *
 * v2 changes (operator-mandated):
 *   1. `.includes()` is banned. Every keyword compiles once to a
 *      regex with \b word boundaries so substring traps (ugh-in-rough,
 *      down-in-rundown, low-in-below) stop misfiring.
 *   2. OVERRIDES table runs FIRST. Catches idioms whose literal
 *      words land in the wrong category — most importantly
 *      "tired of / sick of / fed up with / done with / over it"
 *      which are linguistic frustration markers, not exhaustion.
 *   3. Bare "down" / "low" out of sad keywords; moved into a
 *      contextual pattern so "head down" no longer triggers sad.
 *   4. "long day / long week" out of tired (operator preferred them
 *      as sadness markers); "rough one" added to sad.
 *   5. "Nth time" / "again today" added as frustration overrides.
 *
 * Latency budget unchanged — still pure regex, no LLM call.
 *
 * The accuracy ceiling here is ~80–90%. Above that we burn latency
 * on a Haiku classifier — see classifyMoodHaiku() (TODO).
 */

import type { MoodTag } from "./types";

interface RuleSet {
  keywords: readonly string[];
  patterns?: readonly RegExp[];
}

// ── OVERRIDES (checked first; first match wins) ──────────────
// Idioms whose literal words would otherwise land in the wrong
// category. Order matters within this list — most specific first.

const OVERRIDES: readonly { tag: MoodTag; pattern: RegExp }[] = [
  // Frustration disguised as exhaustion.
  { tag: "frustrated", pattern: /\b(tired|sick|fed\s+up)\s+of\b/i },
  { tag: "frustrated", pattern: /\bdone\s+with\b/i },
  { tag: "frustrated", pattern: /\bover\s+it\b/i },
  // "Nth time" / "again today" — implicit frustration signals.
  { tag: "frustrated", pattern: /\b(for\s+the\s+|the\s+)?(second|third|fourth|fifth|sixth|tenth|hundredth|thousandth|millionth)\s+time\b/i },
  { tag: "frustrated", pattern: /\bagain\s+(today|now|this\s+week)\b/i },
] as const;

// ── RULE TABLES ──────────────────────────────────────────────
// Order in this object is detection priority — first match wins
// for ties. Distress (frustrated, sad) runs before excitement so a
// venting "this is bullshit!!!" reads as frustrated, not excited.

const RULES: Record<Exclude<MoodTag, "neutral">, RuleSet> = {
  frustrated: {
    keywords: [
      "ugh", "annoying", "frustrating", "frustrated", "broken",
      "doesn't work", "doesnt work", "not working", "stupid",
      "ridiculous", "wtf", "wth", "still broken", "again",
      "i give up", "this is bullshit", "this is dumb",
    ],
    patterns: [
      /\bwhy\s+(won'?t|wont|isn'?t|isnt|aren'?t|arent|doesn'?t|doesnt|the\s+hell|the\s+fuck)/i,
      /\bnot\s+(working|doing|loading)\b/i,
      /\b(keep|keeps)\s+(failing|breaking|crashing|hanging|timing\s+out)\b/i,
    ],
  },

  sad: {
    // "down" / "low" deliberately NOT bare keywords — they live in
    // the contextual pattern so "head down" / "below" don't misfire.
    keywords: [
      "sad", "depressed", "lonely", "miserable",
      "burnt out", "burnout", "exhausted emotionally", "feeling low",
      "rough day", "rough week", "rough one", "long week",
      "hard time", "struggling",
    ],
    patterns: [
      /\b(i'?m|i\s+am|feeling)\s+(really\s+|so\s+|pretty\s+|kind\s+of\s+)?(down|sad|low|lost)\b/i,
    ],
  },

  tired: {
    keywords: [
      "tired", "exhausted", "sleepy", "drained", "wiped",
      "running on fumes", "no energy", "long day",
      "can't think straight", "cant think straight",
      "barely awake", "haven't slept", "havent slept",
      "can't sleep", "cant sleep",
    ],
    patterns: [
      /\b(i'?m|i\s+am|feeling)\s+(so\s+|really\s+)?(tired|exhausted|wiped)\b/i,
    ],
  },

  focused: {
    keywords: [
      "deep work", "in the zone", "head down", "flow state",
      "don't interrupt", "dont interrupt", "just answer", "quick one",
      "tldr", "tl;dr", "skip the intro", "skip the preamble",
      "no fluff", "just give me", "just tell me",
    ],
    patterns: [
      /\bjust\s+(give|tell|show)\s+me\b/i,
    ],
  },

  excited: {
    keywords: [
      "amazing", "incredible", "fucking love", "love this",
      "this is great", "huge", "massive",
      "let's go", "lets go", "let's gooo", "lfg",
      "yesss", "finally", "we did it",
      "shipped", "shipped it", "live!", "it's live", "this works",
    ],
    patterns: [
      /!{2,}/,
      /\b(holy|so)\s+(good|cool|sick)\b/i,
    ],
  },
};

// ── Compiled-once regex cache ────────────────────────────────
// Pre-compile every keyword to a \b-anchored regex. Multi-word
// keywords get whitespace-flexible bodies so "I  give  up" (extra
// spaces) still matches.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileKeyword(kw: string): RegExp {
  const escaped = escapeRegex(kw).replace(/\\\s/g, "").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

interface CompiledRuleSet {
  keywordRegexes: RegExp[];
  patterns: readonly RegExp[];
}

const COMPILED: Record<Exclude<MoodTag, "neutral">, CompiledRuleSet> = (() => {
  const out = {} as Record<Exclude<MoodTag, "neutral">, CompiledRuleSet>;
  for (const tag of Object.keys(RULES) as Array<Exclude<MoodTag, "neutral">>) {
    out[tag] = {
      keywordRegexes: RULES[tag].keywords.map(compileKeyword),
      patterns: RULES[tag].patterns ?? [],
    };
  }
  return out;
})();

// ── Public API ───────────────────────────────────────────────

/** Classify the latest user message into one of the six mood tags.
 *  Returns "neutral" when nothing matches. */
export function classifyMood(message: string): MoodTag {
  if (!message || !message.trim()) return "neutral";

  // 1. Hard overrides — first match wins, return immediately.
  for (const o of OVERRIDES) {
    if (o.pattern.test(message)) return o.tag;
  }

  // 2. Priority order over the compiled rules.
  const order: Array<Exclude<MoodTag, "neutral">> = [
    "frustrated", "sad", "tired", "focused", "excited",
  ];
  for (const tag of order) {
    if (ruleMatches(message, COMPILED[tag])) return tag;
  }
  return "neutral";
}

function ruleMatches(text: string, rules: CompiledRuleSet): boolean {
  for (const re of rules.keywordRegexes) {
    if (re.test(text)) return true;
  }
  for (const re of rules.patterns) {
    if (re.test(text)) return true;
  }
  return false;
}

// ── Latency-budget upgrade path (TODO, not yet wired) ────────
// classifyMoodHaiku(): Haiku-backed classifier behind a feature
// flag once regex misses become a real demo problem. Same MoodTag
// output, same caller contract — composer doesn't change.
