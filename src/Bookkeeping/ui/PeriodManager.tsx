// PeriodManager — list periods for the active entity, with an
// embedded close workflow (8-step checklist) per period.

import { useState } from "react";
import type { Entity, FiscalPeriod } from "../types/entity";
import { usePeriods, selectPeriods } from "../stores/periodStore";
import { buildMonthPeriod } from "../utils/periods";
import { newId } from "../stores/ledgerStore";
import { todayIso, formatDate } from "../utils/format";
import { PeriodCloseWorkflow } from "./PeriodCloseWorkflow";

export function PeriodManager({ entity }: { entity: Entity }) {
  usePeriods((s) => s.periods);
  const periods = selectPeriods(entity.id);
  const upsert = usePeriods((s) => s.upsert);
  const [openId, setOpenId] = useState<string | null>(null);

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
        Periods are calendar months. Click any row to open its close
        workflow — eight checks that confirm the books are healthy
        before locking. Locked periods refuse new entries.
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
            {periods.map((p) => {
              const isOpen = openId === p.id;
              return (
                <>
                  <tr
                    key={p.id}
                    className="bk-row-clickable"
                    data-open={isOpen}
                    onClick={() => setOpenId(isOpen ? null : p.id)}
                  >
                    <td className="bk-mono">
                      {formatDate(p.start)} — {formatDate(p.end)}
                    </td>
                    <td>
                      <span className={`bk-pill bk-pill--${pillFor(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="bk-muted bk-mono" style={{ paddingRight: 14 }}>
                      {isOpen ? "▾" : "▸"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${p.id}-workflow`} className="bk-row-detail">
                      <td colSpan={3}>
                        <PeriodCloseWorkflow entity={entity} period={p} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function pillFor(s: FiscalPeriod["status"]): string {
  if (s === "locked") return "warn";
  if (s === "soft_closed") return "neutral";
  return "good";
}
