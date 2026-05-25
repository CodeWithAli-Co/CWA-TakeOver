/**
 * RepoTabs.tsx — Issues / Actions / Insights tabs for the repo
 * view. All three live here so CodePage can import a single
 * module + the tab visual language stays consistent.
 *
 * Data is mocked from mockData.ts; the shapes match the
 * migrations (code_init.sql + code_issues.sql) so wiring to
 * Supabase is a `select` swap when we get there.
 */

import { useMemo, useState } from "react";
import {
  Search, AlertCircle, CheckCircle2, MessageSquare, Tag, Sparkles,
  Activity, Play, GitCommit, GitPullRequest, X, Clock,
  BarChart3, TrendingUp, Users, Plus,
} from "lucide-react";
import {
  MOCK_ISSUES, MOCK_LABELS, MOCK_AGENT_RUNS, MOCK_COMMITS, MOCK_PRS,
  MOCK_AGENTS, MOCK_FILES,
  agentById, labelById,
  type Repo, type Issue, type AgentRun, type AgentRunStep,
} from "./mockData";

// ════════════════════════════════════════════════════════════════
// ISSUES TAB
// ════════════════════════════════════════════════════════════════

export function IssuesTab({ repo }: { repo: Repo }) {
  const all = useMemo(
    () => MOCK_ISSUES.filter((i) => i.repoId === repo.id),
    [repo.id],
  );
  const labels = MOCK_LABELS.filter((l) => l.repoId === repo.id);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (labelFilter !== "all" && !i.labelIds.includes(labelFilter)) return false;
      if (q && !`${i.title} ${i.body}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, statusFilter, labelFilter, search]);

  const counts = {
    open: all.filter((i) => i.status === "open").length,
    closed: all.filter((i) => i.status === "closed").length,
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
        {/* Status segmented control */}
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {([
            ["open",   "Open",   counts.open],
            ["closed", "Closed", counts.closed],
            ["all",    "All",    all.length],
          ] as const).map(([v, label, n]) => {
            const active = statusFilter === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                className={[
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-sm transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
                <span className={`font-mono text-[9.5px] ${active ? "text-primary" : "text-muted-foreground/70"}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {/* Label filter */}
        <select
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/85 outline-none hover:bg-muted/40 cursor-pointer"
        >
          <option value="all">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative ml-auto w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-[12px] outline-none focus:border-foreground/30"
          />
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New issue
        </button>
      </div>

      <ul className="divide-y divide-border">
        {visible.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
        {visible.length === 0 && (
          <li className="px-6 py-12 text-center text-[12px] text-muted-foreground">
            No issues in this view.
          </li>
        )}
      </ul>
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const author = agentById(issue.authorAgentId);
  const assignee = agentById(issue.assigneeAgentId);
  const StatusIcon = issue.status === "open" ? AlertCircle : CheckCircle2;
  const statusColor = issue.status === "open" ? "text-emerald-400" : "text-violet-400";
  const isAi = !!issue.authorAgentId;

  return (
    <li className="px-6 py-3 hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer">
      <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-foreground tracking-tight">
            {issue.title}
          </p>
          {isAi && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {issue.labelIds.map((lid) => {
            const l = labelById(lid);
            if (!l) return null;
            return (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest"
                style={{
                  borderColor: `hsl(${l.colorHsl} / 0.45)`,
                  background:  `hsl(${l.colorHsl} / 0.10)`,
                  color:       `hsl(${l.colorHsl})`,
                }}
              >
                <Tag className="h-2.5 w-2.5" />
                {l.name}
              </span>
            );
          })}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono text-foreground/70">#{issue.number}</span>{" "}
          opened {timeAgo(issue.createdAt)} by{" "}
          {author ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: `hsl(${author.accentHsl})` }} />
              <span className="text-foreground/85 font-medium">{author.displayName}</span>
            </span>
          ) : (
            <span className="text-foreground/85 font-medium">{issue.authorUsername}</span>
          )}
          {assignee && (
            <>
              {" · assigned to "}
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: `hsl(${assignee.accentHsl})` }} />
                <span className="text-foreground/85 font-medium">{assignee.displayName}</span>
              </span>
            </>
          )}
        </p>
      </div>
      {issue.commentCount > 0 && (
        <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {issue.commentCount}
        </span>
      )}
    </li>
  );
}

// ════════════════════════════════════════════════════════════════
// ACTIONS TAB — AI agent run log
// ════════════════════════════════════════════════════════════════

