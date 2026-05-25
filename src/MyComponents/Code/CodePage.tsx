/**
 * CodePage.tsx — /code surface. GitHub-lookalike code dashboard
 * for AI-generated codebases. Lean, dense, theme-aware.
 *
 * Two views, controlled by internal state (no nested routes
 * needed for the first pass):
 *   · "dashboard" — grid of repos + AI activity feed on the side
 *   · "repo"      — single repo with the GitHub 6-tab nav
 *                   (Code / Issues / Pulls / Actions / Insights / Settings)
 *
 * All data is mocked from mockData.ts. When we wire Supabase
 * the component reads stay shape-compatible — the migration in
 * code_init.sql mirrors the mock interfaces.
 *
 * Sub-components live inline to keep the import/export surface
 * tight while iterating. Will pull them into their own files
 * once the shape stabilises.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUp, ArrowDown, Search, Star, GitBranch, GitCommit,
  GitPullRequest, GitMerge, GitPullRequestDraft, MessageSquare,
  Code as CodeIcon, AlertCircle, Activity, Settings, BarChart3,
  Folder, FileText, FileCode, ChevronRight, Sparkles, Clock,
  CheckCircle2, XCircle, Hash, Plus, Download, Lock, Eye, EyeOff,
} from "lucide-react";
import {
  MOCK_REPOS, MOCK_PRS, MOCK_COMMITS, MOCK_FILES, MOCK_ACTIVITY,
  agentById,
  type Repo, type AiAgent, type PullRequest, type CommitRow,
  type FileRow, type ActivityItem,
} from "./mockData";
import { PullRequestDetail } from "./PullRequestDetail";
import { AgentAutonomyPanel } from "./AgentAutonomyPanel";
import { IssuesTab, ActionsTab, InsightsTab } from "./RepoTabs";

type RepoTab = "code" | "issues" | "pulls" | "actions" | "insights" | "settings";

export function CodePage() {
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RepoTab>("code");
  /** When set, the Pulls tab shows the PR detail view instead of
   * the list. Clearing it pops back to the list without leaving
   * the repo or losing the tab. */
  const [activePrId, setActivePrId] = useState<string | null>(null);

  const activeRepo = activeRepoId
    ? MOCK_REPOS.find((r) => r.id === activeRepoId) ?? null
    : null;
  const activePr = activePrId
    ? MOCK_PRS.find((p) => p.id === activePrId) ?? null
    : null;

  return (
    <div className="h-svh min-h-0 flex flex-col bg-background overflow-hidden">
      {activeRepo ? (
        <RepoView
          repo={activeRepo}
          tab={activeTab}
          onTabChange={(t) => { setActiveTab(t); setActivePrId(null); }}
          onBack={() => { setActiveRepoId(null); setActivePrId(null); }}
          activePr={activePr}
          onOpenPr={setActivePrId}
          onClosePr={() => setActivePrId(null)}
        />
      ) : (
        <CodeDashboard onPickRepo={(id) => {
          setActiveRepoId(id);
          setActiveTab("code");
          setActivePrId(null);
        }} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD — grid of repos + AI activity feed sidebar
// ════════════════════════════════════════════════════════════════

function CodeDashboard({ onPickRepo }: { onPickRepo: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_REPOS.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.owner} ${r.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, statusFilter]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Main column — repo grid */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <header className="border-b border-border bg-card/40 sticky top-0 z-10 backdrop-blur">
          <div className="px-8 py-5 flex items-center gap-4">
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                § Code
              </p>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-foreground leading-none">
                Repositories
              </h1>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              {visible.length} {visible.length === 1 ? "repo" : "repos"} · AI-attributed
            </p>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a repository…"
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-[12px] outline-none focus:border-foreground/30"
                />
              </div>
              <SegmentedStatus value={statusFilter} onChange={setStatusFilter} />
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New repo
              </button>
            </div>
          </div>
        </header>

        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((r) => (
            <RepoCard key={r.id} repo={r} onOpen={() => onPickRepo(r.id)} />
          ))}
          {visible.length === 0 && (
            <div className="col-span-full flex items-center justify-center p-16 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40">
                  <CodeIcon className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="mt-4 text-[13px] font-semibold text-foreground">No repositories</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Adjust the filters or create a new repo.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right rail — AI activity feed */}
      <aside className="w-[320px] shrink-0 border-l border-border bg-card/30 hidden xl:flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
            § Activity
          </p>
          <h2 className="mt-0.5 text-[13px] font-semibold text-foreground tracking-tight">
            AI agents · live
          </h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {MOCK_ACTIVITY.map((a) => (
            <ActivityRow key={a.id} item={a} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function SegmentedStatus({
  value, onChange,
}: {
  value: "active" | "archived" | "all";
  onChange: (v: "active" | "archived" | "all") => void;
}) {
  const opts: Array<{ v: typeof value; label: string }> = [
    { v: "active", label: "Active" },
    { v: "archived", label: "Archived" },
    { v: "all", label: "All" },
  ];
  return (
    <div className="flex rounded-md border border-border bg-background p-0.5">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={[
              "px-2.5 py-1 text-[11px] font-semibold rounded-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RepoCard({ repo, onOpen }: { repo: Repo; onOpen: () => void }) {
  const agent = agentById(repo.lastCommitAgentId);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card hover:border-foreground/30 hover:bg-muted/30 transition-colors p-4 text-left"
    >
      {/* Title row */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {repo.visibility === "private" ? (
            <Lock className="h-4 w-4" />
          ) : repo.visibility === "internal" ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[10.5px] text-muted-foreground truncate">{repo.owner} /</p>
          </div>
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground truncate">
            {repo.name}
          </h3>
        </div>
        <ActivityHeatPill heat={repo.activityHeat} />
      </div>

      {/* Description */}
      <p className="text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.4em]">
        {repo.description}
      </p>

      {/* Language bar */}
      <LanguageBar breakdown={repo.languageBreakdown} primary={repo.primaryLanguage} />

      {/* Footer meta */}
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground pt-1 border-t border-border/60">
        <span className="inline-flex items-center gap-1">
          <GitPullRequest className="h-3 w-3" />
          {repo.openPrCount}
        </span>
        <span className="opacity-50">·</span>
        {agent && (
          <span className="inline-flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `hsl(${agent.accentHsl})` }}
            />
            {agent.displayName}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(repo.lastCommitAt)}
        </span>
      </div>
    </button>
  );
}

function ActivityHeatPill({ heat }: { heat: number }) {
  if (heat === 0) {
    return (
      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        idle
      </span>
    );
  }
  const tone = heat >= 70 ? "primary" : heat >= 30 ? "amber" : "zinc";
  const cls =
    tone === "primary" ? "border-primary/40 bg-primary/10 text-primary"
    : tone === "amber" ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
    : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}>
      <Activity className="h-2.5 w-2.5" />
      {heat}
    </span>
  );
}

function LanguageBar({
  breakdown, primary,
}: {
  breakdown: Record<string, number>;
  primary: string;
}) {
  const entries = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
  const colour = (lang: string) => {
    const palette: Record<string, string> = {
      TypeScript:        "#3178c6",
      JavaScript:        "#f1e05a",
      Python:            "#3572A5",
      Rust:              "#dea584",
      CSS:               "#563d7c",
      MDX:               "#1B6FC9",
      JSON:              "#292929",
      SQL:               "#e38c00",
      HTML:              "#e34c26",
      Markdown:          "#083fa1",
      YAML:              "#cb171e",
      "Jupyter Notebook": "#DA5B0B",
    };
    return palette[lang] ?? "#888888";
  };
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {entries.map(([lang, pct]) => (
          <span
            key={lang}
            title={`${lang} · ${(pct * 100).toFixed(0)}%`}
            style={{ width: `${pct * 100}%`, background: colour(lang) }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: colour(primary) }} />
        {primary}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const agent = agentById(item.agentId);
  const Icon = activityIcon(item.kind);
  return (
    <div className="flex items-start gap-2.5 px-5 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={agent ? { background: `hsl(${agent.accentHsl} / 0.15)`, color: `hsl(${agent.accentHsl})` } : undefined}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-foreground/90 leading-snug">
          {item.summary}
        </p>
        <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground/70">
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </div>
  );
}

function activityIcon(kind: ActivityItem["kind"]) {
  switch (kind) {
    case "commit":         return GitCommit;
    case "opened_pr":      return GitPullRequest;
    case "reviewed_pr":    return MessageSquare;
    case "merged_pr":      return GitMerge;
    case "created_branch": return GitBranch;
    case "edited_file":    return FileCode;
  }
}

// ════════════════════════════════════════════════════════════════
// REPO VIEW — single repo + 6-tab nav
// ════════════════════════════════════════════════════════════════

function RepoView({
  repo, tab, onTabChange, onBack, activePr, onOpenPr, onClosePr,
}: {
  repo: Repo;
  tab: RepoTab;
  onTabChange: (t: RepoTab) => void;
  onBack: () => void;
  activePr: PullRequest | null;
  onOpenPr: (id: string) => void;
  onClosePr: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/40">
        <div className="px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Back to repos"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          {repo.visibility === "private" ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          ) : repo.visibility === "internal" ? (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <h1 className="flex items-baseline gap-1 text-[15px] font-semibold tracking-tight text-foreground">
            <span className="text-muted-foreground/80">{repo.owner} /</span>
            <span>{repo.name}</span>
          </h1>
          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
            {repo.visibility}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <RepoHeaderBtn icon={Star} label="Star" />
            <RepoHeaderBtn icon={GitBranch} label={repo.defaultBranch} />
            <RepoHeaderBtn icon={Download} label="Clone" />
          </div>
        </div>

        {/* Tab strip — GitHub-style underlined */}
        <nav className="flex items-end gap-0 px-6 -mb-px">
          <RepoTabBtn label="Code"     icon={CodeIcon}        active={tab === "code"}     onClick={() => onTabChange("code")} />
          <RepoTabBtn label="Issues"   icon={AlertCircle}     active={tab === "issues"}   onClick={() => onTabChange("issues")}   badge={3} />
          <RepoTabBtn label="Pulls"    icon={GitPullRequest}  active={tab === "pulls"}    onClick={() => onTabChange("pulls")}    badge={repo.openPrCount} />
          <RepoTabBtn label="Actions"  icon={Activity}        active={tab === "actions"}  onClick={() => onTabChange("actions")} />
          <RepoTabBtn label="Insights" icon={BarChart3}       active={tab === "insights"} onClick={() => onTabChange("insights")} />
          <RepoTabBtn label="Settings" icon={Settings}        active={tab === "settings"} onClick={() => onTabChange("settings")} />
        </nav>
      </header>

      {/* Tab body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "code" && <CodeTab repo={repo} />}
        {tab === "issues" && <IssuesTab repo={repo} />}
        {tab === "pulls" && (
          activePr
            ? <PullRequestDetail pr={activePr} onBack={onClosePr} />
            : <PullsTab repo={repo} onOpenPr={onOpenPr} />
        )}
        {tab === "actions" && <ActionsTab repo={repo} />}
        {tab === "insights" && <InsightsTab repo={repo} />}
        {tab === "settings" && <AgentAutonomyPanel repo={repo} />}
      </div>
    </div>
  );
}

function RepoHeaderBtn({
  icon: Icon, label,
}: { icon: typeof Star; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function RepoTabBtn({
  label, icon: Icon, active, onClick, badge,
}: {
  label: string;
  icon: typeof CodeIcon;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-muted px-1.5 font-mono text-[9.5px] tabular-nums text-foreground/85">
          {badge}
        </span>
      )}
      <span
        aria-hidden="true"
        className={[
          "absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-all",
          active ? "bg-primary opacity-100" : "bg-transparent opacity-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── CODE TAB — file tree + viewer ───────────────────────────────

function CodeTab({ repo }: { repo: Repo }) {
  const files = MOCK_FILES.filter((f) => f.repoId === repo.id);
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);
  const selected = files.find((f) => f.path === selectedPath) ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* File tree */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-card/30 overflow-y-auto">
        <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10.5px] text-foreground/85">{repo.defaultBranch}</span>
          <span className="ml-auto font-mono text-[9.5px] text-muted-foreground">{files.length} files</span>
        </div>
        <ul className="py-1">
          {files.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setSelectedPath(f.path)}
                className={[
                  "w-full flex items-center gap-1.5 px-3 py-1 text-left text-[11.5px] transition-colors",
                  selectedPath === f.path
                    ? "bg-muted text-foreground"
                    : "text-foreground/80 hover:bg-muted/40 hover:text-foreground",
                ].join(" ")}
              >
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{f.path.split("/").pop()}</span>
                <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/70 truncate max-w-[120px]">
                  {f.path.split("/").slice(0, -1).join("/") || "/"}
                </span>
              </button>
            </li>
          ))}
          {files.length === 0 && (
            <li className="px-3 py-4 text-[11px] text-muted-foreground italic">
              No file snapshots seeded yet. Real branch loads will populate here.
            </li>
          )}
        </ul>
      </aside>

      {/* File viewer + AI summary rail */}
      <main className="flex-1 min-w-0 flex">
        {selected ? (
          <>
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <div className="shrink-0 border-b border-border bg-card/40 px-5 py-2.5 flex items-center gap-2">
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[11.5px] text-foreground/90">{selected.path}</span>
                <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{selected.sizeBytes}b</span>
                  <span className="opacity-50">·</span>
                  <span>{selected.language}</span>
                  <span className="opacity-50">·</span>
                  <span>{timeAgo(selected.lastModifiedAt)}</span>
                </span>
              </div>
              <pre className="flex-1 min-h-0 overflow-auto bg-background p-5 font-mono text-[12px] leading-[1.55] text-foreground/90">
                <code>{selected.content ?? "// (binary or external storage)"}</code>
              </pre>
            </div>
            <aside className="w-[280px] shrink-0 border-l border-border bg-card/30 overflow-y-auto p-5 space-y-5">
              <div>
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI summary
                </p>
                {selected.aiSummary ? (
                  <p className="text-[11.5px] text-foreground/85 leading-relaxed">{selected.aiSummary}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">No summary yet.</p>
                )}
              </div>
              <DepSection title="Imports" paths={selected.depsOut} />
              <DepSection title="Imported by" paths={selected.depsIn} />
            </aside>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center p-10">
            <p className="text-[12px] text-muted-foreground">Pick a file to view its contents.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function DepSection({ title, paths }: { title: string; paths: string[] }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      {paths.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70 italic">None</p>
      ) : (
        <ul className="space-y-1">
          {paths.map((p) => (
            <li key={p} className="font-mono text-[11px] text-foreground/85 truncate">
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── PULLS TAB ────────────────────────────────────────────────────

function PullsTab({ repo, onOpenPr }: { repo: Repo; onOpenPr: (id: string) => void }) {
  const prs = MOCK_PRS.filter((p) => p.repoId === repo.id);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");

  const visible = prs.filter((p) => {
    if (statusFilter === "open") return p.status === "open" || p.status === "draft";
    if (statusFilter === "closed") return p.status === "merged" || p.status === "closed";
    return true;
  });

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {[
            ["open", "Open", prs.filter((p) => p.status === "open" || p.status === "draft").length],
            ["closed", "Closed", prs.filter((p) => p.status === "merged" || p.status === "closed").length],
            ["all", "All", prs.length],
          ].map(([v, label, n]) => {
            const active = statusFilter === v;
            return (
              <button
                key={v as string}
                type="button"
                onClick={() => setStatusFilter(v as any)}
                className={[
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-sm transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
                <span className={[
                  "font-mono text-[9.5px]",
                  active ? "text-primary" : "text-muted-foreground/70",
                ].join(" ")}>{n as number}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New pull request
        </button>
      </div>

      <ul className="divide-y divide-border">
        {visible.map((p) => (
          <PrRow key={p.id} pr={p} onClick={() => onOpenPr(p.id)} />
        ))}
        {visible.length === 0 && (
          <li className="px-6 py-12 text-center text-[12px] text-muted-foreground">
            No pull requests in this view.
          </li>
        )}
      </ul>
    </div>
  );
}

function PrRow({ pr, onClick }: { pr: PullRequest; onClick: () => void }) {
  const author = pr.authorAgentId ? agentById(pr.authorAgentId) : null;
  const StatusIcon =
    pr.status === "merged" ? GitMerge
  : pr.status === "draft"  ? GitPullRequestDraft
  : pr.status === "closed" ? XCircle
  : GitPullRequest;
  const statusColor =
    pr.status === "merged" ? "text-violet-400"
  : pr.status === "draft"  ? "text-muted-foreground"
  : pr.status === "closed" ? "text-muted-foreground/70"
  : "text-emerald-400";
  return (
    <li
      onClick={onClick}
      className="px-6 py-3 hover:bg-muted/30 transition-colors flex items-start gap-3 cursor-pointer"
    >
      <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-semibold text-foreground tracking-tight truncate">
            {pr.title}
          </p>
          {pr.aiExplanation && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono text-foreground/70">#{pr.number}</span>
          {" "}opened {timeAgo(pr.createdAt)} by{" "}
          {author ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: `hsl(${author.accentHsl})` }} />
              <span className="text-foreground/85 font-medium">{author.displayName}</span>
            </span>
          ) : (
            <span className="text-foreground/85 font-medium">{pr.authorUsername}</span>
          )}
          {" · "}
          <span className="text-emerald-400">+{pr.additions}</span>
          {" "}
          <span className="text-red-400">−{pr.deletions}</span>
          {" "}across {pr.changedFiles} files
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3 text-muted-foreground">
        {pr.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tabular-nums">
            <MessageSquare className="h-3 w-3" />
            {pr.commentCount}
          </span>
        )}
        <ChevronRight className="h-4 w-4 opacity-40" />
      </div>
    </li>
  );
}

// ── Placeholder for the tabs we haven't built yet ───────────────

function Placeholder({ kind }: { kind: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center p-12">
      <div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-border bg-muted/40">
          <Hash className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="mt-4 text-[14px] font-semibold text-foreground tracking-tight">
          {kind[0].toUpperCase() + kind.slice(1)} — coming next
        </p>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed max-w-[320px]">
          Schema is in <span className="font-mono">migrations/code_init.sql</span>; this surface ships next session.
        </p>
      </div>
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
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

// Silence unused-import warnings for icons kept around for the
// placeholder tabs / future additions.
void ArrowUp; void ArrowDown; void CheckCircle2; void Folder;
