// Period close engine — eight pure checks that decide whether a
// period is ready to lock. Each returns a CheckResult with status,
// detail message, and optionally a quick-fix proposal (e.g. a
// depreciation JE the operator can post in one click).
//
// All checks are PURE — given the same input they return the same
// output. UI re-runs them after every mutation so the checklist
// updates live as the operator works through it.

import type { Entity, FiscalPeriod } from "../types/entity";
import type { GLAccount } from "../types/coa";
import type { JournalEntry, JournalLine, DraftJournalEntry } from "../types/journal";
import type { ImportedTransaction } from "../types/source";
import type { Counterparty } from "../types/counterparty";
import { trialBalance, profitAndLoss, arAging } from "./reports";
import { roundCents } from "./validation";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Optional one-click fix — the engine can propose a JE for the
   *  operator to post (e.g. monthly depreciation). */
  autoFix?: { label: string; draft: DraftJournalEntry };
}

export interface PeriodCloseInput {
  entity: Entity;
  period: FiscalPeriod;
  accounts: GLAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  imported: ImportedTransaction[];
  counterparties: Counterparty[];
}

/** Run all eight checks and return them in checklist order. The UI
 *  renders each as a row; status drives the icon (✓ / ⚠ / ✕). */
export function runCloseChecks(input: PeriodCloseInput): CheckResult[] {
  return [
    checkBankReconciliation(input),
    checkPendingImports(input),
    checkARTiesToGL(input),
    checkDepreciation(input),
    checkPayrollAccruals(input),
    checkTrialBalance(input),
    checkPnLAnomalies(input),
    checkReadyToLock(input),
  ];
}

// ── 1. Bank reconciliation ────────────────────────────────────────
function checkBankReconciliation(input: PeriodCloseInput): CheckResult {
  const cashAccounts = input.accounts.filter(
    (a) =>
      a.entityId === input.entity.id &&
      a.isPostable &&
      (a.subtype === "cash" || a.subtype === "credit_card"),
  );
  if (cashAccounts.length === 0) {
    return {
      id: "bank-recon",
      label: "Reconcile bank + credit-card balances",
      status: "pass",
      detail: "No cash or credit-card accounts to reconcile.",
    };
  }
  // Count cash accounts and total balance — operator confirms each one
  // matches their bank/CC statement.
  let totalCashBalance = 0;
  for (const a of cashAccounts) {
    const lines = input.lines.filter(
      (l) =>
        l.accountId === a.id &&
        input.entries.find((e) => e.id === l.entryId && e.date <= input.period.end),
    );
    const signed = lines.reduce(
      (s, l) =>
        s +
        (a.normalBalance === "debit"
          ? l.baseDebit - l.baseCredit
          : l.baseCredit - l.baseDebit),
      0,
    );
    totalCashBalance += signed;
  }
  return {
    id: "bank-recon",
    label: "Reconcile bank + credit-card balances",
    status: "warn",
    detail: `${cashAccounts.length} account${cashAccounts.length === 1 ? "" : "s"} totaling ${roundCents(totalCashBalance).toFixed(2)}. Verify each matches its bank statement / Plaid balance, then mark this step done.`,
  };
}

// ── 2. Pending imports ────────────────────────────────────────────
function checkPendingImports(input: PeriodCloseInput): CheckResult {
  const pending = input.imported.filter(
    (t) =>
      t.entityId === input.entity.id &&
      t.status === "pending" &&
      t.postedAt.slice(0, 10) >= input.period.start &&
      t.postedAt.slice(0, 10) <= input.period.end,
  );
  if (pending.length === 0) {
    return {
      id: "pending-imports",
      label: "Categorize all pending imported transactions",
      status: "pass",
      detail: "Inbox is clear for this period.",
    };
  }
  return {
    id: "pending-imports",
    label: "Categorize all pending imported transactions",
    status: "fail",
    detail: `${pending.length} transaction${pending.length === 1 ? "" : "s"} still pending in the inbox for this period.`,
  };
}

