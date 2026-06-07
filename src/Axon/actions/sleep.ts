// ───────────────────────────────────────────────────────────────────
// Sleep / force-sleep actions.
//
// AxonSettings already has a `forceSleep` flag — when true, the voice
// loop refuses to wake on any phrase (not even the standard resume
// phrases) until it's toggled off via the Settings panel. This file
// adds voice + text entry-points for that flag so the operator can
// say "Axon, force sleep" to guarantee silence.
//
// IMPORTANT: once forceSleep is ON, Axon won't hear anything else.
// The only paths back to ON state are:
//   1. The Forced-Sleep toggle in Axon Settings
//   2. Typing `wake_up` / `cancel_force_sleep` in the command composer
//      (text input still works even when the mic is dormant)
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

// Same binding pattern as voiceauth.ts — provider wires these once
// on mount, actions read/write through them without prop-drilling
// through ctx.

let getCurrentSettings:
  | (() => { forceSleep: boolean })
  | null = null;
let updateSettings:
  | ((partial: Partial<{ forceSleep: boolean }>) => void)
  | null = null;

export function _bindSleepAccessors(
  getter: NonNullable<typeof getCurrentSettings>,
  setter: NonNullable<typeof updateSettings>,
) {
  getCurrentSettings = getter;
  updateSettings = setter;
}

// ── force_sleep ───────────────────────────────────────────────────

export const forceSleepAction: AxonAction<
  { reason?: string },
  { ok: boolean }
> = {
  name: "force_sleep",
  description:
    "Put Axon into hard-dormant mode. Mutes the mic, stops wake-word matching, stops proactive speech, AND BLOCKS VOICE WAKE -- the operator MUST toggle Forced Sleep OFF in Axon Settings (or type 'wake up' in the composer) to bring Axon back. This is the nuclear option. ONLY fire on UNAMBIGUOUS phrases that explicitly invoke the forced/hard mode: 'force sleep', 'hard sleep', 'dark mode', 'guaranteed silence', 'force quiet', 'absolute silence', or the operator explicitly saying 'force sleep on'. Do NOT fire on casual quiet requests like 'mute', 'shut up', 'be quiet', 'go quiet', 'standby', 'stand down', 'goodbye' -- those are the SOFT sleep path and are handled by the voice loop's sleepPhrases (voice-wakeable). If the operator just says 'axon mute' or 'axon be quiet', it almost certainly means soft sleep, not this action.",
  input_schema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Optional context the operator gave (logged in the audit feed).",
      },
    },
  },
  mutating: true,
  // No confirmation — this is a SAFETY override the operator asked
  // for. Forcing a confirm dialog defeats the "give me silence right
  // now" UX. The flag is fully reversible from Settings.
  requiresConfirmation: false,
  handler: async ({ reason }, ctx) => {
    if (!updateSettings || !getCurrentSettings) {
      return { summary: "Sleep accessor isn't bound yet — try again in a moment." };
    }
    const current = getCurrentSettings();
    if (current.forceSleep) {
      return {
        summary: "Already in forced sleep. Toggle off in Settings to wake me.",
        data: { ok: true },
      };
    }

    // Speak the confirmation BEFORE setting the flag — the voice loop
    // tears down once forceSleep flips, so this is the last thing the
    // operator will hear.
    ctx.speak("Going silent. Wake me from settings.");

    updateSettings({ forceSleep: true });

    const summary = reason
      ? `Forced sleep enabled (${reason}). Wake me via the Forced Sleep toggle in Settings.`
      : "Forced sleep enabled. Wake me via the Forced Sleep toggle in Settings.";
    ctx.logActivity({
      actionName: "force_sleep",
      params: { reason },
      summary,
    });
    return {
      summary,
      // Silent so the brain doesn't try to follow up with TTS that
      // the operator no longer wants to hear.
      silent: true,
      data: { ok: true },
    };
  },
};

// ── wake_up (text-only escape hatch) ──────────────────────────────

export const wakeUpAction: AxonAction<Record<string, never>, { ok: boolean }> = {
  name: "wake_up",
  description:
    "Cancel forced sleep so Axon resumes normal listening. Only usable from the typed command composer — by the time you can say this out loud, forced sleep would have been off anyway. Trigger phrases: 'wake up', 'cancel force sleep', 'undo silence', 'come back'.",
  input_schema: {
    type: "object",
    properties: {},
  },
  mutating: true,
  handler: async (_input, ctx) => {
    if (!updateSettings || !getCurrentSettings) {
      return { summary: "Sleep accessor isn't bound yet — try again in a moment." };
    }
    const current = getCurrentSettings();
    if (!current.forceSleep) {
      return { summary: "Already awake.", data: { ok: true } };
    }
    updateSettings({ forceSleep: false });
    const summary = "Forced sleep cancelled. Listening again.";
    ctx.speak("I'm back.");
    ctx.logActivity({
      actionName: "wake_up",
      params: {},
      summary,
    });
    return { summary, data: { ok: true } };
  },
};

// ── Registration ──────────────────────────────────────────────────

export function registerSleepActions(): void {
  registerAction(forceSleepAction);
  registerAction(wakeUpAction);
}
