// ───────────────────────────────────────────────────────────────────
// Ledger engine — the only place a JournalEntry gets created or
// reversed. All other code goes through these functions.
//
// Three operations:
//   • postEntry(draft)       — validate + finalize a draft into a
//                              posted entry (atomic, no half-state)
//   • reverseEntry(entryId)  — create a counter-entry that flips the
//                              original; both stay in history
//   • computeBaseAmounts()   — fill in baseDebit / baseCredit from
//                              currency + fxRate
//
// Storage is abstracted behind a `LedgerStore` interface so the engine
// runs the same against an in-memory store (tests), Zustand (local
// optimistic), or Supabase RPC (server of truth).
// ───────────────────────────────────────────────────────────────────

import type {
  DraftJournalEntry,
  JournalEntry,
  JournalLine,
} from "../types/journal";
import type { GLAccount } from "../types/coa";
import type { Entity, FiscalPeriod } from "../types/entity";
import { roundCents, validateDraft } from "./validation";

/** Storage adapter. Implementations live in /stores or are supplied
 *  by tests. The engine doesn't care where the data sleeps. */
export interface LedgerStore {
  insertEntry(entry: JournalEntry): Promise<void>;
  insertLines(lines: JournalLine[]): Promise<void>;
  getEntry(entryId: string): Promise<JournalEntry | null>;
  getLines(entryId: string): Promise<JournalLine[]>;
  /** Append-only audit log — see types/source AuditLog (TBD). */
  recordAudit(args: {
    entityId: string;
    actor: string;
    action: string;
    targetTable: string;
    targetId: string;
    after?: unknown;
    before?: unknown;
  }): Promise<void>;
}

export interface PostContext {
  store: LedgerStore;
  entity: Entity;
  accounts: GLAccount[];
  periods: FiscalPeriod[];
  /** Who's posting — user id, or "system" for source-driven posts. */
  actor: string;
  /** id generator — caller can swap in DB-side uuid_generate_v4 etc. */
  newId: () => string;
}

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
    public readonly warnings: string[] = [],
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

/**
 * Validate a DraftJournalEntry, fill in computed fields, persist as
 * `posted`. Atomic — either the whole entry lands or nothing does
 * (the store is responsible for transactional semantics).
 */
export async function postEntry(
  draft: DraftJournalEntry,
  ctx: PostContext,
): Promise<JournalEntry> {
  // Build the validation context first.
  const accountsById = new Map(ctx.accounts.map((a) => [a.id, a]));
  const validation = validateDraft(draft, {
    accountsById,
    periods: ctx.periods,
    baseCurrency: ctx.entity.baseCurrency,
  });
  if (!validation.ok) {
    throw new LedgerError(
      "Journal entry failed validation. See .errors for details.",
      validation.errors,
      validation.warnings,
    );
  }

  // ── Fill in entry shell ────────────────────────────────────────
  const entryId = ctx.newId();
  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id: entryId,
    entityId: draft.entityId,
    date: draft.date,
    memo: draft.memo,
    status: "posted",
    source: draft.source,
    sourceRef: draft.sourceRef,
    createdBy: ctx.actor,
    createdAt: now,
    postedAt: now,
    totalBase: validation.totalBaseDebit, // === totalBaseCredit
  };

  // ── Build lines with computed base amounts ────────────────────
  const lines: JournalLine[] = draft.lines.map((l) => {
    const fxRate = l.fxRate ?? (l.currency === ctx.entity.baseCurrency ? 1 : 0);
    const debit = Number(l.debit) || 0;
    const credit = Number(l.credit) || 0;
    return {
      id: ctx.newId(),
      entryId,
      accountId: l.accountId,
      debit,
      credit,
      currency: l.currency,
      fxRate,
      baseDebit: roundCents(debit * fxRate),
      baseCredit: roundCents(credit * fxRate),
      memo: l.memo,
      counterpartyId: l.counterpartyId,
    };
  });

  // ── Persist ────────────────────────────────────────────────────
  await ctx.store.insertEntry(entry);
  await ctx.store.insertLines(lines);
  await ctx.store.recordAudit({
    entityId: entry.entityId,
    actor: ctx.actor,
    action: "post_entry",
    targetTable: "journal_entry",
    targetId: entry.id,
    after: { entry, lines },
  });

  return entry;
}

/**
 * Reverse a previously-posted entry by creating a NEW entry that flips
 * every debit to a credit (and vice-versa) on the same accounts on the
 * date the operator chooses (defaults to today). The original stays
 * in history; the two are linked via `reversedBy`.
 *
 * Used for corrections after a period is locked, or to undo a posting
 * where the original cannot legally be edited.
 */
export async function reverseEntry(
  originalEntryId: string,
  reversalDate: string,
  ctx: PostContext,
  memoSuffix = " (reversal)",
): Promise<JournalEntry> {
  const original = await ctx.store.getEntry(originalEntryId);
  if (!original) {
    throw new LedgerError("Original entry not found.", [
      `Entry ${originalEntryId} does not exist.`,
    ]);
  }
  if (original.status === "reversed") {
    throw new LedgerError("Already reversed.", [
      `Entry ${originalEntryId} has already been reversed by ${original.reversedBy}.`,
    ]);
  }

  const originalLines = await ctx.store.getLines(originalEntryId);
  const draft: DraftJournalEntry = {
    entityId: original.entityId,
    date: reversalDate,
    memo: original.memo + memoSuffix,
    source: "manual",
    sourceRef: original.id,
    lines: originalLines.map((l) => ({
      accountId: l.accountId,
      // flip: debit ↔ credit
      debit: l.credit,
      credit: l.debit,
      currency: l.currency,
      fxRate: l.fxRate,
      memo: l.memo,
      counterpartyId: l.counterpartyId,
    })),
  };

  const reversal = await postEntry(draft, ctx);

  // Mark the original as reversed. We DON'T mutate its lines — both
  // entries remain in the books with full audit trail.
  const originalUpdated: JournalEntry = {
    ...original,
    status: "reversed",
    reversedBy: reversal.id,
  };
  await ctx.store.insertEntry(originalUpdated);
  await ctx.store.recordAudit({
    entityId: original.entityId,
    actor: ctx.actor,
    action: "reverse_entry",
    targetTable: "journal_entry",
    targetId: original.id,
    before: original,
    after: originalUpdated,
  });

  return reversal;
}
