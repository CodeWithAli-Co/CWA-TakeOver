// ───────────────────────────────────────────────────────────────────
// Ledger validation — the invariants that keep the books honest.
//
// Every JournalEntry must pass these BEFORE it can be posted:
//   1. Two or more lines.
//   2. Every line has exactly one of debit > 0 or credit > 0
//      (NOT both, NOT neither, NOT negative).
//   3. SUM(baseDebit) === SUM(baseCredit) — to the cent.
//   4. Every account_id resolves to a postable, non-archived account
//      in the same entity as entry.entityId.
//   5. The entry's date is not inside a locked period.
//
// We do these as pure functions over plain data; the engine layer
// composes them. Reusable across UI live-validation, batch import,
// API endpoints — all the same code path.
// ───────────────────────────────────────────────────────────────────

import type {
  DraftJournalEntry,
  JournalLine,
  JournalValidation,
} from "../types/journal";
import type { GLAccount } from "../types/coa";
import type { FiscalPeriod } from "../types/entity";

const CENT = 0.005; // tolerance to sponge floating-point dust

export interface ValidationContext {
  /** All postable accounts for the draft's entity. */
  accountsById: Map<string, GLAccount>;
  /** Periods for the entity, used for the lock check. */
  periods: FiscalPeriod[];
  /** Entity base currency — used to back-fill fxRate when missing. */
  baseCurrency: string;
}

/** Run all invariants against a DraftJournalEntry. Pure: no side
 *  effects, no DB calls. Returns errors / warnings + computed totals. */
export function validateDraft(
  draft: DraftJournalEntry,
  ctx: ValidationContext,
): JournalValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── 1. line count ─────────────────────────────────────────────
  if (!draft.lines || draft.lines.length < 2) {
    errors.push("A journal entry must have at least two lines.");
  }

  // ── 2 + 3. per-line shape + balance totals ────────────────────
  let totalBaseDebit = 0;
  let totalBaseCredit = 0;

  for (const [i, line] of (draft.lines ?? []).entries()) {
    const where = `line ${i + 1}`;

    // exactly one side non-zero, both non-negative
    const dr = Number(line.debit) || 0;
    const cr = Number(line.credit) || 0;
    if (dr < 0 || cr < 0) {
      errors.push(`${where}: debit and credit must be non-negative.`);
      continue;
    }
    if (dr === 0 && cr === 0) {
      errors.push(`${where}: must have a debit or credit amount.`);
      continue;
    }
    if (dr > 0 && cr > 0) {
      errors.push(`${where}: cannot have both debit and credit on the same line.`);
      continue;
    }

    // ── 4. account exists, postable, same entity ────────────────
    const acct = ctx.accountsById.get(line.accountId);
    if (!acct) {
      errors.push(`${where}: account ${line.accountId} not found in this entity.`);
      continue;
    }
    if (acct.entityId !== draft.entityId) {
      errors.push(`${where}: account ${acct.code} ${acct.name} belongs to another entity.`);
      continue;
    }
    if (!acct.isPostable) {
      errors.push(`${where}: ${acct.code} ${acct.name} is a category header, not a postable account.`);
      continue;
    }
    if (acct.isArchived) {
      errors.push(`${where}: ${acct.code} ${acct.name} is archived.`);
      continue;
    }

    // ── normal-balance hint (warning, not error) ────────────────
    const credited = cr > 0;
    const debited = dr > 0;
    if (debited && acct.normalBalance === "credit") {
      warnings.push(
        `${where}: debiting a credit-normal account (${acct.code} ${acct.name}). Sometimes intentional (refund / contra), but double-check.`,
      );
    }
    if (credited && acct.normalBalance === "debit") {
      warnings.push(
        `${where}: crediting a debit-normal account (${acct.code} ${acct.name}). Same caution as above.`,
      );
    }

    // ── apply FX ────────────────────────────────────────────────
    const fxRate = line.fxRate ?? (line.currency === ctx.baseCurrency ? 1 : 0);
    if (fxRate <= 0) {
      errors.push(`${where}: fxRate is required for a foreign-currency line.`);
      continue;
    }
    totalBaseDebit += dr * fxRate;
    totalBaseCredit += cr * fxRate;
  }

  // ── 3 cont. — debits = credits ──────────────────────────────
  totalBaseDebit = roundCents(totalBaseDebit);
  totalBaseCredit = roundCents(totalBaseCredit);
  if (Math.abs(totalBaseDebit - totalBaseCredit) > CENT) {
    errors.push(
      `Debits (${totalBaseDebit.toFixed(2)}) do not equal credits (${totalBaseCredit.toFixed(2)}). Difference: ${(totalBaseDebit - totalBaseCredit).toFixed(2)}.`,
    );
  }

  // ── 5. period lock ────────────────────────────────────────────
  const lockedPeriod = ctx.periods.find(
    (p) =>
      p.status === "locked" &&
      draft.date >= p.start &&
      draft.date <= p.end,
  );
  if (lockedPeriod) {
    errors.push(
      `Period ${lockedPeriod.start} – ${lockedPeriod.end} is locked. Use a reversing entry in an open period instead.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalBaseDebit,
    totalBaseCredit,
  };
}

/** Cent-rounding helper. Bookkeeping is to the penny; floating-point
 *  drift is unacceptable in totals. */
export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum debits (or credits) across a JournalLine[] at face value
 *  (already-base-currency). Useful for reports. */
export function sumBase(lines: JournalLine[], side: "debit" | "credit"): number {
  let total = 0;
  for (const l of lines) total += side === "debit" ? l.baseDebit : l.baseCredit;
  return roundCents(total);
}
