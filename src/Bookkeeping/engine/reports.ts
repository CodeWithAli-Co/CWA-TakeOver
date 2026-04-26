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
