/**
 * quickSendStore.ts -- backing store for the Quick Send pipeline +
 * the Outreach tab's live queue tile.
 *
 * Flow per investor:
 *   1. Operator clicks Quick Send (or shotgun fan-out) on the kanban.
 *   2. enqueue() -- entry lands here with status "queued" (paced via
 *      the queue clock) or "drafting" (first entry of a fresh group).
 *   3. The Outreach tab's QueueTile (which mounts a per-entry
 *      pipeline runner) waits for the entry's notBefore slot, then
 *      runs Axon draft + Gmail send, flipping status:
 *        queued -> drafting -> sending -> sent | failed
 *   4. Status updates re-render the tile + the operator can click a
 *      row to inspect the resolved subject + body in a modal.
 *   5. Sent entries STAY in the store for the rest of the session so
 *      the operator can audit what went out. (They used to auto-vanish
 *      after 6s when the old bottom-right toasts were the only UI;
 *      now the Outreach tab is the source of truth and a session-
 *      length history is more useful than aggressive auto-dismiss.)
 *      The operator can clear individual rows with the X button.
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
// Two gaps:
//   INTRA-GROUP (same investor + same partner = shotgun pattern
//   guesses for one human) -> 6-12s. They go to the same inbox; one
//   delivers, the rest bounce. Spacing them by minutes is wasted
//   time, not deliverability.
//   INTER-PARTNER (distinct human) -> 25-50s. The real anti-spam
//   gap matched to Gmail's burst classifier. Randomized so the
//   cadence isn't perfectly periodic (which is itself a signal).
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
  // Shotgun mode: one draft fanned out to N candidate addresses.
  precomputed_draft?: {
    subject: string;
    body: string;
    hookUsed: string;
  };
  // Pattern label for the shotgun candidate (or "verified" for known
  // emails). Used by the deliverability tile and the employee/source
  // pill in the row.
  pattern?: string;
  // Wall time the entry was enqueued.
  startedAt: number;
  // Wall time this entry is allowed to begin its send pipeline.
  notBefore: number;
  // RESOLVED subject + body captured once the row's pipeline has
  // either pulled it off precomputed_draft or drafted fresh via
  // Axon. The Outreach tab body modal reads this so the operator
  // can audit what actually went out per address.
  resolvedSubject?: string;
  resolvedBody?: string;
  // Wall time the send completed (sent | failed).
  finishedAt?: number;
  // For the employee badge on sent rows: which Gmail alias/display
  // name the row was sent AS. Stamped after we kick the mutation
  // so the modal can show "Sent as Ali <ali@yourco.com>".
  sentAsAlias?: string;
  sentAsDisplayName?: string;
  // Pixel-tracking id. Generated on enqueue (UUID), passed to
  // /api/gmail/send so the server can embed an invisible
  // <img src=".../track/{tracking_id}.gif"> in the outbound body
  // and stamp the same id into the activity row's metadata.
  // useEmailOpens then aggregates opens for tracked sends.
  tracking_id?: string;
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

export interface QuickSendPatch {
  status?: QuickSendStatus;
  error?: string;
  resolvedSubject?: string;
  resolvedBody?: string;
  finishedAt?: number;
  sentAsAlias?: string;
  sentAsDisplayName?: string;
}

interface QuickSendState {
  entries: Map<string, QuickSendEntry>;
  enqueue: (input: NewQuickSendInput) => string;
  setStatus: (id: string, status: QuickSendStatus, error?: string) => void;
  patch: (id: string, patch: QuickSendPatch) => void;
  remove: (id: string) => void;
  clearTerminal: () => void;
}

// Module-level queue clock + last-group key. queueClock holds the
// next free wall-time slot; lastGroupKey lets the next enqueue
// decide between intra-group and inter-partner gap.
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

    // Per-send pixel-tracking id. Generated upfront so it's stable
    // across the runner's pipeline (draft -> send -> activity row).
    const tracking_id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `trk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
        tracking_id,
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
  patch: (id, patch) =>
    set((s) => {
      const cur = s.entries.get(id);
      if (!cur) return {};
      const next = new Map(s.entries);
      next.set(id, { ...cur, ...patch });
      return { entries: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = new Map(s.entries);
      next.delete(id);
      return { entries: next };
    }),
  // "Clear completed" affordance. Wipes sent + failed entries in one
  // pass; leaves queued / drafting / sending alone.
  clearTerminal: () =>
    set((s) => {
      const next = new Map<string, QuickSendEntry>();
      for (const [k, v] of s.entries) {
        if (v.status !== "sent" && v.status !== "failed") next.set(k, v);
      }
      return { entries: next };
    }),
}));
