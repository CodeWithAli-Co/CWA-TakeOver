/**
 * logActivityStore.ts — Zustand state for the global Log-Activity
 * composer modal. Opened from:
 *   · Cmd+K palette ("Log call", "Log email", "Log meeting", "Log note")
 *   · Deal detail drawer "+ Log activity" button
 *   · Contact detail drawer "+ Log activity" button
 *   · Company detail drawer "+ Log activity" button
 *
 * The store holds a partial "prefill" payload so any caller can
 * pre-route the modal to a specific entity + type and the
 * composer just picks up from there.
 */

import { create } from "zustand";
import type { ActivityType } from "@/stores/crm";

export interface LogActivityPrefill {
  type?: ActivityType;
  contactId?: string;
  dealId?: string;
  companyId?: string;
  /** Optional initial title — used when palette typed "log call with Acme". */
  title?: string;
}

export interface LogActivityState {
  open: boolean;
  prefill: LogActivityPrefill;
  openDialog: (prefill?: LogActivityPrefill) => void;
  closeDialog: () => void;
}

export const useLogActivityDialog = create<LogActivityState>((set) => ({
  open: false,
  prefill: {},
  openDialog: (prefill) => set({ open: true, prefill: prefill ?? {} }),
  closeDialog: () => set({ open: false, prefill: {} }),
}));
