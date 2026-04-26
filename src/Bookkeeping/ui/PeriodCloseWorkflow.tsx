// PeriodCloseWorkflow — guided checklist that runs every close check
// and lets the operator lock the period when ready. Mounts inside the
// Period row in PeriodManager so each period gets its own workflow.

import { useMemo } from "react";
import type { Entity, FiscalPeriod } from "../types/entity";
import { runCloseChecks, type CheckResult, type CheckStatus } from "../engine/periodClose";
import { useLedgerData, selectAccountsForEntity, selectEntries } from "../stores/ledgerStore";
import { useImportedTx } from "../stores/importedTxStore";
import { useCounterparties } from "../stores/counterpartyStore";
import { usePeriods } from "../stores/periodStore";

export function PeriodCloseWorkflow({
  entity,
  period,
}: {
  entity: Entity;
  period: FiscalPeriod;
}) {
  // Subscribe to all the stores the checks read so the checklist
  // re-runs the moment any of them changes.
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);
  useImportedTx((s) => s.imported);
  useCounterparties((s) => s.counterparties);
  const setStatus = usePeriods((s) => s.setStatus);

  const checks = useMemo(
    () =>
      runCloseChecks({
        entity,
        period,
        accounts: selectAccountsForEntity(entity.id),
        entries: selectEntries(entity.id),
        lines: useLedgerData.getState().lines,
        imported: useImportedTx.getState().imported,
        counterparties: useCounterparties.getState().counterparties,
      }),
    [entity, period],
  );

  const blocking = checks.filter(
    (c) => c.status === "fail" && c.id !== "lock",
  );
  const canLock = blocking.length === 0 && period.status !== "locked";

  return (
    <div className="bk-close-workflow">
      <div className="bk-close-summary">
        <span className="bk-close-summary-label">Close checklist</span>
        <span className="bk-close-summary-count">
          <PassPill status="pass" count={checks.filter((c) => c.status === "pass").length} />
          <PassPill status="warn" count={checks.filter((c) => c.status === "warn").length} />
          <PassPill status="fail" count={checks.filter((c) => c.status === "fail").length} />
        </span>
      </div>

      <ol className="bk-close-list">
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ol>

      <div className="bk-close-actions">
        {period.status === "locked" ? (
          <button
            type="button"
            className="bk-btn-ghost"
            onClick={() => setStatus(period.id, "open", "operator")}
          >
            Unlock period
          </button>
        ) : (
          <button
            type="button"
            className="bk-btn-primary"
            disabled={!canLock}
            onClick={() => setStatus(period.id, "locked", "operator")}
            title={
              canLock
                ? "Lock this period — refuses new entries dated inside it"
                : `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} — resolve before locking`
            }
          >
            {canLock ? "Lock period" : `${blocking.length} blocking ${blocking.length === 1 ? "issue" : "issues"}`}
          </button>
        )}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <li className="bk-check" data-status={check.status}>
      <span className="bk-check-icon" aria-label={check.status}>
        {check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✕"}
      </span>
      <div className="bk-check-body">
        <div className="bk-check-label">{check.label}</div>
        <div className="bk-check-detail">{check.detail}</div>
      </div>
    </li>
  );
}

function PassPill({ status, count }: { status: CheckStatus; count: number }) {
  if (count === 0) return null;
  const cls =
    status === "pass"
      ? "bk-pill--good"
      : status === "warn"
        ? "bk-pill--warn"
        : "bk-pill--bad";
  const symbol = status === "pass" ? "✓" : status === "warn" ? "⚠" : "✕";
  return (
    <span className={`bk-pill ${cls}`} style={{ marginLeft: 6 }}>
      {symbol} {count}
    </span>
  );
}
