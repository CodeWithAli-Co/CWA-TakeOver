// ImportInbox — pending Plaid + Stripe items, run them through the
// reconciliation engine, show the operator: Match / Rule / Pending.
// One-click approve creates the JE; one-click exclude marks the tx
// as ignored (e.g. an internal transfer that's already booked).

import { useMemo, useState } from "react";
import type { Entity } from "../types/entity";
import {
  useImportedTx,
  selectPendingForEntity,
} from "../stores/importedTxStore";
import {
  useReconciliationRules,
  selectRulesForEntity,
} from "../stores/reconciliationRulesStore";
import {
  useLedgerData,
  memoryLedgerStore,
  newId,
  selectAccountsForEntity,
  selectEntries,
  selectLinesForEntry,
} from "../stores/ledgerStore";
import { reconcileBatch, type ReconciliationOutcome } from "../engine/reconciliation";
import { postEntry } from "../engine/ledger";
import { selectPeriods } from "../stores/periodStore";
import { formatDate, formatMoney } from "../utils/format";
import { accountsById } from "../utils/coaCodes";

export function ImportInbox({ entity }: { entity: Entity }) {
  // Subscribe to relevant slices so the inbox refreshes when anything changes.
  useImportedTx((s) => s.imported);
  useReconciliationRules((s) => s.rules);
  useLedgerData((s) => s.entries);
  useLedgerData((s) => s.lines);

  const pending = selectPendingForEntity(entity.id);
  const rules = selectRulesForEntity(entity.id);
  const entries = selectEntries(entity.id);
  const lines = pending.length > 0
    ? entries.flatMap((e) => selectLinesForEntry(e.id))
    : [];

  const acctIndex = useMemo(
    () => accountsById(selectAccountsForEntity(entity.id)),
    [entity.id, useLedgerData((s) => s.accounts)],
  );

  const outcomes = useMemo(
    () =>
      reconcileBatch(pending, {
        entity,
        rules,
        existingEntries: entries,
        existingLines: lines,
      }),
    [pending, rules, entries, lines, entity],
  );

  const setTxStatus = useImportedTx((s) => s.setStatus);
  const bumpRule = useReconciliationRules((s) => s.bumpHit);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (
    tx: typeof pending[number],
    outcome: ReconciliationOutcome,
  ) => {
    setBusyId(tx.id);
    try {
      if (outcome.kind === "matched") {
        setTxStatus(tx.id, "matched", outcome.existingEntryId);
        return;
      }
      if (outcome.kind === "ruled") {
        const entry = await postEntry(outcome.draft, {
          store: memoryLedgerStore,
          entity,
          accounts: selectAccountsForEntity(entity.id),
          periods: selectPeriods(entity.id),
          actor: "operator",
          newId: () => newId(),
        });
        bumpRule(outcome.rule.id);
        setTxStatus(tx.id, "journaled", entry.id);
        return;
      }
      // pending — would need manual categorization UI; handled below
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0) {
    return (
      <section className="bk-section">
        <h2 className="bk-section-title">Import Inbox · {entity.name}</h2>
        <p className="bk-section-blurb">
          Empty. Connect Stripe + Plaid in the Sources tab; new transactions
          land here for review and one-click approval.
        </p>
      </section>
    );
  }

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Import Inbox · {entity.name}</h2>
      <p className="bk-section-blurb">
        {pending.length} pending. Each row shows what the reconciliation engine proposes:
        an existing JE match, a rule-based proposal, or pending manual categorization.
      </p>

      <table className="bk-table">
        <thead>
          <tr>
            <th style={{ width: 100 }}>Date</th>
            <th>Description</th>
            <th style={{ width: 120, textAlign: "right" }}>Amount</th>
            <th>Proposal</th>
            <th style={{ width: 1 }}></th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map(({ tx, outcome }) => {
            const ruleAcctId =
              outcome.kind === "ruled" ? outcome.draft.lines[1]?.accountId : null;
            const ruleAcct = ruleAcctId ? acctIndex.get(ruleAcctId) : null;
            return (
              <tr key={tx.id}>
                <td className="bk-mono">{formatDate(tx.postedAt.slice(0, 10))}</td>
                <td>{tx.description}</td>
                <td className="bk-mono" style={{ textAlign: "right" }}>
                  {formatMoney(tx.amount, tx.currency)}
                </td>
                <td>
                  {outcome.kind === "matched" && (
                    <span className="bk-pill bk-pill--good">Matches existing JE</span>
                  )}
                  {outcome.kind === "ruled" && (
                    <span className="bk-pill bk-pill--info">
                      Rule → {ruleAcct ? `${ruleAcct.code} ${ruleAcct.name}` : "?"}
                    </span>
                  )}
                  {outcome.kind === "pending" && (
                    <span className="bk-pill bk-pill--warn">Manual</span>
                  )}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {outcome.kind !== "pending" && (
                    <button
                      type="button"
                      className="bk-btn-primary"
                      disabled={busyId === tx.id}
                      onClick={() => handleApprove(tx, outcome)}
                    >
                      {busyId === tx.id ? "..." : "Approve"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="bk-btn-ghost"
                    onClick={() => setTxStatus(tx.id, "excluded")}
                    title="Ignore this transaction"
                  >
                    Exclude
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
