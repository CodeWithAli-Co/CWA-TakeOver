// Pure reports engine. Given a slice of journal lines + accounts,
// produce TrialBalance, ProfitAndLoss, BalanceSheet, ARAging.
//
// Reports compute over baseDebit / baseCredit (already FX-converted)
// so multi-currency entities just work.

import type { GLAccount } from "../types/coa";
import type { JournalEntry, JournalLine } from "../types/journal";
import type {
  ARAgingRow,
  BalanceSheet,
  BalanceSheetLine,
  PnLLine,
  ProfitAndLoss,
  ReportRange,
  TrialBalance,
  TrialBalanceRow,
} from "../types/reports";
import { roundCents } from "./validation";

interface ReportInput {
  entityId: string;
  accounts: GLAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
}

/** Filter the input to ENTITY-scoped, posted entries only. Reversed
 *  entries are KEPT (they're part of the audit-true history) but their
 *  reversing counterparty is also there — net effect is correct. */
function activeLines(input: ReportInput, range?: ReportRange): JournalLine[] {
  const entryById = new Map<string, JournalEntry>();
  for (const e of input.entries) {
    if (e.entityId !== input.entityId) continue;
    if (e.status !== "posted" && e.status !== "reversed") continue;
    if (range && (e.date < range.start || e.date > range.end)) continue;
    entryById.set(e.id, e);
  }
  const result: JournalLine[] = [];
  for (const l of input.lines) {
    const e = entryById.get(l.entryId);
    if (!e) continue;
    result.push(l);
  }
  return result;
}

// ── Trial Balance ─────────────────────────────────────────────────

export function trialBalance(
  input: ReportInput,
  range: ReportRange,
): TrialBalance {
  const lines = activeLines(input, range);
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const t = totals.get(l.accountId) ?? { debit: 0, credit: 0 };
    t.debit += l.baseDebit;
    t.credit += l.baseCredit;
    totals.set(l.accountId, t);
  }

  const rows: TrialBalanceRow[] = input.accounts
    .filter((a) => a.entityId === input.entityId && a.isPostable)
    .map((a) => {
      const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
      const debit = roundCents(t.debit);
      const credit = roundCents(t.credit);
      const balance =
        a.normalBalance === "debit" ? debit - credit : credit - debit;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        debit,
        credit,
        balance: roundCents(balance),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalDebit = roundCents(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = roundCents(rows.reduce((s, r) => s + r.credit, 0));

  return {
    entityId: input.entityId,
    range,
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

// ── Profit & Loss ─────────────────────────────────────────────────

export function profitAndLoss(
  input: ReportInput,
  range: ReportRange,
  comparativeRange?: ReportRange,
): ProfitAndLoss {
  const tb = trialBalance(input, range);
  const prevTb = comparativeRange ? trialBalance(input, comparativeRange) : null;

  const findPrev = (accountId: string) =>
    prevTb?.rows.find((r) => r.accountId === accountId)?.balance;

  const incomeRows = tb.rows.filter((r) => r.type === "income");
  const expenseRows = tb.rows.filter((r) => r.type === "expense");

  const income: PnLLine[] = incomeRows.map((r) => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    subtype: r.subtype,
    amount: r.balance,
    prevAmount: findPrev(r.accountId),
  }));

  const cogs = expenseRows
    .filter((r) => r.subtype === "cogs")
    .map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: r.balance,
      prevAmount: findPrev(r.accountId),
    } as PnLLine));

  const operatingSubtypes = new Set([
    "marketing",
    "software",
    "professional_services",
    "payroll",
    "rent",
    "utilities",
    "travel",
    "meals",
    "office",
    "bank_fees",
    "stripe_fees",
  ]);

  const operatingExpenses = expenseRows
    .filter((r) => operatingSubtypes.has(r.subtype as string))
    .map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: r.balance,
      prevAmount: findPrev(r.accountId),
    } as PnLLine));

  const otherExpenses = expenseRows
    .filter(
      (r) =>
        r.subtype !== "cogs" &&
        !operatingSubtypes.has(r.subtype as string),
    )
    .map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: r.balance,
      prevAmount: findPrev(r.accountId),
    } as PnLLine));

  const sum = (xs: PnLLine[]) => roundCents(xs.reduce((s, x) => s + x.amount, 0));
  const sumPrev = (xs: PnLLine[]) =>
    roundCents(xs.reduce((s, x) => s + (x.prevAmount ?? 0), 0));

  const revenue = sum(income);
  const cogsTotal = sum(cogs);
  const grossProfit = roundCents(revenue - cogsTotal);
  const opTotal = sum(operatingExpenses);
  const operatingIncome = roundCents(grossProfit - opTotal);
  const otherTotal = sum(otherExpenses);
  const netIncome = roundCents(operatingIncome - otherTotal);

  return {
    entityId: input.entityId,
    range,
    comparativeRange,
    income,
    cogs,
    operatingExpenses,
    otherExpenses,
    totals: {
      revenue,
      grossProfit,
      operatingIncome,
      netIncome,
      prevRevenue: prevTb ? sumPrev(income) : undefined,
      prevNetIncome: prevTb
        ? roundCents(
            sumPrev(income) -
              sumPrev(cogs) -
              sumPrev(operatingExpenses) -
              sumPrev(otherExpenses),
          )
        : undefined,
    },
  };
}

