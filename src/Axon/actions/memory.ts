// ───────────────────────────────────────────────────────────────────
// Memory actions — let AXON read/write to the persistent store via
// tool use. "Remember that I prefer tasks due Friday" → write pref.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { addNote, loadMemory, saveMemory, setPref } from "../engine/memory";

export const rememberNoteAction: AxonAction<
  { text: string; kind?: "topic" | "preference" | "note" },
  { saved: boolean }
> = {
  name: "remember_note",
  description:
    "Persist a short note that AXON will recall in future sessions. Use for ongoing topics (e.g., 'we're planning the Q2 roadmap') or small observations that should survive reload. Keep notes under 240 characters. Do NOT persist sensitive data.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The note content." },
      kind: { type: "string", enum: ["topic", "preference", "note"] },
    },
    required: ["text"],
  },
  handler: async ({ text, kind = "note" }, ctx) => {
    const m = loadMemory();
    const next = addNote(m, kind, text);
    saveMemory(next);
    ctx.logActivity({
      actionName: "remember_note",
      params: { text, kind },
      summary: `Saved ${kind}: ${text.slice(0, 60)}`,
    });
    return { summary: "Got it. I'll remember that.", data: { saved: true } };
  },
};

export const setPreferenceAction: AxonAction<
  { key: string; value: string },
  { saved: boolean }
> = {
  name: "set_preference",
  description:
    "Save a key-value preference that survives reload. Example: set_preference({ key: 'default_task_deadline', value: 'end of week' }).",
  input_schema: {
    type: "object",
    properties: {
      key: { type: "string" },
      value: { type: "string" },
    },
    required: ["key", "value"],
  },
  handler: async ({ key, value }, ctx) => {
    const m = loadMemory();
    const next = setPref(m, key, value);
    saveMemory(next);
    ctx.logActivity({
      actionName: "set_preference",
      params: { key, value },
      summary: `Saved preference ${key}`,
    });
    return { summary: `Saved. ${key} is now ${value}.`, data: { saved: true } };
  },
};

export const forgetAllAction: AxonAction<
  Record<string, never>,
  { cleared: boolean }
> = {
  name: "forget_all_memory",
  description:
    "Clear ALL persistent memory — notes and preferences. Destructive; the system will confirm first.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: true,
  handler: async (_input, ctx) => {
    const ok = await ctx.requestConfirmation("Wipe all of AXON's persistent memory?");
    if (!ok) return { summary: "Cancelled.", data: { cleared: false } };
    saveMemory({ notes: [], lastSeen: Date.now(), prefs: {} });
    ctx.logActivity({
      actionName: "forget_all_memory",
      params: {},
      summary: "Cleared persistent memory",
      confirmed: true,
    });
    return { summary: "Memory wiped.", data: { cleared: true } };
  },
};

export function registerMemoryActions() {
  registerAction(rememberNoteAction);
  registerAction(setPreferenceAction);
  registerAction(forgetAllAction);
}
