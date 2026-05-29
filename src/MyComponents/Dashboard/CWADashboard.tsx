/**
 * CWA Dashboard — Black & Red bento grid for CodeWithAli.
 * Shows agency metrics, projects, revenue, team, and an area chart.
 */
import { BentoCard, BentoValue } from "./BentoCard";
import { TasksOverviewCard } from "./TasksOverviewCard";
import { Row3Section } from "./Row3Section";
import { Row3MemberSection } from "./Row3MemberSection";
import { Row5Section } from "./Row5Section";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { useEffectiveRow4View } from "./row4ViewStore";
import { AxonCheckinCard } from "./AxonCheckinCard";
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
import { ActiveUser, Todos, MeetingsQuery } from "@/stores/query";
import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { useCandidates } from "@/MyComponents/Hiring/recruitingQueries";

// TODO(revenue): placeholder series — no real revenue source exists
// yet. When `cwa_revenue_snapshots` (or whatever ships) lands, swap
// this constant for a query. Kept in real units so the y-axis logic
// doesn't need to change at that point.
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
 * InboxCard — preview-first card. The TOP item is the focal point
 * (because that's what you actually need to act on), with the count
 * + nav chevron as quiet header metadata. Empty states say something
 * useful instead of just showing "0".
 *
 * The previous big-number-on-the-left layout tried to be both a stat
 * card and a list preview and ended up looking like neither.
 */
function InboxCard({
  label,
  icon: Icon,
  count,
  accent,
  preview,
  emptyText = "All clear",
  to,
  delay = 0,
}: {
  label: string;
  icon: typeof Users;
  count: number;
  accent: "primary" | "warning" | "success" | "destructive";
  preview?: { text: string; meta?: string } | null;
  emptyText?: string;
  to?: string;
  delay?: number;
}) {
  const navigate = useNavigate();
  const dotCls =
    accent === "primary"     ? "bg-primary" :
    accent === "warning"     ? "bg-warning" :
    accent === "success"     ? "bg-success" :
                               "bg-destructive";
  const countCls =
    accent === "primary"     ? "text-primary" :
    accent === "warning"     ? "text-warning" :
    accent === "success"     ? "text-success" :
                               "text-destructive";

  return (
    // Use BentoCard's shell but no label prop — we render our own
    // tighter header so the preview can be the visual hero.
    <BentoCard delay={delay} noPadding>
      <button
        type="button"
        onClick={to ? () => navigate({ to: to as any }) : undefined}
        className="w-full text-left group/inbox"
        disabled={!to}
      >
        {/* Header row — label, count, chevron, icon. All quiet. */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-3 w-3 flex-shrink-0 ${countCls}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary truncate">
              {label}
            </span>
            <span className={`text-[10.5px] font-bold tabular-nums ${countCls}`}>
              {count}
            </span>
          </div>
          {to && (
            <ChevronRight
              className="h-3 w-3 text-text-tertiary flex-shrink-0 group-hover/inbox:text-foreground transition-colors"
            />
          )}
        </div>

        {/* Body — the actual item, formatted like a list row. */}
        <div className="px-4 pb-3.5 border-t border-xs border-border-soft pt-3">
          {preview ? (
            <div className="flex items-start gap-2.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${dotCls} flex-shrink-0 mt-1.5`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
                  {preview.text}
                </div>
                {preview.meta && (
                  <div className="text-[10px] text-text-tertiary mt-1 uppercase tracking-wider truncate">
                    {preview.meta}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-text-tertiary py-2">
              {emptyText}
            </div>
          )}
        </div>
      </button>
    </BentoCard>
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

  // "lists" — original Tasks + Meetings (power-user backdoor)
  return (
    <>
      <div className="col-span-7">
        <TasksComponent />
      </div>
      <div className="col-span-5">
        <Meetings />
      </div>
    </>
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
      const { data, error } = await supabase
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

  const openBugList = bugReports ?? [];
  const newCandidates = candidates ?? [];

  const revenueData = REAL_REVENUE_SERIES;

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* ── Row 1: Inbox cards — "what's waiting on you", real data ── */}
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
        <InboxCard
          label="Today's Meetings"
          icon={CalendarClock}
          count={todaysMeetings.length}
          accent="success"
          preview={
            todaysMeetings[0]
              ? {
                  text: todaysMeetings[0].meeting_title ?? "Untitled meeting",
                  meta: todaysMeetings[0].time ?? undefined,
                }
              : null
          }
          emptyText="Free today"
          to="/schedule"
          delay={0.15}
        />
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

      {/* ── Row 2: Area Chart (8 cols) + Tasks (4 cols) ── */}
      <BentoCard label="Revenue vs Expenses" span="col-span-8 row-span-2" delay={0.25} noPadding>
        <div className="px-4 pt-3 pb-2">
          <p className="text-[11px] text-muted-foreground">Last 8 months</p>
        </div>
        <div className="h-[280px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                {/* Revenue line now uses --success (positive green) so
                    rising revenue reads as "growth" instead of "alarm".
                    Fill is a soft glow — 10% top, 0% bottom — not a
                    heavy wall of color the old red gradient produced. */}
                <linearGradient id="cwa-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cwa-expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Area type="monotone" dataKey="expenses" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} fill="url(#cwa-expenses)" />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2.25} fill="url(#cwa-revenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      <TasksOverviewCard username={username} />

      {/* ── Row 3: role-split panels (two entirely different shapes) ──
          CEO/COO get the experimental Strategic Intelligence panel
          (Intelligence · Revenue · Mission Control · Daily Briefing).
          Everyone else gets the Member section — Team Activity feed
          + Quick Actions launcher. Two separate components, two
          separate philosophies; the gating happens here. */}
      <UserView userRole={[Role.CEO, Role.COO]}>
        <Row3Section />
      </UserView>
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
