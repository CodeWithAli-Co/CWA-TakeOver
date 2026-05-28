/**
 * scheduleStatsStore.ts — Global "see my schedule numbers" state.
 *
 * Pairs with ScheduleStatsModal + ScheduleStatsShortcut. The shortcut
 * (Cmd+Shift+S / Ctrl+Shift+S, mounted at root) flips `open`; the
 * modal subscribes. Toolbar buttons elsewhere (the Schedule page,
 * Cmd+K palette verbs, etc.) call `openStats()` directly.
 *
 * Why a store: the keyboard listener lives at the root, the trigger
 * button lives on a page, and the modal lives at the root too. A
 * Zustand store lets all three talk without prop-drilling. Mirrors
 * the QuickCompose pattern.
 *
 * Transient only — never persisted. Closing clears nothing because
 * the modal owns its own data fetch via useShiftsInRange.
 */

import { create } from "zustand";

export interface ScheduleStatsState {
  /** Modal visible? */
  open: boolean;
  openStats: () => void;
  closeStats: () => void;
  toggleStats: () => void;
}

export const useScheduleStats = create<ScheduleStatsState>((set) => ({
  open: false,
  openStats: () => set({ open: true }),
  closeStats: () => set({ open: false }),
  toggleStats: () => set((s) => ({ open: !s.open })),
}));
