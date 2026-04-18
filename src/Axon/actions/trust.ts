// ───────────────────────────────────────────────────────────────────
// Trust layer actions — undo, toggle dry-run, clear audit.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { listUndo, peekUndo, popUndo } from "../engine/undoStack";

export const undoLastAction: AxonAction<
  Record<string, never>,
  { undone: boolean; summary: string }
> = {
  name: "undo_last",
  description:
    "Reverse the most recent reversible action. Use when the operator says 'undo that', 'undo', 'revert', 'take it back', 'cancel that last one'. Has no effect if nothing is undoable.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const entry = popUndo();
    if (!entry) {
      return {
        summary: "Nothing to undo.",
        data: { undone: false, summary: "empty" },
      };
    }
    try {
      const reverseSummary = await entry.undo();
      ctx.logActivity({
        actionName: "undo_last",
        params: { targetAction: entry.actionName },
        summary: `Undid ${entry.label}`,
      });
      return {
        summary: reverseSummary || `Undid ${entry.label}.`,
        data: { undone: true, summary: reverseSummary },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        summary: `Couldn't undo: ${msg}`,
        data: { undone: false, summary: msg },
      };
    }
  },
};

export const listUndoableAction: AxonAction<
  Record<string, never>,
  { entries: Array<{ action: string; label: string; ts: number }> }
> = {
  name: "list_undoable",
  description:
    "List reversible actions currently on the undo stack (most recent first).",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const rows = listUndo().map((e) => ({
      action: e.actionName,
      label: e.label,
      ts: e.timestamp,
    }));
    if (rows.length === 0)
      return { summary: "Nothing on the undo stack.", data: { entries: [] } };
    return {
      summary: `${rows.length} reversible ${rows.length === 1 ? "action" : "actions"} available. Latest: ${rows[0].label}.`,
      data: { entries: rows },
    };
  },
};

export const peekUndoableAction: AxonAction<
  Record<string, never>,
  { peek: { action: string; label: string; ts: number } | null }
> = {
  name: "what_would_undo_do",
  description:
    "Preview what 'undo_last' would reverse. Use when the operator asks 'what would undo do' or 'what's the last thing'.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const e = peekUndo();
    if (!e) return { summary: "Nothing to undo.", data: { peek: null } };
    return {
      summary: `Next undo would reverse: ${e.label}.`,
      data: {
        peek: { action: e.actionName, label: e.label, ts: e.timestamp },
      },
    };
  },
};

export function registerTrustActions() {
  registerAction(undoLastAction);
  registerAction(listUndoableAction);
  registerAction(peekUndoableAction);
}
