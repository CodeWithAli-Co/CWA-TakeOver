// ───────────────────────────────────────────────────────────────────
// Counterparty — customers (people who owe us, or who pay us) and
// vendors (people we owe, or we pay). One row can be both.
// ───────────────────────────────────────────────────────────────────

export type CounterpartyKind = "customer" | "vendor" | "both";

export interface Counterparty {
  id: string;
  entityId: string;
  name: string;
  kind: CounterpartyKind;
  email?: string;
  phone?: string;
  address?: string;
  /** Net-N payment terms. 0 = due on receipt. */
  paymentTermsDays?: number;
  /** When invoicing this counterparty, which income / expense account
   *  to default to. */
  defaultAccountId?: string;
  taxId?: string; // EIN / SSN for 1099 reporting
  notes?: string;
  archivedAt?: string;
}
