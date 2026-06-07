/**
 * connectors.tsx — Settings → Connectors page.
 *
 * Replaces the previous "Integrations" page. Under the new
 * Takeover model (a single UI that aggregates every SaaS the team
 * already uses), this is the catalog where the operator wires up
 * each external account. The catalog is ordered easiest →
 * hardest to set up so the operator can start small and ratchet
 * up.
 *
 * Difficulty tiers:
 *   · Easy   — single API key paste, no OAuth dance.
 *   · Medium — standard OAuth 2.0 flow.
 *   · Hard   — multi-step (linking + token exchange + webhooks
 *              and/or regulatory/compliance considerations).
 *
 * Connection state is not persisted yet — there is no
 * `connectors` table. Every card renders "Not connected" and the
 * Connect button shows a placeholder. Backend wiring is a
 * separate phase.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plug, Search, X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import {
  useConnectors,
  useDeleteConnector,
  type Connector as PersistedConnector,
} from "@/stores/connectors";
import { ConnectorCredentialDialog } from "./ConnectorCredentialDialog";
import { ConnectorDetailModal } from "./ConnectorDetailModal";
import { GmailConnection } from "@/MyComponents/Settings/GmailConnection";
import {
  CONNECTORS,
  Monogram,
  tierStyle,
  type CatalogEntry,
  type ConnectorTier,
} from "./connectorCatalog";
import { useConnectorSummary } from "./connectorSummary";

// Aliases so the rest of the file (and the JSX) reads with the
// shorter names. CONNECTORS / Monogram / tierStyle now live in
// `connectorCatalog.tsx`.
type Tier = ConnectorTier;
type Connector = CatalogEntry;

// ─────────────────────────────────────────────────────────────────
// Page export
// ─────────────────────────────────────────────────────────────────

export const ConnectorsSettings = () => {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "All">("All");
  // Connector currently shown in the detail modal. Null = closed.
  // Lives at the page level so all card "Inspect" buttons share
  // the same modal instance.
  const [inspecting, setInspecting] = useState<PersistedConnector | null>(null);

  // Real persistence — read from the `connectors` table.
  const { data: persisted = [], isLoading } = useConnectors();
  const deleteMut = useDeleteConnector();

  // Map kind → persisted row for O(1) lookups in the catalog.
  const connectedByKind = useMemo(() => {
    const m = new Map<string, PersistedConnector>();
    for (const row of persisted) m.set(row.kind, row);
    return m;
  }, [persisted]);

  // Which connector's credential modal is open. `null` = closed.
  const [openKind, setOpenKind] = useState<string | null>(null);

  const handleDisconnect = (kind: string) => {
    const row = connectedByKind.get(kind);
    if (row) deleteMut.mutate(row.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONNECTORS.filter((c) => {
      if (tierFilter !== "All" && c.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q)
      );
    });
  }, [query, tierFilter]);

  const tierCounts = useMemo(() => {
    const counts = { Easy: 0, Medium: 0, Hard: 0 } as Record<Tier, number>;
    for (const c of CONNECTORS) counts[c.tier]++;
    return counts;
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <header>
        <div className="flex items-center gap-2 mb-1.5">
          <Plug className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            Catalog
          </span>
        </div>
        <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-[-0.02em]">
          Connectors<span className="text-primary">.</span>
        </h2>
        <p className="text-[12.5px] text-text-tertiary mt-1.5 max-w-xl leading-relaxed">
          Wire up the tools your team already uses. Each connector pulls data
          and exposes actions across the dashboard. Ordered easiest to set up
          first.
        </p>
      </header>

      {/* First-class email integration — Gmail OAuth. Lives above
          the catalog because send-from-app + inbox-sync is a major
          product feature (drives the AI email draft, contact inbox
          timeline, etc.), not just another API-key paste. */}
      <GmailConnection />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search connectors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 bg-foreground/[0.04] border border-border-soft rounded-md text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tier segmented control */}
        <div className="inline-flex items-center bg-foreground/[0.05] border border-border-soft rounded-full p-0.5">
          {(["All", "Easy", "Medium", "Hard"] as const).map((t) => (
            <TierChip
              key={t}
              label={t}
              count={t === "All" ? CONNECTORS.length : tierCounts[t]}
              active={tierFilter === t}
              onClick={() => setTierFilter(t)}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-[12px]">Loading catalog…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border-soft rounded-2xl">
          <p className="text-[12px] text-text-tertiary italic">
            No connectors match that filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => {
            const row = connectedByKind.get(c.id) ?? null;
            return (
              <ConnectorCard
                key={c.id}
                connector={c}
                persistedRow={row}
                onConnect={() => setOpenKind(c.id)}
                onDisconnect={() => handleDisconnect(c.id)}
                onInspect={() => row && setInspecting(row)}
                delay={Math.min(i, 8) * 0.03}
              />
            );
          })}
        </div>
      )}

      {/* Footnote */}
      <p className="text-[11px] text-text-tertiary/80 italic text-center pt-2">
        Credentials are stored in Supabase with row-level security. Axon reads
        from the same table — connect a service here and it appears in Axon's
        toolbox.
      </p>

      {/* Credential modal — opens for whichever kind was clicked. */}
      {openKind && (
        <ConnectorCredentialDialog
          kind={openKind}
          name={
            CONNECTORS.find((c) => c.id === openKind)?.name ?? openKind
          }
          existing={connectedByKind.get(openKind) ?? null}
          onClose={() => setOpenKind(null)}
        />
      )}

      {/* Detail modal — opens via the Inspect button on connected
        * cards. Shows capabilities + imported data + where it shows
        * up in the rest of the app. */}
      <ConnectorDetailModal
        connector={inspecting}
        onClose={() => setInspecting(null)}
        onDisconnect={(id) => deleteMut.mutate(id)}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Tier filter chip
