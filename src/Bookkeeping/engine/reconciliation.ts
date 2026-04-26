// Reconciliation engine — match ImportedTransactions against rules
// and existing journal entries. Three outcomes per imported tx:
//
//   1. matched     — an existing JE covers this; no new entry needed
//   2. ruled       — a ReconciliationRule matched; a JE was generated
//   3. pending     — neither matched a rule nor an existing JE; sits
//                    in the inbox for manual categorization
//
// The engine is pure: given the inputs, returns the proposals.
// Persistence happens in the caller (the inbox UI calls this engine
// then asks the user to approve before posting).

import type { ImportedTransaction, ReconciliationRule } from "../types/source";
import type { DraftJournalEntry, JournalEntry, JournalLine } from "../types/journal";
import type { Entity } from "../types/entity";

export type ReconciliationOutcome =
  | { kind: "matched"; existingEntryId: string }
  | { kind: "ruled"; rule: ReconciliationRule; draft: DraftJournalEntry }
  | { kind: "pending" };

export interface ReconciliationContext {
  entity: Entity;
  rules: ReconciliationRule[];
  existingEntries: JournalEntry[];
  existingLines: JournalLine[];
}

/** Try to match each tx against an existing JE that posts to the same
 *  account on the same day for the same amount, then against a rule.
 *  Otherwise, mark pending. */
export function reconcileBatch(
  txs: ImportedTransaction[],
  ctx: ReconciliationContext,
): Array<{ tx: ImportedTransaction; outcome: ReconciliationOutcome }> {
  const sortedRules = ctx.rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  return txs.map((tx) => {
    // (1) existing JE match — same date, same account, same magnitude
    const matched = findMatchingEntry(tx, ctx);
    if (matched) {
      return { tx, outcome: { kind: "matched" as const, existingEntryId: matched.id } };
    }

    // (2) rule match
    for (const rule of sortedRules) {
      if (matchesRule(tx, rule)) {
        return {
          tx,
          outcome: {
            kind: "ruled" as const,
            rule,
            draft: ruleToDraft(tx, rule, ctx.entity),
          },
        };
      }
    }

    // (3) pending
    return { tx, outcome: { kind: "pending" as const } };
  });
}

function findMatchingEntry(
  tx: ImportedTransaction,
  ctx: ReconciliationContext,
): JournalEntry | null {
  const day = tx.postedAt.slice(0, 10);
  for (const e of ctx.existingEntries) {
    if (e.entityId !== ctx.entity.id) continue;
    if (e.date !== day) continue;
    // Find any line that posts the same magnitude on this account.
    const lines = ctx.existingLines.filter((l) => l.entryId === e.id);
    const matches = lines.find(
      (l) =>
        l.accountId === tx.accountId &&
        Math.abs(l.baseDebit - Math.abs(tx.amount)) < 0.01 &&
        Math.sign(tx.amount) === (l.debit > 0 ? 1 : -1),
    );
    if (matches) return e;
  }
  return null;
}

function matchesRule(tx: ImportedTransaction, rule: ReconciliationRule): boolean {
  const { match } = rule;
  if (match.source && match.source !== tx.source) return false;
  if (match.accountId && match.accountId !== tx.accountId) return false;
  if (match.amountMin !== undefined && Math.abs(tx.amount) < match.amountMin) return false;
  if (match.amountMax !== undefined && Math.abs(tx.amount) > match.amountMax) return false;
  if (match.descriptionRegex) {
    try {
      const re = new RegExp(match.descriptionRegex, "i");
      if (!re.test(tx.description)) return false;
    } catch {
      return false; // bad regex — skip rule rather than crash
    }
  }
  return true;
}

function ruleToDraft(
  tx: ImportedTransaction,
  rule: ReconciliationRule,
  entity: Entity,
): DraftJournalEntry {
  const day = tx.postedAt.slice(0, 10);
  const isInflow = tx.amount > 0;
  const amount = Math.abs(tx.amount);
  const memo = (rule.action.memoTemplate ?? `${tx.description} (auto)`).slice(0, 200);

  // The bank/credit-card account hits one side; the rule's target
  // account hits the other. Inflow → debit cash, credit target.
  return {
    entityId: entity.id,
    date: day,
    memo,
    source: "plaid",
    sourceRef: tx.sourceId,
    lines: [
      {
        accountId: tx.accountId ?? rule.action.targetAccountId,
        debit: isInflow ? amount : 0,
        credit: isInflow ? 0 : amount,
        currency: tx.currency,
        counterpartyId: rule.action.counterpartyId,
      },
      {
        accountId: rule.action.targetAccountId,
        debit: isInflow ? 0 : amount,
        credit: isInflow ? amount : 0,
        currency: tx.currency,
        counterpartyId: rule.action.counterpartyId,
      },
    ],
  };
}
