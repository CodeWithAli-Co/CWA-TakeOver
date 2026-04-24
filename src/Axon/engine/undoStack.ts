// ───────────────────────────────────────────────────────────────────
// Undo stack — reversible-action ledger for AXON.
//
// Two flavors of entry:
//
//   1. Closure-style  (legacy)
//      pushUndo({ actionName, label, undo: async () => { ... } })
//      ephemeral — lives in memory only, lost on reload.
//
//   2. Descriptor-style  (new, persistable)
//      pushUndo({ actionName, label, descriptor: { kind, payload } })
//      the `kind` names a handler registered via `registerUndoHandler`,
//      and `payload` is JSON-serializable. These entries round-trip
//      through localStorage, so "undo that" survives a page reload.
//
// Both flavors coexist: callers migrate to descriptors at their own
// pace, and the API surface (`popUndo`, `peekUndo`, `listUndo`) treats
// them identically for consumers.
// ───────────────────────────────────────────────────────────────────

/** Serializable description of an undo. Resolved to a handler at run-time. */
export interface UndoDescriptor {
  /** Registry key — must match a call to `registerUndoHandler`. */
  kind: string;
  /** Handler input. Must be JSON-safe. */
  payload: Record<string, unknown>;
}

export interface UndoEntry {
  id: string;
  actionName: string;
  /** Human-readable label shown when AXON speaks the undo result. */
  label: string;
  /** When the original action ran (Unix ms). */
  timestamp: number;
  /** Closure-style reversal. Preferred for in-session-only undos. */
  undo?: () => Promise<string>;
  /** Serializable descriptor. If present, the entry survives reloads. */
  descriptor?: UndoDescriptor;
}

/** Shape callers pass into pushUndo — either closure or descriptor. */
export type UndoEntryInput = Omit<UndoEntry, "id" | "timestamp">;

/** Handler signature — receives the serialized payload and returns a
 *  short summary string to speak. */
export type UndoHandler<P = Record<string, unknown>> = (
  payload: P,
) => Promise<string>;

const stack: UndoEntry[] = [];
const handlers = new Map<string, UndoHandler>();
const MAX = 20;
const STORAGE_KEY = "axon:undoStack:v1";

// ─── persistence ──────────────────────────────────────────────────
// Only descriptor-style entries round-trip through localStorage.
// Closure-style entries remain in memory; their slot is empty after
// reload. This keeps the contract honest: if you want a persistent
// undo, you must provide a serializable descriptor.

/** Serialize the current stack to localStorage. Closure-only entries are
 *  dropped (they can't be faithfully restored). Called implicitly on
 *  every push / pop / clear. */
function persist() {
  if (typeof window === "undefined") return;
  try {
    const serializable = stack.filter((e) => e.descriptor);
    // Strip the closure field before serialization — JSON can't hold it
    // anyway, but being explicit avoids any accidental circular refs.
    const payload = serializable.map((e) => ({
      id: e.id,
      actionName: e.actionName,
      label: e.label,
      timestamp: e.timestamp,
      descriptor: e.descriptor,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Persistence is best-effort — if storage is unavailable we just
    // degrade to session-scoped undos. No need to shout.
    if (typeof console !== "undefined") {
      console.warn("[AXON] undo stack persist failed:", err);
    }
  }
}

/** Load persisted descriptor-entries back into the stack on mount.
 *  Safe to call multiple times; a guard prevents duplicate loads. */
let hydrated = false;
export function hydrateUndoStack() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as UndoEntry[];
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (entry && entry.descriptor && entry.id && entry.actionName) {
        stack.push(entry);
      }
    }
    while (stack.length > MAX) stack.shift();
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[AXON] undo stack hydrate failed:", err);
    }
  }
}

// ─── handler registry ─────────────────────────────────────────────

/** Register a handler for a specific descriptor `kind`. Typical usage:
 *
 *    registerUndoHandler<{ taskId: string }>("restore-task", async (p) => {
 *      await supabase.from("tasks").update({ deleted: false }).eq("id", p.taskId);
 *      return "Task restored.";
 *    });
 *
 *  Action modules register their handlers at import time. */
export function registerUndoHandler<P = Record<string, unknown>>(
  kind: string,
  handler: UndoHandler<P>,
) {
  handlers.set(kind, handler as UndoHandler);
}

/** Resolve an entry to its callable reversal. Closure-style entries
 *  return their closure; descriptor-style entries look up the registered
 *  handler and wrap it with the serialized payload. */
export function resolveUndo(entry: UndoEntry): (() => Promise<string>) | null {
  if (entry.undo) return entry.undo;
  if (entry.descriptor) {
    const handler = handlers.get(entry.descriptor.kind);
    if (!handler) return null;
    const payload = entry.descriptor.payload;
    return () => handler(payload);
  }
  return null;
}

// ─── core stack API ───────────────────────────────────────────────

export function pushUndo(entry: UndoEntryInput): UndoEntry {
  const full: UndoEntry = {
    ...entry,
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  stack.push(full);
  while (stack.length > MAX) stack.shift();
  persist();
  return full;
}

export function popUndo(): UndoEntry | null {
  const entry = stack.pop() ?? null;
  persist();
  return entry;
}

export function peekUndo(): UndoEntry | null {
  return stack[stack.length - 1] ?? null;
}

export function listUndo(): UndoEntry[] {
  return [...stack].reverse();
}

export function clearUndo() {
  stack.length = 0;
  persist();
}