// ─────────────────────────────────────────────────────────────────

function TierChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "text-background"
          : "text-text-tertiary hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="connectorTierIndicator"
          className="absolute inset-0 bg-foreground rounded-full"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative">{label}</span>
      <span
        className={`relative tabular-nums ${active ? "text-background/70" : "text-text-tertiary/70"}`}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// ConnectorCard
// ─────────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  persistedRow,
  onConnect,
  onDisconnect,
  onInspect,
  delay,
}: {
  connector: Connector;
  /** The Supabase row if connected, otherwise null. */
  persistedRow: PersistedConnector | null;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Opens the read-only Details modal (capabilities + imported
   *  data + where this connector's data is displayed). Only shown
   *  when the connector is wired up. */
  onInspect: () => void;
  delay: number;
}) {
  const t = tierStyle(connector.tier);
  const connected = !!persistedRow;
  const lastSyncedAt = persistedRow?.last_synced_at ?? null;
  // Live summary fetch — runs only when there's a persisted row.
  const summary = useConnectorSummary(persistedRow);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/30 transition-colors overflow-hidden flex flex-col"
    >
      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Top row — monogram + name + tier */}
        <div className="flex items-start gap-3">
          <Monogram
            letter={connector.monogram}
            color={connector.brand}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-bold text-foreground leading-tight truncate">
                {connector.name}
              </h3>
              {connected && (
                <CheckCircle2
                  className="h-3 w-3 text-success shrink-0"
                  strokeWidth={2.4}
                />
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary/80 mt-0.5">
              {connector.category}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9.5px] font-bold uppercase tracking-[0.12em] shrink-0 ${t.bg} ${t.text} ${t.border}`}
          >
            {connector.tier}
          </span>
        </div>

        {/* Tagline — only when NOT connected. Once connected we
         *  reuse the row for live data, which is more useful. */}
        {!connected && (
          <p className="text-[11.5px] text-text-secondary leading-relaxed line-clamp-2">
            {connector.tagline}
          </p>
        )}

        {/* Live summary — replaces the tagline once connected.
         *  Shows loading / success / error states explicitly so
         *  the user knows the connector is actually doing
         *  something (and immediately sees when it isn't). */}
        {connected && (
          <div className="space-y-1 min-h-[28px]">
            {summary.isLoading && (
              <p className="text-[11px] text-text-tertiary flex items-center gap-1.5">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Pinging service…
              </p>
            )}
            {!summary.isLoading && summary.data?.ok && (
              <>
                <p className="text-[11.5px] font-semibold text-foreground/85">
                  {summary.data.text}
                </p>
                {summary.data.detail && (
                  <p className="text-[10.5px] text-text-tertiary truncate">
                    {summary.data.detail}
                  </p>
                )}
              </>
            )}
            {!summary.isLoading &&
              summary.data &&
              !summary.data.ok && (
                <p className="text-[11px] text-destructive flex items-start gap-1">
                  <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                  <span className="truncate">
                    {summary.data.error ?? "Connection failed"}
                  </span>
                </p>
              )}
            {!summary.isLoading && summary.error && (
              <p className="text-[11px] text-destructive flex items-start gap-1">
                <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                <span className="truncate">Connection failed</span>
              </p>
            )}
          </div>
        )}

        {/* Last-sync timestamp — small caption under the summary. */}
        {connected && lastSyncedAt && (
          <p className="text-[10px] text-text-tertiary/70 tabular-nums">
            Last verified {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Footer -- connect / inspect / disconnect buttons. When
        * connected we surface a primary "Details" pill (opens the
        * read-only inspection modal) plus a quieter Edit creds shortcut.
        * Disconnect lives at the end to stay out of the way. */}
      <div className="px-4 pb-4 pt-1 flex items-center gap-2">
        {connected ? (
          <>
            <button
              type="button"
              onClick={onInspect}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold bg-success/[0.08] text-success border border-success/30 hover:bg-success/[0.12] transition-colors"
            >
              <CheckCircle2 size={11} strokeWidth={2.4} />
              Details
            </button>
            <button
              type="button"
              onClick={onConnect}
              title="Re-enter credentials"
              className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10.5px] font-semibold text-text-tertiary border border-border-soft hover:border-foreground/30 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10.5px] font-semibold text-text-tertiary border border-border-soft hover:border-destructive/40 hover:text-destructive hover:bg-destructive/[0.05] transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-[11.5px] font-semibold bg-foreground/[0.04] text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.06] transition-colors"
          >
            <Plug size={11} strokeWidth={2.4} />
            Connect
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Monogram + hexToRgba moved to ./connectorCatalog so both this
// page and the Operations dashboard strip can share them.
