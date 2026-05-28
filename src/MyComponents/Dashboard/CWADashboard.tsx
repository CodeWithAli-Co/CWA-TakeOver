/**
 * CWA Dashboard — Black & Red bento grid for CodeWithAli.
 * Shows agency metrics, projects, revenue, team, and an area chart.
 */
import { BentoCard, BentoValue } from "./BentoCard";
import { TasksOverviewCard } from "./TasksOverviewCard";
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
  FolderGit2,
  DollarSign,
  TrendingUp,
  Clock,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  Bug,
  CalendarClock,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { ActiveUser, Employees, Todos, MeetingsQuery } from "@/stores/query";
import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import {
  useDemoMode,
  DEMO_STATS,
  DEMO_REVENUE_SERIES,
  DEMO_PROJECTS,
} from "@/stores/demoMode";
import { useCandidates } from "@/MyComponents/Hiring/recruitingQueries";
import { useWorkspaceResources } from "@/stores/workspace";

// Real revenue series — kept in real units so a future financial-context
// wiring slots in without us changing the y-axis logic.
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

// Short "now / 5m ago / 2h ago / 3d ago" formatter — used by the
// Recent Workspace Activity tiles.
function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const REAL_PROJECTS = [
  { name: "Simplicity",   status: "In Progress", progress: 72 },
  { name: "CWA Invoicer", status: "Active",      progress: 85 },
  { name: "Mario Hauling",status: "Active",      progress: 60 },
  { name: "Registry Site",status: "Planning",    progress: 20 },
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

function CWADashboardContent() {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";
  const { data: todos } = Todos("all");
  const { data: myTodos } = Todos(username);
  const { data: meetings } = MeetingsQuery();
  const { data: candidates } = useCandidates({ status: "applied", limit: 20 });
  const demoMode = useDemoMode((s) => s.enabled);

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

  // Quick Stats — real data sources, drops the dummy Git Commits since
  // there's no GitHub integration yet. Replaces with Workspace docs
  // edited this week so the slot reflects actual team activity.
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const { data: chatMsgCount } = useQuery({
    queryKey: ["dashboard", "chat-message-count"],
    queryFn: async () => {
      const [g, dm] = await Promise.all([
        supabase.from("cwa_chat").select("msg_id", { count: "exact", head: true }),
        supabase.from("cwa_dm_chat").select("msg_id", { count: "exact", head: true }),
      ]);
      return (g.count ?? 0) + (dm.count ?? 0);
    },
  });

  const { data: hoursThisWeek } = useQuery({
    queryKey: ["dashboard", "hours-this-week"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("clock_in, clock_out, status")
        .eq("status", "completed")
        .gte("clock_in", sevenDaysAgo);
      if (error) return 0;
      const totalMs = (data ?? []).reduce((sum: number, s: any) => {
        if (!s.clock_in || !s.clock_out) return sum;
        return sum + (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime());
      }, 0);
      return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
    },
  });

  const { data: workspaceEditsThisWeek } = useQuery({
    queryKey: ["dashboard", "workspace-edits-this-week"],
    queryFn: async () => {
      const [docs, sheets] = await Promise.all([
        supabase
          .from("workspace_documents")
          .select("id", { count: "exact", head: true })
          .gte("updated_at", sevenDaysAgo)
          .eq("archived", false),
        supabase
          .from("workspace_spreadsheets")
          .select("id", { count: "exact", head: true })
          .gte("updated_at", sevenDaysAgo)
          .eq("archived", false),
      ]);
      return (docs.count ?? 0) + (sheets.count ?? 0);
    },
  });

  // Recent Workspace Activity — replaces the previously-hardcoded
  // "Active Projects" tiles with real, recently-edited docs + sheets.
  // The /workspace product is where people actually do work; surfacing
  // the latest edits is far more useful than a dummy progress bar.
  const { data: workspaceItems = [] } = useWorkspaceResources();
  const recentWorkspace = useMemo(
    () => workspaceItems.slice(0, 4),
    [workspaceItems],
  );

  // Demo mode still feeds the chart for pitch rehearsals.
  const revenueData = demoMode ? DEMO_REVENUE_SERIES : REAL_REVENUE_SERIES;

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

      {/* ── Row 3: Quick Links ── */}
      <BentoCard label="Activity (7d)" span="col-span-4" delay={0.35}>
        {/* Real numbers, time-bounded. Drops the dummy "Git Commits"
            since there's no GitHub integration yet — replaces with
            workspace doc/sheet edits in the same period, which is
            what the team actually does on this app. */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Chat messages</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {(chatMsgCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Workspace edits</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {workspaceEditsThisWeek ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Hours tracked</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {hoursThisWeek != null ? `${hoursThisWeek}h` : "—"}
            </span>
          </div>
        </div>
      </BentoCard>

      <BentoCard label="Recent Workspace Activity" span="col-span-8" delay={0.4}>
        {recentWorkspace.length === 0 ? (
          <div className="text-[12px] text-text-tertiary py-2">
            Nothing edited yet. Open the Workspace to start a doc or sheet.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {recentWorkspace.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onClick={() =>
                  navigate({
                    to:
                      r.kind === "document"
                        ? "/workspace/docs/$id"
                        : "/workspace/sheets/$id",
                    params: { id: r.id },
                  } as any)
                }
                className="text-left p-3 rounded-lg border-xs border-border-soft bg-background/40 hover:bg-background/60 transition-colors min-w-0"
              >
                <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider mb-1.5">
                  <span
                    className={`w-1 h-1 rounded-full ${
                      r.kind === "document" ? "bg-primary" : "bg-success"
                    }`}
                  />
                  <span className="text-text-tertiary">
                    {r.kind === "document" ? "Doc" : "Sheet"}
                  </span>
                </div>
                <p className="text-[12.5px] font-medium text-foreground truncate">
                  {r.title || "Untitled"}
                </p>
                <p className="text-[10px] text-text-tertiary mt-1 truncate">
                  {r.updated_by ?? r.owner} · {formatRelativeShort(r.updated_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </BentoCard>

      {/* ── Row 4: Full Tasks + Meetings widgets ── */}
      <div className="col-span-7">
        <TasksComponent />
      </div>
      <div className="col-span-5">
        <Meetings />
      </div>
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
