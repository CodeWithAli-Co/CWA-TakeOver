// PeriodManager — list periods for the active entity, lock or
// unlock them. Locked periods refuse new posts (enforced by the
// validation engine).

import type { Entity, FiscalPeriod } from "../types/entity";
import { usePeriods, selectPeriods } from "../stores/periodStore";
import { buildMonthPeriod } from "../utils/periods";
import { newId } from "../stores/ledgerStore";
import { todayIso, formatDate } from "../utils/format";

export function PeriodManager({ entity }: { entity: Entity }) {
  usePeriods((s) => s.periods);
  const periods = selectPeriods(entity.id);
  const upsert = usePeriods((s) => s.upsert);
  const setStatus = usePeriods((s) => s.setStatus);

  const ensureCurrent = () => {
    const today = todayIso();
    const exists = periods.find((p) => today >= p.start && today <= p.end);
    if (exists) return;
    const skeleton = buildMonthPeriod(entity.id, today);
    upsert({ id: newId("period_"), ...skeleton });
  };

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Periods · {entity.name}</h2>
      <p className="bk-section-blurb">
        Periods are calendar months by default. Lock a period after
        reconciliation to prevent retroactive edits — corrections then go
        through reversing entries instead.
      </p>

      <div className="bk-period-actions">
        <button type="button" className="bk-btn-ghost" onClick={ensureCurrent}>
          + Current month
        </button>
      </div>

      {periods.length === 0 ? (
        <p className="bk-muted" style={{ marginTop: 18 }}>
          No periods yet. Click + Current month to seed one.
        </p>
      ) : (
        <table className="bk-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Range</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <PeriodRow key={p.id} p={p} setStatus={setStatus} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PeriodRow({
  p,
  setStatus,
}: {
  p: FiscalPeriod;
  setStatus: (id: string, status: FiscalPeriod["status"], actor?: string) => void;
}) {
  return (
    <tr>
      <td className="bk-mono">
        {formatDate(p.start)} — {formatDate(p.end)}
      </td>
      <td>
        <span className={`bk-pill bk-pill--${pillFor(p.status)}`}>{p.status}</span>
      </td>
      <td>
        {p.status === "locked" ? (
          <button
            type="button"
            className="bk-btn-ghost"
            onClick={() => setStatus(p.id, "open", "operator")}
          >
            Unlock
          </button>
        ) : (
          <button
            type="button"
            className="bk-btn-primary"
            onClick={() => setStatus(p.id, "locked", "operator")}
          >
            Lock
          </button>
        )}
      </td>
    </tr>
  );
}

function pillFor(s: string): string {
  if (s === "locked") return "warn";
  if (s === "soft_closed") return "neutral";
  return "good";
}
