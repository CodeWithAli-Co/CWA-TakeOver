// ───────────────────────────────────────────────────────────────────
// Journal actions — capture decisions and defers so AXON's persistent
// memory has texture beyond just "we talked about X".
//
// Why: Axon's self-audit flagged that compressing conversations loses
// the texture of HOW the operator works — what they decided, what
// they put off, recurring patterns. These actions give the brain a
// dedicated channel to commit those bits to durable memory.
//
// Both actions are non-mutating from the operator's perspective (they
// just write to local memory), so no confirmation prompt — capturing
// a decision should feel weightless.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  loadMemory,
  saveMemory,
  appendDecision,
  appendDefer,
} from "../engine/memory";

export const recordDecisionAction: AxonAction<
  { text: string },
  { recorded: true }
> = {
  name: "record_decision",
  description:
    "Capture a decision the operator just committed to. Use when the operator clearly chooses a path — 'go with the second option', 'we're shipping it Friday', 'yes do that'. Persists to local memory and surfaces in future-session preambles so AXON remembers what was settled.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "One-line description of the decision in the operator's voice. e.g. 'Ship the new auth flow Friday'.",
      },
    },
    required: ["text"],
  },
  handler: async ({ text }, ctx) => {
    const cur = loadMemory();
    saveMemory(appendDecision(cur, text));
    ctx.logActivity({
      actionName: "record_decision",
      params: { text },
      summary: `Logged decision: ${text}`,
    });
    return {
      summary: `Got it. Logged: "${text}".`,
      data: { recorded: true },
    };
  },
};

export const recordDeferAction: AxonAction<
  { text: string },
  { recorded: true }
> = {
  name: "record_defer",
  description:
    "Capture something the operator put off. Use when they say 'not now', 'come back to that', 'I'll deal with it later', 'that's a Q3 problem'. AXON will surface deferred items when relevant context comes back up.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "One-line description of what was deferred and the rough timeframe. e.g. 'Hire a designer — defer until Q3'.",
      },
    },
    required: ["text"],
  },
  handler: async ({ text }, ctx) => {
    const cur = loadMemory();
    saveMemory(appendDefer(cur, text));
    ctx.logActivity({
      actionName: "record_defer",
      params: { text },
      summary: `Logged defer: ${text}`,
    });
    return {
      summary: `Filed away: "${text}". I'll bring it back when it makes sense.`,
      data: { recorded: true },
    };
  },
};

export function registerJournalActions() {
  registerAction(recordDecisionAction);
  registerAction(recordDeferAction);
}
