// ───────────────────────────────────────────────────────────────────
// Persistent memory — small local store that survives reload.
//
// This is NOT user data, company data, or anything sensitive. It's a
// lightweight continuity layer so AXON can say "last time we talked
// about the budget review" or "you prefer tasks at end of week."
//
// Capped by size + age so the file can never grow unbounded.
// ───────────────────────────────────────────────────────────────────

import { AXON_MEMORY_KEY } from "../config";

export interface MemoryNote {
  id: string;
  text: string;
  ts: number; // epoch ms
  kind: "topic" | "preference" | "note";
}

/** A compressed snapshot of one work session — added when the in-flight
 *  summarizer condenses old turns. Surfaced in the next session's
 *  preamble so AXON has continuity across reloads. */
export interface SessionSummary {
  id: string;
  /** When this session ran. */
  ts: number;
  /** The compressed text the brain produced. */
  summary: string;
}

/** A decision the operator made and committed to during a session. */
export interface DecisionEntry {
  id: string;
  ts: number;
  /** "We're going with X." / "Yes, do that." */
  text: string;
}

/** Something the operator put off. */
export interface DeferEntry {
  id: string;
  ts: number;
  /** "Not now / later / next week / I'll come back to that." */
  text: string;
}

/**
 * Structured operator profile -- the "Axon actually knows you" layer.
 *
 * Distinct from `prefs` (which is free-form k/v) because each field
 * here has KNOWN SEMANTICS that the context-aware preamble uses to
 * decide when to surface it.
 *
 * Example: lunch_time is only injected into the brain's context near
 * actual lunch hours. partner_name surfaces only when the recent
 * conversation has personal context. workday_end surfaces in the
 * end-of-day window. Surfacing every field every turn would be
 * wasteful and creepy ("hi Ali, your wife Sarah and I have been
 * thinking about your overdue tasks" -- no). The profile fields are
 * the inputs to a TASTEFUL injection policy.
 *
 * All fields are optional. Operators set what they want, leave
 * everything else blank. extras is the escape hatch for facts that
 * don't fit a known field -- the preamble surfaces those only when
 * the operator explicitly asks "what do you know about me."
 */
export interface OperatorProfile {
  // ── Personal ──────────────────────────────────────────────────
  partner_name?: string;
  family?: string;
  location?: string;
  timezone?: string;

  // ── Routine (time-of-day relevant) ─────────────────────────────
  workday_start?: string; // human-readable: "8am"
  workday_end?: string;
  lunch_time?: string;
  focus_block?: string;
  exercise?: string;

  // ── Style (cheap to always include) ────────────────────────────
  comm_style?: string;
  avoid_topics?: string[];

  // ── Goals & stressors (surfaces in coaching contexts) ──────────
  current_focus?: string;
  stressors?: string[];
  wins?: string[];

  // ── Catch-all ─────────────────────────────────────────────────
  extras?: Record<string, string>;
}

const EMPTY_PROFILE: OperatorProfile = {};

export interface PersistentMemory {
  notes: MemoryNote[];
  /** Last session timestamp. Used to say "welcome back after X hours." */
  lastSeen: number;
  /** Free-form preferences keyed by name. */
  prefs: Record<string, string>;
  /** Compressed snapshots of past sessions — newest at the end. */
  sessionSummaries: SessionSummary[];
  /** Decisions captured during sessions. */
  decisions: DecisionEntry[];
  /** Things the operator deferred during sessions. */
  defers: DeferEntry[];
  /** Structured operator profile (F.3). The "knows you" layer. */
  profile: OperatorProfile;
}

const EMPTY: PersistentMemory = {
  notes: [],
  lastSeen: 0,
  prefs: {},
  sessionSummaries: [],
  decisions: [],
  defers: [],
  profile: { ...EMPTY_PROFILE },
};
const MAX_NOTES = 24;
/** Cap on session summaries kept in memory. After this we shift the
 *  oldest off — operators don't need recap-from-three-months-ago. */
