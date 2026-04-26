// ───────────────────────────────────────────────────────────────────
// Default Chart of Accounts seeded per legal form.
//
// Codes follow the IRS Schedule C / GAAP convention:
//   1xxx — Assets
//   2xxx — Liabilities
//   3xxx — Equity
//   4xxx — Income
//   5xxx — COGS
//   6xxx — Operating Expenses
//   7xxx — Other Expenses
//
// Each entity gets its own copy of the seeded accounts at creation.
// The user can extend / archive (but not delete) accounts after that.
// ───────────────────────────────────────────────────────────────────

import type {
  AccountType,
  AccountSubtype,
  GLAccount,
  NormalBalance,
} from "../types/coa";
import { normalBalanceFor } from "../types/coa";
import type { LegalForm } from "../types/entity";

interface CoASeed {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  /** If provided, this account is a category-only header (not postable);
   *  its children are the postable rows. */
  isPostable?: boolean;
  /** Other accounts (by code) whose parentId should be set to this one
   *  after the full seed is in place. Resolved post-insert. */
  childrenCodes?: string[];
}

/** Common across all entity types — the bones of a real GL. */
const COMMON_SEED: CoASeed[] = [
  // ── Assets ─────────────────────────────────────────────────────
  { code: "1000", name: "Cash", type: "asset", subtype: "cash", isPostable: false },
  { code: "1010", name: "Cash - Operating Bank", type: "asset", subtype: "cash" },
  { code: "1020", name: "Cash - Savings", type: "asset", subtype: "cash" },
  { code: "1030", name: "Petty Cash", type: "asset", subtype: "cash" },

  { code: "1040", name: "Stripe Pending Balance", type: "asset", subtype: "stripe_pending" },

  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "accounts_receivable" },
  { code: "1200", name: "Prepaid Expenses", type: "asset", subtype: "prepaid" },

  { code: "1500", name: "Property & Equipment", type: "asset", subtype: "fixed_asset", isPostable: false },
  { code: "1510", name: "Computer Equipment", type: "asset", subtype: "fixed_asset" },
  { code: "1520", name: "Furniture & Fixtures", type: "asset", subtype: "fixed_asset" },
  { code: "1590", name: "Accumulated Depreciation", type: "asset", subtype: "accumulated_depreciation" },

  // ── Liabilities ───────────────────────────────────────────────
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "accounts_payable" },
  { code: "2100", name: "Credit Cards", type: "liability", subtype: "credit_card", isPostable: false },
  { code: "2200", name: "Accrued Expenses", type: "liability", subtype: "accrued_expense" },
  { code: "2250", name: "Deferred Revenue", type: "liability", subtype: "deferred_revenue" },
  { code: "2300", name: "Sales Tax Payable", type: "liability", subtype: "sales_tax_payable" },
  { code: "2400", name: "Payroll Liabilities", type: "liability", subtype: "payroll_liability" },
  { code: "2500", name: "Loans Payable", type: "liability", subtype: "loan_payable" },

  // ── Income ────────────────────────────────────────────────────
  { code: "4000", name: "Service Revenue", type: "income", subtype: "service_revenue" },
  { code: "4100", name: "Subscription Revenue", type: "income", subtype: "subscription_revenue" },
  { code: "4200", name: "Product Revenue", type: "income", subtype: "product_revenue" },
  { code: "4900", name: "Other Income", type: "income", subtype: "other_income" },
  { code: "4910", name: "Interest Income", type: "income", subtype: "interest_income" },

  // ── COGS ──────────────────────────────────────────────────────
  { code: "5000", name: "Cost of Services - Contractors", type: "expense", subtype: "cogs" },
  { code: "5100", name: "Cost of Services - Software & APIs", type: "expense", subtype: "cogs" },

  // ── Operating Expenses ────────────────────────────────────────
  { code: "6000", name: "Rent", type: "expense", subtype: "rent" },
  { code: "6010", name: "Utilities", type: "expense", subtype: "utilities" },
  { code: "6100", name: "Marketing & Advertising", type: "expense", subtype: "marketing" },
  { code: "6200", name: "Professional Services (Legal, CPA)", type: "expense", subtype: "professional_services" },
  { code: "6300", name: "Travel", type: "expense", subtype: "travel" },
  { code: "6400", name: "Meals (50% deductible)", type: "expense", subtype: "meals" },
  { code: "6500", name: "Office Supplies", type: "expense", subtype: "office" },
  { code: "6600", name: "Software Subscriptions", type: "expense", subtype: "software" },
  { code: "6700", name: "Bank Fees", type: "expense", subtype: "bank_fees" },
  { code: "6800", name: "Stripe Processing Fees", type: "expense", subtype: "stripe_fees" },
  { code: "6900", name: "Depreciation Expense", type: "expense", subtype: "depreciation" },

  // ── Other ──────────────────────────────────────────────────────
  { code: "7000", name: "Interest Expense", type: "expense", subtype: "interest_expense" },
  { code: "7100", name: "Tax Expense", type: "expense", subtype: "tax_expense" },
  { code: "7900", name: "Other Expense", type: "expense", subtype: "other_expense" },
];

