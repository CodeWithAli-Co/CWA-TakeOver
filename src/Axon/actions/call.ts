// ───────────────────────────────────────────────────────────────────
// Call-mode actions — start_call / end_call.
//
// Call mode turns Axon's normally single-shot Q&A into a continuous
// voice conversation: after every reply, the microphone auto-arms so
// the operator can keep talking without re-invoking the wake word.
// Feels like a phone call.
//
// The ACTUAL mechanic lives in AxonProvider.onEnd — if callModeRef is
// true it arms the recognizer unconditionally. These actions just flip
// the flag and acknowledge.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

export const startCallAction: AxonAction<
  Record<string, never>,
  { on: true }
> = {
  name: "start_call",
  description:
    "Enter call mode — continuous voice conversation. Trigger on phrases like 'start a call', 'call me', 'let's chat', 'conversation mode', 'talk with me'. In call mode Axon re-arms the mic after every reply so the operator can keep talking without the wake word.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async (_input, ctx) => {
    ctx.setCallMode?.(true);
    ctx.logActivity({
      actionName: "start_call",
      params: {},
      summary: "Call mode engaged",
    });
    return {
      summary:
        "Call mode on — I'll stay listening after each reply. Say 'hang up' or 'end call' when you're done.",
      data: { on: true },
    };
  },
};

export const endCallAction: AxonAction<
  Record<string, never>,
  { on: false }
> = {
  name: "end_call",
  description:
    "Exit call mode and go back to single-shot wake-word commands. Trigger on phrases like 'hang up', 'end call', 'stop the call', 'that's all for now', 'we're done here'. Acknowledges briefly and stops auto-arming the mic.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async (_input, ctx) => {
    ctx.setCallMode?.(false);
    ctx.logActivity({
      actionName: "end_call",
      params: {},
      summary: "Call mode ended",
    });
    return {
      summary: "Call ended. Say 'Axon' any time you need me.",
      data: { on: false },
    };
  },
};

export function registerCallActions() {
  registerAction(startCallAction);
  registerAction(endCallAction);
}
