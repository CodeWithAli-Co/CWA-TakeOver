// ───────────────────────────────────────────────────────────────────
// Undo stack — session-scoped record of reversible actions.
// Each mutating action can push a reversal function + a short label;
// "undo_last" pops and runs it.
// ───────────────────────────────────────────────────────────────────

export interface UndoEntry {
  id: string;
  actionName: string;
  /** Human label shown when AXON speaks the undo result. */
  label: string;
  /** When the original action ran. */
  timestamp: number;
  /** Reversal function. Returns short summary. */
  undo: () => Promise<string>;
}

const stack: UndoEntry[] = [];
const MAX = 20;

export function pushUndo(entry: Omit<UndoEntry, "id" | "timestamp">): UndoEntry {
  const full: UndoEntry = {
    ...entry,
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  stack.push(full);
  while (stack.length > MAX) stack.shift();
  return full;
}

export function popUndo(): UndoEntry | null {
  return stack.pop() ?? null;
}

export function peekUndo(): UndoEntry | null {
  return stack[stack.length - 1] ?? null;
}

export function listUndo(): UndoEntry[] {
  return [...stack].reverse();
}

export function clearUndo() {
  stack.length = 0;
}