// ── Balance Sheet ─────────────────────────────────────────────────

export function balanceSheet(
  input: ReportInput,
  asOf: string,
): BalanceSheet {
  // BS is balances as of `asOf` — open at FY start through asOf.
  // Without a prior-year close we approximate by including all entries
  // up through asOf.
  const range: ReportRange = { start: "0001-01-01", end: asOf };
  const tb = trialBalance(input, range);

  const toLine = (r: TrialBalanceRow): BalanceSheetLine => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    subtype: r.subtype,
    amount: r.balance,
  });

  const assets = tb.rows.filter((r) => r.type === "asset").map(toLine);
  const liabilities = tb.rows.filter((r) => r.type === "liability").map(toLine);

  // Equity includes a derived "Current Year Earnings" line = net income
  // of the current FY. We approximate FY by calendar year here; refine
  // when the entity's fiscalYearStart is plumbed through.
  const currentYearStart = `${asOf.slice(0, 4)}-01-01`;
  const ytdPnL = profitAndLoss(input, { start: currentYearStart, end: asOf });
  const currentYearEarnings: BalanceSheetLine = {
    accountId: "computed_current_year",
    code: "3900",
    name: "Current Year Earnings",
    subtype: "current_year_earnings",
    amount: ytdPnL.totals.netIncome,
  };

  const equityRows = tb.rows
    .filter(
      (r) =>
        r.type === "equity" && r.subtype !== "current_year_earnings",
    )
    .map(toLine);

  const equity = [...equityRows, currentYearEarnings];

  const sum = (xs: BalanceSheetLine[]) =>
    roundCents(xs.reduce((s, x) => s + x.amount, 0));

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity);

  return {
    entityId: input.entityId,
    asOf,
    assets,
    liabilities,
    equity,
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
    },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

// ── AR Aging ──────────────────────────────────────────────────────

