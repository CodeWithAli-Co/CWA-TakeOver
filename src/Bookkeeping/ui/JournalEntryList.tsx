// JournalEntryList — recent entries for the active entity, drill into
// lines on click. Read-only; editing happens via reversing entries.

import { useMemo, useState } from "react";
import type { Entity } from "../types/entity";
import { useLedgerData, selectEntries, selectLinesForEntry } from "../stores/ledgerStore";
import { accountsById } from "../utils/coaCodes";
import { formatDate, formatMoney } from "../utils/format";

export function JournalEntryList({ entity }: { entity: Entity }) {
  // Subscribe — re-render on any ledger mutation.
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);
  const entries = selectEntries(entity.id);

  const [openId, setOpenId] = useState<string | null>(null);

  const accountIndex = useMemo(
    () => accountsById(useLedgerData.getState().accounts),
    [useLedgerData.getState().accounts],
  );

  if (entries.length === 0) {
    return (
      <section className="bk-section">
        <h2 className="bk-section-title">Journal Entries</h2>
        <p className="bk-section-blurb">
          No entries yet. Post one in the New Journal Entry tab.
        </p>
      </section>
    );
  }

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Journal Entries · {entity.name}</h2>
      <p className="bk-section-blurb">
        {entries.length} entries total. Click any row to drill into its lines.
      </p>

      <table className="bk-table">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Date</th>
            <th>Memo</th>
            <th style={{ width: 100 }}>Source</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 130, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isOpen = openId === e.id;
            const lines = isOpen ? selectLinesForEntry(e.id) : [];
            return (
              <>
                <tr
                  key={e.id}
                  onClick={() => setOpenId(isOpen ? null : e.id)}
                  className="bk-row-clickable"
                  data-open={isOpen}
                >
                  <td className="bk-mono">{formatDate(e.date)}</td>
                  <td>{e.memo || <span className="bk-muted">(no memo)</span>}</td>
                  <td className="bk-muted bk-mono">{e.source}</td>
                  <td>
                    <span className={`bk-pill bk-pill--${pillStatus(e.status)}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="bk-mono" style={{ textAlign: "right" }}>
                    {formatMoney(e.totalBase, entity.baseCurrency)}
                  </td>
                </tr>
                {isOpen && lines.length > 0 && (
                  <tr key={`${e.id}-lines`} className="bk-row-detail">
                    <td colSpan={5}>
                      <table className="bk-table bk-table--inner">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th style={{ width: 130, textAlign: "right" }}>Debit</th>
                            <th style={{ width: 130, textAlign: "right" }}>Credit</th>
                            <th>Memo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => {
                            const acct = accountIndex.get(l.accountId);
                            return (
                              <tr key={l.id}>
                                <td className="bk-mono">
                                  {acct ? `${acct.code} · ${acct.name}` : l.accountId}
                                </td>
                                <td className="bk-mono" style={{ textAlign: "right" }}>
                                  {l.debit > 0 ? formatMoney(l.baseDebit, entity.baseCurrency) : ""}
                                </td>
                                <td className="bk-mono" style={{ textAlign: "right" }}>
                                  {l.credit > 0 ? formatMoney(l.baseCredit, entity.baseCurrency) : ""}
                                </td>
                                <td className="bk-muted">{l.memo}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function pillStatus(s: string): string {
  if (s === "posted") return "good";
  if (s === "reversed") return "warn";
  return "neutral";
}
