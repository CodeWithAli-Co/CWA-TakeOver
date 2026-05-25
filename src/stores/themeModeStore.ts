/**
 * themeModeStore — global light / dark / system preference.
 *
 * Mirrors the pattern in useCompanyFilter: a persisted Zustand
 * store that applies a `data-theme` attribute to <html> on
 * change AND on rehydration after a reload, so the visual
 * theme survives refresh.
 *
 * Why both data-theme AND a `dark` class on <html>:
 *   · `data-theme="dark|light"` is what main.css uses to swap
 *     the CSS variable block (--background, --card, etc.).
 *   · `dark` class supports Tailwind's `dark:` variants, which
 *     a handful of components rely on. Toggling the class
 *     in lockstep means both systems stay aligned.
 *
 * "system" follows `prefers-color-scheme` and listens for live
 * changes (OS toggling between night and day) — applied only
 * while the user's chosen mode is "system".
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeModeState {
  /** What the user picked. */
  mode: ThemeMode;
  /** What we actually applied — resolves "system" to light/dark. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "cwa-theme-mode";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-theme", resolved);
  // Keep the Tailwind `dark` class in sync so any `dark:` utility
  // classes that exist in the codebase still respond.
  if (resolved === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

// ── Live system-preference listener ──────────────────────────
// Mounted once per page lifetime. Re-evaluates the resolved
// theme whenever the OS preference flips (e.g., scheduled dark
// mode at sunset). Only re-applies when the current mode is
// "system" — manual choices stay sticky.
let systemListenerMounted = false;
function mountSystemListener() {
  if (systemListenerMounted) return;
  if (typeof window === "undefined" || !window.matchMedia) return;
  systemListenerMounted = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    const state = useThemeMode.getState();
    if (state.mode !== "system") return;
    const next = resolveMode("system");
    if (state.resolved !== next) {
      applyTheme(next);
      useThemeMode.setState({ resolved: next });
    }
  };
  // addEventListener is the modern API; older Safari uses
  // addListener. Wrap both for safety.
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  } else if (typeof (mq as any).addListener === "function") {
    (mq as any).addListener(onChange);
  }
}

export const useThemeMode = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: "dark",
      resolved: "dark",
      setMode: (mode: ThemeMode) => {
        const resolved = resolveMode(mode);
        applyTheme(resolved);
        set({ mode, resolved });
      },
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (rehydrated) => {
        // Apply the persisted theme as soon as we read it back
        // from localStorage so the FOUC window is minimal.
        const mode = rehydrated?.mode ?? "dark";
        const resolved = resolveMode(mode);
        applyTheme(resolved);
        if (rehydrated) {
          rehydrated.resolved = resolved;
        }
        mountSystemListener();
      },
    },
  ),
);

// Belt-and-braces: also apply on first import in case rehydrate
// timing leaves the page un-themed for a frame.
if (typeof document !== "undefined") {
  applyTheme(useThemeMode.getState().resolved);
  mountSystemListener();
}