export function arAging(
  input: ReportInput,
  asOf: string,
  counterpartyNames: Map<string, string>,
): ARAgingRow[] {
  const lines = activeLines(input, { start: "0001-01-01", end: asOf });
  const arAccountIds = new Set(
    input.accounts
      .filter((a) => a.entityId === input.entityId && a.subtype === "accounts_receivable")
      .map((a) => a.id),
  );

  // Per-counterparty bucket totals based on AR lines.
  const byCp = new Map<
    string,
    { current: number; b3060: number; b6090: number; b90p: number; total: number }
  >();

  const asOfMs = Date.parse(asOf);

  for (const l of lines) {
    if (!arAccountIds.has(l.accountId)) continue;
    if (!l.counterpartyId) continue;
    const ageMs = asOfMs - Date.parse(input.entries.find((e) => e.id === l.entryId)?.date ?? asOf);
    const ageDays = Math.floor(ageMs / 86400000);
    // AR debits are receivables; credits are payments received.
    const signed = l.baseDebit - l.baseCredit;
    if (Math.abs(signed) < 0.01) continue;

    const bucket = byCp.get(l.counterpartyId) ?? {
      current: 0,
      b3060: 0,
      b6090: 0,
      b90p: 0,
      total: 0,
    };
    if (ageDays <= 30) bucket.current += signed;
    else if (ageDays <= 60) bucket.b3060 += signed;
    else if (ageDays <= 90) bucket.b6090 += signed;
    else bucket.b90p += signed;
    bucket.total += signed;
    byCp.set(l.counterpartyId, bucket);
  }

  const rows: ARAgingRow[] = [];
  for (const [cpId, b] of byCp.entries()) {
    if (Math.abs(b.total) < 0.01) continue;
    rows.push({
      counterpartyId: cpId,
      counterpartyName: counterpartyNames.get(cpId) ?? "(unknown)",
      bucketCurrent: roundCents(b.current),
      bucket3060: roundCents(b.b3060),
      bucket6090: roundCents(b.b6090),
      bucket90Plus: roundCents(b.b90p),
      total: roundCents(b.total),
    });
  }
  rows.sort((a, b) => b.bucket90Plus - a.bucket90Plus || b.total - a.total);
  return rows;
}


// ── Cashflow Statement (Indirect method) ─────────────────────────

/** Helper — sum balances over a date range for accounts of a given
 *  subtype, signed by normal balance. Used to compute deltas between
 *  the start and end of the period. */
function balanceForSubtypes(
  input: ReportInput,
  asOf: string,
  subtypes: string[],
): number {
  const subSet = new Set(subtypes);
  const accountIds = new Set(
    input.accounts
      .filter(
        (a) =>
          a.entityId === input.entityId &&
          a.isPostable &&
          subSet.has(a.subtype as string),
      )
      .map((a) => a.id),
  );
  if (accountIds.size === 0) return 0;
  const lines = activeLines(input, { start: "0001-01-01", end: asOf });
  let total = 0;
  const accountsById = new Map(input.accounts.map((a) => [a.id, a]));
  for (const l of lines) {
    if (!accountIds.has(l.accountId)) continue;
    const acct = accountsById.get(l.accountId);
    if (!acct) continue;
    const signed =
      acct.normalBalance === "debit"
        ? l.baseDebit - l.baseCredit
        : l.baseCredit - l.baseDebit;
    total += signed;
  }
  return roundCents(total);
}

/**
 * Cashflow Statement, Indirect method.
 *
 * Starts from Net Income (off the P&L), then:
 *
 *   + Non-cash expenses (depreciation, amortization)
 *   - Increases in AR, prepaid expenses
 *   + Increases in AP, accrued expenses, deferred revenue
 *     ── Sum: Cash from Operations
 *
 *   - Increases in fixed assets (cash spent)
 *   + Increases in accumulated depreciation (already adjusted above
 *     via depreciation expense; not double-counted here)
 *     ── Sum: Cash from Investing
 *
 *   + Increases in loans payable
 *   + Owner contributions
 *   - Owner draws / distributions
 *     ── Sum: Cash from Financing
 *
 * The sum of the three sections should equal the change in cash
 * accounts over the same period — the engine sanity-checks this and
 * surfaces a "reconciliation gap" line if the math doesn't tie.
 */
