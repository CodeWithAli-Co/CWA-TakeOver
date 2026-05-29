/**
 * scheduleFocusStore.ts — Tiny cross-component channel for "open the
 * Schedule page focused on a specific calendar day".
 *
 * Use case: dashboard meeting rows want clicking → /schedule but the
 * route has no search-param plumbing in this version. Rather than add
 * a URL contract, the meeting row stashes the target date in this
 * store and navigates; the TimesheetPage `consume`s the date on
 * mount and snaps its `weekAnchor` to it. After consumption the
 * store empties — subsequent navigations to /schedule open on today.
 *
 *   meeting row → useScheduleFocus().setFocusDate(date)
 *                 navigate({ to: "/schedule" })
 *
 *   TimesheetPage mount → const d = useScheduleFocus.getState().consume()
 *                         if (d) setWeekAnchor(d)
 */

import { create } from "zustand";

interface ScheduleFocusState {
  focusDate: Date | null;
  /** Set the next focus date — does not navigate. */
  setFocusDate: (d: Date) => void;
  /** Read + clear in one shot so TimesheetPage only honours it once. */
  consume: () => Date | null;
}

export const useScheduleFocus = create<ScheduleFocusState>((set, get) => ({
  focusDate: null,
  setFocusDate: (d) => set({ focusDate: d }),
  consume: () => {
    const d = get().focusDate;
    if (d) set({ focusDate: null });
    return d;
  },
}));
