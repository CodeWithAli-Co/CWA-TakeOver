// ───────────────────────────────────────────────────────────────────
// Undo actions — pop the most recent reversible entry and run it.
// Because autoApprove runs destructive commands instantly, the undo
// stack is the operator's safety net.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { popUndo, peekUndo, listUndo, resolveUndo } from "../engine/undoStack";
import { registerAction } from "./registry";

export const undoLastAction: AxonAction<{}, { undone: boolean; label?: string }> = {
  name: "undo_last",
  description:
    "Undo the last reversible action Axon performed. Trigger on phrases like 'undo that', 'take it back', 'revert that', 'never mind'. Always safe to call — if nothing is reversible, this reports so.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async (_input, ctx) => {
    const entry = popUndo();
    if (!entry) {
      return { summary: "Nothing to undo.", data: { undone: false } };
    }
    // Entry may be closure-style (session-scoped) or descriptor-style
    // (persisted across reloads). resolveUndo handles both — or returns
    // null if we hydrated a descriptor whose handler isn't registered
    // yet (e.g. a stale entry from an older build).
    const reversal = resolveUndo(entry);
    if (!reversal) {
      return {
        summary: `I can't undo "${entry.label}" — the reversal handler for that action isn't available (likely a stale entry from an older session).`,
        data: { undone: false, label: entry.label },
      };
    }
    try {
      const message = await reversal();
      ctx.logActivity({
        actionName: "undo_last",
        params: { target: entry.actionName, label: entry.label },
        summary: `Undid "${entry.label}" — ${message}`,
      });
      return {
        summary: `Reverted: ${entry.label}. ${message}`,
        data: { undone: true, label: entry.label },
      };
    } catch (err) {
      console.error("[axon undo] reversal failed:", err);
      return {
        summary: `I tried to undo "${entry.label}" but something went wrong. You'll need to fix it manually.`,
        data: { undone: false, label: entry.label },
      };
    }
  },
};

export const peekUndoAction: AxonAction<{}, { label?: string }> = {
  name: "peek_undo",
  description:
    "Tell the operator what the most recent undo-able action is, without undoing it. Useful when the operator asks 'what did you just do' or 'can I undo that'.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const e = peekUndo();
    if (!e) return { summary: "Nothing to undo right now." };
    const ago = Math.round((Date.now() - e.timestamp) / 1000);
    return {
      summary: `Last reversible action: ${e.label} (${ago}s ago). Say "undo that" to reverse it.`,
      data: { label: e.label },
    };
  },
};

export const listUndoAction: AxonAction<{}, { entries: { label: string; when: number }[] }> = {
  name: "list_undo",
  description:
    "List the undo stack (most-recent-first). For when the operator wants to see the last few reversible actions.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const entries = listUndo();
    if (entries.length === 0) return { summary: "Undo stack is empty." };
    const lines = entries
      .slice(0, 8)
      .map((e, i) => `${i + 1}. ${e.label}`)
      .join("\n");
    return {
      summary: `Most recent reversible actions:\n${lines}`,
      data: {
        entries: entries.map((e) => ({ label: e.label, when: e.timestamp })),
      },
    };
  },
};

export function registerUndoActions() {
  registerAction(undoLastAction);
  registerAction(peekUndoAction);
  registerAction(listUndoAction);
}
