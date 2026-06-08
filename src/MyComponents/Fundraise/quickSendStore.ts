/**
 * quickSendStore.ts — Zustand store backing the ⚡ Quick Send button
 * on KanbanInvestorCard.
 *
 * Flow per investor:
 *   1. Operator clicks ⚡ on the card
 *   2. enqueue() — entry lands here with status: "drafting"
 *   3. QuickSendToast picks it up, runs Axon draft + Gmail send, and
 *      flips status -> "sending" -> "sent" or "failed"
 *   4. Operator sees the toast in the bottom-right with live status
 *   5. Auto-dismiss after a few seconds on success (operator can also
 *      X out manually). Failures stay until dismissed.
 *
 * Why a store and not local state?
 *   - The toast outlives the kanban card (operator might scroll away
 *     mid-send). Persisting on the page surface lets multiple sends
 *     queue up without losing visibility.
 *   - Cmd+K can enqueue a quick send from anywhere later if we want.
 */

import { create } from "zustand";

export type QuickSendStatus =
  | "drafting"
  | "sending"
  | "sent"
  | "failed";

export interface QuickSendEntry {
  id: string;
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  status: QuickSendStatus;
  error?: string;
  /** Wall time the entry was enqueued -- used by the toast to fade
   *  successful sends after a few seconds. */
  startedAt: number;
}

export interface NewQuickSendInput {
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
}

interface QuickSendState {
  entries: Map<string, QuickSendEntry>;
  enqueue: (input: NewQuickSendInput) => string;
  setStatus: (id: string, status: QuickSendStatus, error?: string) => void;
  remove: (id: string) => void;
}

export const useQuickSendStore = create<QuickSendState>((set) => ({
  entries: new Map(),
  enqueue: (input) => {
    // Random id — we don't need cryptographic uniqueness, just a key
    // for the Map + React render.
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((s) => {
      const next = new Map(s.entries);
      next.set(id, {
        id,
        ...input,
        status: "drafting",
        startedAt: Date.now(),
      });
      return { entries: next };
    });
    return id;
  },
  setStatus: (id, status, error) =>
    set((s) => {
      const cur = s.entries.get(id);
      if (!cur) return {};
      const next = new Map(s.entries);
      next.set(id, { ...cur, status, error });
      return { entries: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = new Map(s.entries);
      next.delete(id);
      return { entries: next };
    }),
}));
