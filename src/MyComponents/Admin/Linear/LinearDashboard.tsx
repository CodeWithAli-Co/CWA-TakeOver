/**
 * LinearDashboard.tsx — Admin-gated Linear operations surface.
 *
 * The /linear route mounts this for CEO + COO only. Mirrors the
 * Vercel admin dashboard's structure:
 *
 *   · Hero strip — workspace name + active cycle pill
 *   · AXON insights — heuristic observations across the issue set
 *   · KPI grid: Open · In Progress · Cycle progress · Blockers
 *   · Cycle progress strip — per-team active cycles with %
 *   · Issue groups — In Progress / To Do (priority-sorted) / Triage
 *   · IssueDrawer for full per-issue details
 *
 * Auto-polls every 30 seconds. Unconnected state surfaces a
 * "connect Linear" CTA.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RotateCw,
  Sparkles,
  Activity,
  Inbox,
  Zap,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useConnectors } from "@/stores/connectors";
import {
  linearListCycles,
  linearListIssues,
  linearMe,
  type LinearCycle,
  type LinearIssue,
  type LinearViewer,
} from "@/lib/linear";
import { InsightsCard } from "../Vercel/InsightsCard";
import { computeLinearInsights } from "./linearInsights";
import { IssueDrawer } from "./IssueDrawer";
import { Sparkline } from "../Vercel/Sparkline";

const POLL_MS = 30_000;

export function LinearDashboard() {
  const { data: connectors = [] } = useConnectors();
  const conn = useMemo(
    () => connectors.find((c) => c.kind === "linear" && c.status === "connected"),
    [connectors],
  );
  const token = (conn?.credentials as any)?.token as string | undefined;
  const [openId, setOpenId] = useState<string | null>(null);

  const viewerQ = useQuery<LinearViewer>({
    queryKey: ["linear-dashboard", "viewer", conn?.id ?? "none"],
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    queryFn: () => linearMe(token!),
  });

  const issuesQ = useQuery<LinearIssue[]>({
    queryKey: ["linear-dashboard", "issues", conn?.id ?? "none"],
    enabled: !!token,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: false,
    // Pull a healthy slice — 100 issues covers most teams. The
    // dashboard groups + filters in memory, so one big query is
    // cheaper than many small ones.
    queryFn: () => linearListIssues(token!, { limit: 100, includeCompleted: true }),
  });

  const cyclesQ = useQuery<LinearCycle[]>({
    queryKey: ["linear-dashboard", "cycles", conn?.id ?? "none"],
    enabled: !!token,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: false,
    queryFn: () => linearListCycles(token!, { limit: 20 }),
  });

  // ─── Derived data ──────────────────────────────────────────────

  const issues = issuesQ.data ?? [];
  const myEmail = viewerQ.data?.email;
  const myName = viewerQ.data?.name;

  const buckets = useMemo(() => {
    const inProgress = issues.filter((i) => i.state.type === "started");
    const todo = issues.filter((i) => i.state.type === "unstarted");
    const backlog = issues.filter((i) => i.state.type === "backlog");
    const triage = issues.filter((i) => i.state.type === "triage");
    const completed = issues.filter((i) => i.state.type === "completed");
    const blocked = issues.filter(
      (i) =>
        (i.state.type === "started" ||
          i.state.type === "unstarted" ||
          i.state.type === "backlog") &&
        i.labels?.nodes?.some((l) => /blocked|wait/i.test(l.name ?? "")),
    );
    return { inProgress, todo, backlog, triage, completed, blocked };
  }, [issues]);

  /** Mine first — operator's own work surfaces before the team's. */
  const sortMineFirst = (a: LinearIssue, b: LinearIssue) => {
    const aMine = a.assignee?.email === myEmail || a.assignee?.name === myName;
    const bMine = b.assignee?.email === myEmail || b.assignee?.name === myName;
    if (aMine && !bMine) return -1;
    if (bMine && !aMine) return 1;
    // Then by priority (lower number = higher priority in Linear)
    if (a.priority !== b.priority) {
      // Treat 0 (no priority) as lowest
      const ap = a.priority === 0 ? 99 : a.priority;
      const bp = b.priority === 0 ? 99 : b.priority;
      return ap - bp;
    }
    // Then by most-recently-updated
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  };

  /** Daily "closed" series for the sparkline. Last 30 days. */
  const dailyClosedSeries = useMemo(() => {
    const days = 30;
    const today = new Date();
    const dayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const series = new Array<number>(days).fill(0);
    for (const i of issues) {
      if (i.state.type !== "completed") continue;
      const t = Date.parse(i.updatedAt);
      const bucket = days - 1 - Math.floor((dayStart - t) / 86_400_000);
      if (bucket < 0 || bucket >= days) continue;
      series[bucket]! += 1;
    }
    return series;
  }, [issues]);

  /** AXON insights — heuristic engine over the issue set. */
  const insights = useMemo(() => computeLinearInsights(issues), [issues]);

  /** Active cycles, sorted with the operator's team(s) first. */
  const activeCycles = useMemo(() => {
    const now = Date.now();
    return (cyclesQ.data ?? [])
      .filter(
        (c) =>
          Date.parse(c.startsAt) <= now && Date.parse(c.endsAt) >= now,
      )
      .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  }, [cyclesQ.data]);

  const overallCycleProgress = useMemo(() => {
    if (activeCycles.length === 0) return null;
    const total = activeCycles.reduce((s, c) => s + c.progress, 0);
    return (total / activeCycles.length) * 100;
  }, [activeCycles]);

  // ─── Render ────────────────────────────────────────────────────

  if (!token) {
    return (
      <PageShell>
        <UnconnectedState />
      </PageShell>
    );
  }

  const isLoading = issuesQ.isLoading || cyclesQ.isLoading;
  const isError = !!(issuesQ.error || cyclesQ.error);

  return (
    <PageShell>
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary mb-1.5">
              Admin · Operations
            </p>
            <h1 className="text-[26px] font-bold text-foreground leading-tight">
              Linear
            </h1>
            <p className="text-[13px] text-text-secondary mt-1">
              {viewerQ.data ? (
                <>Live workspace pulse for <strong>{viewerQ.data.organization.name}</strong> · issues, cycles, and blockers across the team.</>
              ) : (
                "Live workspace pulse — issues, cycles, and blockers across the team."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeCycles.length > 0 && (
              <CyclePill cycles={activeCycles} overall={overallCycleProgress} />
            )}
            <button
              type="button"
              onClick={() => {
                issuesQ.refetch();
                cyclesQ.refetch();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] text-[11px] font-semibold text-foreground/85 transition-colors disabled:opacity-50"
              title="Refresh now"
            >
              <RotateCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <InsightsCard
        insights={insights.map((i) => ({
          id: i.id,
          severity: i.severity,
          line: i.line,
          detail: i.detail,
          category:
            i.category === "blockers"
              ? "regression"
              : i.category === "stale"
              ? "build-time"
              : i.category === "bottleneck"
              ? "regression"
              : i.category === "champion"
              ? "champion"
              : "velocity",
        }))}
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={Activity}
          label="In progress"
          value={buckets.inProgress.length.toString()}
          tone="neutral"
        />
        <KpiCard
          icon={ListTodo}
          label="Open (todo + backlog)"
          value={(buckets.todo.length + buckets.backlog.length).toString()}
          tone="neutral"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Closed (last 30d)"
          value={dailyClosedSeries.reduce((s, n) => s + n, 0).toString()}
          tone="up"
          sparklineValues={dailyClosedSeries}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Blocked"
          value={buckets.blocked.length.toString()}
          tone={buckets.blocked.length === 0 ? "up" : "warning"}
        />
      </div>

      {/* Per-team active cycles */}
      {activeCycles.length > 0 && (
        <Section
          title="Active cycles"
          subtitle={`${activeCycles.length} team${activeCycles.length === 1 ? "" : "s"} with a cycle in flight`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCycles.map((c) => (
              <CycleCard key={c.id} cycle={c} />
            ))}
          </div>
        </Section>
      )}

      {/* In Progress */}
      {buckets.inProgress.length > 0 && (
        <IssueGroup
          title="In Progress"
          subtitle="Active work — yours first"
          icon={Activity}
          tone="up"
          issues={[...buckets.inProgress].sort(sortMineFirst).slice(0, 12)}
          onOpen={setOpenId}
          myEmail={myEmail}
          myName={myName}
        />
      )}

      {/* To Do — priority-sorted */}
      {buckets.todo.length > 0 && (
        <IssueGroup
          title="To Do"
          subtitle="Up next — priority-sorted"
          icon={ListTodo}
          tone="neutral"
          issues={[...buckets.todo].sort(sortMineFirst).slice(0, 12)}
          onOpen={setOpenId}
          myEmail={myEmail}
          myName={myName}
        />
      )}

      {/* Triage */}
      {buckets.triage.length > 0 && (
        <IssueGroup
          title="Triage"
          subtitle="Needs a decision before it enters the flow"
          icon={Inbox}
          tone="warning"
          issues={buckets.triage.slice(0, 10)}
          onOpen={setOpenId}
          myEmail={myEmail}
          myName={myName}
        />
      )}

      {/* Empty / loading / error fallbacks */}
      {!isLoading && !isError && issues.length === 0 && (
        <EmptyState message="No issues yet. Once your team creates some in Linear, they'll appear here." />
      )}
      {isError && <ErrorState message="Linear API call failed. Check the connector token." />}
      {isLoading && issues.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading Linear…
        </div>
      )}

      {/* Issue drawer */}
      <IssueDrawer
        issue={openId ? issues.find((i) => i.id === openId) ?? null : null}
        onClose={() => setOpenId(null)}
      />
    </PageShell>
  );
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-6 py-6">{children}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <header className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-text-tertiary">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function CyclePill({
  cycles,
  overall,
}: {
  cycles: LinearCycle[];
  overall: number | null;
}) {
  const ending = cycles[0]!;
  const daysLeft = Math.ceil(
    (Date.parse(ending.endsAt) - Date.now()) / 86_400_000,
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-primary/30 bg-primary/[0.08] text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
      <Zap className="h-3 w-3" />
      Cycle {overall !== null ? `${Math.round(overall)}%` : ""} ·{" "}
      {daysLeft > 0 ? `${daysLeft}d left` : "ending today"}
    </span>
  );
}

function CycleCard({ cycle }: { cycle: LinearCycle }) {
  const daysLeft = Math.ceil(
    (Date.parse(cycle.endsAt) - Date.now()) / 86_400_000,
  );
  const pct = Math.round(cycle.progress * 100);
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] px-4 py-3">
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            {cycle.team.key}
          </p>
          <p className="text-[13px] font-semibold text-foreground truncate">
            {cycle.name ?? `Cycle ${cycle.number}`}
          </p>
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-foreground/80 shrink-0">
          {pct}%
        </span>
      </header>
      <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden mb-1.5">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-[10.5px] text-text-tertiary tabular-nums">
        {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "ending today"}
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  sparklineValues,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone: "up" | "watch" | "warning" | "neutral";
  sparklineValues?: number[];
}) {
  const toneCls =
    tone === "up"
      ? "text-success"
      : tone === "watch"
      ? "text-warning"
      : tone === "warning"
      ? "text-destructive"
      : "text-foreground";
  const showSparkline =
    !!sparklineValues &&
    sparklineValues.length > 1 &&
    sparklineValues.some((v) => v > 0);
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={`${toneCls} opacity-70`} />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className={`text-[20px] font-semibold tabular-nums leading-tight ${toneCls}`}>
          {value}
        </p>
        {showSparkline && (
          <div className={`${toneCls} opacity-80 shrink-0`}>
            <Sparkline
              values={sparklineValues!}
              width={70}
              height={20}
              ariaLabel={`${label} trend last 30 days`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function IssueGroup({
  title,
  subtitle,
  icon: Icon,
  tone,
  issues,
  onOpen,
  myEmail,
  myName,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "up" | "warning" | "neutral";
  issues: LinearIssue[];
  onOpen: (id: string) => void;
  myEmail?: string;
  myName?: string;
}) {
  const toneCls =
    tone === "up"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <Section title={title} subtitle={subtitle}>
      <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-xs border-border/10">
          <Icon size={11} className={toneCls} />
          <span className={`text-[10.5px] font-bold uppercase tracking-[0.14em] ${toneCls}`}>
            {title} · {issues.length}
          </span>
        </div>
        <div className="divide-y divide-border/10">
          {issues.map((i) => (
            <IssueRow
              key={i.id}
              issue={i}
              isMine={
                i.assignee?.email === myEmail || i.assignee?.name === myName
              }
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

function IssueRow({
  issue,
  isMine,
  onOpen,
}: {
  issue: LinearIssue;
  isMine: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(issue.id)}
      initial={{ opacity: 0, x: -2 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full text-left grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-foreground/[0.04] transition-colors"
    >
      <span className="col-span-2 text-[10.5px] font-mono uppercase tracking-[0.12em] text-text-tertiary tabular-nums">
        {issue.identifier}
      </span>
      <div className="col-span-7 min-w-0 flex items-center gap-2">
        <span
          className={`text-[12.5px] font-semibold truncate ${
            isMine ? "text-foreground" : "text-foreground/85"
          }`}
        >
          {issue.title}
        </span>
        {isMine && (
          <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-[0.14em] text-primary bg-primary/[0.12] border border-primary/30 rounded px-1 py-px">
            you
          </span>
        )}
      </div>
      <div className="col-span-2 text-[10.5px] text-text-tertiary truncate">
        {issue.assignee?.name ?? "—"}
      </div>
      <div className="col-span-1 flex justify-end">
        {issue.priority > 0 && issue.priority <= 2 && (
          <span
            className={`text-[9.5px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded border ${
              issue.priority === 1
                ? "text-destructive bg-destructive/12 border-destructive/30"
                : "text-warning bg-warning/12 border-warning/30"
            }`}
          >
            {issue.priorityLabel.slice(0, 3)}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function UnconnectedState() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 p-3 rounded-md bg-muted/40 border border-border w-fit">
          <Plug className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          Linear isn't connected
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Connect your Linear workspace in Settings → Connectors to see live cycles,
          issues, and blockers here.
        </p>
        <Link
          to={"/settings" as any}
          search={{ tab: "connectors" } as any}
          className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-3 w-3" /> Open connectors
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-xs border-dashed border-border-soft bg-foreground/[0.02] px-4 py-8 text-center">
      <p className="text-[12.5px] text-text-tertiary italic">{message}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-xs border-warning/30 bg-warning/[0.05] px-4 py-3 flex items-start gap-2">
      <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
      <span className="text-[12px] text-warning">{message}</span>
    </div>
  );
}

// Decorative — silences "unused" warnings for an icon we might
// promote in a follow-up polish.
void TrendingUp;

export default LinearDashboard;
