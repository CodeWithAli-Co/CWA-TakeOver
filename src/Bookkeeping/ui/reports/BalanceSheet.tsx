import type { Entity } from "../../types/entity";
import { useLedgerData, selectAccountsForEntity, selectEntries } from "../../stores/ledgerStore";
import { balanceSheet } from "../../engine/reports";
import { formatMoney, formatMoneyAccounting, todayIso } from "../../utils/format";

export function BalanceSheetReport({ entity }: { entity: Entity }) {
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);

  const today = todayIso();
  const bs = balanceSheet(
    {
      entityId: entity.id,
      accounts: selectAccountsForEntity(entity.id),
      entries: selectEntries(entity.id),
      lines: useLedgerData.getState().lines,
    },
    today,
  );

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Balance Sheet · {entity.name}</h2>
      <p className="bk-section-blurb">
        As of {today}.
        {bs.balanced
          ? " Assets = Liabilities + Equity. Books are in balance."
          : " ⚠ Assets ≠ Liabilities + Equity. Investigate."}
      </p>

      <div className="bk-bs-grid">
        <Section title="Assets" lines={bs.assets} total={bs.totals.assets} currency={entity.baseCurrency} />
        <div>
          <Section
            title="Liabilities"
            lines={bs.liabilities}
            total={bs.totals.liabilities}
            currency={entity.baseCurrency}
          />
          <Section
            title="Equity"
            lines={bs.equity}
            total={bs.totals.equity}
            currency={entity.baseCurrency}
          />
          <div className="bk-pnl-subtotal" data-emphasis>
            <span>Total Liabilities + Equity</span>
            <span className="bk-mono">
              {formatMoney(bs.totals.liabilities + bs.totals.equity, entity.baseCurrency)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  lines,
  total,
  currency,
}: {
  title: string;
  lines: { accountId: string; code: string; name: string; amount: number }[];
  total: number;
  currency: string;
}) {
  return (
    <div className="bk-pnl-group">
      <h3 className="bk-pnl-group-title">{title}</h3>
      <table className="bk-table bk-table--inner">
        <tbody>
          {lines
            .filter((l) => Math.abs(l.amount) > 0.01)
            .map((l) => (
              <tr key={l.accountId}>
                <td className="bk-mono" style={{ width: 80 }}>{l.code}</td>
                <td>{l.name}</td>
                <td className="bk-mono" style={{ width: 140, textAlign: "right" }}>
                  {formatMoneyAccounting(l.amount, currency)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="bk-pnl-subtotal">
        <span>Total {title}</span>
        <span className="bk-mono">{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}
