/**
 * VercelDashboard.tsx — Admin-gated Vercel operations surface.
 *
 * The /vercel route mounts this component for CEO + COO only. It
 * exists to answer every question a founder + technical co-founder
 * have about their deploys without ever opening the Vercel
 * dashboard:
 *
 *   · What's the production health right now? (hero pill)
 *   · How fast are we shipping? (this-week deploy count, success rate)
 *   · Did anything break recently? (failed deploys strip)
 *   · Per-project: latest prod state + last commit + build duration
 *   · Full feed of recent deploys with branch + commit + duration
 *   · Click any deploy row to open Vercel's inspector
 *
 * Architecture: pure React Query polling against the Vercel REST
 * client. 30-second stale window means the page feels live without
 * pounding Vercel's rate limits.
 *
 * Empty / unconnected state surfaces a "connect Vercel first" CTA
 * pointing at Settings → Connectors.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock,
  GitBranch,
  Globe,
  Loader2,
  Plug,
  RotateCw,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useConnectors } from "@/stores/connectors";
import {
  vercelListDeployments,
  vercelListProjects,
  type VercelDeployment,
  type VercelProject,
} from "@/lib/vercel";
import { Sparkline } from "./Sparkline";
import { DeploymentDrawer } from "./DeploymentDrawer";
import { computeInsights } from "./insights";
import { InsightsCard } from "./InsightsCard";

const POLL_MS = 30_000;
const PROJECT_LIMIT = 30;
const DEPLOY_LIMIT = 100;

export function VercelDashboard() {
  const { data: connectors = [] } = useConnectors();
  const conn = useMemo(
    () => connectors.find((c) => c.kind === "vercel" && c.status === "connected"),
    [connectors],
  );
  const token = (conn?.credentials as any)?.token as string | undefined;

  // Drawer state — which deployment, if any, is currently expanded.
  // Drawer is a sibling rendered at the end of the page; the rows
  // call setOpenUid(deployment.uid) on click.
  const [openUid, setOpenUid] = useState<string | null>(null);

  const projectsQ = useQuery<VercelProject[]>({
    queryKey: ["vercel-dashboard", "projects", conn?.id ?? "none"],
    enabled: !!token,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: false,
    queryFn: () => vercelListProjects(token!, { limit: PROJECT_LIMIT }),
  });

  const deploymentsQ = useQuery<VercelDeployment[]>({
    queryKey: ["vercel-dashboard", "deployments", conn?.id ?? "none"],
    enabled: !!token,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: false,
    queryFn: () => vercelListDeployments(token!, { limit: DEPLOY_LIMIT }),
  });

  const isLoading = projectsQ.isLoading || deploymentsQ.isLoading;
  const isError = !!(projectsQ.error || deploymentsQ.error);

  // ─── Derived data ────────────────────────────────────────────────

  /** Most recent production deploy per project. Drives the
   *  per-project status card grid. */
  const prodLatestByProject = useMemo(() => {
    const map = new Map<string, VercelDeployment>();
    for (const d of deploymentsQ.data ?? []) {
      if (d.target !== "production") continue;
      const existing = map.get(d.name);
      if (!existing || d.created > existing.created) map.set(d.name, d);
    }
    return map;
  }, [deploymentsQ.data]);

  /** Production health: green when every latest prod is READY,
   *  amber if any are BUILDING/QUEUED, red if any are ERROR. */
  const prodHealth = useMemo<"healthy" | "building" | "broken" | "unknown">(() => {
    const latests = Array.from(prodLatestByProject.values());
    if (latests.length === 0) return "unknown";
    if (latests.some((d) => d.state === "ERROR")) return "broken";
    if (latests.some((d) => d.state === "BUILDING" || d.state === "QUEUED" || d.state === "INITIALIZING")) return "building";
    return "healthy";
  }, [prodLatestByProject]);

  /** Last 7-day metrics: total deploys, success rate, avg build
   *  duration. Computed from the in-memory deploy list — fine while
   *  POLL_MS keeps the slice fresh. */
  const weekStats = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const week = (deploymentsQ.data ?? []).filter((d) => d.created >= cutoff);
    const totalDeploys = week.length;
    const completed = week.filter((d) => d.state === "READY" || d.state === "ERROR");
    const successful = week.filter((d) => d.state === "READY").length;
    const successRate =
      completed.length === 0 ? null : (successful / completed.length) * 100;

    // Avg build duration over READY deploys with timestamps.
    const durations = week
      .filter((d) => d.state === "READY" && d.ready && d.buildingAt)
      .map((d) => (d.ready! - d.buildingAt!) / 1000);
    const avgBuildSeconds =
      durations.length === 0
        ? null
        : durations.reduce((s, n) => s + n, 0) / durations.length;

    const last24h = (deploymentsQ.data ?? []).filter(
      (d) => d.created >= Date.now() - 86_400_000,
    );
    const failed24h = last24h.filter((d) => d.state === "ERROR").length;

    return { totalDeploys, successRate, avgBuildSeconds, failed24h };
  }, [deploymentsQ.data]);

  /** 30-day daily series for sparkline rendering. Two parallel
   *  arrays — `dailyDeploys` is the count of deploys finishing each
   *  day, `dailyBuildSeconds` is the average build time (READY only).
   *  Days with no data get 0 / null and the sparkline interpolates. */
  const dailySeries = useMemo(() => {
    const days = 30;
    const today = new Date();
    const dayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();

    const deployCounts = new Array<number>(days).fill(0);
    const buildSums = new Array<number>(days).fill(0);
    const buildCounts = new Array<number>(days).fill(0);

    for (const d of deploymentsQ.data ?? []) {
      // Bucket by day relative to today. Index 0 = 29 days ago,
      // index 29 = today.
      const bucket =
        days -
        1 -
        Math.floor((dayStart - d.created) / 86_400_000);
      if (bucket < 0 || bucket >= days) continue;
      deployCounts[bucket]! += 1;
      if (d.state === "READY" && d.ready && d.buildingAt) {
        buildSums[bucket]! += (d.ready - d.buildingAt) / 1000;
        buildCounts[bucket]! += 1;
      }
    }

    const dailyDeploys = deployCounts;
    const dailyBuildSeconds = buildSums.map((sum, i) =>
      buildCounts[i] === 0 ? 0 : sum / buildCounts[i]!,
    );

    return { dailyDeploys, dailyBuildSeconds };
  }, [deploymentsQ.data]);

  /** AXON insights — heuristic engine over the deploy list.
   *  Auto-hides when nothing notable. */
  const insights = useMemo(
    () => computeInsights(deploymentsQ.data ?? []),
    [deploymentsQ.data],
  );

  // ─── Render ──────────────────────────────────────────────────────

  if (!token) {
    return (
      <PageShell>
        <UnconnectedState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Hero strip — title + last refresh + prod health */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary mb-1.5">
              Admin · Operations
            </p>
            <h1 className="text-[26px] font-bold text-foreground leading-tight">
              Vercel
            </h1>
            <p className="text-[13px] text-text-secondary mt-1">
              Live production status, deploy velocity, and build health across every project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ProdHealthPill health={prodHealth} />
            <button
              type="button"
              onClick={() => {
                projectsQ.refetch();
                deploymentsQ.refetch();
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

      {/* AXON insights — heuristic observations over recent deploys.
       *  Renders above the KPIs because it's the "what should I care
       *  about?" answer the operator wants first. Auto-hides when
       *  there's nothing to surface. */}
      <InsightsCard insights={insights} />

      {/* KPI grid — sparklines render in the bottom-right of cards
       *  whose metrics naturally trend over time (deploys, build
       *  duration). Skip them on success-rate + 24h-failure where a
       *  30-day chart doesn't tell a useful story. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={Zap}
          label="Deploys this week"
          value={
            isLoading && weekStats.totalDeploys === 0
              ? "—"
              : weekStats.totalDeploys.toString()
          }
          tone="neutral"
          sparklineValues={dailySeries.dailyDeploys}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Success rate (7d)"
          value={
            weekStats.successRate === null
              ? "—"
              : `${Math.round(weekStats.successRate)}%`
          }
          tone={
            weekStats.successRate === null
              ? "neutral"
              : weekStats.successRate >= 95
              ? "up"
              : weekStats.successRate >= 80
              ? "watch"
              : "warning"
          }
        />
        <KpiCard
          icon={Clock}
          label="Avg build (7d)"
          value={
            weekStats.avgBuildSeconds === null
              ? "—"
              : formatDuration(weekStats.avgBuildSeconds)
          }
          tone="neutral"
          sparklineValues={dailySeries.dailyBuildSeconds}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Failed (24h)"
          value={weekStats.failed24h.toString()}
          tone={weekStats.failed24h === 0 ? "up" : "warning"}
        />
      </div>

      {/* Per-project production status — grid of cards */}
      <Section
        title="Production status"
        subtitle={`${prodLatestByProject.size} project${prodLatestByProject.size === 1 ? "" : "s"} with recent production deploys`}
      >
        {isError ? (
          <ErrorState message="Couldn't load Vercel projects." />
        ) : prodLatestByProject.size === 0 ? (
          <EmptyState
            message="No production deploys yet. Once a project ships to prod, it'll appear here."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {Array.from(prodLatestByProject.values())
              .sort((a, b) => b.created - a.created)
              .map((d) => (
                <ProductionStatusCard
                  key={d.uid}
                  deployment={d}
                  onOpen={setOpenUid}
                />
              ))}
          </div>
        )}
      </Section>

      {/* Recent failures — only render when there are any */}
      {(deploymentsQ.data ?? []).some(
        (d) => d.state === "ERROR" && d.created >= Date.now() - 86_400_000,
      ) && (
        <Section
          title="Recent failures (24h)"
          subtitle="Things that broke recently — investigate before they pile up."
          tone="warning"
        >
          <div className="space-y-2">
            {(deploymentsQ.data ?? [])
              .filter(
                (d) =>
                  d.state === "ERROR" && d.created >= Date.now() - 86_400_000,
              )
              .slice(0, 5)
              .map((d) => (
                <DeployRow
                  key={d.uid}
                  deployment={d}
                  emphasizeError
                  onOpen={setOpenUid}
                />
              ))}
          </div>
        </Section>
      )}

      {/* Full recent deploys feed */}
      <Section
        title="Recent deployments"
        subtitle={`${deploymentsQ.data?.length ?? 0} deploys · newest first · auto-refresh ${POLL_MS / 1000}s`}
      >
        {isLoading && (deploymentsQ.data?.length ?? 0) === 0 ? (
          <div className="flex items-center gap-2 py-12 justify-center text-[12px] text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading Vercel…
          </div>
        ) : (deploymentsQ.data?.length ?? 0) === 0 ? (
          <EmptyState message="No deployments yet." />
        ) : (
          <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] overflow-hidden">
            {/* Column headers — quiet caps */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary/80 border-b border-xs border-border/10">
              <div className="col-span-3">Project</div>
              <div className="col-span-3">Commit</div>
              <div className="col-span-2">Branch</div>
              <div className="col-span-1">Target</div>
              <div className="col-span-1">State</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-1 text-right">When</div>
            </div>
            <div className="divide-y divide-border/10">
              {(deploymentsQ.data ?? []).slice(0, 25).map((d) => (
                <DeployRow key={d.uid} deployment={d} onOpen={setOpenUid} />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Deployment detail drawer — slides in from the right when
       *  any row is clicked. Esc + backdrop click close. Mounting at
       *  this level (rather than per-row) means only one drawer is
       *  ever live, regardless of which row triggered it. */}
      <DeploymentDrawer
        deployment={
          openUid
            ? (deploymentsQ.data ?? []).find((d) => d.uid === openUid) ?? null
            : null
        }
        onClose={() => setOpenUid(null)}
        token={token}
        onRedeployed={() => deploymentsQ.refetch()}
      />

      {/* All projects — bottom directory */}
      <Section
        title="All projects"
        subtitle={`${projectsQ.data?.length ?? 0} project${projectsQ.data?.length === 1 ? "" : "s"} on the connected token`}
      >
        {isLoading && (projectsQ.data?.length ?? 0) === 0 ? (
          <div className="text-[11.5px] text-text-tertiary px-4 py-3">Loading…</div>
        ) : (
          <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] divide-y divide-border/10">
            {(projectsQ.data ?? [])
              .slice(0, 25)
              .map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  latestProd={prodLatestByProject.get(p.name)}
                />
              ))}
          </div>
        )}
      </Section>
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
  tone = "neutral",
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: "neutral" | "warning";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <header className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <h2
          className={`text-[15px] font-bold ${
            tone === "warning" ? "text-warning" : "text-foreground"
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11.5px] text-text-tertiary">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function ProdHealthPill({
  health,
}: {
  health: "healthy" | "building" | "broken" | "unknown";
}) {
  const meta =
    health === "healthy"
      ? {
          label: "All systems READY",
          icon: CheckCircle2,
          cls: "text-success bg-success/12 border-success/30",
        }
      : health === "building"
      ? {
          label: "Builds in flight",
          icon: Loader2,
          cls: "text-warning bg-warning/12 border-warning/30",
          spin: true,
        }
      : health === "broken"
      ? {
          label: "Production broken",
          icon: XCircle,
          cls: "text-destructive bg-destructive/12 border-destructive/30",
        }
      : {
          label: "No prod deploys yet",
          icon: AlertCircle,
          cls: "text-text-tertiary bg-foreground/[0.05] border-border-soft",
        };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-[0.12em] ${meta.cls}`}
    >
      <Icon className={`h-3 w-3 ${(meta as any).spin ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
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
  /** Optional 30-day series. When present, renders a tiny inline
   *  trend chart in the bottom-right corner of the card. */
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
  // Only render the sparkline when there's signal — all zeros
  // looks like the chart is broken, so suppress it.
  const showSparkline =
    !!sparklineValues &&
    sparklineValues.length > 1 &&
    sparklineValues.some((v) => v > 0);
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <Icon size={11} className={`${toneCls} opacity-70`} />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            {label}
          </span>
        </div>
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

function ProductionStatusCard({
  deployment,
  onOpen,
}: {
  deployment: VercelDeployment;
  onOpen: (uid: string) => void;
}) {
  const commit = deployment.meta?.githubCommitMessage as string | undefined;
  const branch = deployment.meta?.githubCommitRef as string | undefined;
  const author = deployment.meta?.githubCommitAuthorName as string | undefined;
  const duration =
    deployment.ready && deployment.buildingAt
      ? (deployment.ready - deployment.buildingAt) / 1000
      : null;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(deployment.uid)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-left w-full block rounded-xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-foreground/15 transition-colors p-3 group"
    >
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground truncate">
            {deployment.name}
          </p>
          <p className="text-[10.5px] text-text-tertiary truncate">
            {deployment.url}
          </p>
        </div>
        <StateBadge state={deployment.state} />
      </header>

      {commit && (
        <p className="text-[11.5px] text-foreground/80 line-clamp-2 leading-snug mb-1.5">
          {commit}
        </p>
      )}

      <div className="flex items-center gap-2.5 text-[10.5px] text-text-tertiary flex-wrap">
        {branch && (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-2.5 w-2.5" />
            {branch}
          </span>
        )}
        {duration !== null && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(duration)}
          </span>
        )}
        <span className="tabular-nums ml-auto">{relativeTime(deployment.created)}</span>
      </div>

      {author && (
        <p className="text-[10px] text-text-tertiary/70 mt-1 truncate">by {author}</p>
      )}

    </motion.button>
  );
}

function ProjectRow({
  project,
  latestProd,
}: {
  project: VercelProject;
  latestProd?: VercelDeployment;
}) {
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        <Box className="h-3 w-3 text-text-tertiary shrink-0" />
        <span className="text-[12.5px] font-semibold text-foreground truncate">
          {project.name}
        </span>
      </div>
      <div className="col-span-3 text-[11.5px] text-text-tertiary truncate">
        {project.framework ?? "—"}
      </div>
      <div className="col-span-3 text-[11.5px] text-text-tertiary truncate">
        {project.link?.repo ?? "—"}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        {latestProd ? (
          <>
            <StateBadge state={latestProd.state} compact />
            <span className="text-[10.5px] text-text-tertiary tabular-nums">
              {relativeTime(latestProd.created)}
            </span>
          </>
        ) : (
          <span className="text-[10.5px] text-text-tertiary">no prod deploy</span>
        )}
      </div>
    </div>
  );
}

function DeployRow({
  deployment,
  emphasizeError,
  onOpen,
}: {
  deployment: VercelDeployment;
  emphasizeError?: boolean;
  onOpen: (uid: string) => void;
}) {
  const commit = deployment.meta?.githubCommitMessage as string | undefined;
  const branch = deployment.meta?.githubCommitRef as string | undefined;
  const duration =
    deployment.ready && deployment.buildingAt
      ? (deployment.ready - deployment.buildingAt) / 1000
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(deployment.uid)}
      className={`w-full text-left grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-foreground/[0.04] transition-colors ${
        emphasizeError
          ? "bg-destructive/[0.05] border border-destructive/15 rounded-lg"
          : ""
      }`}
    >
      <div className="col-span-12 md:col-span-3 flex items-center gap-2 min-w-0">
        <span className="text-[12.5px] font-semibold text-foreground truncate">
          {deployment.name}
        </span>
      </div>
      <div className="col-span-12 md:col-span-3 text-[11.5px] text-foreground/80 truncate">
        {commit ?? <span className="text-text-tertiary italic">no commit msg</span>}
      </div>
      <div className="col-span-6 md:col-span-2 text-[11px] text-text-tertiary truncate inline-flex items-center gap-1">
        {branch && <GitBranch className="h-2.5 w-2.5" />}
        {branch ?? "—"}
      </div>
      <div className="col-span-3 md:col-span-1">
        <TargetBadge target={deployment.target} />
      </div>
      <div className="col-span-3 md:col-span-1">
        <StateBadge state={deployment.state} compact />
      </div>
      <div className="col-span-3 md:col-span-1 text-[11px] tabular-nums text-text-tertiary">
        {duration === null ? "—" : formatDuration(duration)}
      </div>
      <div className="col-span-3 md:col-span-1 text-[11px] tabular-nums text-text-tertiary text-right">
        {relativeTime(deployment.created)}
      </div>
    </button>
  );
}

function StateBadge({
  state,
  compact,
}: {
  state: VercelDeployment["state"];
  compact?: boolean;
}) {
  const meta = stateToMeta(state);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] border ${meta.cls}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dotCls} ${
          state === "BUILDING" || state === "QUEUED" || state === "INITIALIZING"
            ? "animate-pulse"
            : ""
        }`}
      />
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

function TargetBadge({ target }: { target: VercelDeployment["target"] }) {
  if (target === "production") {
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-primary">
        <Globe className="h-2.5 w-2.5" /> prod
      </span>
    );
  }
  if (target === "preview") {
    return (
      <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        preview
      </span>
    );
  }
  return <span className="text-[10px] text-text-tertiary">—</span>;
}

function UnconnectedState() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 p-3 rounded-md bg-muted/40 border border-border w-fit">
          <Plug className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          Vercel isn't connected
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Connect your Vercel account in Settings → Connectors to see live deploy
          status, build velocity, and per-project health here.
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

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function stateToMeta(state: VercelDeployment["state"]) {
  switch (state) {
    case "READY":
      return {
        label: "Ready",
        shortLabel: "Ready",
        cls: "text-success bg-success/12 border-success/30",
        dotCls: "bg-success",
      };
    case "ERROR":
      return {
        label: "Error",
        shortLabel: "Error",
        cls: "text-destructive bg-destructive/12 border-destructive/30",
        dotCls: "bg-destructive",
      };
    case "BUILDING":
      return {
        label: "Building",
        shortLabel: "Build",
        cls: "text-warning bg-warning/12 border-warning/30",
        dotCls: "bg-warning",
      };
    case "QUEUED":
      return {
        label: "Queued",
        shortLabel: "Queue",
        cls: "text-warning bg-warning/12 border-warning/30",
        dotCls: "bg-warning",
      };
    case "INITIALIZING":
      return {
        label: "Initializing",
        shortLabel: "Init",
        cls: "text-warning bg-warning/12 border-warning/30",
        dotCls: "bg-warning",
      };
    case "CANCELED":
      return {
        label: "Canceled",
        shortLabel: "Cancel",
        cls: "text-text-tertiary bg-foreground/[0.05] border-border-soft",
        dotCls: "bg-text-tertiary",
      };
    default:
      return {
        label: state,
        shortLabel: state,
        cls: "text-text-tertiary bg-foreground/[0.05] border-border-soft",
        dotCls: "bg-text-tertiary",
      };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

// Decorative — silences "unused" warnings for an icon I might
// promote in a follow-up polish.
void TrendingUp;

export default VercelDashboard;
