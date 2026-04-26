import { useState } from "react";
import type { Entity } from "../types/entity";
import { TrialBalanceReport } from "./reports/TrialBalance";
import { ProfitAndLossReport } from "./reports/ProfitAndLoss";
import { BalanceSheetReport } from "./reports/BalanceSheet";

const REPORT_TABS = [
  { id: "tb", label: "Trial Balance" },
  { id: "pnl", label: "P&L" },
  { id: "bs", label: "Balance Sheet" },
] as const;
type ReportTab = (typeof REPORT_TABS)[number]["id"];

export function ReportsPanel({ entity }: { entity: Entity }) {
  const [tab, setTab] = useState<ReportTab>("pnl");

  return (
    <div>
      <nav className="bk-reports-nav">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            data-active={tab === t.id}
            className="bk-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "tb" && <TrialBalanceReport entity={entity} />}
      {tab === "pnl" && <ProfitAndLossReport entity={entity} />}
      {tab === "bs" && <BalanceSheetReport entity={entity} />}
    </div>
  );
}
