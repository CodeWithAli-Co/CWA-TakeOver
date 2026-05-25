// ───────────────────────────────────────────────────────────────────
// Theme action — flip the app's light/dark/system theme by voice.
//
// The Settings → Appearance toggle in Profile already drives this
// from the UI; this just gives Axon the same handle so the operator
// can say "switch to light mode" without leaving whatever they're
// working on.
//
// We deliberately use SPECIFIC trigger phrases ("light theme",
// "switch to light mode") instead of the bare word "light" or
// "dark" — the force_sleep action in sleep.ts already claims some
// dark-coloured phrases ("dark mode" in particular has historically
// been a force-sleep trigger). The description below lists each
// theme trigger explicitly so Claude's tool router can disambiguate
// from sleep / wake.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

// Late-bound store API. The provider binds it once on mount so this
// module doesn't have to import the Zustand store directly (keeps
// the action file decoupled from React + avoids a circular import
// through the provider). Same pattern as sleep.ts / voiceauth.ts.

type Mode = "light" | "dark" | "system";

let getCurrentMode: (() => Mode) | null = null;
let setMode: ((mode: Mode) => void) | null = null;

export function _bindThemeAccessors(
  getter: NonNullable<typeof getCurrentMode>,
  setter: NonNullable<typeof setMode>,
) {
  getCurrentMode = getter;
  setMode = setter;
}

const MODE_LABEL: Record<Mode, string> = {
  light: "light mode",
  dark: "dark mode",
  system: "system theme",
};

// ── set_theme ─────────────────────────────────────────────────────

export const setThemeAction: AxonAction<
  { mode: Mode },
  { ok: boolean; previous: Mode; next: Mode }
> = {
  name: "set_theme",
  description:
    "Switch the app's visual theme. Use this whenever the operator says: 'switch to light mode', 'switch to dark mode', 'use light theme', 'use dark theme', 'go light', 'go dark', 'turn on light mode', 'turn on dark mode', 'light theme please', 'dark theme please', 'enable light mode', 'enable dark mode', 'change to light', 'change to dark', 'flip the theme', 'toggle the theme', 'follow system theme', 'use system theme', 'match my system', or 'auto theme'. DO NOT confuse this with the force_sleep action — that uses phrases like 'go silent', 'shut down', or 'mute yourself'. Theme phrases are always about VISUAL appearance (light/dark/system).",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["light", "dark", "system"],
        description:
          "Which theme to switch to. 'light' for white-paper mode, 'dark' for zinc/black mode, 'system' to follow the OS preference (matches whatever the user has set in their OS).",
      },
    },
    required: ["mode"],
  },
  mutating: true,
  // Theme is fully reversible by saying the opposite phrase, so no
  // confirm dialog. Forcing a confirm would feel pedantic for a
  // setting the operator can flip back instantly.
  requiresConfirmation: false,
  handler: async ({ mode }, ctx) => {
    if (!setMode || !getCurrentMode) {
      return { summary: "Theme accessor isn't bound yet — try again in a moment." };
    }
    const previous = getCurrentMode();
    if (previous === mode) {
      return {
        summary: `Already in ${MODE_LABEL[mode]}.`,
        data: { ok: true, previous, next: mode },
      };
    }
    setMode(mode);
    const summary = `Switched to ${MODE_LABEL[mode]}.`;
    ctx.speak(
      mode === "system"
        ? "Following your system theme."
        : `Switching to ${mode} mode.`,
    );
    ctx.logActivity({
      actionName: "set_theme",
      params: { mode },
      summary,
    });
    return { summary, data: { ok: true, previous, next: mode } };
  },
};

// ── toggle_theme ──────────────────────────────────────────────────
// A convenience: flips between light and dark without needing to
// specify which. "system" mode resolves to whichever side it's
// currently rendering and flips to the opposite.

export const toggleThemeAction: AxonAction<
  Record<string, never>,
  { ok: boolean; from: Mode; to: Mode }
> = {
  name: "toggle_theme",
  description:
    "Flip the visual theme between light and dark without specifying which. Use when the operator says 'toggle theme', 'flip theme', 'switch theme', 'opposite theme', or just 'theme' as a one-word command. If 'system' is active, this resolves to whatever's currently rendering and flips to the opposite.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: false,
  handler: async (_input, ctx) => {
    if (!setMode || !getCurrentMode) {
      return { summary: "Theme accessor isn't bound yet — try again in a moment." };
    }
    const from = getCurrentMode();
    // If they're on "system", we flip to the OPPOSITE of what's
    // currently rendered so the change is actually visible. Reading
    // `prefers-color-scheme` here gives us the resolved side.
    let resolved: "light" | "dark" = from === "light" ? "light" : "dark";
    if (from === "system" && typeof window !== "undefined") {
      try {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } catch { /* default to dark */ }
    }
    const to: Mode = resolved === "light" ? "dark" : "light";
    setMode(to);
    const summary = `Toggled to ${MODE_LABEL[to]} (from ${MODE_LABEL[from]}).`;
    ctx.speak(`Switching to ${to} mode.`);
    ctx.logActivity({
      actionName: "toggle_theme",
      params: {},
      summary,
    });
    return { summary, data: { ok: true, from, to } };
  },
};

// ── Registration ──────────────────────────────────────────────────

export function registerThemeActions(): void {
  registerAction(setThemeAction);
  registerAction(toggleThemeAction);
}
