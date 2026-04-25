// ───────────────────────────────────────────────────────────────────
// Voice-print actions — enrollment, status, gate toggle, test.
//
// The underlying voice-print machinery already exists in
// engine/voicePrint.ts (cosine-similarity over a 7-feature vector).
// What was missing was a voice-driven path to enroll, test, and
// actually GATE sensitive actions on speaker identity. These actions
// fill that gap.
//
// IMPORTANT: per the engine module's own caveat, this is a coarse
// filter, not a security primitive. It blocks "the wrong person in
// the room speaking" — it does not stop a determined impersonator.
// Treat it as a soft lock + UX signal.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { enrollVoice, verifyVoice } from "../engine/voicePrint";

// We don't have direct settings access from inside an action handler —
// settings flow through the provider. The simplest path is a small
// shared module that the provider populates and actions read.
//
// We expose two getters/setters here so the provider can wire them up
// once on mount, and the actions can pull live values without prop-
// drilling through ctx.

let getCurrentSettings:
  | (() => {
      voicePrint: number[] | null;
      voicePrintThreshold: number;
      voicePrintGate: boolean;
    })
  | null = null;
let updateSettings:
  | ((
      partial: Partial<{
        voicePrint: number[] | null;
        voicePrintThreshold: number;
        voicePrintGate: boolean;
      }>,
    ) => void)
  | null = null;

export function _bindVoicePrintAccessors(
  getter: NonNullable<typeof getCurrentSettings>,
  setter: NonNullable<typeof updateSettings>,
) {
  getCurrentSettings = getter;
  updateSettings = setter;
}

// ─── enroll_voice_print ──────────────────────────────────────────

export const enrollVoicePrintAction: AxonAction<
  Record<string, never>,
  { ok: boolean }
> = {
  name: "enroll_voice_print",
  description:
    "Capture the operator's voice print for speaker verification. Records ~5 seconds of speech then stores a feature vector. Use when the operator says 'enroll my voice', 'remember how I sound', 'set up voice ID'. After enrollment, separately enable the gate via 'enable voice gate' to actually block strangers from triggering sensitive actions.",
  input_schema: {
    type: "object",
    properties: {},
  },
  mutating: true,
  handler: async (_input, ctx) => {
    if (!updateSettings) {
      return {
        summary: "Voice-print system isn't bound yet — try again in a moment.",
      };
    }
    ctx.note("Recording voice for ~5 seconds. Speak naturally.");
    ctx.speak("Listening for five seconds — say a couple of sentences.");

    try {
      const v = await enrollVoice();
      if (!v) {
        return {
          summary:
            "Couldn't capture a clear voice print. Microphone may be muted, or the recording was mostly silence.",
        };
      }
      updateSettings({ voicePrint: v });
      ctx.logActivity({
        actionName: "enroll_voice_print",
        params: {},
        summary: `Enrolled voice print (${v.length} features)`,
      });
      return {
        summary:
          "Voice print enrolled. Say 'enable voice gate' to start gating sensitive actions on speaker identity.",
        data: { ok: true },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Enrollment failed: ${msg}` };
    }
  },
};

// ─── enable / disable voice gate ─────────────────────────────────

export const enableVoiceGateAction: AxonAction<
  Record<string, never>,
  { gated: boolean }
> = {
  name: "enable_voice_gate",
  description:
    "Turn ON voice-print gating for mutating actions. Once enabled, every destructive action verifies the speaker before running. Requires a prior enrollment (enroll_voice_print). Trigger phrases: 'enable voice gate', 'lock my voice', 'gate sensitive actions'.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  handler: async (_input, ctx) => {
    if (!getCurrentSettings || !updateSettings) {
      return { summary: "Voice-print system isn't bound yet." };
    }
    const cur = getCurrentSettings();
    if (!cur.voicePrint) {
      return {
        summary:
          "No voice print enrolled. Run enroll_voice_print first, then try this again.",
      };
    }
    updateSettings({ voicePrintGate: true });
    ctx.logActivity({
      actionName: "enable_voice_gate",
      params: {},
      summary: "Voice gate enabled",
    });
    return {
      summary:
        "Voice gate is on. Sensitive actions will verify the speaker before running. Adds ~1.5s of latency per gated action.",
      data: { gated: true },
    };
  },
};

export const disableVoiceGateAction: AxonAction<
  Record<string, never>,
  { gated: boolean }
> = {
  name: "disable_voice_gate",
  description:
    "Turn OFF voice-print gating. Sensitive actions will run without verifying the speaker. The enrolled voice print is preserved — re-enable any time. Trigger: 'disable voice gate', 'unlock voice', 'stop gating actions'.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: true,
  handler: async (_input, ctx) => {
    if (!updateSettings) return { summary: "Voice-print system isn't bound yet." };
    const ok = await ctx.requestConfirmation(
      "Disable voice gating? Strangers will be able to trigger sensitive actions.",
    );
    if (!ok) return { summary: "Voice gate stays on.", data: { gated: true } };
    updateSettings({ voicePrintGate: false });
    ctx.logActivity({
      actionName: "disable_voice_gate",
      params: {},
      summary: "Voice gate disabled",
    });
    return { summary: "Voice gate disabled.", data: { gated: false } };
  },
};

// ─── test_voice_print ────────────────────────────────────────────

export const testVoicePrintAction: AxonAction<
  Record<string, never>,
  { score: number; pass: boolean }
> = {
  name: "test_voice_print",
  description:
    "Snapshot the operator's voice and compare it to the enrolled print. Returns a similarity score and whether it would pass the gate. Useful for tuning the threshold. Trigger: 'test my voice', 'check voice match'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    if (!getCurrentSettings) return { summary: "Voice-print system isn't bound yet." };
    const cur = getCurrentSettings();
    if (!cur.voicePrint) {
      return {
        summary: "No voice print enrolled yet. Run enroll_voice_print first.",
      };
    }
    ctx.speak("Say something — comparing now.");
    const result = await verifyVoice(
      cur.voicePrint as number[],
      cur.voicePrintThreshold,
    );
    if (!result) return { summary: "Couldn't capture audio for comparison." };
    return {
      summary: `Similarity ${result.score.toFixed(2)} ${result.pass ? "(pass)" : "(would be rejected)"}. Threshold is ${cur.voicePrintThreshold.toFixed(2)}.`,
      data: { score: result.score, pass: result.pass },
    };
  },
};

export function registerVoiceAuthActions() {
  registerAction(enrollVoicePrintAction);
  registerAction(enableVoiceGateAction);
  registerAction(disableVoiceGateAction);
  registerAction(testVoicePrintAction);
}