const MAX_SESSION_SUMMARIES = 12;
/** Cap on decisions / defers. Older ones age out via MAX_AGE_MS. */
const MAX_DECISIONS = 30;
const MAX_DEFERS = 30;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function loadMemory(): PersistentMemory {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(AXON_MEMORY_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PersistentMemory>;
    const cutoff = Date.now() - MAX_AGE_MS;
    return {
      notes: (parsed.notes ?? [])
        .filter((n) => n && n.ts >= cutoff)
        .slice(-MAX_NOTES),
      prefs: parsed.prefs ?? {},
      lastSeen: parsed.lastSeen ?? 0,
      sessionSummaries: (parsed.sessionSummaries ?? []).slice(
        -MAX_SESSION_SUMMARIES,
      ),
      decisions: (parsed.decisions ?? [])
        .filter((d) => d && d.ts >= cutoff)
        .slice(-MAX_DECISIONS),
      defers: (parsed.defers ?? [])
        .filter((d) => d && d.ts >= cutoff)
        .slice(-MAX_DEFERS),
      // Profile is new in F.3 -- older stored memory won't have it.
      // Spread over EMPTY_PROFILE so partial profiles work too.
      profile: { ...EMPTY_PROFILE, ...(parsed.profile ?? {}) },
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveMemory(m: PersistentMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AXON_MEMORY_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function addNote(m: PersistentMemory, kind: MemoryNote["kind"], text: string): PersistentMemory {
  const clean = text.trim();
  if (!clean) return m;
  const note: MemoryNote = {
    id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text: clean.length > 240 ? clean.slice(0, 240) + "…" : clean,
    ts: Date.now(),
    kind,
  };
  const notes = [...m.notes, note].slice(-MAX_NOTES);
  return { ...m, notes };
}

export function setPref(m: PersistentMemory, key: string, value: string): PersistentMemory {
  return { ...m, prefs: { ...m.prefs, [key]: value } };
}

/**
 * Set a typed profile field. Use this instead of setPref when the
 * field has KNOWN SEMANTICS that the preamble logic uses for time-
 * aware injection. For ad-hoc facts that don't fit a known field,
 * use setProfileExtra instead.
 */
export function setProfileField<K extends keyof OperatorProfile>(
  m: PersistentMemory,
  field: K,
  value: OperatorProfile[K],
): PersistentMemory {
  return {
    ...m,
    profile: { ...m.profile, [field]: value },
  };
}

/** Set an ad-hoc fact under profile.extras. The catch-all for things
 *  that don't fit a known field but should still survive across
 *  sessions. */
export function setProfileExtra(
  m: PersistentMemory,
  key: string,
  value: string,
): PersistentMemory {
  return {
    ...m,
    profile: {
      ...m.profile,
      extras: { ...(m.profile.extras ?? {}), [key]: value },
    },
  };
}

/** Remove a known profile field. */
export function clearProfileField<K extends keyof OperatorProfile>(
  m: PersistentMemory,
  field: K,
): PersistentMemory {
  const next = { ...m.profile };
  delete next[field];
  return { ...m, profile: next };
}

/** Append a new session-summary entry, capped at MAX_SESSION_SUMMARIES. */
export function appendSessionSummary(
  m: PersistentMemory,
  summary: string,
): PersistentMemory {
  const clean = summary.trim();
  if (!clean) return m;
  const entry: SessionSummary = {
    id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    summary: clean,
  };
  const sessionSummaries = [...m.sessionSummaries, entry].slice(
    -MAX_SESSION_SUMMARIES,
  );
  return { ...m, sessionSummaries };
}

/** Capture a decision the operator just made. */
export function appendDecision(
  m: PersistentMemory,
  text: string,
): PersistentMemory {
  const clean = text.trim();
  if (!clean) return m;
  const entry: DecisionEntry = {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    text: clean.length > 240 ? clean.slice(0, 240) + "…" : clean,
  };
  return {
    ...m,
    decisions: [...m.decisions, entry].slice(-MAX_DECISIONS),
  };
}

/** Capture a defer ("not now, later"). */
export function appendDefer(
  m: PersistentMemory,
  text: string,
): PersistentMemory {
  const clean = text.trim();
  if (!clean) return m;
  const entry: DeferEntry = {
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    text: clean.length > 240 ? clean.slice(0, 240) + "…" : clean,
  };
  return {
    ...m,
    defers: [...m.defers, entry].slice(-MAX_DEFERS),
  };
}

// ════════════════════════════════════════════════════════════════
// RELEVANCE-SCORED PREAMBLE (F.4 -- Conversation Memory v2)
//
// The v1 memoryPreamble below dumps the most recent 5-8 of each
// channel verbatim into the brain context. That's fine when memory
// is small and the operator's turn is on-topic with their recent
// activity, but it falls down two ways:
//
//   1. Token waste -- 30+ irrelevant lines per turn, every turn,
//      regardless of whether any of them are about the current
//      question.
//
//   2. Stale context drag -- Claude sees "Cesar Sosa Santos was a
//      test candidate" in the preamble and brings it up when the
//      operator was actually asking about Stripe MRR. The preamble
//      shouldn't be a leash.
//
// v2 (when currentUtterance is provided): score every memory entry
// by keyword overlap with the operator's current turn, surface top
// K relevant + the freshest 1-2 decisions for continuity, drop the
// rest. The "always-keep-fresh-decisions" bit prevents the case
// where you mentioned something five minutes ago and Axon already
// forgot the context.
//
// Keyword overlap (not embeddings) is deliberate -- it's <1ms,
// requires no inference call, and works fine at the scale we have
// (24 notes, 30 decisions, 30 defers max). If memory ever grows to
// 1000+ entries we'd want embeddings, but we don't and won't.
// ════════════════════════════════════════════════════════════════

// Common English stopwords -- dropped from both sides of the
// overlap so "the X" matches "the Y" only on the meaningful parts.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "in", "on",
  "at", "to", "for", "with", "from", "by", "as", "is", "was", "are",
  "were", "be", "been", "being", "do", "does", "did", "doing",
  "have", "has", "had", "having", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "my", "your", "his",
  "her", "its", "our", "their", "me", "him", "us", "them", "what",
  "which", "who", "whom", "when", "where", "why", "how", "all",
  "any", "some", "no", "not", "so", "than", "too", "very", "just",
  "can", "will", "would", "should", "could", "may", "might", "must",
  "shall", "about", "into", "over", "under", "out", "up", "down",
  "off", "again", "more", "most", "other", "such", "yes", "okay",
  "ok", "ya", "yeah", "nope",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

/**
 * Score how relevant `entry` is to `utteranceTokens`. Higher is more
 * relevant. Pure keyword overlap -- count of intersecting tokens. No
 * length normalization on the entry side (so longer entries get a
 * slight natural advantage, which is fine -- a 240-char decision
 * with 3 overlapping terms is probably MORE relevant than a 30-char
 * note with 2 overlapping terms).
 */
function relevanceScore(
  entryText: string,
  utteranceTokens: Set<string>,
): number {
  if (utteranceTokens.size === 0) return 0;
  const entryTokens = tokenize(entryText);
  let overlap = 0;
  for (const t of entryTokens) {
    if (utteranceTokens.has(t)) overlap += 1;
  }
  return overlap;
}

interface ScoredEntry {
  text: string;
  kind: "note" | "decision" | "defer";
  ts: number;
  score: number;
}

function rankMemory(
  m: PersistentMemory,
  utterance: string,
): ScoredEntry[] {
  const tokens = tokenize(utterance);
  const scored: ScoredEntry[] = [];
  for (const n of m.notes) {
    scored.push({
      text: n.text,
      kind: "note",
      ts: n.ts,
      score: relevanceScore(n.text, tokens),
    });
  }
  for (const d of m.decisions) {
    scored.push({
      text: d.text,
      kind: "decision",
      ts: d.ts,
      score: relevanceScore(d.text, tokens),
    });
  }
  for (const f of m.defers) {
    scored.push({
      text: f.text,
      kind: "defer",
      ts: f.ts,
      score: relevanceScore(f.text, tokens),
    });
  }
  // Sort by score descending, then by recency as the tiebreaker.
  scored.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return scored;
}

/**
 * Relevance-scored preamble. Drop-in replacement for memoryPreamble
 * when the brain has the current user turn to compare against. Falls
 * back to the recency-based composition when utterance is empty or
 * yields zero matches above the threshold.
 *
 * Output discipline:
 *   - Top 5 entries by relevance, score > 0
 *   - PLUS the 2 most recent decisions regardless of score (so
 *     conversational continuity doesn't break when the operator
 *     suddenly switches topic)
 *   - PLUS preferences + last session recap (identity-level context,
 *     small footprint, always useful)
 */
export function memoryPreambleV2(
  m: PersistentMemory,
  utterance: string,
): string {
  if (
    !m.notes.length &&
    !Object.keys(m.prefs).length &&
    !m.sessionSummaries.length &&
    !m.decisions.length &&
    !m.defers.length
  )
    return "";

  // Fall back to v1 when we have no signal to score against.
  if (!utterance || utterance.trim().length < 3) {
    return memoryPreamble(m);
  }

  const ranked = rankMemory(m, utterance);
  const relevant = ranked.filter((r) => r.score > 0).slice(0, 5);

  // Always include the 2 most recent decisions for continuity, but
  // dedupe against anything already in the relevant set.
  const recentDecisions = m.decisions.slice(-2).reverse();
  const seenTexts = new Set(relevant.map((r) => r.text));
  const continuity = recentDecisions
    .filter((d) => !seenTexts.has(d.text))
    .map((d) => ({
      text: d.text,
      kind: "decision" as const,
      ts: d.ts,
      score: 0,
    }));

  const parts: string[] = [];

  // Style + preferences -- cheap to include, always useful for tone.
  if (Object.keys(m.prefs).length) {
    const prefs = Object.entries(m.prefs)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");
    parts.push(`Operator preferences:\n${prefs}`);
  }

  // Relevant memory entries.
  if (relevant.length > 0) {
    const lines = relevant.map((r) => {
      const tag =
        r.kind === "decision" ? "[decision]" :
        r.kind === "defer" ? "[deferred]" :
        "[note]";
      return `${tag} ${r.text}`;
    });
    parts.push(
      `Relevant memory (scored by overlap with the current question):\n${lines.join("\n")}`,
    );
  }

  // Continuity decisions -- only if they add something the relevant
  // set didn't already cover.
  if (continuity.length > 0) {
    const lines = continuity.map((c) => `[decision] ${c.text}`);
    parts.push(`Recent decisions (continuity):\n${lines.join("\n")}`);
  }

  // Last session summary -- "you were just working on X" context.
  if (m.sessionSummaries.length > 0) {
    const last = m.sessionSummaries[m.sessionSummaries.length - 1];
    parts.push(`Last session recap:\n${last.summary}`);
  }

  if (parts.length === 0) {
    // No relevant matches AND no other content -- skip the block
    // entirely rather than emitting an empty "Memory:" header.
    return "";
  }
  return parts.join("\n\n");
}

/** Compose a compact preamble block the brain can read. */
export function memoryPreamble(m: PersistentMemory): string {
  if (
    !m.notes.length &&
    !Object.keys(m.prefs).length &&
    !m.sessionSummaries.length &&
    !m.decisions.length &&
    !m.defers.length
  )
    return "";
  const parts: string[] = [];
  if (m.notes.length) {
    const recent = m.notes.slice(-8).map((n) => `• ${n.text}`).join("\n");
    parts.push(`Persistent memory (recent notes):\n${recent}`);
  }
  if (Object.keys(m.prefs).length) {
    const prefs = Object.entries(m.prefs)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");
    parts.push(`Operator preferences:\n${prefs}`);
  }
  // Last 3 session summaries — gives Axon "you've been working on X
  // for a while now" awareness across reloads.
  if (m.sessionSummaries.length) {
    const recent = m.sessionSummaries
      .slice(-3)
      .map((s, i, arr) => {
        const ago = humanizeAgo(Date.now() - s.ts);
        const tag = i === arr.length - 1 ? "most recent" : `${ago} ago`;
        return `[${tag}] ${s.summary}`;
      })
      .join("\n\n");
    parts.push(`Past session recaps:\n${recent}`);
  }
  if (m.decisions.length) {
    const recent = m.decisions
      .slice(-5)
      .map((d) => `• ${d.text}`)
      .join("\n");
    parts.push(`Decisions the operator has committed to:\n${recent}`);
  }
  if (m.defers.length) {
    const recent = m.defers
      .slice(-5)
      .map((d) => `• ${d.text}`)
      .join("\n");
    parts.push(`Things the operator has deferred (revisit when relevant):\n${recent}`);
  }
  return parts.join("\n\n");
}

/** Format a duration like "3 hours" / "2 days" for preamble context. */
function humanizeAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function sinceLastSeen(m: PersistentMemory): string | null {
  if (!m.lastSeen) return null;
  const ms = Date.now() - m.lastSeen;
  if (ms < 5 * 60 * 1000) return null;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) return `${Math.round(ms / 60000)} minutes`;
  if (hours < 24) return `${hours} hours`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}
