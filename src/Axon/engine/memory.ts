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
}

const EMPTY: PersistentMemory = {
  notes: [],
  lastSeen: 0,
  prefs: {},
  sessionSummaries: [],
  decisions: [],
  defers: [],
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
