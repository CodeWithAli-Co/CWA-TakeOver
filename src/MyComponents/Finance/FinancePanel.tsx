/**
 * FinancePanel.tsx — Provider-neutral finance surface on /operations.
 *
 * Reads from useUnifiedFinance() which merges every connected
 * finance provider (Stripe today; Mercury, Plaid, Brex, Toast,
 * Ramp, QBO as they're shipped). Renders four headline stats
 * (cash, MRR, monthly burn, runway days) followed by a recent
 * transactions list with source badges per row.
 *
 * Auto-hides when no finance providers are connected — same
 * null-state contract as MeetingsPanel / SlackPulsePanel /
 * ConnectorsStrip.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  monthlyBurnCents,
  runwayDays,
  totalCashCents,
  totalMrrCents,
  useUnifiedFinance,
  type UnifiedTransaction,
} from "@/lib/unified/finance";
import { SourceBadge } from "@/lib/unified/SourceBadge";
import { getSourceMeta } from "@/lib/unified/types";

const MAX_VISIBLE = 6;

export function FinancePanel() {
  const fin = useUnifiedFinance({ txLimit: 30 });
  const [filter, setFilter] = useState<string | "all">("all");
  const [showAll, setShowAll] = useState(false);

  const connectedProviders = useMemo(
    () => fin.providerStatus.filter((p) => p.connected),
    [fin.providerStatus],
  );

  // Headline numbers — same data the AXON finance actions return.
  const headline = useMemo(() => {
    const cashCents = totalCashCents(fin.balances);
    const mrrCents = totalMrrCents(fin.revenue);
    const burnCents = monthlyBurnCents(fin.transactions);
    const runway = runwayDays(cashCents, burnCents);
    return { cashCents, mrrCents, burnCents, runway };
  }, [fin.balances, fin.revenue, fin.transactions]);

  // Apply per-provider filter for the row list (headline stats
  // always reflect the full unified roll-up).
  const visibleTx = useMemo(() => {
    const filtered =
      filter === "all"
        ? fin.transactions
        : fin.transactions.filter((t) => t.source === filter);
    return showAll ? filtered : filtered.slice(0, MAX_VISIBLE);
  }, [fin.transactions, filter, showAll]);

  const filteredCount =
    filter === "all"
      ? fin.transactions.length
      : fin.transactions.filter((t) => t.source === filter).length;

  // Null state — hide entirely if nothing's connected.
  if (connectedProviders.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] px-4 py-3"
    >
      <header className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/85">
            Finance
          </span>
          <span className="text-[10px] font-semibold text-text-tertiary">
            · {connectedProviders.length} source{connectedProviders.length === 1 ? "" : "s"}
          </span>
        </div>
        {connectedProviders.length > 1 && (
          <div className="flex items-center gap-1">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All"
            />
            {connectedProviders.map((p) => (
              <FilterChip
                key={p.source}
                active={filter === p.source}
                onClick={() => setFilter(p.source)}
                label={getSourceMeta(p.source)?.name ?? p.source}
                source={p.source}
              />
            ))}
          </div>
        )}
      </header>

      {/* Headline stats — 4-up grid that collapses to 2 on narrow. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
        <StatCard
          label="Cash"
          value={formatUsd(headline.cashCents)}
          tone="neutral"
          Icon={Banknote}
          loading={fin.isLoading && fin.balances.length === 0}
        />
        <StatCard
          label="MRR"
          value={formatUsd(headline.mrrCents)}
          tone="up"
          Icon={TrendingUp}
          loading={fin.isLoading && fin.revenue.length === 0}
        />
        <StatCard
          label="Monthly burn"
          value={formatUsd(headline.burnCents)}
          tone="down"
          Icon={TrendingDown}
          loading={fin.isLoading && fin.transactions.length === 0}
        />
        <StatCard
          label="Runway"
          value={
            headline.runway === null
              ? "∞"
              : headline.runway > 999
              ? "1000+ days"
              : `${headline.runway} days`
          }
          tone={
            headline.runway === null
              ? "neutral"
              : headline.runway < 90
              ? "warning"
              : "neutral"
          }
          Icon={Clock}
          loading={fin.isLoading && fin.balances.length === 0}
        />
      </div>

      {/* Recent transactions list with source badges */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Recent activity
          </p>
          {fin.isError && (
            <span className="flex items-center gap-1 text-[10px] text-warning">
              <AlertCircle className="h-2.5 w-2.5" />
              Some sources failed
            </span>
          )}
        </div>

        {fin.isLoading && fin.transactions.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-[11.5px] text-text-tertiary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading finance providers…
          </div>
        ) : visibleTx.length === 0 ? (
          <p className="text-[11.5px] text-text-tertiary italic px-2 py-2">
            No recent transactions.
          </p>
        ) : (
          <ul className="divide-y divide-border/10">
            {visibleTx.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}

        {!showAll && filteredCount > MAX_VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary hover:text-foreground transition-colors"
          >
            Show {filteredCount - MAX_VISIBLE} more →
          </button>
        )}
      </div>
    </motion.section>
  );
}

// ────────────────────────────────────────────────
// StatCard — one of the four headline numbers
// ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
  Icon,
  loading,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "warning" | "neutral";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  loading?: boolean;
}) {
  const toneClasses =
    tone === "up"
      ? "text-success"
      : tone === "down"
      ? "text-foreground"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="rounded-lg border-xs border-border-soft bg-foreground/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={11} className={`${toneClasses} opacity-70`} />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </span>
      </div>
      <p
        className={`text-[15px] font-semibold tabular-nums leading-tight ${toneClasses}`}
      >
        {loading ? <span className="text-text-tertiary">—</span> : value}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────
// TransactionRow
// ────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: UnifiedTransaction }) {
  const when = new Date(tx.occurred_at);
  const dateLabel = when.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const isInflow = tx.amount_cents > 0;

  return (
    <li className="py-2 px-1 grid grid-cols-[auto_1fr_auto] items-center gap-3">
      {/* Date column */}
      <span className="text-[10.5px] font-semibold tabular-nums text-text-tertiary min-w-[40px]">
        {dateLabel}
      </span>

      {/* Description + counterparty */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground truncate">
            {tx.description}
          </p>
          <SourceBadge source={tx.source} size="xs" />
        </div>
        {tx.counterparty && (
          <p className="text-[10.5px] text-text-tertiary truncate mt-0.5">
            {tx.counterparty}
          </p>
        )}
      </div>

      {/* Amount + back-link */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`text-[12.5px] font-semibold tabular-nums ${
            isInflow ? "text-success" : "text-foreground/90"
          }`}
        >
          {isInflow ? "+" : ""}
          {formatUsd(tx.amount_cents)}
        </span>
        {tx.external_url && (
          <a
            href={tx.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-tertiary hover:text-foreground transition-colors"
            title="Open in provider"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────
// FilterChip
// ────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  source,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  source?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-foreground/[0.04] text-text-secondary hover:text-foreground hover:bg-foreground/[0.08]"
      }`}
    >
      {source && <SourceBadge source={source} size="xs" variant="dot" />}
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────
// Formatting helper — extracted to keep render code clean
// ────────────────────────────────────────────────

function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (abs >= 100_000_00) {
    // $1M+ → compact (no cents)
    return `${sign}$${(abs / 100_000_00).toFixed(2)}M`;
  }
  if (abs >= 1000_00) {
    // $1k+ → no cents, comma separators
    return `${sign}$${Math.round(abs / 100).toLocaleString()}`;
  }
  // Under $1k → with cents
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export default FinancePanel;
