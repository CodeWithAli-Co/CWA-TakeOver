/**
 * ConnectorsStrip.tsx — live connector summary row on /operations.
 *
 * Sits between the Axon brief banner and the main bento. Auto-
 * hides entirely when no connectors are wired up — first-time
 * users don't see a stub. As soon as a connector is added in
 * Settings → Connectors, the strip appears with live data.
 *
 * Each mini-card calls `useConnectorSummary` which is the same
 * TanStack-cached query the Settings tiles use. Hitting both
 * pages doesn't double-fetch; the cache dedupes.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  useConnectors,
  useDeleteConnector,
  type Connector,
} from "@/stores/connectors";
import {
  getCatalogEntry,
  Monogram,
} from "@/MyComponents/SettingNavComponents/connectorCatalog";
import { useConnectorSummary } from "@/MyComponents/SettingNavComponents/connectorSummary";
import { ConnectorDetailModal } from "@/MyComponents/SettingNavComponents/ConnectorDetailModal";

export function ConnectorsStrip() {
  const { data: connectors = [], isLoading } = useConnectors();
  const deleteMut = useDeleteConnector();
  // Selected connector drives the detail modal. Null = closed.
  // Lives on the strip rather than on each card so closing one
  // and opening another doesn't unmount/remount the modal chrome.
  const [selected, setSelected] = useState<Connector | null>(null);

  // Don't render until we know whether there are any, and don't
  // render at all when there are none. Keeps the dashboard from
  // showing an empty "Connectors" tag for fresh installs.
  if (isLoading || connectors.length === 0) return null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] px-4 py-3"
      >
        <header className="flex items-center justify-between mb-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/85">
              Connectors
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-text-tertiary">
              {connectors.length} connected
            </span>
          </div>
          <Link
            to={"/settings" as any}
            search={{ tab: "connectors" } as any}
            className="inline-flex items-center gap-1 text-[10.5px] text-text-tertiary hover:text-foreground transition-colors"
          >
            <SettingsIcon size={10} />
            Manage
          </Link>
        </header>
        <div
          className="flex items-stretch gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {connectors.map((c) => (
            <MiniCard
              key={c.id}
              connector={c}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      </motion.section>
      <ConnectorDetailModal
        connector={selected}
        onClose={() => setSelected(null)}
        onDisconnect={(id) => deleteMut.mutate(id)}
      />
    </>
  );
}

function MiniCard({
  connector,
  onClick,
}: {
  connector: Connector;
  onClick: () => void;
}) {
  const meta = getCatalogEntry(connector.kind);
  const summary = useConnectorSummary(connector);

  // Three-way status — loading, error, ok. Error covers both the
  // fetch-rejected case AND a successful fetch that came back
  // with ok=false (e.g. token saved but service rejected it now).
  const isError =
    !!summary.error || (summary.data ? !summary.data.ok : false);
  const isLoading = summary.isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${meta?.name ?? connector.kind} details`}
      className="shrink-0 w-[200px] text-left rounded-xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-primary/25 focus:outline-none focus:border-primary/40 transition-colors px-3 py-2.5 cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1.5">
        {meta && (
          <Monogram letter={meta.monogram} color={meta.brand} size={26} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-foreground truncate leading-tight">
            {meta?.name ?? connector.kind}
          </p>
          {meta?.category && (
            <p className="text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary truncate font-bold">
              {meta.category}
            </p>
          )}
        </div>
        <StatusDot loading={isLoading} error={isError} />
      </div>
      <p
        className={`text-[11px] truncate ${
          isError
            ? "text-destructive"
            : isLoading
              ? "text-text-tertiary italic"
              : "text-text-secondary"
        }`}
      >
        {isLoading
          ? "Loading…"
          : isError
            ? summary.data?.error ?? "Connection failed"
            : (summary.data?.text ?? "—")}
      </p>
    </button>
  );
}

function StatusDot({
  loading,
  error,
}: {
  loading: boolean;
  error: boolean;
}) {
  if (loading)
    return (
      <Loader2 className="h-2.5 w-2.5 animate-spin text-text-tertiary shrink-0" />
    );
  if (error)
    return (
      <AlertTriangle
        className="h-2.5 w-2.5 text-destructive shrink-0"
        strokeWidth={2.4}
      />
    );
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-success shrink-0"
      title="Connected"
    />
  );
}
