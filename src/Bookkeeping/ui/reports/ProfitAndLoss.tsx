import type { Entity } from "../../types/entity";
import { useLedgerData, selectAccountsForEntity, selectEntries } from "../../stores/ledgerStore";
import { profitAndLoss } from "../../engine/reports";
import { formatMoney, formatMoneyAccounting, todayIso } from "../../utils/format";

export function ProfitAndLossReport({ entity }: { entity: Entity }) {
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);

  const today = todayIso();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const pnl = profitAndLoss(
    {
      entityId: entity.id,
      accounts: selectAccountsForEntity(entity.id),
      entries: selectEntries(entity.id),
      lines: useLedgerData.getState().lines,
    },
    { start: yearStart, end: today },
  );

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Profit &amp; Loss · {entity.name}</h2>
      <p className="bk-section-blurb">
        Year-to-date through {today}.
      </p>

      <Group title="Revenue" lines={pnl.income} currency={entity.baseCurrency} />
      <SubTotal label="Total Revenue" amount={pnl.totals.revenue} currency={entity.baseCurrency} />

      <Group title="Cost of Services" lines={pnl.cogs} currency={entity.baseCurrency} />
      <SubTotal label="Gross Profit" amount={pnl.totals.grossProfit} currency={entity.baseCurrency} bold />

      <Group title="Operating Expenses" lines={pnl.operatingExpenses} currency={entity.baseCurrency} />
      <SubTotal label="Operating Income" amount={pnl.totals.operatingIncome} currency={entity.baseCurrency} />

      <Group title="Other Expenses" lines={pnl.otherExpenses} currency={entity.baseCurrency} />
      <SubTotal
        label="Net Income"
        amount={pnl.totals.netIncome}
        currency={entity.baseCurrency}
        bold
        emphasis
      />
    </section>
  );
}

function Group({
  title,
  lines,
  currency,
}: {
  title: string;
  lines: { accountId: string; code: string; name: string; amount: number }[];
  currency: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="bk-pnl-group">
      <h3 className="bk-pnl-group-title">{title}</h3>
      <table className="bk-table bk-table--inner">
        <tbody>
          {lines.map((l) => (
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
    </div>
  );
}

function SubTotal({
  label,
  amount,
  currency,
  bold,
  emphasis,
}: {
  label: string;
  amount: number;
  currency: string;
  bold?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className="bk-pnl-subtotal"
      data-bold={bold || undefined}
      data-emphasis={emphasis || undefined}
    >
      <span>{label}</span>
      <span className="bk-mono">{formatMoney(amount, currency)}</span>
    </div>
  );
}