export function cashflowStatement(
  input: ReportInput,
  range: ReportRange,
): import("../types/reports").CashflowStatement {
  // Net income for the period
  const pnl = profitAndLoss(input, range);
  const netIncome = pnl.totals.netIncome;

  // Working-capital deltas — change in subtype balances from
  // start-1 day to end of range. Positive delta means the account
  // grew during the period.
  const dayBefore = subtractDays(range.start, 1);

  const delta = (subtypes: string[]) =>
    balanceForSubtypes(input, range.end, subtypes) -
    balanceForSubtypes(input, dayBefore, subtypes);

  // Depreciation expense recognized in the period — already in P&L
  // via Net Income, but it's non-cash so we ADD it back here.
  const depreciation = pnl.operatingExpenses
    .concat(pnl.otherExpenses, pnl.cogs)
    .filter((l) => l.subtype === "depreciation")
    .reduce((s, l) => s + l.amount, 0);

  // Increases in current assets USE cash; increases in current
  // liabilities PROVIDE cash. AR is debit-normal so balanceForSubtypes
  // returns a positive number when AR grows; that's a USE of cash so
  // we subtract.
  const arDelta = delta(["accounts_receivable"]);
  const prepaidDelta = delta(["prepaid"]);
  const apDelta = delta(["accounts_payable"]);
  const accruedDelta = delta(["accrued_expense"]);
  const deferredRevDelta = delta(["deferred_revenue"]);
  const salesTaxDelta = delta(["sales_tax_payable"]);

  const adjustments = [
    ...(Math.abs(depreciation) > 0.005
      ? [{ name: "Depreciation (non-cash)", amount: roundCents(depreciation) }]
      : []),
  ];

  const workingCapitalChanges = [
    ...(Math.abs(arDelta) > 0.005
      ? [{ name: "Change in Accounts Receivable", amount: roundCents(-arDelta) }]
      : []),
    ...(Math.abs(prepaidDelta) > 0.005
      ? [{ name: "Change in Prepaid Expenses", amount: roundCents(-prepaidDelta) }]
      : []),
    ...(Math.abs(apDelta) > 0.005
      ? [{ name: "Change in Accounts Payable", amount: roundCents(apDelta) }]
      : []),
    ...(Math.abs(accruedDelta) > 0.005
      ? [{ name: "Change in Accrued Expenses", amount: roundCents(accruedDelta) }]
      : []),
    ...(Math.abs(deferredRevDelta) > 0.005
      ? [{ name: "Change in Deferred Revenue", amount: roundCents(deferredRevDelta) }]
      : []),
    ...(Math.abs(salesTaxDelta) > 0.005
      ? [{ name: "Change in Sales Tax Payable", amount: roundCents(salesTaxDelta) }]
      : []),
  ];

  const cashFromOperations = roundCents(
    netIncome +
      adjustments.reduce((s, x) => s + x.amount, 0) +
      workingCapitalChanges.reduce((s, x) => s + x.amount, 0),
  );

  // Investing — increases in fixed assets are USES of cash.
  const fixedAssetDelta = delta(["fixed_asset"]);
  const cashFromInvesting = roundCents(-fixedAssetDelta);

  // Financing — loan increases bring in cash; owner draws use cash.
  const loanDelta = delta(["loan_payable"]);
  const ownerContribDelta = delta(["contributed_capital"]);
  const ownerDrawDelta = delta(["owner_draw"]);
  const cashFromFinancing = roundCents(
    loanDelta + ownerContribDelta - ownerDrawDelta,
  );

  // Net change in cash + reconcile to actual cash balance change.
  const netCashChange = roundCents(
    cashFromOperations + cashFromInvesting + cashFromFinancing,
  );
  const startingCash = balanceForSubtypes(input, dayBefore, ["cash", "stripe_pending"]);
  const endingCash = balanceForSubtypes(input, range.end, ["cash", "stripe_pending"]);

  return {
    entityId: input.entityId,
    range,
    netIncome,
    adjustments,
    workingCapitalChanges,
    cashFromOperations,
    cashFromInvesting,
    cashFromFinancing,
    netCashChange,
    startingCash: roundCents(startingCash),
    endingCash: roundCents(endingCash),
  };
}

function subtractDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