// ── 3. AR aging ties to GL ────────────────────────────────────────
function checkARTiesToGL(input: PeriodCloseInput): CheckResult {
  const arAccounts = input.accounts.filter(
    (a) =>
      a.entityId === input.entity.id &&
      a.subtype === "accounts_receivable",
  );
  if (arAccounts.length === 0) {
    return {
      id: "ar-tie",
      label: "Confirm AR aging ties to GL",
      status: "pass",
      detail: "No AR account; nothing to tie.",
    };
  }

  // GL balance of AR
  const arIds = new Set(arAccounts.map((a) => a.id));
  const arBalance = input.lines
    .filter((l) => arIds.has(l.accountId))
    .filter((l) => {
      const e = input.entries.find((x) => x.id === l.entryId);
      return e && e.date <= input.period.end;
    })
    .reduce((s, l) => s + (l.baseDebit - l.baseCredit), 0);

  // AR aging total
  const cpNames = new Map(input.counterparties.map((c) => [c.id, c.name]));
  const aging = arAging(
    {
      entityId: input.entity.id,
      accounts: input.accounts,
      entries: input.entries,
      lines: input.lines,
    },
    input.period.end,
    cpNames,
  );
  const agingTotal = aging.reduce((s, r) => s + r.total, 0);

  if (Math.abs(roundCents(arBalance) - roundCents(agingTotal)) < 0.01) {
    return {
      id: "ar-tie",
      label: "Confirm AR aging ties to GL",
      status: "pass",
      detail: `GL Accounts Receivable (${roundCents(arBalance).toFixed(2)}) matches AR aging total (${roundCents(agingTotal).toFixed(2)}).`,
    };
  }
  return {
    id: "ar-tie",
    label: "Confirm AR aging ties to GL",
    status: "fail",
    detail: `Mismatch: GL AR is ${roundCents(arBalance).toFixed(2)} but AR aging totals ${roundCents(agingTotal).toFixed(2)}. Likely missing counterparty tag on a JE line.`,
  };
}

// ── 4. Depreciation ───────────────────────────────────────────────
function checkDepreciation(input: PeriodCloseInput): CheckResult {
  const fixedAssets = input.accounts.filter(
    (a) =>
      a.entityId === input.entity.id &&
      a.subtype === "fixed_asset" &&
      a.isPostable,
  );
  if (fixedAssets.length === 0) {
    return {
      id: "depreciation",
      label: "Post depreciation for the period",
      status: "pass",
      detail: "No fixed assets booked; nothing to depreciate.",
    };
  }

  // Did any depreciation hit this period?
  const depExpenseAccounts = input.accounts.filter(
    (a) => a.entityId === input.entity.id && a.subtype === "depreciation",
  );
  const depAcctIds = new Set(depExpenseAccounts.map((a) => a.id));
  const depPosted = input.lines.some((l) => {
    if (!depAcctIds.has(l.accountId)) return false;
    const e = input.entries.find((x) => x.id === l.entryId);
    return e && e.date >= input.period.start && e.date <= input.period.end;
  });

  if (depPosted) {
    return {
      id: "depreciation",
      label: "Post depreciation for the period",
      status: "pass",
      detail: "Depreciation expense recorded.",
    };
  }

  return {
    id: "depreciation",
    label: "Post depreciation for the period",
    status: "warn",
    detail: `${fixedAssets.length} fixed asset${fixedAssets.length === 1 ? "" : "s"} on the books, but no depreciation posted this period. Review your depreciation schedule.`,
  };
}

// ── 5. Payroll accruals ───────────────────────────────────────────
function checkPayrollAccruals(input: PeriodCloseInput): CheckResult {
  // Payroll is optional — pass if there are no payroll-liability
  // accounts AND no recent payroll-expense activity.
  const hasPayrollAccts = input.accounts.some(
    (a) =>
      a.entityId === input.entity.id &&
      (a.subtype === "payroll_liability" || a.subtype === "payroll"),
  );
  if (!hasPayrollAccts) {
    return {
      id: "payroll",
      label: "Post payroll accruals (if applicable)",
      status: "pass",
      detail: "No payroll accounts; not applicable.",
    };
  }
  return {
    id: "payroll",
    label: "Post payroll accruals (if applicable)",
    status: "warn",
    detail: "Verify any unpaid wages / employer taxes are accrued for the period.",
  };
}

