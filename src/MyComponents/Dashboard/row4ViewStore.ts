/**
 * row4ViewStore.ts — Which Row 4 variant is the home dashboard
 * currently showing?
 *
 *   · "lists"   — the original full Tasks + Meetings widgets.
 *                 Useful for triage and queue-management.
 *
 *   · "today"   — the unified Today Agenda + AddMeeting panel.
 *                 Useful when you want a focused, time-anchored
 *                 view of your day rather than full lists.
 *
 * Default-by-role:
 *   · CEO / COO       → "lists" (managerial overview)
 *   · everyone else   → "today" (focused day-plan)
 *
 * The store holds an explicit `preference` that is `null` until the
 * user picks one — at which point the role default no longer applies.
 * Toggles via Cmd+Shift+D and the Cmd+K palette publish into the
 * preference so the user's choice persists across reloads.
 *
 * Consumers should read the effective view via `useEffectiveRow4View(
 * role)` — that hook resolves null → role default. Callers that need
 * to mutate use `useRow4View` directly.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Row4View = "lists" | "today";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO"]);

export function isCLevel(role?: string | null): boolean {
  return !!role && C_LEVEL_ROLES.has(role);
}

export function getDefaultForRole(role?: string | null): Row4View {
  return isCLevel(role) ? "lists" : "today";
}

interface Row4ViewState {
  /** null = "use role-based default"; otherwise this is the user's pick. */
  preference: Row4View | null;
  setPreference: (v: Row4View | null) => void;
  /**
   * Toggle relative to the current effective view. Callers pass the
   * effective view so the toggle works correctly even when the user
   * hasn't expressed a preference (preference === null) and we're
   * rendering the role default.
   */
  toggleFrom: (currentEffective: Row4View) => void;
}

export const useRow4View = create<Row4ViewState>()(
  persist(
    (set) => ({
      preference: null,
      setPreference: (v) => set({ preference: v }),
      toggleFrom: (currentEffective) =>
        set({ preference: currentEffective === "today" ? "lists" : "today" }),
    }),
    { name: "cwa:row4View" },
  ),
);

/**
 * Resolves the current effective view: stored preference if any,
 * otherwise role-based default. Use this in components that render
 * Row 4; use the underlying store actions to mutate.
 *
 * When `ignorePreference` is true the persisted preference is skipped
 * and the role default is returned verbatim. Use this when the caller
 * is previewing another role via `useRolePreview` — the preview should
 * faithfully show that role's default, not the actual user's saved pick.
 */
export function useEffectiveRow4View(
  role?: string | null,
  ignorePreference: boolean = false,
): Row4View {
  const preference = useRow4View((s) => s.preference);
  return useMemo(
    () =>
      ignorePreference
        ? getDefaultForRole(role)
        : (preference ?? getDefaultForRole(role)),
    [preference, role, ignorePreference],
  );
}
