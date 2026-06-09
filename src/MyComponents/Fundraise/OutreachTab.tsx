/**
 * OutreachTab.tsx -- flat-black bento dashboard for the outreach
 * pipeline.
 *
 * Reference aesthetic: dark portfolio bento. rounded-xl (12px)
 * corners, pure #0a0a0a tile backgrounds, 4% white hairline
 * borders, tight 6px gaps between tiles, BIG bold typography
 * inside each tile (the number leads, the label is a quiet eyebrow).
 *
 * 12-col grid. Hero arrangement:
 *   [delivery rate · 4col x 2row]   [sent 2]   [bounced 2]   [chart 4 x 2]
 *                                   [active 2] [today 2]
 *   [delivery chart · 12col]
 *   [queue · 7]                                              [recent · 5]
 *   [pattern · 12]
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCcw,
  Send,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  History,
} from "lucide-react";

import { useOutreachStats, type DayStat } from "@/Fundraise/useOutreachStats";
import {
  useQuickSendStore,
  type QuickSendEntry,
} from "./quickSendStore";
import { EmailBodyModal, EmployeeBadge } from "./EmailBodyModal";

export function OutreachTab() {
  const { data: stats, loading, error, refresh } = useOutreachStats(30);
  const entries = useQuickSendStore((s) => s.entries);
  const clearTerminal = useQuickSendStore((s) => s.clearTerminal);
  const remove = useQuickSendStore((s) => s.remove);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      Array.from(entries.values()).sort(
        (a, b) => a.startedAt - b.startedAt,
      ),
    [entries],
  );
  const inFlight = list.filter(
    (e) =>
      e.status === "queued" ||
      e.status === "drafting" ||
      e.status === "sending",
  );
  const terminal = list
    .filter((e) => e.status === "sent" || e.status === "failed")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const queuedCount = inFlight.filter((e) => e.status === "queued").length;
  const activeCount = inFlight.filter(
    (e) => e.status === "drafting" || e.status === "sending",
  ).length;
  const sentToday = terminal.filter(
    (e) => e.status === "sent" && isToday(e.finishedAt),
  ).length;

  const inspectEntry =
    inspectId != null ? (entries.get(inspectId) ?? null) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-1.5"
    >
      {/* Strip ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/40">
          §02 · Outreach analytics · last 30 days
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-[0.14em] text-foreground/65 hover:text-foreground hover:bg-white/[0.05] hover:border-white/20 transition-all"
        >
          <RefreshCcw size={10} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <Tile className="p-3 text-[11px] text-destructive flex items-center gap-2">
          <AlertTriangle size={12} />
          {error}
        </Tile>
      )}

      {/* Row 1 ── hero arrangement (12-col, 2 rows) ────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 grid-rows-[auto] gap-1.5">
        <DeliveryRateTile
          rate={stats?.deliveryRate ?? null}
          loading={loading}
          className="col-span-2 md:col-span-3 lg:col-span-4 row-span-2"
        />
        <NumberTile
          label="Sent · 30d"
          value={stats?.totalSent ?? 0}
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Bounced"
          value={stats?.totalBounced ?? 0}
          tone={
            stats == null
              ? "neutral"
              : stats.totalBounced === 0
                ? "good"
                : "warn"
          }
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Delivered"
          value={stats ? stats.totalSent - stats.totalBounced : 0}
          tone="good"
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Sent / day avg"
          value={
            stats && stats.byDay.length
              ? (stats.totalSent / stats.byDay.length).toFixed(1)
              : "—"
          }
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Active queue"
          value={inFlight.length}
          sub={`${queuedCount} q · ${activeCount} live`}
          tone={inFlight.length > 0 ? "info" : "neutral"}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Today"
          value={sentToday}
          sub="sends · session"
          tone={sentToday > 0 ? "good" : "neutral"}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Patterns scored"
          value={stats?.byPattern.length ?? 0}
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
        <NumberTile
          label="Verified accuracy"
          value={
            stats
              ? `${Math.round((stats.byPattern.find((p) => p.pattern === "verified")?.rate ?? 0) * 100)}%`
              : "—"
          }
          tone={
            stats &&
            (stats.byPattern.find((p) => p.pattern === "verified")?.rate ?? 0) >=
              0.85
              ? "good"
              : "neutral"
          }
          loading={loading}
          className="col-span-1 md:col-span-3 lg:col-span-2"
        />
      </div>

      {/* Row 2 ── chart + pattern ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <Tile className="lg:col-span-8 p-4">
          <TileHeader
            label="Deliverability over time"
            eyebrow="§12 · 30d"
          />
          <DeliverabilityChart series={stats?.byDay ?? []} />
        </Tile>
        <Tile className="lg:col-span-4 p-4">
          <TileHeader
            label="Per-pattern accuracy"
            eyebrow="§13"
            sub="Verified first, then guesses by sample size."
          />
          <PatternAccuracyList
            patterns={stats?.byPattern ?? []}
            loading={loading}
          />
        </Tile>
      </div>

      {/* Row 3 ── queue + recent ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <Tile className="lg:col-span-7 p-4">
          <TileHeader
            label="Live send queue"
            eyebrow="§14"
            sub={
              inFlight.length === 0
                ? "Nothing in flight."
                : `${inFlight.length} in flight · ${queuedCount} queued, ${activeCount} active`
            }
          />
          <QueueList
            entries={inFlight}
            onInspect={setInspectId}
            onRemove={remove}
          />
        </Tile>
        <Tile className="lg:col-span-5 p-4">
          <TileHeader
            label="Recent sends"
            eyebrow="§15"
            sub="Click a row to inspect the body."
            action={
              terminal.length > 0 ? (
                <button
                  type="button"
                  onClick={() => clearTerminal()}
                  className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-foreground/45 hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              ) : null
            }
          />
          <RecentList entries={terminal} onInspect={setInspectId} />
        </Tile>
      </div>

      <EmailBodyModal
        entry={inspectEntry}
        onClose={() => setInspectId(null)}
      />
    </motion.div>
  );
}

// ─── Tile primitives ──────────────────────────────────────

/** Base flat-black tile. rounded-xl (12px), pure #0a0a0a background,
 *  4% white hairline border. No gradient, no shadow. */