export function ActionsTab({ repo }: { repo: Repo }) {
  const runs = useMemo(
    () => MOCK_AGENT_RUNS.filter((r) => r.repoId === repo.id),
    [repo.id],
  );
  const [statusFilter, setStatusFilter] = useState<"all" | AgentRun["status"]>("all");

  const visible = runs.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter,
  );

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {(["all", "running", "succeeded", "failed", "canceled"] as const).map((v) => {
            const active = statusFilter === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                className={[
                  "px-2.5 py-1 text-[11px] font-semibold rounded-sm capitalize transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {v}
              </button>
            );
          })}
        </div>
        <p className="ml-auto font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
          {visible.length} runs
        </p>
      </div>

      <ul className="px-6 py-4 space-y-3">
        {visible.map((run) => (
          <AgentRunCard key={run.id} run={run} />
        ))}
        {visible.length === 0 && (
          <li className="text-center text-[12px] text-muted-foreground py-12">
            No runs in this view.
          </li>
        )}
      </ul>
    </div>
  );
}

function AgentRunCard({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(run.status === "running" || run.status === "failed");
  const agent = agentById(run.agentId);

  const statusMeta = {
    running:   { Icon: Play,          cls: "border-blue-500/40 bg-blue-500/10 text-blue-300",       label: "Running" },
    succeeded: { Icon: CheckCircle2,  cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", label: "Succeeded" },
    failed:    { Icon: X,             cls: "border-red-500/40 bg-red-500/10 text-red-300",         label: "Failed" },
    canceled:  { Icon: X,             cls: "border-border bg-muted/40 text-muted-foreground",       label: "Canceled" },
  }[run.status];
  const StatusIcon = statusMeta.Icon;

  return (
    <li className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest shrink-0 ${statusMeta.cls}`}>
          {run.status === "running"
            ? <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
              </span>
            : <StatusIcon className="h-2.5 w-2.5" />}
          {statusMeta.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground tracking-tight">
            {run.title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground inline-flex items-center gap-2 flex-wrap">
            {agent && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: `hsl(${agent.accentHsl})` }} />
                <span className="text-foreground/85 font-medium">{agent.displayName}</span>
              </span>
            )}
            <span className="opacity-50">·</span>
            <span className="capitalize">{run.trigger}</span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(run.startedAt)}
            </span>
            {run.durationMs && (
              <>
                <span className="opacity-50">·</span>
                <span className="font-mono">{formatDuration(run.durationMs)}</span>
              </>
            )}
            {run.outputRef?.kind === "pr" && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <GitPullRequest className="h-3 w-3" />
                  #{run.outputRef.prNumber}
                </span>
              </>
            )}
            {run.outputRef?.kind === "commit" && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1 text-primary font-mono">
                  <GitCommit className="h-3 w-3" />
                  {run.outputRef.sha?.slice(0, 7)}
                </span>
              </>
            )}
          </p>
        </div>
      </button>

      {open && (
        <ul className="border-t border-border bg-muted/20 px-4 py-3 space-y-1.5">
          {run.steps.map((step, i) => (
            <RunStepRow key={i} step={step} />
          ))}
        </ul>
      )}
    </li>
  );
}

function RunStepRow({ step }: { step: AgentRunStep }) {
  const meta = {
    succeeded: { Icon: CheckCircle2, cls: "text-emerald-400" },
    failed:    { Icon: X,            cls: "text-red-400" },
    skipped:   { Icon: X,            cls: "text-muted-foreground/50" },
  }[step.status];
  const Icon = meta.Icon;
  return (
    <li className="flex items-center gap-2 text-[11.5px]">
      <Icon className={`h-3 w-3 shrink-0 ${meta.cls}`} />
      <span className={step.status === "skipped" ? "text-muted-foreground/70 line-through" : "text-foreground/85"}>
        {step.label}
      </span>
      {step.durationMs > 0 && (
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {formatDuration(step.durationMs)}
        </span>
      )}
    </li>
  );
}

// ════════════════════════════════════════════════════════════════
// INSIGHTS TAB — commit + agent stats
// ════════════════════════════════════════════════════════════════

export function InsightsTab({ repo }: { repo: Repo }) {
  // Commit frequency over the last 30 days, bucketed by day. For
  // the mock we synthesize a roughly-realistic distribution from
  // the commits we have.
  const commitsByDay = useMemo(() => {
    const buckets = new Array(30).fill(0);
    const repoCommits = MOCK_COMMITS.filter((c) => c.repoId === repo.id);
    const now = Date.now();
    for (const c of repoCommits) {
      const daysAgo = Math.floor((now - new Date(c.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      if (daysAgo >= 0 && daysAgo < 30) buckets[29 - daysAgo]++;
    }
    // Pad with synthetic activity so the chart doesn't read empty
    // — real wiring removes this.
    for (let i = 0; i < 30; i++) {
      if (buckets[i] === 0) buckets[i] = Math.floor(Math.random() * (i > 22 ? 8 : 4));
    }
    return buckets;
  }, [repo.id]);
  const maxCommits = Math.max(...commitsByDay, 1);

  // Per-agent contribution stats — commits, PRs, lines changed.
  const agentStats = useMemo(() => {
    return MOCK_AGENTS.map((a) => {
      const commits = MOCK_COMMITS.filter(
        (c) => c.repoId === repo.id && c.authorAgentId === a.id,
      );
      const prs = MOCK_PRS.filter(
        (p) => p.repoId === repo.id && p.authorAgentId === a.id,
      );
      const lines = commits.reduce((s, c) => s + c.additions + c.deletions, 0);
      return {
        agent: a,
        commits: commits.length,
        prs: prs.length,
        lines,
      };
    });
  }, [repo.id]);

  // Files touched per agent — heatmap rows.
  const filesByAgent = useMemo(() => {
    const files = MOCK_FILES.filter((f) => f.repoId === repo.id);
    return MOCK_AGENTS.map((a) => ({
      agent: a,
      files: files.filter((f) => f.lastModifiedAgentId === a.id),
    }));
  }, [repo.id]);

  const prThroughput = useMemo(() => {
    const prs = MOCK_PRS.filter((p) => p.repoId === repo.id);
    return {
      open:   prs.filter((p) => p.status === "open" || p.status === "draft").length,
      merged: prs.filter((p) => p.status === "merged").length,
      closed: prs.filter((p) => p.status === "closed").length,
    };
  }, [repo.id]);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-8">
        {/* ── Commit frequency ──────────────────────────────────── */}
        <Section icon={BarChart3} title="Commit frequency" subtitle="Last 30 days">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-end gap-1 h-32">
              {commitsByDay.map((count, i) => {
                const pct = (count / maxCommits) * 100;
                return (
                  <div
                    key={i}
                    title={`${count} commit${count === 1 ? "" : "s"}, ${29 - i} day${29 - i === 1 ? "" : "s"} ago`}
                    className="flex-1 rounded-sm bg-primary/60 hover:bg-primary transition-colors min-h-[2px]"
                    style={{ height: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground/70">
              <span>30 days ago</span>
              <span>today</span>
            </div>
          </div>
        </Section>

        {/* ── Agent contributions ───────────────────────────────── */}
        <Section icon={Users} title="Agent contributions" subtitle="Who's writing what">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80">Agent</th>
                  <th className="px-2 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 text-right">Commits</th>
                  <th className="px-2 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 text-right">PRs opened</th>
                  <th className="px-2 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 text-right">Lines changed</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map(({ agent, commits, prs, lines }) => (
                  <tr key={agent.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${agent.accentHsl})` }} />
                        <span className="font-semibold text-foreground">{agent.displayName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground/90">{commits}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground/90">{prs}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground/90">{lines.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── File ownership heatmap ────────────────────────────── */}
        <Section icon={TrendingUp} title="File ownership" subtitle="Which agent has touched which files recently">
          <div className="space-y-2">
            {filesByAgent.map(({ agent, files }) => (
              <div key={agent.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${agent.accentHsl})` }} />
                  <span className="text-[12.5px] font-semibold text-foreground">{agent.displayName}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {files.length} file{files.length === 1 ? "" : "s"}
                  </span>
                </div>
                {files.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {files.map((f) => (
                      <li
                        key={f.id}
                        className="font-mono text-[10.5px] rounded border border-border bg-muted/40 px-2 py-0.5 text-foreground/85"
                      >
                        {f.path.split("/").pop()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No recent file modifications attributed to this agent.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ── PR throughput ─────────────────────────────────────── */}
        <Section icon={GitPullRequest} title="PR throughput">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Open"   value={prThroughput.open}   tone="emerald" />
            <StatTile label="Merged" value={prThroughput.merged} tone="violet" />
            <StatTile label="Closed" value={prThroughput.closed} tone="zinc" />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: typeof BarChart3;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            · {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "violet" | "zinc";
}) {
  const cls =
    tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
  : tone === "violet"  ? "border-violet-500/40 bg-violet-500/5 text-violet-300"
  : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] opacity-80">{label}</p>
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// Silence imports kept for the row UI but not yet referenced.
void Activity;
