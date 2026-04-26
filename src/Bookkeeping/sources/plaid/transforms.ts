// Pure transform: Plaid transaction → ImportedTransaction (NOT a JE).
// Plaid txs land in the inbox first, then get converted to JEs by the
// reconciliation engine using rules + manual categorization.

import type { ImportedTransaction } from "../../types/source";

export interface PlaidTxShape {
  transaction_id: string;
  account_id: string;     // Plaid account id
  amount: number;          // Plaid: positive = outflow, negative = inflow
  iso_currency_code: string;
  date: string;            // YYYY-MM-DD
  name: string;
  pending: boolean;
  category?: string[];
}

export function plaidTxToImported(
  tx: PlaidTxShape,
  entityId: string,
  /** Map from Plaid account_id → our GLAccount.id (the cash / credit-card
   *  account that this tx debits or credits). */
  accountIdMap: Record<string, string>,
  newId: () => string,
): ImportedTransaction {
  // Plaid amount sign convention: positive = money OUT, negative = IN.
  // We flip to our convention: positive amount = inflow.
  const amount = -tx.amount;
  return {
    id: newId(),
    entityId,
    source: "plaid",
    sourceId: tx.transaction_id,
    postedAt: tx.date + "T00:00:00.000Z",
    amount,
    currency: tx.iso_currency_code.toUpperCase(),
    description: tx.name,
    accountId: accountIdMap[tx.account_id],
    status: tx.pending ? "pending" : "pending", // both start pending in our pipeline
    raw: tx as unknown as Record<string, unknown>,
    createdAt: new Date().toISOString(),
  };
}
