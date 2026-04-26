// ───────────────────────────────────────────────────────────────────
// Journal Entry — the atom of accounting.
//
// Every economic event is one JournalEntry made of two or more
// JournalLines whose debits and credits balance. Posting is atomic:
// the engine refuses partial / unbalanced entries.
//
// Posted entries are immutable. Corrections happen via a NEW entry
// that reverses the original (`reversedBy`).
// ───────────────────────────────────────────────────────────────────

import type { ISO4217 } from "./entity";

export type EntryStatus = "draft" | "posted" | "reversed";

export type EntrySource =
  | "manual"
  | "stripe"
  | "plaid"
  | "invoicer"
  | "depreciation"
  | "fx_revaluation"
  | "period_close";

export interface JournalEntry {
  id: string;
  entityId: string;
  /** Economic date — YYYY-MM-DD. Independent of created_at. */
  date: string;
  memo: string;
  status: EntryStatus;
  source: EntrySource;
  /** External id from the source system (Stripe charge id, etc.). */
  sourceRef?: string;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  reversedBy?: string;
  /** Convenience fields denormalized from lines for fast list rendering.
   *  Always equals SUM(base_debit) which equals SUM(base_credit). */
  totalBase: number;
}

export interface JournalLine {
  id: string;
  entryId: string;
  accountId: string;
  /** Exactly one of debit / credit is non-zero. Both stored in the
   *  TRANSACTION currency (could be foreign for an international
   *  invoice). The base*-fields hold the entity-base-currency post-FX. */
  debit: number;
  credit: number;
  currency: ISO4217;
  fxRate: number; // 1.0 when transaction currency === base currency
  baseDebit: number;
  baseCredit: number;
  memo?: string;
  counterpartyId?: string;
}

export interface DraftJournalEntry {
  entityId: string;
  date: string;
  memo: string;
  source: EntrySource;
  sourceRef?: string;
  lines: Array<Omit<JournalLine, "id" | "entryId" | "baseDebit" | "baseCredit" | "fxRate"> & {
    fxRate?: number; // optional — defaults to 1 if currency = base
  }>;
}

/** What the engine returns when validating a draft. */
export interface JournalValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalBaseDebit: number;
  totalBaseCredit: number;
}
