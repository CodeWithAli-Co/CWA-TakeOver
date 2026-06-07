/**
 * row4ViewStore.ts — Which Row 4 variant is the home dashboard
 * currently showing?
 *
 *   · "components"  — the canonical Row 4 Redux: Axon Daily
 *                     Check-in (left 60%) + Career Growth (top
 *                     right) + Team Pulse (bottom right). The
 *                     default for everyone.
 *
 *   · "lists"       — the original full Tasks + Meetings widgets.
 *                     Preserved as a power-user backdoor for
 *                     operators who want the lists view back.
 *                     Reachable via Cmd+Shift+D and the Cmd+K
 *                     palette verb "Switch row 4 view".
 *
 * The store holds an explicit `preference`:
 *   · null   → "use the canonical components view"
 *   · "lists" or "components" → user's explicit pick (persisted)
 *
 * Historically this enum was "today" | "lists" where "today" meant
 * the Today Agenda + AddMeeting panel. That content moved to Row 5
 * when Row 4 was redesigned, so we map any persisted "today"
 * preference forward to "components" via the persist migrate hook.
 *
 * Consumers read the effective view via `useEffectiveRow4View(role)`.
 * Callers that need to mutate use `useRow4View` directly.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Row4View = "lists" | "components";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO"]);

export function isCLevel(role?: string | null): boolean {
  return !!role && C_LEVEL_ROLES.has(role);
}

/**
 * Default Row 4 variant for a given role.
 *
 * Split by role: non-C-level operators land on the lists view
 * (Meetings + Tasks) because those surfaces are what they actually
 * work in day-to-day. C-level keeps the components view (Daily
 * Check-in / Career Growth / Team Pulse) since the editorial home
 * is more useful for them. Cmd+Shift+D toggles between the two for
 * either role, and the user's explicit pick (persisted in
 * `preference`) overrides the default.
 */
export function getDefaultForRole(role?: string | null): Row4View {
  return isCLevel(role) ? "components" : "lists";
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
        set({
          preference:
            currentEffective === "components" ? "lists" : "components",
        }),
    }),
    {
      name: "cwa:row4View",
      version: 2,
      // v1 used "today" as the canonical alt-of-lists. The Row 4
      // redesign replaced that content (and moved the agenda down
      // to Row 5), so any persisted "today" preference becomes
      // "components" going forward — the user keeps "I prefer
      // the non-lists view" semantics without us silently
      // resurrecting the old agenda layout.
      migrate: (persisted: any, fromVersion) => {
        if (!persisted) return persisted;
        if (fromVersion < 2 && persisted.preference === "today") {
          return { ...persisted, preference: "components" };
        }
        return persisted;
      },
    },
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
