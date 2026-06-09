/**
 * quickSendStore.ts — Zustand store backing the Quick Send button
 * on KanbanInvestorCard.
 *
 * Flow per investor:
 *   1. Operator clicks the bolt on the card
 *   2. enqueue() — entry lands here with status: "queued" or "drafting"
 *   3. QuickSendToast picks it up, waits for its paced slot, then
 *      runs Axon draft + Gmail send, flipping status -> "sending"
 *      -> "sent" or "failed"
 *   4. Operator sees the toast in the bottom-right with live status
 *   5. Auto-dismiss after a few seconds on success (operator can
 *      also X out manually). Failures stay until dismissed; queued
 *      rows can be cancelled with the X before they fire.
 *
 * Why a store and not local state?
 *   - The toast outlives the kanban card (operator might scroll away
 *     mid-send). Persisting on the page surface lets multiple sends
 *     queue up without losing visibility.
 *   - Cmd+K can enqueue a quick send from anywhere later if we want.
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
// Gmail's outbound abuse classifier flags bursts: N messages in M
// seconds, especially when they share subject/body skeleton or hit
// the same domain. Shotgun fan-out (one partner -> 5 pattern guesses
// at the same domain) is the worst case -- pre-pacing, all five
// fired the moment the operator clicked the bolt.
//
// We pace by stamping each enqueued entry with a `notBefore`
// timestamp. The toast row waits until that wall-time before kicking
// the send pipeline. Per-enqueue gap is randomized between MIN and
// MAX so the cadence isn't perfectly periodic (which is itself a
// spam signal).
//
// Numbers: 35s-75s. Slow enough to look human, fast enough that a
// 5-candidate fan-out finishes in about 3-5 minutes.
const SEND_GAP_MIN_MS = 35_000;
const SEND_GAP_MAX_MS = 75_000;
const jitteredGap = () =>
  SEND_GAP_MIN_MS + Math.random() * (SEND_GAP_MAX_MS - SEND_GAP_MIN_MS);

export interface QuickSendEntry {
  id: string;
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  status: QuickSendStatus;
  error?: string;
  // Phase 11.1: pre-computed draft. When set, the toast row skips
  // the drafting phase and jumps straight to sending. Used by
  // shotgun mode where one draft is fanned out to N candidate
  // addresses for the same partner.
  precomputed_draft?: {
    subject: string;
    body: string;
    hookUsed: string;
  };
  // Phase 11.1: which pattern produced this candidate. 'verified'
  // for known emails, 'first'/'first.last'/etc for pattern guesses.
  pattern?: string;
  // Wall time the entry was enqueued -- used by the toast to fade
  // successful sends after a few seconds.
  startedAt: number;
  // Wall time this entry is allowed to begin its send pipeline.
  // Stamped at enqueue from a rolling queue clock so consecutive
  // enqueues land in distinct slots (35-75s apart). The toast row
  // shows a countdown while now < notBefore.
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

// Module-level queue clock. Tracks the wall time of the next free
// send slot. Lives outside zustand state because mutating it inside
// `set` would create extra renders and it's purely a scheduling
// helper -- the UI reads notBefore off each entry directly.
let queueClock = 0;

export const useQuickSendStore = create<QuickSendState>((set) => ({
  entries: new Map(),
  enqueue: (input) => {
    // Random id -- we don't need cryptographic uniqueness, just a
    // key for the Map + React render.
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Advance the queue clock. The first entry after an idle period
    // goes immediately (notBefore = now). Subsequent enqueues stack
    // at jittered intervals so we never burst-send.
    const now = Date.now();
    const slotStart = Math.max(now, queueClock);
    queueClock = slotStart + jitteredGap();

    set((s) => {
      const next = new Map(s.entries);
      next.set(id, {
        id,
        ...input,
        // Initial status: if we have to wait, the row shows "queued"
        // until notBefore. Otherwise jump straight to the right
        // first-active state (precomputed drafts skip "drafting").
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
