/**
 * ProjectsPage.tsx — /projects landing surface.
 *
 * Wraps the explorer with the workspace chrome (search, status
 * filter, priority filter, board ⇄ list view toggle, "New project"
 * CTA). Pulls real data from `useProjects`, subscribes to realtime
 * via `useProjectsRealtime`, and mounts:
 *   · ProjectDetailDrawer — right-slide, full project context
 *   · CreateProjectDialog — centered modal (C-level only)
 *
 * Mutations are gated client-side to C-level (matches the RLS in
 * migrations/projects_baseline.sql). Non-C-level users still see
 * every project they can read, with read-only affordances.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Filter, LayoutGrid, Rows3, Flag, AlertCircle,
  Calendar, ChevronRight, CircleDot, Activity, Eye, CheckCircle2,
  Pause, Loader2,
} from "lucide-react";
import { ActiveUser } from "@/stores/query";
import {
  useProjects,
  useProjectsRealtime,
  type Project,
  type ProjectStatus,
  type ProjectPriority,
} from "@/stores/projects";
import { ProjectDetailDrawer } from "./ProjectDetailDrawer";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { STATUS_META, PRIORITY_META, daysUntil, fmtDate, AvatarStack } from "./projectStyles";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO", "Admin"]);

const STATUS_FILTERS: { id: "all" | ProjectStatus; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "to_do",        label: "To do" },
  { id: "in_progress",  label: "In progress" },
  { id: "review",       label: "Review" },
  { id: "completed",    label: "Completed" },
  { id: "on_hold",      label: "On hold" },
];

const COLUMN_ORDER: ProjectStatus[] = [
  "to_do", "in_progress", "review", "completed", "on_hold",
];

export function ProjectsPage() {
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const role: string | undefined = me?.role ?? undefined;
  const isCLevel = !!role && C_LEVEL_ROLES.has(role);

  useProjectsRealtime();

  const { data: projects = [], isLoading } = useProjects();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ProjectPriority>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.owner_username ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projects, query, statusFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<ProjectStatus, Project[]> = {
      to_do: [], in_progress: [], review: [], completed: [], on_hold: [],
    };
    for (const p of filtered) buckets[p.status].push(p);
    return buckets;
  }, [filtered]);

  // Esc closes whatever's open (drawer first, then create modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (createOpen) setCreateOpen(false);
      else if (activeId) setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, activeId]);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      {/* ── Page header ────────────────────────────────────────── */}
      <header className="border-b border-xs border-border-soft bg-background">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                {isCLevel ? "C-level workspace" : "Member workspace"} · Projects
              </p>
              <h1 className="text-[26px] font-bold text-foreground leading-tight">
                Projects
              </h1>
              <p className="text-[13px] text-text-secondary mt-1 max-w-2xl">
                Every project across the org in one editorial grid. Owners can
                update their own status &amp; progress; creating, assigning,
                and deleting is C-level only.
              </p>
            </div>
            {isCLevel && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[12px] font-bold px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                <Plus size={13} strokeWidth={2.6} />
                New project
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1600px] px-6 pt-4">
        <div className="rounded-xl border-xs border-border-soft bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-xs border-border-soft flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[420px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, owners, tags…"
                className="w-full pl-9 pr-3 py-2 rounded-md bg-background/60 border-xs border-border-soft text-[13px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40"
              />
            </div>

            <div className="hidden md:flex items-center gap-1 list-none p-0 m-0">
              {STATUS_FILTERS.map((s) => {
                const isActive = statusFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={
                      "list-none px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors " +
                      (isActive
                        ? "bg-foreground text-background"
                        : "text-text-secondary hover:text-foreground hover:bg-foreground/[0.05]")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <PrioritySelect value={priorityFilter} onChange={setPriorityFilter} />
              <div className="hidden sm:flex items-center rounded-md border-xs border-border-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView("board")}
                  className={
                    "px-2 py-1.5 transition-colors " +
                    (view === "board" ? "bg-foreground/[0.06] text-foreground" : "text-text-tertiary hover:text-foreground")
                  }
                  aria-label="Board view"
                  title="Board view"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={
                    "px-2 py-1.5 transition-colors border-l border-xs border-border-soft " +
                    (view === "list" ? "bg-foreground/[0.06] text-foreground" : "text-text-tertiary hover:text-foreground")
                  }
                  aria-label="List view"
                  title="List view"
                >
                  <Rows3 size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile pill scroller */}
          <div className="md:hidden px-4 py-2.5 border-b border-xs border-border-soft flex items-center gap-1.5 overflow-x-auto list-none">
            {STATUS_FILTERS.map((s) => {
              const isActive = statusFilter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  className={
                    "list-none whitespace-nowrap px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors " +
                    (isActive
                      ? "bg-foreground text-background"
                      : "text-text-secondary hover:text-foreground border-xs border-border-soft")
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* ── Body ─────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="py-20 flex items-center justify-center text-[13px] text-text-tertiary">
              <Loader2 size={14} className="animate-spin mr-2" />
              Loading projects…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              hasFilters={query.length > 0 || statusFilter !== "all" || priorityFilter !== "all"}
              isCLevel={isCLevel}
              hasAnyProjects={projects.length > 0}
              onReset={() => {
                setQuery("");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
              onCreate={() => setCreateOpen(true)}
            />
          ) : view === "board" ? (
            <BoardView grouped={grouped} onOpen={(id) => setActiveId(id)} />
          ) : (
            <ListView projects={filtered} onOpen={(id) => setActiveId(id)} />
          )}
        </div>
      </div>

      {/* ── Drawer + create modal (portaled at this component level) ── */}
      <ProjectDetailDrawer
        projectId={activeId}
        onClose={() => setActiveId(null)}
        isCLevel={isCLevel}
        me={me}
      />

      {createOpen && isCLevel && (
        <CreateProjectDialog
          onClose={() => setCreateOpen(false)}
          me={me}
          onCreated={(id) => {
            setCreateOpen(false);
            setActiveId(id);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-views
// ────────────────────────────────────────────────────────────────────

function BoardView({
  grouped,
  onOpen,
}: {
  grouped: Record<ProjectStatus, Project[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {COLUMN_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const items = grouped[status];
        return (
          <div key={status} className="flex flex-col min-h-[120px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="inline-flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {meta.label}
                </span>
                <span className="text-[11px] text-text-tertiary">{items.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 list-none p-0 m-0">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-soft py-6 text-center text-[11.5px] text-text-tertiary">
                  Nothing here.
                </div>
              ) : (
                items.map((p) => (
                  <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-border-soft">
      <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary bg-popover/40">
        <div className="col-span-5">Project</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Priority</div>
        <div className="col-span-2">Owner</div>
        <div className="col-span-1">Due</div>
        <div className="col-span-1 text-right">Progress</div>
      </div>
      {projects.map((p) => {
        const sm = STATUS_META[p.status];
        const pm = PRIORITY_META[p.priority];
        const days = p.due ? daysUntil(p.due) : null;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="w-full grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-popover/50 transition-colors text-left"
          >
            <div className="col-span-12 md:col-span-5 min-w-0">
              <div className="text-[13.5px] font-semibold text-foreground truncate">{p.title}</div>
              <div className="text-[11.5px] text-text-tertiary truncate mt-0.5">{p.description}</div>
            </div>
            <div className="col-span-4 md:col-span-2 flex items-center">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10.5px] font-bold ${sm.chip}`}>
                <sm.Icon size={10} strokeWidth={2.5} />
                {sm.label}
              </span>
            </div>
            <div className="col-span-4 md:col-span-1 flex items-center">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${pm.chip}`}>
                <Flag size={9} strokeWidth={2.5} />
                {pm.label}
              </span>
            </div>
            <div className="col-span-4 md:col-span-2 flex items-center gap-2 text-[12px] text-text-secondary">
              <span className="truncate">{p.owner_username ?? "—"}</span>
            </div>
            <div className="col-span-6 md:col-span-1 flex items-center text-[11.5px] text-text-secondary">
              {p.due ? (
                <span className={days !== null && days < 0 ? "text-red-500 font-semibold" : days !== null && days <= 7 ? "text-orange-500 font-semibold" : ""}>
                  {fmtDate(p.due)}
                </span>
              ) : (
                <span className="text-text-tertiary">No due</span>
              )}
            </div>
            <div className="col-span-6 md:col-span-1 flex items-center justify-end gap-2">
              <div className="w-14 h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
                <div
                  className={`h-full ${p.status === "completed" ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <span className="text-[10.5px] font-bold tabular-nums text-text-secondary w-7 text-right">
                {p.progress}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const sm = STATUS_META[project.status];
  const pm = PRIORITY_META[project.priority];
  const days = project.due ? daysUntil(project.due) : null;
  const dueTone =
    days === null
      ? "text-text-tertiary"
      : days < 0
      ? "text-red-500"
      : days <= 7
      ? "text-orange-500"
      : "text-text-tertiary";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full text-left rounded-lg border-xs border-border-soft bg-background/60 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] transition-all p-3"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${pm.chip}`}>
          <Flag size={8} strokeWidth={3} />
          {pm.label}
        </span>
        <ChevronRight size={12} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-[13px] font-bold text-foreground leading-snug mb-1.5 line-clamp-2">
        {project.title}
      </div>
      <div className="text-[11.5px] text-text-secondary leading-snug line-clamp-2 mb-3">
        {project.description || <span className="text-text-tertiary italic">No description.</span>}
      </div>

      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="flex-1 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
          <div
            className={`h-full transition-all ${project.status === "completed" ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <span className="text-[9.5px] font-bold tabular-nums text-text-tertiary">
          {project.tasks_done}/{project.tasks_total}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <AvatarStack usernames={project.owner_username ? [project.owner_username] : []} max={3} />
        <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold ${dueTone}`}>
          <Calendar size={10} strokeWidth={2.5} />
          {project.due === null
            ? "No due"
            : days !== null && days < 0
            ? `${Math.abs(days)}d over`
            : days === 0
            ? "Due today"
            : `${days}d`}
        </span>
      </div>
    </button>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: "all" | ProjectPriority;
  onChange: (v: "all" | ProjectPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value === "all" ? "Any priority" : PRIORITY_META[value].label;
  const options: { id: "all" | ProjectPriority; label: string }[] = [
    { id: "all",      label: "Any priority" },
    { id: "critical", label: "Critical" },
    { id: "high",     label: "High" },
    { id: "medium",   label: "Medium" },
    { id: "low",      label: "Low" },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border-xs border-border-soft text-[11.5px] font-semibold text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
      >
        <Flag size={11} />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-card border-xs border-border-soft rounded-md shadow-lg overflow-hidden list-none p-0 m-0">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={() => { onChange(o.id); setOpen(false); }}
              className={
                "list-none block w-full text-left px-3 py-1.5 text-[12px] transition-colors " +
                (value === o.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-text-secondary hover:bg-foreground/[0.05] hover:text-foreground")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  isCLevel,
  hasAnyProjects,
  onReset,
  onCreate,
}: {
  hasFilters: boolean;
  isCLevel: boolean;
  hasAnyProjects: boolean;
  onReset: () => void;
  onCreate: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-foreground/[0.05] text-text-tertiary mb-3">
          <Filter size={18} />
        </div>
        <p className="text-[14px] font-semibold text-foreground mb-1">No projects match your filters.</p>
        <p className="text-[12.5px] text-text-secondary mb-4">Try clearing the search or status filter.</p>
        <button
          type="button"
          onClick={onReset}
          className="text-[12px] font-semibold text-primary hover:underline underline-offset-4"
        >
          Reset filters
        </button>
      </div>
    );
  }
  if (!hasAnyProjects && isCLevel) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
          <Plus size={18} />
        </div>
        <p className="text-[14px] font-semibold text-foreground mb-1">No projects yet.</p>
        <p className="text-[12.5px] text-text-secondary mb-4">
          Spin up the first one — the team will see it in their feed.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[12px] font-bold px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={12} strokeWidth={2.6} />
          New project
        </button>
      </div>
    );
  }
  return (
    <div className="py-20 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-foreground/[0.05] text-text-tertiary mb-3">
        <AlertCircle size={18} />
      </div>
      <p className="text-[14px] font-semibold text-foreground mb-1">Nothing to show.</p>
      <p className="text-[12.5px] text-text-secondary">
        You don&apos;t belong to any projects yet — ask a C-level to add you.
      </p>
    </div>
  );
}
