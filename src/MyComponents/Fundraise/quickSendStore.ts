/**
 * quickSendStore.ts -- Zustand store backing the Quick Send button
 * on KanbanInvestorCard.
 *
 * Flow per investor:
 *   1. Operator clicks the bolt on the card
 *   2. enqueue() -- entry lands here with status: "queued" or "drafting"
 *   3. QuickSendToast picks it up, waits for its paced slot, then
 *      runs Axon draft + Gmail send, flipping status -> "sending"
 *      -> "sent" or "failed"
 *   4. Operator sees the toast in the bottom-right with live status
 *   5. Auto-dismiss on success; failures stay until dismissed;
 *      queued rows can be cancelled with the X before they fire.
 */

import { create } from "zustand";

export type QuickSendStatus =
  | "queued"
  | "drafting"
  | "sending"
  | "sent"
  | "failed";

// Send pacing.
//
// Gmail's outbound abuse classifier flags bursts of cold mail to
// DISTINCT recipients. Shotgun fan-out (one partner -> N pattern
// guesses at the same domain) is a different shape: all N addresses
// resolve to the same human, N-1 will bounce, and one will land.
// Spacing those N guesses out for minutes does nothing for spam --
// it just makes the operator wait. The actual spam-pacing concern
// is between distinct partners.
//
// So we keep two gaps:
//
//   INTRA-GROUP (same investor + same partner, i.e. shotgun guesses
//   for the same person) -> 6-12s. Quick enough to find the right
//   address fast, slow enough to let the receiving mail server
//   distinguish them.
//
//   INTER-PARTNER (new investor / new partner) -> 25-50s. The real
//   anti-spam gap. Randomized so the cadence isn't perfectly
//   periodic.
//
// With 14 distinct partners + 5 shotgun guesses each (70 entries),
// total queue time is roughly:
//   14 * 37s (inter avg) + 14 * 4 * 9s (intra avg)
//   = 8.6 min + 8.4 min = ~17 min, not the ~70 min the flat gap
//   produced.
const INTER_PARTNER_GAP_MIN_MS = 25_000;
const INTER_PARTNER_GAP_MAX_MS = 50_000;
const INTRA_GROUP_GAP_MIN_MS = 6_000;
const INTRA_GROUP_GAP_MAX_MS = 12_000;
const jitter = (min: number, max: number) =>
  min + Math.random() * (max - min);
const interPartnerGap = () =>
  jitter(INTER_PARTNER_GAP_MIN_MS, INTER_PARTNER_GAP_MAX_MS);
const intraGroupGap = () =>
  jitter(INTRA_GROUP_GAP_MIN_MS, INTRA_GROUP_GAP_MAX_MS);

export interface QuickSendEntry {
  id: string;
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  status: QuickSendStatus;
  error?: string;
  precomputed_draft?: {
    subject: string;
    body: string;
    hookUsed: string;
  };
  pattern?: string;
  startedAt: number;
  notBefore: number;
}

export interface NewQuickSendInput {
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  precomputed_draft?: {
    subject: string;
    body: string;
    hookUsed: string;
  };
  pattern?: string;
}

interface QuickSendState {
  entries: Map<string, QuickSendEntry>;
  enqueue: (input: NewQuickSendInput) => string;
  setStatus: (id: string, status: QuickSendStatus, error?: string) => void;
  remove: (id: string) => void;
}

// Module-level queue clock + last-group key. queueClock holds the
// next free wall-time slot; lastGroupKey lets the next enqueue
// decide between the intra-group and inter-partner gap.
let queueClock = 0;
let lastGroupKey: string | null = null;

export const useQuickSendStore = create<QuickSendState>((set) => ({
  entries: new Map(),
  enqueue: (input) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const now = Date.now();
    const slotStart = Math.max(now, queueClock);
    const groupKey = `${input.investor_id}::${input.partner_id}`;
    const isContinuation = lastGroupKey === groupKey;
    const gap = isContinuation ? intraGroupGap() : interPartnerGap();
    queueClock = slotStart + gap;
    lastGroupKey = groupKey;

    set((s) => {
      const next = new Map(s.entries);
      next.set(id, {
        id,
        ...input,
        status:
          slotStart > now
            ? "queued"
            : input.precomputed_draft
              ? "sending"
              : "drafting",
        startedAt: now,
        notBefore: slotStart,
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
