/**
 * createGrowthTrackStore.ts — Zustand state for the global
 * Create-Growth-Track composer modal. Opened from the Cmd+K
 * palette ("Create growth track") by C-level operators.
 *
 * Modal subscribes to `useCreateGrowthTrackDialog()`. Optional
 * prefilledEmployeeId routes the modal straight to a specific
 * employee (useful for a future "create track for this person"
 * button on an employee detail page).
 */

import { create } from "zustand";

export interface CreateGrowthTrackState {
  open: boolean;
  prefilledEmployeeId: string | null;
  openDialog: (opts?: { employeeId?: string }) => void;
  closeDialog: () => void;
}

export const useCreateGrowthTrackDialog = create<CreateGrowthTrackState>(
  (set) => ({
    open: false,
    prefilledEmployeeId: null,
    openDialog: (opts) =>
      set({ open: true, prefilledEmployeeId: opts?.employeeId ?? null }),
    closeDialog: () => set({ open: false, prefilledEmployeeId: null }),
  }),
);
