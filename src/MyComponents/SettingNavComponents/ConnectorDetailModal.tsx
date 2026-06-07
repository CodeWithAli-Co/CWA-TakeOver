/**
 * ConnectorDetailModal.tsx — click-through detail modal for any
 * connected integration.
 *
 * Answers the three questions an operator has after wiring up an
 * external service:
 *
 *   1. What can this thing do?  (capabilities — from connectorMetadata)
 *   2. What data has it pulled?  (live counts via useConnectorSummary
 *      with the dataKinds list as the descriptor)
 *   3. Where in the app is that data being used?  (surfaces — click any
 *      row to navigate to the consuming route).
 *
 * Opens from any connector tile -- ConnectorsStrip mini-card on
 * /operations and the ConnectorCard on the Settings page. Closing
 * routes through the same handler; we never own the actual disconnect
 * mutation, just call the parent's onDisconnect callback so the
 * existing flow in connectors.tsx keeps its single source of truth.
 */

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Database,
  Layers,
  AlertTriangle,
  Loader2,
  Settings as SettingsIcon,
  Unplug,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { Connector } from "@/stores/connectors";
import {
  getCatalogEntry,
  Monogram,
} from "./connectorCatalog";
import { getConnectorMetadata } from "./connectorMetadata";
import { useConnectorSummary } from "./connectorSummary";

interface Props {
  /** The connector row to show; null = closed. */
  connector: Connector | null;
  onClose: () => void;
  /** Optional — called when the user clicks "Disconnect". The modal
   *  doesn't own the mutation; the parent does. */
  onDisconnect?: (id: string) => void;
}

