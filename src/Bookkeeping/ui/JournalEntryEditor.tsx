// Journal Entry editor — multi-line form with LIVE debits=credits
// validation. Save is disabled until balanced. Posts via the engine
// so all invariants get checked.

import { useMemo, useState } from "react";
import type { GLAccount } from "../types/coa";
import type { DraftJournalEntry } from "../types/journal";
import type { Entity } from "../types/entity";
import { postEntry, LedgerError } from "../engine/ledger";
import { validateDraft } from "../engine/validation";
import {
  memoryLedgerStore,
  newId,
  selectAccountsForEntity,
} from "../stores/ledgerStore";
import { usePeriods, selectPeriods } from "../stores/periodStore";
import { useLedgerData } from "../stores/ledgerStore";
import { postableAccounts } from "../utils/coaCodes";
import { formatMoney, todayIso } from "../utils/format";

interface DraftLine {
  id: string;
  accountId: string;
  debit: string; // strings while editing, parsed on submit
  credit: string;
  memo: string;
}

const EMPTY_LINE = (): DraftLine => ({
  id: newId("line_"),
  accountId: "",
  debit: "",
  credit: "",
  memo: "",
});

export function JournalEntryEditor({
  entity,
  onPosted,
}: {
  entity: Entity;
  onPosted?: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [EMPTY_LINE(), EMPTY_LINE()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-read accounts on every render so a new seeded entity shows up
  // immediately when the user switches.
  useLedgerData((s) => s.accounts);
  usePeriods((s) => s.periods);

  const accounts = useMemo(
    () => postableAccounts(selectAccountsForEntity(entity.id)),
    [entity.id],
  );

  // ── Live validation totals ────────────────────────────────────
  const validation = useMemo(() => {
    const draft = buildDraft(entity, date, memo, lines);
    if (!draft) {
      return {
        ok: false,
        totalBaseDebit: 0,
        totalBaseCredit: 0,
        errors: [],
        warnings: [],
      };
    }
    return validateDraft(draft, {
      accountsById: new Map(accounts.map((a) => [a.id, a])),
      periods: selectPeriods(entity.id),
      baseCurrency: entity.baseCurrency,
    });
  }, [entity, date, memo, lines, accounts]);

  const balanced = validation.ok;
  const diff = validation.totalBaseDebit - validation.totalBaseCredit;

  // ── Mutators ──────────────────────────────────────────────────
  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((s) => s.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines((s) => [...s, EMPTY_LINE()]);
  const removeLine = (id: string) =>
    setLines((s) => (s.length <= 2 ? s : s.filter((l) => l.id !== id)));

  const reset = () => {
    setDate(todayIso());
    setMemo("");
    setLines([EMPTY_LINE(), EMPTY_LINE()]);
    setError(null);
  };

  const handlePost = async () => {
    setError(null);
    setSaving(true);
    try {
      const draft = buildDraft(entity, date, memo, lines);
      if (!draft) {
        setError("Every line needs an account.");
        return;
      }
      await postEntry(draft, {
        store: memoryLedgerStore,
        entity,
        accounts: selectAccountsForEntity(entity.id),
        periods: selectPeriods(entity.id),
        actor: "operator",
        newId: () => newId(),
      });
      reset();
      onPosted?.();
    } catch (e) {
      if (e instanceof LedgerError) {
        setError(e.errors.join(" · "));
      } else {
        setError(String((e as Error).message));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">New Journal Entry</h2>
      <p className="bk-section-blurb">
        Live debits=credits validation. Save is disabled until the entry
        balances. Posted entries are immutable; corrections happen via
        reversing entries.
      </p>

      <div className="bk-je-meta">
        <label className="bk-field">
          <span className="bk-field-label">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bk-input"
          />
        </label>
        <label className="bk-field bk-field--grow">
          <span className="bk-field-label">Memo</span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="What was this for?"
            className="bk-input"
          />
        </label>
      </div>

      <table className="bk-table bk-je-table">
        <thead>
          <tr>
            <th style={{ width: "32%" }}>Account</th>
            <th style={{ width: "18%", textAlign: "right" }}>Debit</th>
            <th style={{ width: "18%", textAlign: "right" }}>Credit</th>
            <th>Memo</th>
            <th style={{ width: 1 }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <AccountSelect
                  value={line.accountId}
                  onChange={(v) => updateLine(line.id, { accountId: v })}
                  accounts={accounts}
                />
              </td>
              <td>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={line.debit}
                  onChange={(e) =>
                    updateLine(line.id, { debit: e.target.value, credit: "" })
                  }
                  placeholder="0.00"
                  className="bk-input bk-input--right bk-mono"
                />
              </td>
              <td>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={line.credit}
                  onChange={(e) =>
                    updateLine(line.id, { credit: e.target.value, debit: "" })
                  }
                  placeholder="0.00"
                  className="bk-input bk-input--right bk-mono"
                />
              </td>
              <td>
                <input
                  value={line.memo}
                  onChange={(e) => updateLine(line.id, { memo: e.target.value })}
                  placeholder="optional"
                  className="bk-input"
                />
              </td>
              <td>
                <button
                  type="button"
                  className="bk-icon-btn"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length <= 2}
                  title="Remove line"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>
              <button type="button" className="bk-btn-ghost" onClick={addLine}>
                + Add line
              </button>
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="bk-je-totals" data-balanced={balanced}>
        <span>
          Debits <strong className="bk-mono">{formatMoney(validation.totalBaseDebit, entity.baseCurrency)}</strong>
        </span>
        <span>
          Credits <strong className="bk-mono">{formatMoney(validation.totalBaseCredit, entity.baseCurrency)}</strong>
        </span>
        {balanced ? (
          <span className="bk-pill bk-pill--good">Balanced</span>
        ) : (
          <span className="bk-pill bk-pill--bad">
            Off by {formatMoney(Math.abs(diff), entity.baseCurrency)}
          </span>
        )}
      </div>

      {validation.warnings.length > 0 && (
        <div className="bk-warnings">
          {validation.warnings.map((w, i) => (
            <div key={i} className="bk-warning">⚠ {w}</div>
          ))}
        </div>
      )}

      {error && <div className="bk-error">✕ {error}</div>}

      <div className="bk-je-actions">
        <button type="button" className="bk-btn-ghost" onClick={reset} disabled={saving}>
          Reset
        </button>
        <button
          type="button"
          className="bk-btn-primary"
          disabled={!balanced || saving}
          onClick={handlePost}
        >
          {saving ? "Posting..." : "Post Entry"}
        </button>
      </div>
    </section>
  );
}

function AccountSelect({
  value,
  onChange,
  accounts,
}: {
  value: string;
  onChange: (v: string) => void;
  accounts: GLAccount[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bk-input bk-mono"
    >
      <option value="">— Select account —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} · {a.name}
        </option>
      ))}
    </select>
  );
}

function buildDraft(
  entity: Entity,
  date: string,
  memo: string,
  lines: DraftLine[],
): DraftJournalEntry | null {
  if (lines.some((l) => !l.accountId)) return null;
  return {
    entityId: entity.id,
    date,
    memo,
    source: "manual",
    lines: lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      currency: entity.baseCurrency,
      memo: l.memo || undefined,
    })),
  };
}
