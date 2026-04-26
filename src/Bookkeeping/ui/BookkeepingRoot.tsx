// BookkeepingRoot — top-level shell mounted at /bookkeeping.
// All eight tabs from PLAN.md now wire to real implementations.

import { useMemo, useState } from "react";
import { useActiveEntity } from "../stores/activeEntityStore";
import { SEED_ENTITIES, seedEntityChartOfAccounts } from "../data/seedEntities";
import { JournalEntryEditor } from "./JournalEntryEditor";
import { JournalEntryList } from "./JournalEntryList";
import { CounterpartyManager } from "./CounterpartyManager";
import { PeriodManager } from "./PeriodManager";
import { ImportInbox } from "./ImportInbox";
import { SourcesPanel } from "./SourcesPanel";
import { ReportsPanel } from "./ReportsPanel";
import "./bookkeeping.css";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "ledger", label: "General Ledger" },
  { id: "journal", label: "Journal Entries" },
  { id: "inbox", label: "Import Inbox" },
  { id: "reports", label: "Reports" },
  { id: "sources", label: "Sources" },
  { id: "settings", label: "Settings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SETTINGS_TABS = [
  { id: "counterparties", label: "Counterparties" },
  { id: "periods", label: "Periods" },
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

const JOURNAL_TABS = [
  { id: "list", label: "All Entries" },
  { id: "new", label: "+ New Entry" },
] as const;
type JournalTab = (typeof JOURNAL_TABS)[number]["id"];

export default function BookkeepingRoot() {
  const { activeEntityId, setActiveEntity } = useActiveEntity();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("counterparties");
  const [journalTab, setJournalTab] = useState<JournalTab>("list");

  const entity = useMemo(
    () => SEED_ENTITIES.find((e) => e.id === activeEntityId) ?? SEED_ENTITIES[0],
    [activeEntityId],
  );

  const accounts = useMemo(
    () => seedEntityChartOfAccounts(entity),
    [entity],
  );

  return (
    <div className="bk-root">
      <header className="bk-header">
        <div className="bk-header-left">
          <span className="bk-title">Bookkeeping</span>
          <span className="bk-subtitle">{entity.legalForm} · {entity.baseCurrency}</span>
        </div>

        <div className="bk-entity-switcher" role="tablist" aria-label="Active entity">
          {SEED_ENTITIES.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === activeEntityId}
              data-active={e.id === activeEntityId}
              className="bk-entity-tab"
              onClick={() => setActiveEntity(e.id)}
            >
              {e.name}
            </button>
          ))}
        </div>
      </header>

      <nav className="bk-tabs">
        {TABS.map((t) => (
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

      <main className="bk-pane">
        {tab === "dashboard" && (
          <section className="bk-section">
            <h2 className="bk-section-title">Dashboard · {entity.name}</h2>
            <p className="bk-section-blurb">
              KPI dashboard wires up after first journal entries flow through the
              Reports engine. Phase-1 status below.
            </p>
            <div className="bk-stat-grid">
              <Stat label="Entity" value={entity.name} />
              <Stat label="Accounts" value={String(accounts.length)} />
              <Stat label="Postable" value={String(accounts.filter((a) => a.isPostable).length)} />
              <Stat label="Currency" value={entity.baseCurrency} />
            </div>
          </section>
        )}

        {tab === "ledger" && (
          <CoAPreview entityName={entity.name} accounts={accounts} />
        )}

        {tab === "journal" && (
          <div>
            <nav className="bk-reports-nav">
              {JOURNAL_TABS.map((t) => (
                <button
                  key={t.id}
                  data-active={journalTab === t.id}
                  className="bk-tab"
                  onClick={() => setJournalTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {journalTab === "list" && <JournalEntryList entity={entity} />}
            {journalTab === "new" && (
              <JournalEntryEditor
                entity={entity}
                onPosted={() => setJournalTab("list")}
              />
            )}
          </div>
        )}

        {tab === "inbox" && <ImportInbox entity={entity} />}
        {tab === "reports" && <ReportsPanel entity={entity} />}
        {tab === "sources" && <SourcesPanel entity={entity} />}

        {tab === "settings" && (
          <div>
            <nav className="bk-reports-nav">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t.id}
                  data-active={settingsTab === t.id}
                  className="bk-tab"
                  onClick={() => setSettingsTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {settingsTab === "counterparties" && <CounterpartyManager entity={entity} />}
            {settingsTab === "periods" && <PeriodManager entity={entity} />}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bk-stat">
      <span className="bk-stat-label">{label}</span>
      <span className="bk-stat-value">{value}</span>
    </div>
  );
}

function CoAPreview({
  entityName,
  accounts,
}: {
  entityName: string;
  accounts: ReturnType<typeof seedEntityChartOfAccounts>;
}) {
  return (
    <section className="bk-section">
      <h2 className="bk-section-title">General Ledger — {entityName}</h2>
      <p className="bk-section-blurb">
        Default chart of accounts seeded for this entity. Click a postable
        account in a future iteration to drill into its journal lines.
      </p>
      <table className="bk-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Subtype</th>
            <th>Normal</th>
            <th>Postable</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} data-postable={a.isPostable}>
              <td className="bk-mono">{a.code}</td>
              <td>{a.name}</td>
              <td>{a.type}</td>
              <td className="bk-muted">{a.subtype}</td>
              <td className="bk-mono bk-muted">{a.normalBalance}</td>
              <td className="bk-mono">{a.isPostable ? "✓" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