function Tile({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "relative overflow-hidden rounded-xl border border-white/[0.04] " +
        "bg-[#0a0a0a] " +
        className
      }
    >
      {children}
    </section>
  );
}

function TileHeader({
  label,
  eyebrow,
  sub,
  action,
}: {
  label: string;
  eyebrow?: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-foreground/35 mb-0.5">
            {eyebrow}
          </div>
        )}
        <h3 className="text-[13px] font-semibold text-foreground tracking-tight m-0 leading-tight">
          {label}
        </h3>
        {sub && (
          <p className="text-[10.5px] text-foreground/40 leading-snug mt-0.5">
            {sub}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/** Number-led KPI tile: BIG number is the hero, label is a quiet
 *  eyebrow on top. */
function NumberTile({
  label,
  value,
  sub,
  tone = "neutral",
  loading,
  className = "",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  loading?: boolean;
  className?: string;
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-rose-300"
          : tone === "info"
            ? "text-sky-300"
            : "text-foreground";
  return (
    <section
      className={
        "relative overflow-hidden rounded-xl border border-white/[0.04] bg-[#0a0a0a] px-4 py-3.5 flex flex-col justify-between min-h-[88px] " +
        className
      }
    >
      <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-foreground/35">
        {label}
      </div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <div
          className={
            "ed-serif text-[30px] leading-none tracking-tight " + valueColor
          }
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin text-foreground/40" />
          ) : (
            value
          )}
        </div>
        {sub && (
          <div className="text-[9.5px] font-mono text-foreground/35 pb-1 truncate max-w-[55%] text-right">
            {sub}
          </div>
        )}
      </div>
    </section>
  );
}

/** Delivery-rate tile: big number with arc gauge backdrop. Same
 *  flat-black chrome, but the arc lives behind the number rather
 *  than in its own visual half. */
function DeliveryRateTile({
  rate,
  loading,
  className = "",
}: {
  rate: number | null;
  loading?: boolean;
  className?: string;
}) {
  const pct = rate == null ? 0 : Math.round(rate * 100);
  const tone =
    rate == null
      ? "neutral"
      : rate >= 0.85
        ? "good"
        : rate >= 0.6
          ? "warn"
          : "bad";
  const accent =
    tone === "good"
      ? "rgb(110 231 183)"
      : tone === "warn"
        ? "rgb(252 211 77)"
        : tone === "bad"
          ? "rgb(253 164 175)"
          : "rgb(212 212 216)";
  return (
    <section
      className={
        "relative overflow-hidden rounded-xl border border-white/[0.04] bg-[#0a0a0a] p-4 flex flex-col " +
        className
      }
    >
      {/* Subtle accent glow only on this hero tile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent.replace("rgb", "rgba").replace(")", ", 0.10)")} 0%, transparent 70%)`,
        }}
      />
      <div className="relative text-[9px] font-mono uppercase tracking-[0.22em] text-foreground/35">
        Delivery rate · 30d
      </div>
      <div className="relative flex-1 flex items-center justify-center">
        <ArcGauge pct={pct} accent={accent} loading={loading} />
      </div>
      <div className="relative">
        <p className="text-[10.5px] text-foreground/40 leading-snug">
          Outbound that reached an inbox. Below 85% = check the bounce
          log.
        </p>
      </div>
    </section>
  );
}

function ArcGauge({
  pct,
  accent,
  loading,
}: {
  pct: number;
  accent: string;
  loading?: boolean;
}) {
  const size = 200;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg
      viewBox={`0 0 ${size} ${size / 2 + 12}`}
      className="w-full max-w-[280px]"
    >
      <defs>
        <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={accent} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {!loading && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{
            filter: `drop-shadow(0 0 8px ${accent.replace("rgb", "rgba").replace(")", ", 0.4)")})`,
            transition: "stroke-dasharray 600ms ease-out",
          }}
        />
      )}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        style={{
          font: "600 42px / 1 'Newsreader', Georgia, serif",
          fill: accent,
        }}
      >
        {loading ? "…" : `${pct}%`}
      </text>
    </svg>
  );
}

// ─── Smooth area chart ─────────────────────────────────────

function DeliverabilityChart({ series }: { series: DayStat[] }) {
  const W = 900;
  const H = 200;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 24;

  if (series.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[11px] text-foreground/35">
        No outbound emails in the last 30 days.
      </div>
    );
  }

  const max = Math.max(1, ...series.map((d) => d.sent));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = innerW / Math.max(1, series.length - 1);
  const xAt = (i: number) => padL + i * stepX;
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  const smoothPath = (pts: [number, number][]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0]![0]} ${pts[0]![1]}`;
    let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  };

  const deliveredPts: [number, number][] = series.map((d, i) => [
    xAt(i),
    yAt(d.delivered),
  ]);
  const sentPts: [number, number][] = series.map((d, i) => [
    xAt(i),
    yAt(d.sent),
  ]);

  const deliveredLine = smoothPath(deliveredPts);
  const sentLine = smoothPath(sentPts);

  const deliveredArea =
    deliveredLine +
    ` L ${xAt(series.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
  const bounceArea =
    sentLine +
    ` L ${xAt(series.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;

  const tickIdx: number[] = [];
  const step = Math.max(1, Math.floor(series.length / 5));
  for (let i = 0; i < series.length; i += step) tickIdx.push(i);
  if (tickIdx[tickIdx.length - 1] !== series.length - 1) {
    tickIdx.push(series.length - 1);
  }

  const yTicks = [0, Math.ceil(max / 2), max];
  const lastSent = sentPts[sentPts.length - 1]!;
  const lastDelivered = deliveredPts[deliveredPts.length - 1]!;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[200px]"
      >
        <defs>
          <linearGradient
            id="delivered-fill"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.45" />
            <stop offset="60%" stopColor="rgb(52 211 153)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="sent-fill"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity="0.22" />
            <stop offset="80%" stopColor="rgb(244 63 94)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity="0" />
          </linearGradient>
          <filter id="line-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 8}
              y={yAt(v) + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="rgba(255,255,255,0.3)"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={bounceArea} fill="url(#sent-fill)" />
        <path d={deliveredArea} fill="url(#delivered-fill)" />

        <path
          d={sentLine}
          fill="none"
          stroke="rgba(244, 63, 94, 0.55)"
          strokeWidth={1.1}
          strokeDasharray="3 3"
        />

        <path
          d={deliveredLine}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={2}
          strokeOpacity={0.35}
          filter="url(#line-glow)"
        />
        <path
          d={deliveredLine}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx={lastSent[0]}
          cy={lastSent[1]}
          r={2.5}
          fill="rgb(244 63 94)"
          opacity={0.75}
        />
        <circle
          cx={lastDelivered[0]}
          cy={lastDelivered[1]}
          r={4}
          fill="rgb(52 211 153)"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={1.2}
        />

        {tickIdx.map((i) => (
          <text
            key={`x-${i}`}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fill="rgba(255,255,255,0.3)"
          >
            {fmtDayLabel(series[i]!.day)}
          </text>
        ))}
      </svg>

      <div className="flex items-center gap-3 pt-2 text-[9.5px] font-mono uppercase tracking-[0.16em] text-foreground/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          Delivered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-rose-400/70" />
          Sent (gap = bounced)
        </span>
      </div>
    </div>
  );
}

function fmtDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Per-pattern accuracy ──────────────────────────────────

function PatternAccuracyList({
  patterns,
  loading,
}: {
  patterns: { pattern: string; sent: number; bounced: number; rate: number }[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="h-[170px] flex items-center justify-center text-[11px] text-foreground/35">
        <Loader2 size={13} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (patterns.length === 0) {
    return (
      <div className="h-[170px] flex items-center justify-center text-[11px] text-foreground/35 text-center px-4">
        Send a few cold emails to start scoring patterns.
      </div>
    );
  }
  return (
    <ul className="m-0 list-none space-y-2.5">
      {patterns.slice(0, 6).map((p) => {
        const pct = Math.round(p.rate * 100);
        const tone =
          p.rate >= 0.85
            ? "bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
            : p.rate >= 0.5
              ? "bg-amber-400/80 shadow-[0_0_6px_rgba(252,211,77,0.35)]"
              : "bg-rose-400/80 shadow-[0_0_6px_rgba(244,63,94,0.35)]";
        return (
          <li key={p.pattern}>
            <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
              <span className="font-mono uppercase tracking-[0.12em] text-foreground/75 truncate">
                {p.pattern}
              </span>
              <span className="font-mono text-foreground/45 flex-shrink-0">
                {pct}% · {p.sent - p.bounced}/{p.sent}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={"h-full rounded-full " + tone}
                style={{
                  width: `${Math.max(3, pct)}%`,
                  transition: "width 600ms ease-out",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Live queue ─────────────────────────────────────────────

function QueueList({
  entries,
  onInspect,
  onRemove,
}: {
  entries: QuickSendEntry[];
  onInspect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-center px-4">
        <Inbox size={18} className="text-foreground/20 mb-2" />
        <p className="text-[11px] text-foreground/40 max-w-[260px]">
          Queue is empty. Hit Quick Send on a kanban card to kick
          something off.
        </p>
      </div>
    );
  }
  return (
    <ul className="m-0 list-none max-h-[340px] overflow-y-auto space-y-1.5">
      {entries.map((e) => (
        <QueueRow
          key={e.id}
          entry={e}
          onInspect={() => onInspect(e.id)}
          onRemove={() => onRemove(e.id)}
        />
      ))}
    </ul>
  );
}

function QueueRow({
  entry,
  onInspect,
  onRemove,
}: {
  entry: QuickSendEntry;
  onInspect: () => void;
  onRemove: () => void;
}) {
  const icon =
    entry.status === "queued" ? (
      <Clock size={12} className="text-foreground/45" />
    ) : entry.status === "drafting" ? (
      <Loader2 size={12} className="text-emerald-300 animate-spin" />
    ) : (
      <Send size={12} className="text-emerald-300" />
    );

  let statusText: React.ReactNode = null;
  if (entry.status === "queued") {
    const s = Math.max(0, Math.ceil((entry.notBefore - Date.now()) / 1000));
    statusText = `Queued · sends in ${fmt(s)}`;
  } else if (entry.status === "drafting") {
    statusText = "Axon is drafting…";
  } else {
    statusText = "Sending via Gmail…";
  }

  return (
    <li>
      <button
        type="button"
        onClick={onInspect}
        className="w-full text-left rounded-md border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/15 transition-colors px-3 py-2 group"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[11.5px] font-semibold text-foreground truncate">
                {entry.firm_name}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-foreground/35 flex-shrink-0">
                {entry.status}
              </span>
            </div>
            <div className="text-[10.5px] text-foreground/50 truncate mb-0.5">
              to {entry.partner_name}
              <span className="text-foreground/30"> · </span>
              <span className="font-mono">{entry.partner_email}</span>
              {entry.pattern && (
                <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/35">
                  {entry.pattern}
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-foreground/55">{statusText}</div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Cancel"
            title="Cancel before this slot fires"
            className="p-1 text-foreground/25 hover:text-foreground/80 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          >
            <XCircle size={11} />
          </button>
        </div>
      </button>
    </li>
  );
}

// ─── Recent sends ──────────────────────────────────────────

function RecentList({
  entries,
  onInspect,
}: {
  entries: QuickSendEntry[];
  onInspect: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-center px-4">
        <History size={18} className="text-foreground/20 mb-2" />
        <p className="text-[11px] text-foreground/40 max-w-[280px]">
          Nothing sent in this session yet. Sends accumulate here with
          the body, recipient, and employee badge.
        </p>
      </div>
    );
  }
  return (
    <ul className="m-0 list-none max-h-[340px] overflow-y-auto space-y-1.5">
      {entries.slice(0, 40).map((e) => (
        <RecentRow key={e.id} entry={e} onInspect={() => onInspect(e.id)} />
      ))}
    </ul>
  );
}

function RecentRow({
  entry,
  onInspect,
}: {
  entry: QuickSendEntry;
  onInspect: () => void;
}) {
  const ok = entry.status === "sent";
  return (
    <li>
      <button
        type="button"
        onClick={onInspect}
        className="w-full text-left rounded-md border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/15 transition-colors px-3 py-2"
      >
        <div className="flex items-start gap-2.5">
          {ok ? (
            <CheckCircle2
              size={12}
              className="text-emerald-300 mt-0.5 flex-shrink-0"
            />
          ) : (
            <XCircle
              size={12}
              className="text-rose-300 mt-0.5 flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[11.5px] font-semibold text-foreground truncate">
                {entry.firm_name}
              </span>
              <span className="text-[9.5px] font-mono text-foreground/40 flex-shrink-0">
                {fmtRelative(entry.finishedAt)}
              </span>
            </div>
            <div className="text-[10.5px] text-foreground/50 truncate mb-1">
              to {entry.partner_name}
              <span className="text-foreground/30"> · </span>
              <span className="font-mono">{entry.partner_email}</span>
            </div>
            <div className="text-[10.5px] flex items-center gap-2 min-w-0">
              <EmployeeBadge entry={entry} />
            </div>
            {!ok && entry.error && (
              <div className="text-[10px] text-rose-300/80 mt-1 truncate">
                {entry.error}
              </div>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

// ─── utils ─────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function fmtRelative(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function isToday(ts: number | undefined): boolean {
  if (!ts) return false;
  const a = new Date(ts);
  const b = new Date();
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
