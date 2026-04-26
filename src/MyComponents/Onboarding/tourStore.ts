// ───────────────────────────────────────────────────────────────────
// Guided Tour — Zustand store.
//
// Drives the post-onboarding walkthrough. The tour is a fixed list of
// "stops" (routes + titles + bodies). When the user advances:
//   1. We navigate the router to step.route.
//   2. The overlay re-positions / re-renders for the new step.
//   3. On finish or skip, we stamp localStorage so the tour doesn't
//      auto-play next time. The user can manually relaunch via the
//      Onboarding dashboard.
//
// Single source of truth — both the banner ("Continue → start tour")
// and the manual "Take a tour" button push the same start() action.
// ───────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TourStop {
  id: string;
  /** Router path the overlay navigates to before showing this stop. */
  route: string;
  /** Optional CSS / data-attribute selector for an element to spotlight.
   *  When omitted, the tour shows a centered intro card with no cutout. */
  selector?: string;
  title: string;
  body: string;
  /** Friendly label for "what to do next" — shows under the body. */
  hint?: string;
  /** Where to anchor the tooltip card relative to the spotlit element.
   *  Ignored when selector is omitted (card renders centered). */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

interface TourState {
  /** Active tour or null when idle. */
  active: boolean;
  /** Index into the steps array. */
  index: number;
  /** Step list — set when start() is called. */
  steps: TourStop[];
  /** When true, user has seen the tour at least once. Persisted. */
  seen: boolean;

  start: (steps: TourStop[], opts?: { reset?: boolean }) => void;
  next: () => void;
  prev: () => void;
  finish: () => void;
  skip: () => void;
  /** Reset the "seen" flag so the tour auto-plays again next sign-in. */
  resetSeen: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      active: false,
      index: 0,
      steps: [],
      seen: false,

      start: (steps, opts) => {
        if (!steps.length) return;
        set({
          active: true,
          index: 0,
          steps,
          ...(opts?.reset ? { seen: false } : {}),
        });
      },

      next: () => {
        const s = get();
        if (s.index >= s.steps.length - 1) {
          set({ active: false, index: 0, seen: true });
          return;
        }
        set({ index: s.index + 1 });
      },

      prev: () => {
        const s = get();
        set({ index: Math.max(0, s.index - 1) });
      },

      finish: () => {
        set({ active: false, index: 0, seen: true });
      },

      skip: () => {
        // Skipping still counts as "seen" — don't nag the user every
        // sign-in. They can replay manually from the Onboarding page.
        set({ active: false, index: 0, seen: true });
      },

      resetSeen: () => {
        set({ seen: false });
      },
    }),
    {
      // Bumped v1 → v2 to invalidate stale `{ seen: true }` blobs from
      // earlier testing. zustand sees no v2 entry and hydrates with the
      // default seen: false, so the tour auto-fires on the next
      // sign-in for everyone. Once the user finishes / skips, this
      // key flips to true and the tour stays quiet thereafter.
      name: "cwa-onboarding-tour-v2",
      // Only persist seen — index/active/steps are always session-scoped.
      partialize: (s) => ({ seen: s.seen }),
    },
  ),
);
