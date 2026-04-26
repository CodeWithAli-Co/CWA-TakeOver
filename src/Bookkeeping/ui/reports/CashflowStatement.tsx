import type { Entity } from "../../types/entity";
import { useLedgerData, selectAccountsForEntity, selectEntries } from "../../stores/ledgerStore";
import { cashflowStatement } from "../../engine/reports";
import { formatMoney, formatMoneyAccounting, todayIso } from "../../utils/format";

export function CashflowStatementReport({ entity }: { entity: Entity }) {
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);

  const today = todayIso();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const cfs = cashflowStatement(
    {
      entityId: entity.id,
      accounts: selectAccountsForEntity(entity.id),
      entries: selectEntries(entity.id),
      lines: useLedgerData.getState().lines,
    },
    { start: yearStart, end: today },
  );

  // Sanity check: net change should match ending - starting cash.
  const reconciles = Math.abs(
    cfs.netCashChange - (cfs.endingCash - cfs.startingCash),
  ) < 0.01;

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Cashflow Statement · {entity.name}</h2>
      <p className="bk-section-blurb">
        Indirect method, year-to-date through {today}. Starts from Net Income,
        adjusts for non-cash items, then walks investing and financing.
      </p>

      <div className="bk-pnl-group">
        <h3 className="bk-pnl-group-title">Cash from Operations</h3>
        <table className="bk-table bk-table--inner">
          <tbody>
            <tr>
              <td>Net Income</td>
              <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                {formatMoneyAccounting(cfs.netIncome, entity.baseCurrency)}
              </td>
            </tr>
            {cfs.adjustments.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                  {formatMoneyAccounting(a.amount, entity.baseCurrency)}
                </td>
              </tr>
            ))}
            {cfs.workingCapitalChanges.map((w) => (
              <tr key={w.name}>
                <td>{w.name}</td>
                <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                  {formatMoneyAccounting(w.amount, entity.baseCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bk-pnl-subtotal" data-bold>
        <span>Net Cash from Operations</span>
        <span className="bk-mono">{formatMoneyAccounting(cfs.cashFromOperations, entity.baseCurrency)}</span>
      </div>

      <div className="bk-pnl-group">
        <h3 className="bk-pnl-group-title">Cash from Investing</h3>
        <table className="bk-table bk-table--inner">
          <tbody>
            <tr>
              <td>Net change in fixed assets</td>
              <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                {formatMoneyAccounting(cfs.cashFromInvesting, entity.baseCurrency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="bk-pnl-subtotal" data-bold>
        <span>Net Cash from Investing</span>
        <span className="bk-mono">{formatMoneyAccounting(cfs.cashFromInvesting, entity.baseCurrency)}</span>
      </div>

      <div className="bk-pnl-group">
        <h3 className="bk-pnl-group-title">Cash from Financing</h3>
        <table className="bk-table bk-table--inner">
          <tbody>
            <tr>
              <td>Net change from loans + owner activity</td>
              <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                {formatMoneyAccounting(cfs.cashFromFinancing, entity.baseCurrency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="bk-pnl-subtotal" data-bold>
        <span>Net Cash from Financing</span>
        <span className="bk-mono">{formatMoneyAccounting(cfs.cashFromFinancing, entity.baseCurrency)}</span>
      </div>

      <div className="bk-pnl-subtotal" data-emphasis>
        <span>Net Change in Cash</span>
        <span className="bk-mono">{formatMoneyAccounting(cfs.netCashChange, entity.baseCurrency)}</span>
      </div>

      <div className="bk-tb-balance" data-balanced={reconciles}>
        Starting cash {formatMoney(cfs.startingCash, entity.baseCurrency)} +
        Net change {formatMoneyAccounting(cfs.netCashChange, entity.baseCurrency)} =
        Ending cash {formatMoney(cfs.endingCash, entity.baseCurrency)}
        {reconciles ? " · Reconciles" : " · ⚠ Does not reconcile — investigate"}
      </div>
    </section>
  );
}
