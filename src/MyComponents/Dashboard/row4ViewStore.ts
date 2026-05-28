/**
 * row4ViewStore.ts — Which Row 4 variant is the home dashboard
 * currently showing?
 *
 *   · "lists"   — the original full Tasks + Meetings widgets (default).
 *                 Useful for triage and queue-management.
 *
 *   · "today"   — the unified Today Agenda + AddMeeting panel. Useful
 *                 when you want a focused, time-anchored view of your
 *                 day rather than full lists.
 *
 * The two trade places via:
 *   · the small toggle button in the row's chrome,
 *   · the Cmd+K command palette ("switch row 4 view"),
 *   · or any other entry point that calls setRow4View().
 *
 * Persisted to localStorage so the user's last choice survives a
 * refresh — switching is meant to be a settled preference, not a
 * transient toggle.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Row4View = "lists" | "today";

interface Row4ViewState {
  row4View: Row4View;
  setRow4View: (v: Row4View) => void;
  toggleRow4View: () => void;
}

export const useRow4View = create<Row4ViewState>()(
  persist(
    (set) => ({
      row4View: "lists",
      setRow4View: (v) => set({ row4View: v }),
      toggleRow4View: () =>
        set((s) => ({ row4View: s.row4View === "lists" ? "today" : "lists" })),
    }),
    { name: "cwa:row4View" },
  ),
);