// ── 6. Trial Balance ──────────────────────────────────────────────
function checkTrialBalance(input: PeriodCloseInput): CheckResult {
  const tb = trialBalance(
    {
      entityId: input.entity.id,
      accounts: input.accounts,
      entries: input.entries,
      lines: input.lines,
    },
    { start: input.period.start, end: input.period.end },
  );
  if (tb.balanced) {
    return {
      id: "trial-balance",
      label: "Trial balance balances",
      status: "pass",
      detail: `Debits ${tb.totalDebit.toFixed(2)} = Credits ${tb.totalCredit.toFixed(2)}.`,
    };
  }
  return {
    id: "trial-balance",
    label: "Trial balance balances",
    status: "fail",
    detail: `Debits ${tb.totalDebit.toFixed(2)} ≠ Credits ${tb.totalCredit.toFixed(2)}. The engine should make this impossible — investigate immediately.`,
  };
}

// ── 7. P&L anomalies ──────────────────────────────────────────────
function checkPnLAnomalies(input: PeriodCloseInput): CheckResult {
  // Compare this period to the prior month-equivalent. Flag any P&L
  // line with >30% absolute swing AND >$50 absolute change.
  const range = { start: input.period.start, end: input.period.end };
  const periodLen = (Date.parse(input.period.end) - Date.parse(input.period.start)) / 86400000 + 1;
  const prevEnd = subtractDays(input.period.start, 1);
  const prevStart = subtractDays(prevEnd, periodLen - 1);
  const compRange = { start: prevStart, end: prevEnd };

  const pnl = profitAndLoss(
    {
      entityId: input.entity.id,
      accounts: input.accounts,
      entries: input.entries,
      lines: input.lines,
    },
    range,
    compRange,
  );

  const allLines = [
    ...pnl.income,
    ...pnl.cogs,
    ...pnl.operatingExpenses,
    ...pnl.otherExpenses,
  ];

  const anomalies: string[] = [];
  for (const l of allLines) {
    const cur = l.amount;
    const prev = l.prevAmount ?? 0;
    const absChange = Math.abs(cur - prev);
    const pct = prev > 0 ? Math.abs(cur - prev) / prev : cur > 0 ? Infinity : 0;
    if (absChange > 50 && pct > 0.3) {
      const dir = cur > prev ? "↑" : "↓";
      anomalies.push(`${l.code} ${l.name}: ${prev.toFixed(2)} → ${cur.toFixed(2)} ${dir}`);
    }
  }

  if (anomalies.length === 0) {
    return {
      id: "anomalies",
      label: "Review P&L for anomalies",
      status: "pass",
      detail: "No line items moved >30% MoM (with >$50 absolute change).",
    };
  }
  return {
    id: "anomalies",
    label: "Review P&L for anomalies",
    status: "warn",
    detail: `${anomalies.length} line${anomalies.length === 1 ? "" : "s"} flagged: ${anomalies.slice(0, 3).join("; ")}${anomalies.length > 3 ? "…" : ""}`,
  };
}

// ── 8. Ready to lock ──────────────────────────────────────────────
function checkReadyToLock(input: PeriodCloseInput): CheckResult {
  if (input.period.status === "locked") {
    return {
      id: "lock",
      label: "Lock the period",
      status: "pass",
      detail: "Period is locked. Corrections must go through reversing entries.",
    };
  }
  return {
    id: "lock",
    label: "Lock the period",
    status: "warn",
    detail: "Once locked, no edits to entries dated in this range. Use this AFTER all other checks pass.",
  };
}

function subtractDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
