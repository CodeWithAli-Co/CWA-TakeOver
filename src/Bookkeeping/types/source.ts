// ───────────────────────────────────────────────────────────────────
// Source connectors + imported-transaction inbox.
//
// Stripe + Plaid push raw events into ImportedTransaction. The
// reconciliation engine turns each into a JournalEntry — either by
// matching an existing JE, applying a rule, or sitting in the inbox
// for human review.
// ───────────────────────────────────────────────────────────────────

import type { ISO4217 } from "./entity";

export type TxSource = "stripe" | "plaid" | "manual_import";

export type ImportedTxStatus =
  | "pending"     // waiting to be processed
  | "matched"     // auto-matched against an existing JE
  | "journaled"   // a new JE was created from this
  | "excluded"    // operator chose to ignore (e.g. internal transfer)
  | "duplicate";  // dedupe caught it

export interface ImportedTransaction {
  id: string;
  entityId: string;
  source: TxSource;
  /** ID from the source system (Stripe charge id, Plaid transaction id). */
  sourceId: string;
  postedAt: string; // ISO8601 — when the tx hit the source system
  amount: number;   // positive = inflow, negative = outflow
  currency: ISO4217;
  description: string;
  /** Which GL account this tx is associated with (e.g. "Cash - Chase"
   *  for a Plaid bank tx, "Stripe Pending" for a Stripe charge). */
  accountId?: string;
  status: ImportedTxStatus;
  matchedEntryId?: string;
  /** Raw payload from the source — kept verbatim for debugging /
   *  re-import without losing fields. */
  raw: Record<string, unknown>;
  createdAt: string;
}

/** A rule that auto-categorizes incoming transactions. */
export interface ReconciliationRule {
  id: string;
  entityId: string;
  priority: number; // lower = applied first
  match: {
    descriptionRegex?: string;
    amountMin?: number;
    amountMax?: number;
    source?: TxSource;
    accountId?: string; // restrict to a specific bank/credit card
  };
  action: {
    targetAccountId: string;
    counterpartyId?: string;
    memoTemplate?: string;
  };
  enabled: boolean;
  hitCount: number;
  createdAt: string;
}

export interface ImportRun {
  id: string;
  entityId: string;
  source: TxSource;
  startedAt: string;
  finishedAt?: string;
  transactionsPulled: number;
  transactionsNew: number;
  errorMessage?: string;
}
