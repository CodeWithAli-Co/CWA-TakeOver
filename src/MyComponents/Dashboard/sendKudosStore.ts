/**
 * sendKudosStore.ts — Zustand state for the global Send-Kudos
 * composer modal. Opened from the Cmd+K palette ("Send kudos").
 *
 * Modal subscribes to `useSendKudos()`. Single source of truth
 * for open/close + optional prefilled target supa_id (e.g. if a
 * future palette verb pre-routes to a specific person).
 */

import { create } from "zustand";

export interface SendKudosState {
  open: boolean;
  prefilledTargetId: string | null;
  openDialog: (opts?: { targetId?: string }) => void;
  closeDialog: () => void;
}

export const useSendKudosDialog = create<SendKudosState>((set) => ({
  open: false,
  prefilledTargetId: null,
  openDialog: (opts) =>
    set({ open: true, prefilledTargetId: opts?.targetId ?? null }),
  closeDialog: () => set({ open: false, prefilledTargetId: null }),
}));
