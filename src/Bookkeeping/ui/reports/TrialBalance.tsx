import type { Entity } from "../../types/entity";
import { useLedgerData, selectAccountsForEntity, selectEntries } from "../../stores/ledgerStore";
import { trialBalance } from "../../engine/reports";
import { formatMoney, todayIso } from "../../utils/format";

export function TrialBalanceReport({ entity }: { entity: Entity }) {
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);

  const today = todayIso();
  const tb = trialBalance(
    {
      entityId: entity.id,
      accounts: selectAccountsForEntity(entity.id),
      entries: selectEntries(entity.id),
      lines: useLedgerData.getState().lines,
    },
    { start: `${today.slice(0, 4)}-01-01`, end: today },
  );

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Trial Balance · {entity.name}</h2>
      <p className="bk-section-blurb">
        Year-to-date through {today}. Debits must equal credits — they do automatically
        because the engine refuses unbalanced entries at post time.
      </p>
      <div className="bk-tb-balance" data-balanced={tb.balanced}>
        Debits {formatMoney(tb.totalDebit, entity.baseCurrency)} ·
        Credits {formatMoney(tb.totalCredit, entity.baseCurrency)} ·
        {tb.balanced ? " Balanced" : " ⚠ NOT balanced — investigate."}
      </div>
      <table className="bk-table">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Code</th>
            <th>Name</th>
            <th style={{ width: 130, textAlign: "right" }}>Debit</th>
            <th style={{ width: 130, textAlign: "right" }}>Credit</th>
            <th style={{ width: 130, textAlign: "right" }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.filter((r) => r.debit > 0 || r.credit > 0).map((r) => (
            <tr key={r.accountId}>
              <td className="bk-mono">{r.code}</td>
              <td>{r.name}</td>
              <td className="bk-mono" style={{ textAlign: "right" }}>
                {r.debit > 0 ? formatMoney(r.debit, entity.baseCurrency) : ""}
              </td>
              <td className="bk-mono" style={{ textAlign: "right" }}>
                {r.credit > 0 ? formatMoney(r.credit, entity.baseCurrency) : ""}
              </td>
              <td className="bk-mono" style={{ textAlign: "right" }}>
                {formatMoney(r.balance, entity.baseCurrency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
