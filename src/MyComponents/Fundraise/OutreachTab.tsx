/**
 * OutreachTab.tsx -- bento dashboard for the Fundraise outreach
 * pipeline.
 *
 * Two semantic sections:
 *
 *   §02A SUCCESS METRICS   (what investors / LPs actually care about)
 *     - Reply rate / Meeting rate / Close rate / Reply latency / Opens
 *       packed into 3 DUAL stat tiles
 *     - Hot leads (replied, no follow-up yet) -- highest-leverage
 *       action items, sitting beside the dual tiles
 *
 *   §02B DELIVERABILITY    (Gmail / mail-server health)
 *     - Delivery rate gauge hero
 *     - 4 dual tiles packing: sent / bounced / delivered / sent-per-
 *       day / active queue / patterns scored / verified accuracy /
 *       tracked sends
 *     - Daily area chart with hover tooltip + crosshair
 *     - Per-pattern accuracy + live queue + recent sends
 *
 * Aesthetic: flat #0a0a0a tiles, rounded-xl corners, 4% white
 * hairline borders, tight 6px gaps. DualStatTile halves the visual
 * tile count without losing info.
 *
 * Pixel-tracking foundation: useEmailOpens reads aggregated open
 * counts by tracking_id. Server-side spec is in useEmailOpens.ts --
 * until those routes ship, openRate gracefully reads 0% and the UI
 * surfaces "pixel tracking server-side not live".
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
  Reply,
  CalendarCheck2,
  Flame,
  Eye,
} from "lucide-react";

import { useOutreachStats, type DayStat } from "@/Fundraise/useOutreachStats";
import {
  useSuccessStats,
  type HotLead,
} from "@/Fundraise/useSuccessStats";
import { useEmailOpens } from "@/Fundraise/useEmailOpens";
import {
  useQuickSendStore,
  type QuickSendEntry,
} from "./quickSendStore";
import { EmailBodyModal, EmployeeBadge } from "./EmailBodyModal";
import { useFundraiseStore } from "./fundraiseStore";

export function OutreachTab() {
  const { data: stats, loading, error, refresh } = useOutreachStats(30);
  const { data: success, loading: successLoading } = useSuccessStats(30);
  const { data: opens } = useEmailOpens(30);
  const entries = useQuickSendStore((s) => s.entries);
  const clearTerminal = useQuickSendStore((s) => s.clearTerminal);
  const remove = useQuickSendStore((s) => s.remove);
  const openInvestor = useFundraiseStore((s) => s.openInvestor);
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

  const inspectEntry =
    inspectId != null ? (entries.get(inspectId) ?? null) : null;

  // Verified pattern accuracy for the deliverability dual tile.
  const verifiedRate =
    stats?.byPattern.find((p) => p.pattern === "verified")?.rate ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* ── Strip ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 pb-0">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/40">
          §02 · Outreach · last 30 days
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

      {/* ── Unified KPI grid -- one 12-col bento. The tab pill
        * above already names this section "Outreach", so no
        * intro SectionLabel here -- saves vertical real-estate. */}
      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
        {/* Row 1+2: gauge hero spans 3col × 2row on the left */}
        <DeliveryRateTile
          rate={stats?.deliveryRate ?? null}
          loading={loading}
          className="col-span-2 md:col-span-6 lg:col-span-4 lg:row-span-2"
        />

        {/* Success dual tiles (3 of them, top row + start of row 2) */}
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Reply rate",
            value: success
              ? `${Math.round(success.replyRate * 100)}%`
              : "—",
            sub: success
              ? `${success.investorsReplied}/${success.investorsContacted} firms`
              : undefined,
            tone:
              success == null
                ? "neutral"
                : success.replyRate >= 0.1
                  ? "good"
                  : success.replyRate >= 0.05
                    ? "warn"
                    : "bad",
            loading: successLoading,
            icon: <Reply size={11} />,
          }}
          right={{
            label: "Meeting rate",
            value: success
              ? `${Math.round(success.meetingRate * 100)}%`
              : "—",
            sub: success
              ? `${success.investorsAtMeetingOrFurther}/${success.investorsContacted}`
              : undefined,
            tone:
              success == null
                ? "neutral"
                : success.meetingRate >= 0.03
                  ? "good"
                  : success.meetingRate > 0
                    ? "warn"
                    : "neutral",
            loading: successLoading,
            icon: <CalendarCheck2 size={11} />,
          }}
        />
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Closed",
            value: success?.investorsClosed ?? 0,
            sub: success
              ? `${Math.round(success.closeRate * 100)}% rate`
              : undefined,
            tone:
              success && success.investorsClosed > 0 ? "good" : "neutral",
            loading: successLoading,
            icon: <CheckCircle2 size={11} />,
          }}
          right={{
            label: "Reply latency",
            value:
              success && success.avgReplyLatencyDays != null
                ? `${success.avgReplyLatencyDays.toFixed(1)}d`
                : "—",
            sub: "avg first-reply",
            loading: successLoading,
            icon: <Clock size={11} />,
          }}
        />
        {/* Row 2: chart fills the 8 cols beside the gauge (which is
          * row-span-2). Inline with the KPI cards, no separate
          * "chart row" below the bento. */}
        <Tile className="col-span-2 md:col-span-6 lg:col-span-8 p-4">
          <TileHeader
            label="Deliverability over time"
            eyebrow="§02 · 30d"
            sub="Hover for daily counts. Red ribbon = bounces."
          />
          <DeliverabilityChart series={stats?.byDay ?? []} />
        </Tile>

        {/* Row 3+ : remaining dual tiles + hot leads + secondary
          * lists in 3-up rows. */}
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Opens",
            value:
              opens && opens.trackedSends > 0
                ? `${Math.round(opens.openRate * 100)}%`
                : "—",
            sub:
              opens && opens.trackedSends > 0
                ? `${opens.opened}/${opens.trackedSends}`
                : "pixel offline",
            icon: <Eye size={11} />,
          }}
          right={{
            label: "Tracked sends",
            value: opens?.trackedSends ?? 0,
            sub: "with pixel id",
            icon: <Send size={11} />,
          }}
        />
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Sent · 30d",
            value: stats?.totalSent ?? 0,
            loading,
          }}
          right={{
            label: "Sent / day avg",
            value:
              stats && stats.byDay.length
                ? (stats.totalSent / stats.byDay.length).toFixed(1)
                : "—",
            loading,
          }}
        />
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Delivered",
            value: stats ? stats.totalSent - stats.totalBounced : 0,
            tone: "good",
            loading,
          }}
          right={{
            label: "Bounced",
            value: stats?.totalBounced ?? 0,
            tone:
              stats == null
                ? "neutral"
                : stats.totalBounced === 0
                  ? "good"
                  : "warn",
            loading,
          }}
        />
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Active queue",
            value: inFlight.length,
            sub: `${queuedCount} q · ${activeCount} live`,
            tone: inFlight.length > 0 ? "info" : "neutral",
          }}
          right={{
            label: "Patterns scored",
            value: stats?.byPattern.length ?? 0,
            loading,
          }}
        />

        {/* Row 3: last dual tile + hot leads filling the rest */}
        <DualStatTile
          className="col-span-2 md:col-span-6 lg:col-span-4"
          left={{
            label: "Verified rate",
            value: stats ? `${Math.round(verifiedRate * 100)}%` : "—",
            sub: "known emails",
            tone:
              stats && verifiedRate >= 0.85
                ? "good"
                : stats && verifiedRate > 0
                  ? "warn"
                  : "neutral",
            loading,
          }}
          right={{
            label: "Close rate",
            value: success
              ? `${Math.round(success.closeRate * 100)}%`
              : "—",
            sub: success
              ? `${success.investorsClosed}/${success.investorsContacted}`
              : undefined,
            tone:
              success && success.closeRate > 0 ? "good" : "neutral",
            loading: successLoading,
          }}
        />

        {/* Hot leads — col-span-4 to match the 3-up KPI rhythm. */}
        <Tile className="col-span-2 md:col-span-6 lg:col-span-4 p-4">
          <TileHeader
            label="Hot leads · need a bump"
            eyebrow="§02 · action items"
            sub="Replied but no follow-up yet."
            action={
              success && success.hotLeads.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-amber-300">
                  <Flame size={10} />
                  {success.hotLeads.length}
                </span>
              ) : null
            }
          />
          <HotLeadList
            leads={success?.hotLeads ?? []}
            onOpen={(id) => openInvestor(id)}
            loading={successLoading}
          />
        </Tile>

        {/* §02 · Lists row -- Pattern accuracy + Live queue +
          * Recent sends all sized at col-span-4, sharing one row.
          * All three are short list tiles so the row height is
          * uniform. */}
        <Tile className="col-span-2 md:col-span-6 lg:col-span-4 p-4">
          <TileHeader
            label="Per-pattern accuracy"
            eyebrow="§02"
            sub="Verified first, then shotgun guesses."
          />
          <PatternAccuracyList
            patterns={stats?.byPattern ?? []}
            loading={loading}
          />
        </Tile>
        <Tile className="col-span-2 md:col-span-6 lg:col-span-4 p-4">
          <TileHeader
            label="Live send queue"
            eyebrow="§02"
            sub={
              inFlight.length === 0
                ? "Nothing in flight."
                : `${inFlight.length} in flight · ${queuedCount} q, ${activeCount} live`
            }
          />
          <QueueList
            entries={inFlight}
            onInspect={setInspectId}
            onRemove={remove}
          />
        </Tile>
        <Tile className="col-span-2 md:col-span-6 lg:col-span-4 p-4">
          <TileHeader
            label="Recent sends"
            eyebrow="§02"
            sub="Click to inspect the body."
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

