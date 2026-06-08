/**
 * batchOutreachStore.ts — state machine for the BatchOutreachModal.
 *
 * Five-state flow:
 *   picker   → operator selects which investors to draft for
 *   drafting → Axon drafts all in parallel (parallel API calls)
 *   review   → list of N draft cards, each editable + approveable
 *   sending  → sequential Gmail sends with 2.5s spacing
 *   done     → summary with per-row outcomes
 *
 * State lives in a zustand store rather than React state because:
 *   1. The modal can be closed mid-batch (user wants to scroll
 *      the kanban) and reopened without losing the work
 *   2. The send queue may need to be aborted from elsewhere
 *      (kill switch on the toolbar, etc.)
 *   3. Future: Cmd+K "/batch send" verb can push directly into the
 *      sending state without remounting the modal
 *
 * Note: drafts are NOT persisted across page reloads. If the
 * operator hard-refreshes mid-batch, they lose the drafts. That's
 * intentional -- persisting unsent drafts in a CRM creates a
 * graveyard that nobody revisits, and Axon can re-draft in 10s
 * anyway.
 */

import { create } from "zustand";
import type { DraftInvestorEmailResult } from "@/Fundraise/draftInvestorEmail";

export type BatchStage =
  | "picker"
  | "drafting"
  | "review"
  | "sending"
  | "done";

/** Per-investor record. We key by investor.id because that's what
 *  the InvestorListEntry exposes; the partner_id is captured per
 *  draft because an investor may have multiple partners. */
export interface BatchDraft {
  investor_id: string;
  /** Display name for the review list (firm name). */
  firm_name: string;
  /** Which partner this draft is addressed to. We pick the first
   *  partner with an email at draft time -- the operator can swap
   *  inline if they want a different one. */
  partner_id: string;
  partner_name: string;
  partner_email: string;
  /** Editable. Initialized from Axon's draft. */
  subject: string;
  body: string;
  /** Axon's one-line explanation of the hook (for the right-rail
   *  sanity-check in the review pane). */
  hook_used: string;
  /** Operator's approval gate. Defaults TRUE so the dominant flow
   *  is "scan + uncheck a few" rather than "approve each". */
  approved: boolean;
  /** Per-row outcome state during the sending phase. */
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  /** Set when status === "failed". */
  error?: string;
  /** Set when status === "sent". Gmail's thread id. */
  thread_id?: string;
}

export interface BatchOutreachState {
  open: boolean;
  stage: BatchStage;

  /** Picker selection (investor IDs). Survives stage transitions
   *  so going back to picker from review re-opens with the same
   *  set checked. */
  selectedIds: Set<string>;

  /** Per-investor draft records. Keyed by investor.id for fast
   *  per-row updates. */
  drafts: Map<string, BatchDraft>;

  /** Sending progress. */
  progress: { current: number; total: number };

  /** Set when the operator clicks "Stop remaining sends". The
   *  send loop checks this between rows and bails. */
  aborted: boolean;

  /** ISO timestamp captured when the send loop starts. Used by the
   *  bounce-check panel in the Done state to scope its Gmail query
   *  to bounces from THIS batch (not ancient ones). Null until the
   *  first send goes out. */
  sendStartedAt: string | null;

  // ── Actions ────────────────────────────────────────────────
  openModal: () => void;
  closeModal: () => void;
  reset: () => void;

  setStage: (stage: BatchStage) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  setDrafts: (drafts: BatchDraft[]) => void;
  patchDraft: (id: string, patch: Partial<BatchDraft>) => void;

  setProgress: (current: number, total: number) => void;
  abort: () => void;

  /** Stamp sendStartedAt with the current time. Call once, right
   *  before the first send goes out. The bounce checker uses this
   *  as the `since` bound. */
  markSendStarted: () => void;
}

const emptyDrafts = new Map<string, BatchDraft>();
const emptySelection = new Set<string>();

export const useBatchOutreachStore = create<BatchOutreachState>((set) => ({
  open: false,
  stage: "picker",
  selectedIds: emptySelection,
  drafts: emptyDrafts,
  progress: { current: 0, total: 0 },
  aborted: false,
  sendStartedAt: null,

  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
  reset: () =>
    set({
      open: false,
      stage: "picker",
      selectedIds: new Set(),
      drafts: new Map(),
      progress: { current: 0, total: 0 },
      aborted: false,
      sendStartedAt: null,
    }),

  setStage: (stage) => set({ stage }),

  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: (ids) =>
    set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setDrafts: (drafts) =>
    set({
      drafts: new Map(drafts.map((d) => [d.investor_id, d])),
    }),

  patchDraft: (id, patch) =>
    set((s) => {
      const cur = s.drafts.get(id);
      if (!cur) return {};
      const next = new Map(s.drafts);
      next.set(id, { ...cur, ...patch });
      return { drafts: next };
    }),

  setProgress: (current, total) =>
    set({ progress: { current, total } }),

  abort: () => set({ aborted: true }),

  markSendStarted: () =>
    set((s) =>
      s.sendStartedAt ? {} : { sendStartedAt: new Date().toISOString() },
    ),
}));

/** Build a BatchDraft skeleton from an Axon result + investor metadata.
 *  Exported so the modal can construct rows without duplicating
 *  this boilerplate. */
export function makeBatchDraft(args: {
  investor_id: string;
  firm_name: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  result: DraftInvestorEmailResult;
}): BatchDraft {
  return {
    investor_id: args.investor_id,
    firm_name: args.firm_name,
    partner_id: args.partner_id,
    partner_name: args.partner_name,
    partner_email: args.partner_email,
    subject: args.result.subject,
    body: args.result.body,
    hook_used: args.result.hookUsed,
    approved: !args.result.error && !!args.result.body.trim(),
    status: "pending",
  };
}
