/**
 * CWA Dashboard — Black & Red bento grid for CodeWithAli.
 * Shows agency metrics, projects, revenue, team, and an area chart.
 */
import { BentoCard, BentoValue } from "./BentoCard";
import { TasksOverviewCard } from "./TasksOverviewCard";
import { Row3MemberSection } from "./Row3MemberSection";
import { Row5Section } from "./Row5Section";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { useEffectiveRow4View } from "./row4ViewStore";
import { AxonCheckinCard } from "./AxonCheckinCard";
import { AxonCoachCard } from "./AxonCoachCard";
import { CareerGrowthCard } from "./CareerGrowthCard";
import { TeamPulseCard } from "./TeamPulseCard";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { useRolePreview } from "@/stores/store";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import {
  Users,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  Bug,
  CalendarClock,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import {
  ActiveUser,
  Todos,
  MeetingsQuery,
  useKudosReceived,
  useMyAxonCheckins,
  useMyGrowthTrack,
  useStrategicFocus,
  getActiveCompanyLabel,
} from "@/stores/query";
import { useShiftsInRange } from "@/stores/shifts";
import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { companySupabase } from "@/routes/index.lazy";
import { useCandidates } from "@/MyComponents/Hiring/recruitingQueries";
import { useStripeDashboard } from "@/lib/useStripeDashboard";

// Fallback revenue series used when Stripe isn't connected (or the
// account has no charge history yet). The chart prefers live data from
// useStripeDashboard().timeseries.series when available — see the
// `revenueData` useMemo in CWADashboardContent — so this constant is
// only the demo skeleton the dashboard shows on a brand-new install.
const REAL_REVENUE_SERIES = [
  { month: "Sep", revenue: 320, expenses: 280 },
  { month: "Oct", revenue: 580, expenses: 310 },
  { month: "Nov", revenue: 420, expenses: 290 },
  { month: "Dec", revenue: 610, expenses: 350 },
  { month: "Jan", revenue: 490, expenses: 320 },
  { month: "Feb", revenue: 671, expenses: 380 },
  { month: "Mar", revenue: 720, expenses: 400 },
  { month: "Apr", revenue: 850, expenses: 420 },
];

/**
 * KpiCell — small editorial KPI tile for the chart's top strip.
 *
 * Three-line hierarchy:
 *   · label (tracked uppercase, quiet)
 *   · value (bold, the focal number; optional tone tint)
 *   · hint  (text-tertiary, supporting context)
 *
 * Used in the Revenue chart's header to surface answers the chart
 * shape alone hides — totals, margin, best month.
 */
function KpiCell({
  label,
  value,
  hint,
  valueTone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueTone?: "default" | "success" | "destructive";
}) {
  // Tone tokens lean editorial — emerald for positive (Net Profit
  // is the "Live Stripe" tone too so it reads as continuity),
  // soft rose for negative, otherwise default zinc.
  const toneCls =
    valueTone === "success"
      ? "text-emerald-300"
      : valueTone === "destructive"
        ? "text-rose-300"
        : "text-zinc-100";
  // Editorial KpiCell — mono uppercase eyebrow, Newsreader serif
  // hero figure, quiet zinc hint. Tone classes still apply on top
  // of the base zinc-100 so success/destructive cells stay
  // distinguishable.
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-zinc-400 truncate">
        {label}
      </div>
      <div
        className={`text-[22px] font-medium tabular-nums leading-tight mt-1 ${toneCls}`}
        style={{ fontFamily: "Newsreader, Georgia, serif" }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-zinc-500 mt-1 truncate">
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * CustomChartTooltip — recharts-compatible tooltip for the Revenue
 * vs Expenses area chart. Replaces the cramped default tooltip with
 * an editorial-styled card that mirrors the dashboard's design
 * language: hairline border, soft elevation, generous padding,
 * tracked uppercase header.
 *
 * Renders three things:
 *   1. The month label (uppercase, tracked)
 *   2. One row per series — colored dot, name, formatted value
 *   3. A derived "Net" line at the foot showing revenue − expenses,
 *      colored success/destructive based on sign. This is the bit
 *      the old tooltip was missing — the operator usually cares
 *      more about profit than the raw numbers.
 *
 * The colored dots reuse each series' `payload.color` from recharts,
 * so when we tune the chart palette later the tooltip stays in sync
 * automatically.
 */
function CustomChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Find revenue + expenses values by dataKey so we can compute net
  // profit. Falls back to 0 when a series is missing so the math
  // doesn't NaN out on an incomplete payload.
  const revenue =
    payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const expenses =
    payload.find((p) => p.dataKey === "expenses")?.value ?? 0;
  const net = revenue - expenses;
  const positive = net >= 0;

  // Format a number as a dollar amount with thousands separators.
  const fmt = (v: number) => `$${v.toLocaleString()}`;

  return (
    <div
      className="
        bg-popover border-xs border-border-soft rounded-lg
        px-3.5 py-3 min-w-[200px]
      "
      style={{
        // Slightly heavier shadow than a card so the tooltip lifts
        // off the chart canvas — it's an overlay, not a sibling.
        boxShadow: "0 8px 22px -8px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Month label — tracked uppercase, same treatment as our
       *  widget section headers so the tooltip reads as part of
       *  the same family. */}
      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-text-tertiary mb-2.5">
        {label}
      </div>

      {/* Series rows. Order matches the chart's z-order: expenses
       *  first (drawn underneath), revenue second (drawn on top). */}
      <div className="space-y-1.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="text-[11.5px] text-foreground/80 capitalize flex-1">
              {p.dataKey}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {fmt(p.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Net profit — divider + derived line. Colors with the sign
       *  so green = good, red = trouble. Most operators read the
       *  chart for "are we profitable?", so surfacing this answer
       *  inline saves them the mental subtraction. */}
      <div className="mt-2.5 pt-2.5 border-t border-xs border-border/15 flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" aria-hidden />
        <span className="text-[11.5px] text-foreground/70 flex-1">Net</span>
        <span
          className={`text-[12px] font-semibold tabular-nums ${
            positive ? "text-success" : "text-destructive"
          }`}
        >
          {positive ? "+" : "−"}
          {fmt(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}


/**
 * StatCard — hero metric tile.
 *
 * Hierarchy locked to the polish-pass system:
 *   · label (tertiary 40%):  small uppercase, quiet
 *   · value (primary ~92%):  text-3xl, the focal point
 *   · delta (success green): icon + value + timeframe, normalized
 *
 * `delta` and `timeframe` replace the old freeform `change` string so
 * every card uses the same "↑ 26.7% MoM" structure.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  timeframe,
  direction = "up",
  delay = 0,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  delta?: string;
  timeframe?: string;
  direction?: "up" | "down";
  delay?: number;
}) {
  const positive = direction === "up";
  return (
    <BentoCard label={label} delay={delay}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <BentoValue>{value}</BentoValue>
          {delta && (
            <div className="flex items-center gap-1 mt-2">
              {positive ? (
                <ArrowUpRight className="h-3 w-3 text-success" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-destructive" />
              )}
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  positive ? "text-success" : "text-destructive"
                }`}
              >
                {delta}
              </span>
              {timeframe && (
                <span className="text-[10.5px] text-text-tertiary ml-0.5">
                  {timeframe}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </BentoCard>
  );
}

/**
 * InboxCard — editorial top-strip card.
 *
 * Rebuilt to match the meeting/task card aesthetic so the dashboard
 * reads as one design language top-to-bottom. Same surface
 * (`bg-card` with hairline border), same hierarchy:
 *
 *   · LABEL · count   → small uppercase header line, count in the accent
 *   · Preview title    → bold, the focal text the operator scans
 *   · Preview meta     → muted supporting line
 *
 * Drops: the internal hairline divider between header and body, the
 * icon chip (the colored count carries the accent already), the
 * BentoCard wrapper (we own the surface directly so we get the same
 * editorial padding + hover treatment as the meeting/task cards).
 *
 * Click target = the whole card. Disabled state when no `to` was
 * supplied keeps the card readable but inert.
 */
function InboxCard({
  label,
  icon: _icon,
  count,
  accent,
  preview,
  emptyText = "All clear",
  to,
  delay: _delay = 0,
}: {
  label: string;
  /** Kept on the prop signature for API compatibility — no longer
   *  rendered. The accent color now carries the visual cue. */
  icon: typeof Users;
  count: number;
  accent: "primary" | "warning" | "success" | "destructive";
  preview?: { text: string; meta?: string } | null;
  emptyText?: string;
  to?: string;
  /** Same — kept for signature compat; entrance motion lives on the
   *  parent BentoCard shell which is gone now. */
  delay?: number;
}) {
  const navigate = useNavigate();

  // Editorial accent system — emerald for positive states (success
  // + primary), amber for warning, soft rose for destructive. The
  // count is the focal point so it gets the strongest accent.
  const accentText =
    accent === "primary"     ? "text-emerald-300" :
    accent === "warning"     ? "text-amber-300" :
    accent === "success"     ? "text-emerald-300" :
                               "text-rose-300";
  const accentHoverBorder =
    accent === "primary"     ? "hover:border-emerald-500/30" :
    accent === "warning"     ? "hover:border-amber-500/30" :
    accent === "success"     ? "hover:border-emerald-500/30" :
                               "hover:border-rose-500/30";
  const accentDot =
    accent === "primary"     ? "bg-emerald-400" :
    accent === "warning"     ? "bg-amber-400" :
    accent === "success"     ? "bg-emerald-400" :
                               "bg-rose-400";

  return (
    <button
      type="button"
      onClick={to ? () => navigate({ to: to as any }) : undefined}
      disabled={!to}
      className={`
        group relative w-full text-left
        bg-gradient-to-b from-zinc-800/40 to-zinc-900/70
        border border-white/[0.06] rounded-xl
        ${accentHoverBorder} transition-colors
        px-5 py-4
        focus-visible:outline-none focus-visible:border-emerald-500/40
        disabled:cursor-default
        overflow-hidden
      `}
    >
      {/* Eyebrow — mono uppercase tracking, the editorial signature. */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-1 w-1 rounded-full ${accentDot}`} />
          <span className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-zinc-400">
            {label}
          </span>
        </div>
        {to && (
          <ChevronRight
            className="h-3 w-3 text-zinc-600 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all"
          />
        )}
      </div>

      {/* Hero count — Newsreader serif, big and confident. The number
       *  is the focal point of the card; everything else supports it. */}
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={`text-[28px] leading-none font-medium tabular-nums ${accentText}`}
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        >
          {count}
        </span>
      </div>

      {/* Body — preview title + meta or muted empty state. min-h keeps
       *  the four-card row aligned regardless of which slots are empty. */}
      <div className="min-h-[38px]">
        {preview ? (
          <>
            <h3 className="text-[13px] font-semibold text-zinc-100 leading-snug line-clamp-2 tracking-tight">
              {preview.text}
            </h3>
            {preview.meta && (
              <p className="mt-1 text-[10.5px] font-mono uppercase tracking-[0.12em] text-zinc-500 leading-snug line-clamp-1">
                {preview.meta}
              </p>
            )}
          </>
        ) : (
          <p className="text-[11.5px] text-zinc-500 italic">
            {emptyText}
          </p>
        )}
      </div>
    </button>
  );
}

/**
 * Tasks Overview row — shared markup for the Open / Completed entries
 * inside the Tasks Overview BentoCard. Mirrors the typography +
 * progress-bar treatment used on Active Projects so the panels visually
 * belong to the same family.
 */
function TaskOverviewRow({
  label, value, accent, total, count,
}: {
  label: string;
  value: number;
  accent: "warning" | "success";
  total: number;
  count: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const fillCls =
    accent === "warning"
      ? "bg-gradient-to-r from-warning/80 to-warning"
      : "bg-gradient-to-r from-success/80 to-success";
  const valueCls = accent === "warning" ? "text-warning" : "text-success";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] text-foreground/90">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${valueCls}`}>{value}</span>
      </div>
      <div className="w-full h-1 bg-foreground/[0.08] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${fillCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Row4Swapper — renders the active Row 4 variant per the row4ViewStore.
 *
 * Canonical view ("components") is the Row 4 Redux: AxonCheckin (left
 * 60%) + CareerGrowth (top-right) + TeamPulse (bottom-right). This is
 * the default for every role.
 *
 * Power-user backdoor view ("lists") shows the original Tasks +
 * Meetings widgets. Reachable via Cmd+Shift+D (Row4SwapShortcut at
 * root) or the Cmd+K palette ("switch row 4 view"). Hidden — no
 * visible toggle button.
 */
function Row4Swapper() {
  const { data: meRows } = ActiveUser();
  const actualRole: string | undefined =
    (meRows?.[0] as any)?.role ?? undefined;
  // Honor the role-preview overlay. When a CEO/COO previews as
  // another role we ignore the actual user's persisted preference
  // so the preview is a faithful "what this role sees on a fresh
  // dashboard". With the canonical default being "components" for
  // everyone the preview will normally render the new three-card
  // Row 4 — same as the actual user's first-load experience.
  const previewRole = useRolePreview((s) => s.previewRole);
  const effectiveRole = previewRole || actualRole;
  const row4View = useEffectiveRow4View(effectiveRole, !!previewRole);

  if (row4View === "components") {
    // 60 / 40 split. Right column splits internally into two stacked
    // cards (CareerGrowth on top, TeamPulse on bottom).
    return (
      <>
        <div className="col-span-12 md:col-span-7">
          <AxonCheckinCard />
        </div>
        <div className="col-span-12 md:col-span-5 grid grid-rows-2 gap-3">
          <CareerGrowthCard />
          <TeamPulseCard />
        </div>
      </>
    );
  }

  // "lists" — Tasks + Meetings + Axon coach. The Axon card lives
  // next to Meetings so it can pull from the same daily context
  // (upcoming meetings + open tasks) and offer concrete actions
  // rather than just counting them.
  return (
    <>
      <div className="col-span-5">
        <TasksComponent />
      </div>
      <div className="col-span-4">
        <Meetings />
      </div>
      <div className="col-span-3">
        <AxonCoachCard />
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Employee-strip cards — Row 1 variants for non-C-level employees.
// Each wraps the InboxCard primitive with role-relevant data:
//   1. EmployeeKudosCard       → recent recognition received
//   2. EmployeeCheckinCard     → daily AXON reflection
//   3. EmployeeHoursCard       → hours logged this week
//   4. EmployeeFocusCard       → current growth track + progress
//
// CWADashboard role-gates Row 1 — C-level sees the exec strip (Tasks,
// Bugs, Meetings, Candidates), everyone else sees these four. Same
// editorial card surface, same hierarchy, just member-focused data.
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// StrategicFocusCard — C-level fallback for the Today's Meetings slot
// on days the operator has no meetings scheduled. Pivots the dead
// "Free today" state into a strategic prompt.
//
// Reads `cwa_strategic_focus` for the active company, ordered newest
// first. Empty state nudges the operator to set one up via /strategy
// (where the editing UX will eventually live).
// ────────────────────────────────────────────────────────────────────
function StrategicFocusCard() {
  const company = getActiveCompanyLabel();
  const { data: focus } = useStrategicFocus(company);

  if (!focus) {
    return (
      <InboxCard
        label="Strategic Focus"
        icon={CheckSquare}
        count={0}
        accent="primary"
        preview={null}
        emptyText="Set your quarter's strategic focus"
        to="/strategy"
      />
    );
  }

  // Compose meta — show the latest note if present, otherwise show
  // the "updated X days ago" hint so the operator knows how fresh
  // the focus is.
  const updatedAgo = (() => {
    const ms = Date.now() - new Date(focus.updated_at).getTime();
    const days = Math.round(ms / (24 * 60 * 60 * 1000));
    if (days === 0) return "updated today";
    if (days === 1) return "updated yesterday";
    if (days < 14) return `updated ${days}d ago`;
    return `updated ${Math.round(days / 7)}w ago`;
  })();

  return (
    <InboxCard
      label="Strategic Focus"
      icon={CheckSquare}
      // Count is meaningless here — render as a 0 or skip. Showing
      // the updated freshness via meta is more honest.
      count={0}
      accent="primary"
      preview={{
        text: focus.headline,
        meta: focus.latest_note
          ? focus.latest_note
          : `Quarterly priority · ${updatedAgo}`,
      }}
      emptyText="Set your quarter's strategic focus"
      to="/strategy"
    />
  );
}

function EmployeeKudosCard() {
  const { data: me } = ActiveUser();
  const supaId = (me?.[0] as any)?.supa_id ?? null;
  const { data: kudos } = useKudosReceived(supaId);

  // Resolve actor_id → username so the meta line shows who gave the
  // kudos instead of a generic "From your teammates". Cheap lookup
  // against the employees roster which is already cached for the
  // tasks/meetings widgets. Single query, cached.
  const { data: employees } = useQuery({
    queryKey: ["app_users_lookup_for_kudos"],
    queryFn: async () => {
      const { data } = await companySupabase
  .from("employee")
        .select("supa_id, username");
      return (data ?? []) as Array<{ supa_id: string; username: string }>;
    },
    staleTime: 5 * 60_000,
  });

  const usersBySupaId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees ?? []) {
      if (e?.supa_id && e?.username) m.set(e.supa_id, e.username);
    }
    return m;
  }, [employees]);

  // "This week" = trailing 7 days. Avoids week-boundary edge cases.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = (kudos ?? []).filter(
    (k) => new Date(k.created_at).getTime() > sevenDaysAgo,
  );
  const mostRecent = (kudos ?? [])[0];
  // Kudos messages can live on either metadata.message (newer
  // schema) or description (older fallback). Try both.
  const message =
    (mostRecent?.metadata?.message as string | undefined) ??
    mostRecent?.description ??
    null;
  // Resolve sender — fall back to a polite generic when the actor
  // isn't in the roster (deleted user, system-sent kudos, etc).
  const senderName = mostRecent?.actor_id
    ? usersBySupaId.get(mostRecent.actor_id) ?? null
    : null;

  return (
    <InboxCard
      label="Recent Kudos"
      icon={CheckSquare}
      count={recent.length}
      accent="success"
      preview={
        message
          ? {
              text: message,
              meta: senderName ? `From ${senderName}` : "From a teammate",
            }
          : null
      }
      emptyText="No kudos this week — yet"
      to={undefined}
    />
  );
}

function EmployeeCheckinCard() {
  const { data: checkins } = useMyAxonCheckins(7);
  const today = new Date().toISOString().slice(0, 10);
  const todayCheckin = (checkins ?? []).find((c: any) =>
    typeof c.created_at === "string" && c.created_at.startsWith(today),
  );
  const last7Count = (checkins ?? []).length;

  return (
    <InboxCard
      label="Daily Check-in"
      icon={CheckSquare}
      count={last7Count}
      // Done today → calm success. Not done → warning to nudge the
      // operator to log a reflection.
      accent={todayCheckin ? "success" : "warning"}
      preview={
        todayCheckin
          ? {
              text: "Logged for today",
              meta: "Open AXON to revisit your reflection",
            }
          : {
              text: "Log today's reflection",
              meta: "Tell AXON how the day's going",
            }
      }
      emptyText="Open AXON to start your first check-in"
      to={undefined}
    />
  );
}

function EmployeeHoursCard() {
  const { data: me } = ActiveUser();
  const supaId = (me?.[0] as any)?.supa_id ?? null;

  // Trailing 7-day window aligned to "today minus current weekday".
  // Computed once per render — useMemo so the Date instances stay
  // stable for the useShiftsInRange query key.
  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // back to Sunday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { weekStart: start, weekEnd: end };
  }, []);

  const { data: shifts } = useShiftsInRange(weekStart, weekEnd);

  const totalHours = useMemo(() => {
    if (!shifts || !supaId) return 0;
    return shifts
      .filter((s: any) => s.user_supa_id === supaId)
      .reduce((sum: number, s: any) => {
        const start = new Date(s.starts_at).getTime();
        const end = new Date(s.ends_at).getTime();
        if (isNaN(start) || isNaN(end) || end <= start) return sum;
        return sum + (end - start) / 3_600_000;
      }, 0);
  }, [shifts, supaId]);

  const target = 40;
  const rounded = Math.round(totalHours * 10) / 10;
  const remaining = Math.max(0, target - rounded);
  const pct = Math.round((rounded / target) * 100);

  return (
    <InboxCard
      label="Hours This Week"
      icon={CheckSquare}
      count={rounded}
      accent="primary"
      preview={
        rounded > 0
          ? {
              text: `${rounded} / ${target} hours`,
              meta:
                remaining > 0
                  ? `${Math.round(remaining * 10) / 10}h remaining · ${pct}%`
                  : "Target hit · nice",
            }
          : null
      }
      emptyText="No shifts logged this week"
      to="/schedule"
    />
  );
}

function EmployeeFocusCard() {
  const { data: track } = useMyGrowthTrack();

  if (!track) {
    return (
      <InboxCard
        label="Current Focus"
        icon={CheckSquare}
        count={0}
        accent="warning"
        preview={null}
        emptyText="Ask your manager for a growth track"
        to="/growth"
      />
    );
  }

  const steps = (track.milestone_steps ?? []) as Array<{
    title?: string;
    completed?: boolean;
  }>;
  const completed = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextStep = steps.find((s) => !s.completed);

  return (
    <InboxCard
      label="Current Focus"
      icon={CheckSquare}
      // Percent as the headline count — gives the operator a quick
      // signal whether they're tracking on this milestone.
      count={pct}
      accent="primary"
      preview={{
        text:
          track.next_milestone ||
          nextStep?.title ||
          track.role_title ||
          "Focus active",
        meta:
          total > 0
            ? `${completed} of ${total} steps · ${pct}%`
            : "No steps defined yet",
      }}
      emptyText="No active focus"
      to="/growth"
    />
  );
}

function CWADashboardContent() {
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";
  const { data: myTodos } = Todos(username);
  const { data: meetings } = MeetingsQuery();
  const { data: candidates } = useCandidates({ status: "applied", limit: 20 });

  // Open bug reports — inline query, no shared hook exists yet.
  const { data: bugReports } = useQuery({
    queryKey: ["dashboard", "open-bug-reports"],
    queryFn: async () => {
      const { data, error } = await companySupabase
  .from("bug_reports")
        .select("id, title, severity, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data ?? [];
    },
  });

  // Derived stats for the 4 inbox cards.
  const myOpenTasks = useMemo(
    () => (myTodos ?? []).filter((t: any) => t.status !== "done"),
    [myTodos],
  );
  const topUrgentTask = useMemo(() => {
    if (myOpenTasks.length === 0) return null;
    return [...myOpenTasks].sort(
      (a: any, b: any) => (b.priorityOrder ?? 0) - (a.priorityOrder ?? 0),
    )[0];
  }, [myOpenTasks]);

  const todaysMeetings = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (meetings ?? []).filter((m: any) => {
      const d = m.date ? String(m.date).slice(0, 10) : "";
      return d === todayStr;
    });
  }, [meetings]);

  // First meeting strictly after today — fallback content for the
  // "Today's Meetings" slot when there's nothing on the calendar
  // today. Parses each meeting's date defensively (the field is free
  // text and can be in several formats), filters to upcoming, sorts
  // ascending, returns the soonest.
  const nextMeeting = useMemo(() => {
    const tomorrowStart = new Date();
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    return (meetings ?? [])
      .map((m: any) => {
        const d = m.date ? new Date(m.date) : null;
        return d && !isNaN(d.getTime()) ? { meeting: m, date: d } : null;
      })
      .filter((x): x is { meeting: any; date: Date } => x !== null)
      .filter((x) => x.date.getTime() >= tomorrowStart.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.meeting ?? null;
  }, [meetings]);

  const openBugList = bugReports ?? [];
  const newCandidates = candidates ?? [];

  // ── Revenue chart data ────────────────────────────────────────
  //
  // Revenue line comes from Stripe (useStripeDashboard fans out the
  // /api/stripe/timeseries call once for the whole app). Expense line
  // is a flat monthly burn computed from cwa_expenses — we don't track
  // expenses by historical month, so applying current burn evenly
  // across the window is the truthful baseline.
  //
  // If Stripe isn't connected (or the account has no charges in
  // window), the chart falls back to REAL_REVENUE_SERIES so the home
  // dashboard still renders something useful on a fresh install.
  const stripe = useStripeDashboard();

  const { data: monthlyBurnDollars = 0 } = useQuery({
    queryKey: ["dashboard", "monthly-expense-burn"],
    queryFn: async () => {
      const { data, error } = await companySupabase
        .from("cwa_expenses")
        .select("amount, frequency");
      if (error) return 0;
      let monthlyTotal = 0;
      for (const e of (data ?? []) as Array<{
        amount: number | string;
        frequency: string | null;
      }>) {
        const amt = Number(e.amount) || 0;
        switch (e.frequency) {
          case "yearly":
            monthlyTotal += amt / 12;
            break;
          case "quarterly":
            monthlyTotal += amt / 3;
            break;
          case "weekly":
            monthlyTotal += amt * (52 / 12);
            break;
          case "monthly":
          default:
            monthlyTotal += amt;
        }
      }
      return Math.round(monthlyTotal);
    },
    staleTime: 5 * 60_000,
  });

  const revenueData = useMemo(() => {
    const series = stripe.timeseries?.series ?? [];
    if (stripe.connected && series.length > 0) {
      // Keep the same 8-month window the chart was tuned for so the
      // KPI strip + summary footer math (avg / best / worst) don't
      // need to change.
      return series.slice(-8).map((p) => ({
        month: p.label,
        revenue: Math.round(p.revenue_cents / 100),
        expenses: monthlyBurnDollars,
      }));
    }
    return REAL_REVENUE_SERIES;
  }, [stripe.connected, stripe.timeseries, monthlyBurnDollars]);

  // Used to swap the "Last 8 months" subtitle for a live indicator.
  const usingLiveRevenue =
    stripe.connected && (stripe.timeseries?.series.length ?? 0) > 0;

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* ── Row 1 (C-level): exec inbox — tasks, bugs, meetings,
       *  candidates. UserView wraps the four divs as a fragment so
       *  the grid still slots them into the row correctly. */}
      <UserView userRole={["CEO", "COO", "CFO", "Admin"]}>
        <div className="col-span-3">
          <InboxCard
            label="My Tasks"
            icon={CheckSquare}
            count={myOpenTasks.length}
            accent="primary"
            preview={
              topUrgentTask
                ? {
                    text: topUrgentTask.title,
                    meta: `${topUrgentTask.priority ?? "low"} priority`,
                  }
                : null
            }
            emptyText="Nothing on your plate"
            to="/task"
            delay={0.05}
          />
        </div>
        <div className="col-span-3">
          <InboxCard
            label="Open Bug Reports"
            icon={Bug}
            count={openBugList.length}
            accent="destructive"
            preview={
              openBugList[0]
                ? {
                    text: openBugList[0].title,
                    meta: openBugList[0].severity
                      ? `Severity · ${openBugList[0].severity}`
                      : undefined,
                  }
                : null
            }
            emptyText="No open bugs"
            to="/reports"
            delay={0.1}
          />
        </div>
        <div className="col-span-3">
          {/* Today's meetings slot, with a smart fallback chain:
           *    has meetings today  → Today's Meetings card
           *    no meetings today   → Next Meeting card (closest
           *                          upcoming on the calendar)
           *    no upcoming at all  → quiet empty "Free today"
           *
           *  StrategicFocusCard is defined above and ready to slot
           *  back in once the /strategy route is fleshed out. */}
          {todaysMeetings.length > 0 ? (
            <InboxCard
              label="Today's Meetings"
              icon={CalendarClock}
              count={todaysMeetings.length}
              accent="success"
              preview={{
                text: todaysMeetings[0].meeting_title ?? "Untitled meeting",
                meta: todaysMeetings[0].time ?? undefined,
              }}
              emptyText="Free today"
              to="/schedule"
              delay={0.15}
            />
          ) : nextMeeting ? (
            <InboxCard
              label="Next Meeting"
              icon={CalendarClock}
              count={1}
              accent="primary"
              preview={{
                text: nextMeeting.meeting_title ?? "Untitled meeting",
                // Friendly relative-ish formatting: "Mon, Jun 1" +
                // time if available. Caller has already validated
                // the date parses, so this is safe.
                meta: (() => {
                  const d = new Date(nextMeeting.date);
                  const dateLabel = d.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  return nextMeeting.time
                    ? `${dateLabel} · ${nextMeeting.time}`
                    : dateLabel;
                })(),
              }}
              emptyText="No upcoming meetings"
              to="/schedule"
              delay={0.15}
            />
          ) : (
            <InboxCard
              label="Today's Meetings"
              icon={CalendarClock}
              count={0}
              accent="success"
              preview={null}
              emptyText="Free today"
              to="/schedule"
              delay={0.15}
            />
          )}
        </div>
        <div className="col-span-3">
          <InboxCard
            label="New Candidates"
            icon={UserPlus}
            count={newCandidates.length}
            accent="warning"
            preview={
              newCandidates[0]
                ? {
                    text: (newCandidates[0] as any).full_name ?? "Unnamed candidate",
                    meta:
                      (newCandidates[0] as any).fit_score != null
                        ? `Fit · ${(newCandidates[0] as any).fit_score}`
                        : "Awaiting review",
                  }
                : null
            }
            emptyText="No new applicants"
            to="/hiring"
            delay={0.2}
          />
        </div>
      </UserView>

      {/* ── Row 1 (Non-C-level): employee inbox — kudos received,
       *  daily AXON check-in, hours logged this week, and current
       *  growth-track focus. excludeRoles flips the gate so this
       *  surface shows for everyone NOT in the exec set. */}
      <UserView excludeRoles={["CEO", "COO", "CFO", "Admin"]}>
        <div className="col-span-3">
          <EmployeeKudosCard />
        </div>
        <div className="col-span-3">
          <EmployeeCheckinCard />
        </div>
        <div className="col-span-3">
          <EmployeeHoursCard />
        </div>
        <div className="col-span-3">
          <EmployeeFocusCard />
        </div>
      </UserView>

      {/* ── Row 2: Area Chart (8 cols) + Tasks (4 cols) ── */}
      <BentoCard span="col-span-8 row-span-2" delay={0.25} noPadding>
        {/* Editorial header — title + subtitle + period delta in
         *  one row, inline legend on the right. The delta tells the
         *  operator "are we up or down vs the prior half" at a
         *  glance, before they read the chart. */}
        {(() => {
          // Derived metrics — computed inline (small, single use).
          // Splits the window in half to compute a "vs prior period"
          // delta: avg revenue of last 4 vs first 4 months.
          const mid = Math.floor(revenueData.length / 2);
          const firstHalf = revenueData.slice(0, mid);
          const secondHalf = revenueData.slice(mid);
          const avgRev = (rows: typeof revenueData) =>
            rows.length > 0
              ? rows.reduce((s, m) => s + m.revenue, 0) / rows.length
              : 0;
          const firstAvg = avgRev(firstHalf);
          const secondAvg = avgRev(secondHalf);
          const trendPct =
            firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
          const trendPositive = trendPct >= 0;
          return (
            <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.05]">
              <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                  Revenue vs Expenses
                </span>
                {/* Source indicator — when Stripe is connected and has
                 *  shipped data for the window, show a small pulsing
                 *  green pill so the operator knows the chart is live.
                 *  Otherwise show the quieter "Demo data" tag so the
                 *  fallback series isn't mistaken for real revenue. */}
                {usingLiveRevenue ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-success/70 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    Live · Stripe
                  </span>
                ) : (
                  <span
                    className="text-[10.5px] text-text-tertiary"
                    title={
                      stripe.connected
                        ? "Stripe connected but no charges in this window yet"
                        : "Connect Stripe in Settings → Connectors to see live revenue"
                    }
                  >
                    Last 8 months · Demo data
                  </span>
                )}
                {/* Period delta badge — inline with the title.
                 *  Colored success/destructive based on direction;
                 *  same arrow icons used in the StatCards above. */}
                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold">
                  {trendPositive ? (
                    <ArrowUpRight className="h-3 w-3 text-success" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                  )}
                  <span
                    className={
                      trendPositive ? "text-success" : "text-destructive"
                    }
                  >
                    {trendPositive ? "+" : ""}
                    {trendPct.toFixed(0)}%
                  </span>
                  <span className="text-text-tertiary ml-0.5 font-normal">
                    vs prior half
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-[10.5px] font-medium text-foreground/70">
                    Revenue
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                  <span className="text-[10.5px] font-medium text-foreground/70">
                    Expenses
                  </span>
                </div>
              </div>
            </header>
          );
        })()}

        {/* KPI strip — four small editorial cells across the top
         *  giving the operator the answer before they read the
         *  chart. Same hairline divider style as the header. Cells
         *  are evenly spaced; the last one (Net Profit) is the
         *  visual focal point with the success/destructive color. */}
        {(() => {
          const totalRev = revenueData.reduce((s, m) => s + m.revenue, 0);
          const totalExp = revenueData.reduce((s, m) => s + m.expenses, 0);
          const net = totalRev - totalExp;
          const margin = totalRev > 0 ? (net / totalRev) * 100 : 0;
          const avg = totalRev / Math.max(revenueData.length, 1);

          // Round before formatting so we never get `$582.625/mo`.
          // K-formatted values keep one decimal of precision so a
          // $4.6K reads truthfully, not as $5K.
          const fmtMoney = (v: number) => {
            const r = Math.round(v);
            return r >= 1000
              ? `$${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)}K`
              : `$${r.toLocaleString()}`;
          };

          return (
            <div className="grid grid-cols-4 gap-4 px-5 py-3.5 border-b border-xs border-border/15">
              <KpiCell
                label="Total Revenue"
                value={fmtMoney(totalRev)}
                hint={`Avg ${fmtMoney(avg)}/mo`}
              />
              <KpiCell
                label="Total Expenses"
                value={fmtMoney(totalExp)}
                hint={`${Math.round((totalExp / totalRev) * 100)}% of revenue`}
              />
              <KpiCell
                label="Net Profit"
                value={fmtMoney(net)}
                valueTone={net >= 0 ? "success" : "destructive"}
                hint={`${margin.toFixed(0)}% margin`}
              />
              {/* Best Month — lead with the dollar amount so the
               *  hierarchy matches the other three cells (value = $,
               *  hint = supporting context). The month name slots
               *  into the hint line. */}
              {(() => {
                const best = [...revenueData].sort(
                  (a, b) => b.revenue - a.revenue,
                )[0];
                return (
                  <KpiCell
                    label="Best Month"
                    value={fmtMoney(best?.revenue ?? 0)}
                    hint={best?.month ? `in ${best.month}` : "—"}
                  />
                );
              })()}
            </div>
          );
        })()}

        <div className="h-[200px] px-4 pt-3 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                {/* Revenue uses --success (positive green) so rising
                    revenue reads as growth, not alarm. Fill is a soft
                    glow at the top, fading to zero by the bottom. */}
                <linearGradient id="cwa-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cwa-expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Quieter grid — dasharray "2 4" gives open dotted look
               *  instead of the heavier "3 3"; stroke alpha tuned so
               *  lines whisper rather than shout. */}
              <CartesianGrid
                vertical={false}
                strokeDasharray="2 4"
                stroke="hsl(var(--border) / 0.5)"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: "hsl(var(--text-tertiary))" }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: "hsl(var(--text-tertiary))" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`
                }
                width={40}
              />
              {/* Custom tooltip — the inline contentStyle approach
               *  capped at small, undetailed default chrome. The
               *  component above gives us full control: editorial
               *  card surface, colored series rows, AND a derived
               *  net profit line that answers "are we ahead?" at a
               *  glance without the operator having to subtract in
               *  their head. */}
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={<CustomChartTooltip />}
              />

              {/* Target line — horizontal dashed reference at the
               *  monthly revenue goal. Right-edge label tells the
               *  operator what they're looking at without hovering.
               *  TODO: pull the goal value from a settings row when
               *  one exists; for now $1K/mo is the implicit target
               *  the chart's y-axis already implies. */}
              <ReferenceLine
                y={1000}
                stroke="hsl(var(--primary) / 0.5)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: "Target $1K",
                  position: "insideTopRight",
                  fill: "hsl(var(--primary))",
                  fontSize: 10,
                  fontWeight: 600,
                  offset: 6,
                }}
              />

              {/* Reference dots — small filled markers at the best
               *  and worst revenue months so the eye can identify
               *  them without scanning. Best gets a success-green
               *  ring; worst gets a destructive-red ring. Kept
               *  subtle (r=4) so they don't overpower the line. */}
              {(() => {
                const sorted = [...revenueData].sort(
                  (a, b) => b.revenue - a.revenue,
                );
                const best = sorted[0];
                const worst = sorted[sorted.length - 1];
                return (
                  <>
                    {best && (
                      <ReferenceDot
                        x={best.month}
                        y={best.revenue}
                        r={4}
                        fill="hsl(var(--card))"
                        stroke="hsl(var(--success))"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                      />
                    )}
                    {worst && (
                      <ReferenceDot
                        x={worst.month}
                        y={worst.revenue}
                        r={4}
                        fill="hsl(var(--card))"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                      />
                    )}
                  </>
                );
              })()}
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--foreground) / 0.4)"
                strokeWidth={1.5}
                fill="url(#cwa-expenses)"
                // Hover dot — small filled circle that appears at
                // the hover point. fill matches the card surface so
                // the dot looks "punched out" of the line. stroke
                // picks up the series color via CSS var.
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  fill: "hsl(var(--card))",
                  stroke: "hsl(var(--foreground) / 0.6)",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--success))"
                strokeWidth={2.25}
                fill="url(#cwa-revenue)"
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: "hsl(var(--card))",
                  stroke: "hsl(var(--success))",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary footer — quiet editorial data dust below the
         *  chart. Surfaces best/worst month + average margin so the
         *  operator can read the season at a glance without manually
         *  scanning. Sits on a hairline divider; never wraps. */}
        {(() => {
          const sorted = [...revenueData].sort(
            (a, b) => b.revenue - a.revenue,
          );
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          const totalRev = revenueData.reduce((s, m) => s + m.revenue, 0);
          const totalExp = revenueData.reduce((s, m) => s + m.expenses, 0);
          const avgMargin =
            totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0;
          const fmt = (v: number) =>
            v >= 1000
              ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
              : `$${v.toLocaleString()}`;
          return (
            <div className="px-5 py-2.5 border-t border-xs border-border/15 flex items-center gap-4 text-[10.5px] text-text-tertiary flex-wrap">
              <span>
                Best{" "}
                <span className="text-foreground/85 font-semibold">
                  {best?.month}
                </span>{" "}
                <span className="text-foreground/70 tabular-nums">
                  {fmt(best?.revenue ?? 0)}
                </span>
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span>
                Worst{" "}
                <span className="text-foreground/85 font-semibold">
                  {worst?.month}
                </span>{" "}
                <span className="text-foreground/70 tabular-nums">
                  {fmt(worst?.revenue ?? 0)}
                </span>
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span>
                Avg margin{" "}
                <span className="text-foreground/85 font-semibold tabular-nums">
                  {avgMargin.toFixed(0)}%
                </span>
              </span>
            </div>
          );
        })()}
      </BentoCard>

      <TasksOverviewCard username={username} />

      {/* ── Row 3: non-leadership only.
          C-level used to get the Strategic Intelligence panel here.
          That panel was 884 lines of mostly-mock data fighting four
          different viz paradigms in one row — moved to its own
          destination at /strategy so home stays focused on today's
          execution surface. Non-C-level still see the Member section
          (Team Activity + Quick Actions) since that's their primary
          dashboard real estate. */}
      <UserView excludeRoles={[Role.CEO, Role.COO]}>
        <Row3MemberSection />
      </UserView>

      {/* ── Row 4: Row 4 Redux ──
          Canonical "components" mode shows the three new cards:
          AxonCheckin (left 60%, full row height) + CareerGrowth
          (top right) + TeamPulse (bottom right). Power-user backdoor
          "lists" mode shows the original Tasks + Meetings widgets
          (toggle via Cmd+Shift+D or Cmd+K palette). */}
      <Row4Swapper />

      {/* ── Row 6 (preview): Communication & Workspace ──
          Engagement-focused — Communication & Presence (mentions,
          online users) + Workspace Deep Dive (co-edited docs +
          recent feedback). Sits below the new Row 5 footer; an open
          question whether this row continues to ship at all. */}
      <Row5Section />
    </div>
  );
}

export function CWADashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-12 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="col-span-3 h-24 rounded-lg bg-card animate-pulse" />
          ))}
          <div className="col-span-8 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
          <div className="col-span-4 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
        </div>
      }
    >
      <CWADashboardContent />
    </Suspense>
  );
}
