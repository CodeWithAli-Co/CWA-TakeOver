// ───────────────────────────────────────────────────────────────────
// Chart of Accounts — the structure of the GL.
//
// Five account types map to the accounting equation:
//   Assets = Liabilities + Equity + (Income - Expense)
//
// Subtype matters for reports — e.g. only `cash` subtypes show up in
// the cashflow statement; only `accounts_receivable` rolls into AR
// aging; etc.
// ───────────────────────────────────────────────────────────────────

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

export type AssetSubtype =
  | "cash"
  | "accounts_receivable"
  | "stripe_pending"
  | "inventory"
  | "prepaid"
  | "fixed_asset"
  | "accumulated_depreciation"
  | "other_asset";

export type LiabilitySubtype =
  | "accounts_payable"
  | "credit_card"
  | "accrued_expense"
  | "deferred_revenue"
  | "sales_tax_payable"
  | "payroll_liability"
  | "loan_payable"
  | "other_liability";

export type EquitySubtype =
  | "contributed_capital"
  | "owner_draw"
  | "retained_earnings"
  | "current_year_earnings"
  | "other_equity";

export type IncomeSubtype =
  | "service_revenue"
  | "subscription_revenue"
  | "product_revenue"
  | "interest_income"
  | "other_income";

export type ExpenseSubtype =
  | "cogs"
  | "marketing"
  | "software"
  | "professional_services"
  | "payroll"
  | "rent"
  | "utilities"
  | "travel"
  | "meals"
  | "office"
  | "bank_fees"
  | "stripe_fees"
  | "depreciation"
  | "interest_expense"
  | "tax_expense"
  | "other_expense";

export type AccountSubtype =
  | AssetSubtype
  | LiabilitySubtype
  | EquitySubtype
  | IncomeSubtype
  | ExpenseSubtype;

export type NormalBalance = "debit" | "credit";

/** Asset + expense are debit-normal; liability + equity + income are
 *  credit-normal. Used by the validation layer to flag obviously-wrong
 *  postings (e.g. crediting a debit-normal account is allowed but rare;
 *  the editor warns). */
export function normalBalanceFor(t: AccountType): NormalBalance {
  return t === "asset" || t === "expense" ? "debit" : "credit";
}

export interface GLAccount {
  id: string;
  entityId: string;
  code: string; // "1000", "4100" — sortable, gappy by convention
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  normalBalance: NormalBalance;
  parentId?: string;
  isPostable: boolean; // false for category-only nodes
  isArchived: boolean;
  /** Optional link to a real-world account (Plaid bank, Stripe account). */
  externalLink?:
    | { type: "plaid_account"; plaidAccountId: string }
    | { type: "stripe_account"; stripeAccountId: string };
}