// ─── Section label (between major sections) ───────────────

function SectionLabel({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="pt-2 pb-1 px-1 border-l-2 border-primary/40 pl-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-primary/80">
        {eyebrow}
      </div>
      <h2 className="ed-serif text-[20px] tracking-tight text-foreground leading-tight mt-0.5">
        {title}
      </h2>
      {sub && (
        <p className="text-[11.5px] text-foreground/45 leading-snug mt-1 max-w-[680px]">
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Tile primitives ──────────────────────────────────────

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

// ─── Dual stat tile ───────────────────────────────────────
//
// One visually-unified card containing two KPIs. A small mono
// "pair header" at the top names what the two stats have in common
// (e.g. ENGAGEMENT, VOLUME, PIXEL), so the card unambiguously reads
// as a single unit. Stronger outer border + a clearly-visible
// internal divider reinforce the "one card" reading.

interface StatHalf {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  icon?: React.ReactNode;
  loading?: boolean;
}

// ─── Animation utilities ──────────────────────────────────
//
// Count-up animation for KPI numbers. requestAnimationFrame-driven
// ease-out tween from the previous value to the new value. Tweens
// happen on mount (from 0) and whenever the target changes.
// Returns the current animating number. The caller is responsible
// for formatting (prefix/suffix/decimals).
function useAnimatedNumber(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const startTime = performance.now();
    const from = fromRef.current;
    const to = target;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // easeOutCubic -- snappy start, gentle settle.
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

/** Parse a string like "8%", "4.6d", "143" into a number + a
 *  formatter that re-applies the suffix/decimals when given the
 *  animating value back. Returns null when the value isn't
 *  numeric (e.g. "—") so the caller can skip animating. */
function parseAnimatable(value: string | number):
  | { num: number; format: (n: number) => string }
  | null {
  if (typeof value === "number") {
    return {
      num: value,
      format: (n) =>
        Number.isInteger(value) ? String(Math.round(n)) : n.toFixed(1),
    };
  }
  const s = String(value);
  // Match leading optional negative sign, digits, optional decimal.
  const match = s.match(/^(-?\d+(?:\.\d+)?)([%a-zA-Z]*)$/);
  if (!match) return null;
  const num = parseFloat(match[1]!);
  if (Number.isNaN(num)) return null;
  const suffix = match[2] ?? "";
  const decimalPart = match[1]!.split(".")[1];
  const decimals = decimalPart ? decimalPart.length : 0;
  return {
    num,
    format: (n) =>
      (decimals > 0 ? n.toFixed(decimals) : String(Math.round(n))) + suffix,
  };
}

/** Renders a count-up animated value. Falls back to plain display
 *  when the value can't be parsed (e.g. "—"). */
function CountUp({
  value,
  className = "",
}: {
  value: string | number;
  className?: string;
}) {
  const parsed = parseAnimatable(value);
  const animated = useAnimatedNumber(parsed ? parsed.num : 0);
  if (!parsed) {
    return <span className={className}>{value}</span>;
  }
  return <span className={className}>{parsed.format(animated)}</span>;
}

/** Dual stat tile: one seamless card containing two stats. Each
 *  stat is a tight vertical mini-stack (label -> value -> sub) so
 *  the eye reads each half as a real unit rather than searching
 *  across rows to match a label with its value. Two halves sit
 *  side by side, sharing the same card chrome but with their own
 *  internal rhythm. No divider, no pair header. */
function DualStatTile({
  left,
  right,
  className = "",
}: {
  left: StatHalf;
  right: StatHalf;
  /** header kept on the API for backcompat; currently ignored. */
  header?: string;
  className?: string;
}) {
  return (
    <section
      className={
        "relative overflow-hidden rounded-xl border border-white/[0.06] " +
        "bg-[#0a0a0a] px-5 py-4 " +
        className
      }
    >
      <div className="grid grid-cols-2 gap-5">
        <CohesiveHalf data={left} />
        <CohesiveHalf data={right} />
      </div>
    </section>
  );
}

/** A single tight stack: label on top, value just below it, sub
 *  immediately under the value. All three elements visually anchor
 *  to each other so the half reads as one indivisible unit. */
function CohesiveHalf({ data }: { data: StatHalf }) {
  const valueColor =
    data.tone === "good"
      ? "text-emerald-300"
      : data.tone === "warn"
        ? "text-amber-300"
        : data.tone === "bad"
          ? "text-rose-300"
          : data.tone === "info"
            ? "text-sky-300"
            : "text-foreground";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[9.5px] font-mono uppercase tracking-[0.18em] text-foreground/45 mb-1.5">
        {data.icon && (
          <span className="text-foreground/40 flex-shrink-0">{data.icon}</span>
        )}
        <span className="truncate">{data.label}</span>
      </div>
      <div
        className={
          "ed-serif text-[26px] leading-none tracking-tight " + valueColor
        }
      >
        {data.loading ? (
          <Loader2 size={14} className="animate-spin text-foreground/40" />
        ) : (
          <CountUp value={data.value} />
        )}
      </div>
      {data.sub && (
        <div className="text-[10px] font-mono text-foreground/40 mt-1 truncate">
          {data.sub}
        </div>
      )}
    </div>
  );
}

// ─── Hot leads list ──────────────────────────────────────

function HotLeadList({
  leads,
  onOpen,
  loading,
}: {
  leads: HotLead[];
  onOpen: (id: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[11px] text-foreground/35">
        <Loader2 size={13} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <div className="h-[120px] flex flex-col items-center justify-center text-center px-4">
        <Flame size={16} className="text-foreground/20 mb-1.5" />
        <p className="text-[11px] text-foreground/40 max-w-[260px]">
          No unbumped replies.
        </p>
      </div>
    );
  }
  return (
    <ul className="m-0 list-none space-y-1.5 max-h-[180px] overflow-y-auto">
      {leads.map((l) => (
        <li key={l.investor_id}>
          <button
            type="button"
            onClick={() => onOpen(l.investor_id)}
            className="w-full text-left rounded-md border border-amber-500/15 bg-amber-500/[0.04] hover:bg-amber-500/[0.09] hover:border-amber-500/30 transition-colors px-3 py-2"
          >
            <div className="flex items-start gap-2">
              <Flame
                size={11}
                className="text-amber-300 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-foreground truncate">
                    {l.firm_name}
                  </span>
                  <span className="text-[9.5px] font-mono text-amber-300/85 flex-shrink-0">
                    {l.days_since_reply}d ago
                  </span>
                </div>
                {l.partner_name && (
                  <div className="text-[10.5px] text-foreground/50 truncate mt-0.5">
                    {l.partner_name} replied · no follow-up yet
                  </div>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Delivery-rate tile (gauge hero) ──────────────────────

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
  // Animated percentage drives both the arc dash + the text number,
  // so the visual fill and the centered "66%" tick up in lockstep.
  const animatedPct = useAnimatedNumber(pct, 1100);
  const dash = (animatedPct / 100) * circ;
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
        {loading ? "…" : `${Math.round(animatedPct)}%`}
      </text>
    </svg>
  );
}

// ─── Smooth area chart with hover tooltip + crosshair ─────

function DeliverabilityChart({ series }: { series: DayStat[] }) {
  const W = 900;
  const H = 200;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVB = (xPx / rect.width) * W;
    const i = Math.round((xVB - padL) / stepX);
    const clamped = Math.max(0, Math.min(series.length - 1, i));
    setHoverIdx(clamped);
  };

  const hoverDay = hoverIdx != null ? series[hoverIdx]! : null;
  const tooltipLeftPct =
    hoverIdx != null ? (xAt(hoverIdx) / W) * 100 : 0;

  return (
    <div className="relative px-0 pt-2 pb-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-[200px]"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="delivered-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.45" />
            <stop offset="60%" stopColor="rgb(52 211 153)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sent-fill" x1="0%" y1="0%" x2="0%" y2="100%">
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

        {/* Area fills -- fade in. */}
        <motion.path
          d={bounceArea}
          fill="url(#sent-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />
        <motion.path
          d={deliveredArea}
          fill="url(#delivered-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />

        {/* Sent dashed envelope -- draws in. */}
        <motion.path
          d={sentLine}
          fill="none"
          stroke="rgba(244, 63, 94, 0.55)"
          strokeWidth={1.1}
          strokeDasharray="3 3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Delivered line glow + main stroke -- both draw in. */}
        <motion.path
          d={deliveredLine}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={2}
          strokeOpacity={0.35}
          filter="url(#line-glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        <motion.path
          d={deliveredLine}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />

        {/* Endpoint markers -- pop in after the line finishes. */}
        <motion.circle
          cx={lastSent[0]}
          cy={lastSent[1]}
          r={2.5}
          fill="rgb(244 63 94)"
          opacity={0.75}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.4,
            delay: 1.3,
            type: "spring",
            stiffness: 380,
          }}
          style={{ transformOrigin: `${lastSent[0]}px ${lastSent[1]}px` }}
        />
        <motion.circle
          cx={lastDelivered[0]}
          cy={lastDelivered[1]}
          r={4}
          fill="rgb(52 211 153)"
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={1.2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.4,
            delay: 1.4,
            type: "spring",
            stiffness: 380,
          }}
          style={{ transformOrigin: `${lastDelivered[0]}px ${lastDelivered[1]}px` }}
        />

        {hoverIdx != null && (
          <g>
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={padT}
              y2={H - padB}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(series[hoverIdx]!.sent)}
              r={3}
              fill="rgb(244 63 94)"
              opacity={0.8}
            />
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(series[hoverIdx]!.delivered)}
              r={4}
              fill="rgb(52 211 153)"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={1.2}
            />
          </g>
        )}

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

      {hoverDay && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-white/10 bg-black/85 backdrop-blur-sm shadow-xl px-2.5 py-2 text-[10.5px] z-10"
          style={{
            left: `${tooltipLeftPct}%`,
            top: 6,
          }}
        >
          <div className="font-mono uppercase tracking-[0.14em] text-foreground/55 mb-1">
            {fmtTooltipDay(hoverDay.day)}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-emerald-300/85">Delivered</span>
            <span className="text-foreground font-mono tabular-nums text-right">
              {hoverDay.delivered}
            </span>
            <span className="text-rose-300/85">Bounced</span>
            <span className="text-foreground font-mono tabular-nums text-right">
              {hoverDay.bounced}
            </span>
            <span className="text-foreground/55">Sent</span>
            <span className="text-foreground font-mono tabular-nums text-right">
              {hoverDay.sent}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 px-3 text-[9.5px] font-mono uppercase tracking-[0.16em] text-foreground/50">
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

function fmtTooltipDay(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
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
      <div className="h-[120px] flex items-center justify-center text-[11px] text-foreground/35">
        <Loader2 size={13} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (patterns.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[11px] text-foreground/35 text-center px-4">
        Send a few cold emails to start scoring patterns.
      </div>
    );
  }
  return (
    <ul className="m-0 list-none space-y-2.5">
      {patterns.slice(0, 6).map((p, i) => {
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
                <CountUp value={pct} />% ·{" "}
                {p.sent - p.bounced}/{p.sent}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              {/* Bars fill in with a brief stagger so the row reads
                * top-down rather than landing all at once. */}
              <motion.div
                className={"h-full rounded-full " + tone}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, pct)}%` }}
                transition={{
                  duration: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.08 * i,
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
      <div className="h-[120px] flex flex-col items-center justify-center text-center px-4">
        <Inbox size={16} className="text-foreground/20 mb-1.5" />
        <p className="text-[11px] text-foreground/40 max-w-[260px]">
          Queue is empty.
        </p>
      </div>
    );
  }
  return (
    <ul className="m-0 list-none max-h-[200px] overflow-y-auto space-y-1.5">
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
      <div className="h-[120px] flex flex-col items-center justify-center text-center px-4">
        <History size={16} className="text-foreground/20 mb-1.5" />
        <p className="text-[11px] text-foreground/40 max-w-[260px]">
          Nothing sent in this session.
        </p>
      </div>
    );
  }
  return (
    <ul className="m-0 list-none max-h-[200px] overflow-y-auto space-y-1.5">
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
            <CheckCircle2 size={12} className="text-emerald-300 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle size={12} className="text-rose-300 mt-0.5 flex-shrink-0" />
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
