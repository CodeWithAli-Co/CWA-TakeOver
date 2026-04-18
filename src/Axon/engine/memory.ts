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

export interface PersistentMemory {
  notes: MemoryNote[];
  /** Last session timestamp. Used to say "welcome back after X hours." */
  lastSeen: number;
  /** Free-form preferences keyed by name. */
  prefs: Record<string, string>;
}

const EMPTY: PersistentMemory = { notes: [], lastSeen: 0, prefs: {} };
const MAX_NOTES = 24;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function loadMemory(): PersistentMemory {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(AXON_MEMORY_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as PersistentMemory;
    // Age out stale notes.
    const cutoff = Date.now() - MAX_AGE_MS;
    parsed.notes = (parsed.notes ?? []).filter((n) => n.ts >= cutoff).slice(-MAX_NOTES);
    parsed.prefs = parsed.prefs ?? {};
    parsed.lastSeen = parsed.lastSeen ?? 0;
    return parsed;
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

/** Compose a compact preamble block the brain can read. */
export function memoryPreamble(m: PersistentMemory): string {
  if (!m.notes.length && !Object.keys(m.prefs).length) return "";
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
  return parts.join("\n\n");
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
