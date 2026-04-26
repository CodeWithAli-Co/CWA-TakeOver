// ───────────────────────────────────────────────────────────────────
// Report types — the shapes returned by engine/reports.ts.
// ───────────────────────────────────────────────────────────────────

import type { AccountType, AccountSubtype } from "./coa";

export interface ReportRange {
  /** YYYY-MM-DD inclusive. */
  start: string;
  end: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  debit: number;  // total debits in the period
  credit: number; // total credits in the period
  balance: number; // signed by normalBalance — positive is "normal"
}

export interface TrialBalance {
  entityId: string;
  range: ReportRange;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  /** True iff totalDebit === totalCredit. Always true for a healthy GL. */
  balanced: boolean;
}

export interface PnLLine {
  accountId: string;
  code: string;
  name: string;
  subtype: AccountSubtype;
  amount: number;
  prevAmount?: number; // optional comparative period
}

export interface ProfitAndLoss {
  entityId: string;
  range: ReportRange;
  comparativeRange?: ReportRange;
  income: PnLLine[];
  cogs: PnLLine[];
  operatingExpenses: PnLLine[];
  otherExpenses: PnLLine[];
  totals: {
    revenue: number;
    grossProfit: number;
    operatingIncome: number;
    netIncome: number;
    prevRevenue?: number;
    prevNetIncome?: number;
  };
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  subtype: AccountSubtype;
  amount: number;
}

export interface BalanceSheet {
  entityId: string;
  asOf: string; // YYYY-MM-DD
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
  };
  /** True iff assets = liabilities + equity. */
  balanced: boolean;
}

export interface CashflowStatement {
  entityId: string;
  range: ReportRange;
  /** Indirect method. */
  netIncome: number;
  adjustments: Array<{ name: string; amount: number }>;
  workingCapitalChanges: Array<{ name: string; amount: number }>;
  cashFromOperations: number;
  cashFromInvesting: number;
  cashFromFinancing: number;
  netCashChange: number;
  startingCash: number;
  endingCash: number;
}

export interface ARAgingRow {
  counterpartyId: string;
  counterpartyName: string;
  bucketCurrent: number;  // 0-30
  bucket3060: number;
  bucket6090: number;
  bucket90Plus: number;
  total: number;
}