export function ConnectorDetailModal({
  connector,
  onClose,
  onDisconnect,
}: Props) {
  const navigate = useNavigate();
  const isOpen = !!connector;

  // Esc + click-outside close. We rely on a backdrop click handler
  // rather than a global keypress to avoid colliding with other
  // modals already mounted in the tree.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {connector && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 28,
            }}
            className="relative w-full max-w-[680px] max-h-[88vh] overflow-y-auto rounded-sm bg-card border border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <ModalBody
              connector={connector}
              onClose={onClose}
              onDisconnect={onDisconnect}
              onNavigateTo={(route) => {
                onClose();
                if (route) navigate({ to: route as any });
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalBody({
  connector,
  onClose,
  onDisconnect,
  onNavigateTo,
}: {
  connector: Connector;
  onClose: () => void;
  onDisconnect?: (id: string) => void;
  onNavigateTo: (route: string | null) => void;
}) {
  const meta = getCatalogEntry(connector.kind);
  const detail = getConnectorMetadata(connector.kind);
  const summary = useConnectorSummary(connector);

  const isError =
    !!summary.error || (summary.data ? !summary.data.ok : false);
  const isLoading = summary.isLoading;
  const status: "ok" | "loading" | "error" = isLoading
    ? "loading"
    : isError
      ? "error"
      : "ok";

  return (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-start gap-4 p-6 border-b border-border/60">
        <div className="flex-shrink-0">
          {meta && (
            <Monogram letter={meta.monogram} color={meta.brand} size={48} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-[20px] font-semibold text-foreground leading-tight m-0">
              {meta?.name ?? connector.kind}
            </h2>
            <StatusPill status={status} />
          </div>
          {meta?.tagline && (
            <p className="text-[12.5px] text-foreground/55 mt-1 leading-snug">
              {meta.tagline}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10.5px] uppercase tracking-[0.14em] text-foreground/40 font-mono">
            {meta?.category && <span>{meta.category}</span>}
            {meta?.tier && (
              <>
                <span className="text-foreground/20">·</span>
                <span>{meta.tier} setup</span>
              </>
            )}
            <span className="text-foreground/20">·</span>
            <span>
              Connected {formatRelative(connector.connected_at)}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
        >
          <X size={16} />
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="p-6 space-y-7">
        {!detail && (
          <div className="rounded-sm border border-border bg-foreground/[0.02] p-4 text-[12.5px] text-foreground/55">
            We haven't documented this connector's capabilities yet. The
            credentials are saved and any Axon actions or background syncs
            that depend on it will still run — but the operator-facing
            "where it shows up" map is empty.
          </div>
        )}

        {/* ── Live status / summary line ──────────────────────── */}
        <Section
          title="Live status"
          icon={<CheckCircle2 size={11} />}
          meta={isLoading ? "fetching…" : isError ? "error" : "ok"}
        >
          <div
            className={
              "text-[12.5px] " +
              (isError
                ? "text-destructive"
                : isLoading
                  ? "text-foreground/45 italic"
                  : "text-foreground/75")
            }
          >
            {isLoading
              ? "Pinging the API…"
              : isError
                ? summary.data?.error ?? "Connection failed."
                : summary.data?.text ?? "Connection healthy."}
          </div>
        </Section>

        {/* ── Capabilities ────────────────────────────────────── */}
        {detail && detail.capabilities.length > 0 && (
          <Section
            title="Capabilities"
            icon={<Sparkles size={11} />}
            meta={`${detail.capabilities.length} action${detail.capabilities.length === 1 ? "" : "s"}`}
          >
            <ul className="list-none p-0 m-0 space-y-2">
              {detail.capabilities.map((cap, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[12.5px]"
                >
                  <span
                    className="mt-1.5 inline-block w-1 h-1 rounded-full bg-primary flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-foreground font-medium leading-snug">
                      {cap.label}
                    </div>
                    {cap.context && (
                      <div className="text-foreground/55 text-[11.5px] leading-snug mt-0.5">
                        {cap.context}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Imported data kinds ─────────────────────────────── */}
        {detail && detail.dataKinds.length > 0 && (
          <Section
            title="Data imported"
            icon={<Database size={11} />}
            meta={`${detail.dataKinds.length} kind${detail.dataKinds.length === 1 ? "" : "s"}`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {detail.dataKinds.map((dk, i) => (
                <div
                  key={i}
                  className="rounded-sm border border-border/60 bg-foreground/[0.02] px-2.5 py-2"
                >
                  <div className="text-[12px] text-foreground font-medium leading-tight">
                    {dk.label}
                  </div>
                  {dk.hint && (
                    <div className="text-[10.5px] text-foreground/45 mt-0.5">
                      {dk.hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {summary.data?.text && !isError && (
              <p className="text-[10.5px] text-foreground/45 mt-2 font-mono">
                Latest pull: {summary.data.text}
              </p>
            )}
          </Section>
        )}

        {/* ── Where it shows up ───────────────────────────────── */}
        {detail && detail.surfaces.length > 0 && (
          <Section
            title="Where it's displayed"
            icon={<Layers size={11} />}
            meta={`${detail.surfaces.length} surface${detail.surfaces.length === 1 ? "" : "s"}`}
          >
            <ul className="list-none p-0 m-0 -mx-2">
              {detail.surfaces.map((surf, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onNavigateTo(surf.route)}
                    disabled={!surf.route}
                    className="w-full text-left rounded-sm px-2 py-2 hover:bg-foreground/[0.04] disabled:hover:bg-transparent group transition-colors flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[12.5px] font-medium text-foreground leading-tight">
                        <span className="truncate">{surf.label}</span>
                        {surf.route && (
                          <ExternalLink
                            size={10}
                            className="text-foreground/30 group-hover:text-primary flex-shrink-0 transition-colors"
                          />
                        )}
                      </div>
                      <div className="text-[11.5px] text-foreground/55 mt-1 leading-snug">
                        {surf.description}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {detail.axonPowered && (
              <div className="mt-3 flex items-start gap-2 text-[11px] text-foreground/55 italic">
                <Sparkles size={11} className="text-primary mt-0.5 flex-shrink-0" />
                <span>
                  Also powers Axon voice actions — say the right command and
                  this connector executes for you.
                </span>
              </div>
            )}
          </Section>
        )}

        {detail && detail.surfaces.length === 0 && (
          <Section title="Where it's displayed" icon={<Layers size={11} />} meta="none yet">
            <p className="text-[12px] text-foreground/55">
              This connector is wired up but no UI surfaces consume its
              data yet. Background syncs and Axon actions can still use it.
            </p>
          </Section>
        )}
      </div>

      {/* ── Footer actions ─────────────────────────────────────── */}
      <footer className="flex items-center justify-between gap-2 p-4 border-t border-border/60 bg-foreground/[0.015]">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-foreground/35 font-mono">
          {connector.kind}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateTo("/settings")}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-border text-[11px] text-foreground/70 hover:text-foreground hover:border-border-secondary transition-colors"
          >
            <SettingsIcon size={11} />
            Manage in settings
          </button>
          {onDisconnect && (
            <button
              type="button"
              onClick={() => {
                onDisconnect(connector.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-border text-[11px] text-foreground/60 hover:text-destructive hover:border-destructive/40 transition-colors"
            >
              <Unplug size={11} />
              Disconnect
            </button>
          )}
        </div>
      </footer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-foreground/45 font-mono inline-flex items-center gap-1.5">
          <span className="text-primary" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h3>
        {meta && (
          <span className="text-[10px] text-foreground/35 font-mono uppercase tracking-[0.12em]">
            {meta}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: "ok" | "loading" | "error" }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border text-[9.5px] tracking-[0.14em] uppercase text-foreground/55 font-mono">
        <Loader2 size={9} className="animate-spin" /> Loading
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/[0.12] border border-destructive/30 text-[9.5px] tracking-[0.14em] uppercase text-destructive font-mono">
        <AlertTriangle size={9} /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/[0.10] border border-emerald-500/25 text-[9.5px] tracking-[0.14em] uppercase text-emerald-300 font-mono">
      <span className="w-1 h-1 rounded-full bg-emerald-400" aria-hidden="true" />
      Live
    </span>
  );
}

// Tiny relative-time formatter. Avoids adding a date-fns dep for one
// call site; rounding is fine for "connected 3d ago" copy.
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  if (diff < 30 * 24 * 60 * 60_000)
    return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
  return new Date(iso).toLocaleDateString();
}