/** Equity accounts vary by legal form — LLC has Owner's Capital & Draw,
 *  C-Corp has Common Stock + Additional Paid-In Capital, etc. */
const EQUITY_BY_FORM: Record<LegalForm, CoASeed[]> = {
  "LLC": [
    { code: "3000", name: "Member Contributions", type: "equity", subtype: "contributed_capital" },
    { code: "3100", name: "Member Draws", type: "equity", subtype: "owner_draw" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
  "Sole Prop": [
    { code: "3000", name: "Owner's Capital", type: "equity", subtype: "contributed_capital" },
    { code: "3100", name: "Owner's Draws", type: "equity", subtype: "owner_draw" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
  "Partnership": [
    { code: "3000", name: "Partner Contributions", type: "equity", subtype: "contributed_capital" },
    { code: "3100", name: "Partner Draws", type: "equity", subtype: "owner_draw" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
  "C-Corp": [
    { code: "3000", name: "Common Stock", type: "equity", subtype: "contributed_capital" },
    { code: "3010", name: "Additional Paid-In Capital", type: "equity", subtype: "contributed_capital" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
  "S-Corp": [
    { code: "3000", name: "Common Stock", type: "equity", subtype: "contributed_capital" },
    { code: "3010", name: "Additional Paid-In Capital", type: "equity", subtype: "contributed_capital" },
    { code: "3050", name: "Shareholder Distributions", type: "equity", subtype: "owner_draw" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
  "Non-Profit": [
    { code: "3000", name: "Net Assets - Without Donor Restrictions", type: "equity", subtype: "contributed_capital" },
    { code: "3010", name: "Net Assets - With Donor Restrictions", type: "equity", subtype: "contributed_capital" },
    { code: "3500", name: "Retained Earnings", type: "equity", subtype: "retained_earnings" },
    { code: "3900", name: "Current Year Earnings", type: "equity", subtype: "current_year_earnings", isPostable: false },
  ],
};

/** Build the seeded GLAccount[] for a given entity. Caller assigns
 *  ids; we just return the structural rows. */
export function seedChartOfAccounts(
  entityId: string,
  legalForm: LegalForm,
  idGen: () => string = randomId,
): GLAccount[] {
  const seeds: CoASeed[] = [...COMMON_SEED, ...EQUITY_BY_FORM[legalForm]];
  // Sort by code so the inserted accounts arrive in display order.
  seeds.sort((a, b) => a.code.localeCompare(b.code));
  return seeds.map((s) => buildAccount(s, entityId, idGen));
}

function buildAccount(
  s: CoASeed,
  entityId: string,
  idGen: () => string,
): GLAccount {
  return {
    id: idGen(),
    entityId,
    code: s.code,
    name: s.name,
    type: s.type,
    subtype: s.subtype,
    normalBalance: normalBalanceFor(s.type) satisfies NormalBalance,
    isPostable: s.isPostable ?? true,
    isArchived: false,
  };
}

function randomId(): string {
  // Simple URL-safe id; good enough for a seed pass. Replace with a
  // proper UUID generator at the call site if running against Postgres.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
