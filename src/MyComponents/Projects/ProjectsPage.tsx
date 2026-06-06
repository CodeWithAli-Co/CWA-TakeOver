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
  Search, Plus, Filter, LayoutGrid, Rows3, Flag, AlertCircle, Loader2,
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
import {
  STATUS_META, PRIORITY_META, daysUntil, fmtDate, AvatarStack,
  StatusIcon, PriorityIcon,
} from "./projectStyles";

const STATUS_FILTERS: { id: "all" | ProjectStatus; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "to_do",        label: "To do" },
  { id: "in_progress",  label: "In progress" },
  { id: "review",       label: "Review" },
  { id: "completed",    label: "Completed" },
  { id: "on_hold",      label: "On hold" },
];

/**
 * Projects page.
 *
 * `embedded` (from OperationsHub) hides the big page header. The
 * toolbar with search / status / priority / view-toggle / "New
 * project" stays so the controls are reachable from the hub.
 */
interface ProjectsPageProps {
  embedded?: boolean;
}

export function ProjectsPage({ embedded = false }: ProjectsPageProps = {}) {
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  // Gating removed — everyone can view, create, and edit projects.
  // `isCLevel` is hardcoded true so existing call sites that read
  // it keep working without further plumbing. RLS still enforces
  // write permissions at the database layer if needed.
  const isCLevel = true;

  useProjectsRealtime();

  const { data: projects = [], isLoading } = useProjects();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ProjectPriority>("all");
  // Linear-inspired default: list view first. Information density
  // is higher, scanning is faster, and the visual chrome is calmer.
  // Board view stays available via the toggle for visual planning.
  const [view, setView] = useState<"board" | "list">("list");
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
    <div
      className={
        embedded
          ? "h-full w-full bg-background text-foreground overflow-y-auto"
          : "min-h-[100dvh] w-full bg-background text-foreground"
      }
    >
      {/* ── Page header — full hero when standalone, quiet stat strip
       *  when embedded inside OperationsHub. */}
      {embedded ? (
        <div className="px-6 py-3 border-b border-xs border-border/15 bg-background/95 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0 text-[11.5px]">
            {/* Role chip removed — projects are open to everyone. */}
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-bold text-foreground tabular-nums text-[14px]">
                {projects.length}
              </span>
              <span className="text-text-tertiary">
                project{projects.length === 1 ? "" : "s"}
              </span>
            </span>
            {(() => {
              const inFlight = projects.filter(
                (p) => p.status === "in_progress" || p.status === "review",
              ).length;
              const done = projects.filter((p) => p.status === "completed").length;
              return (
                <>
                  <span className="h-3 w-px bg-border-soft" />
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="font-bold text-warning tabular-nums text-[14px]">
                      {inFlight}
                    </span>
                    <span className="text-text-tertiary">in flight</span>
                  </span>
                  <span className="h-3 w-px bg-border-soft" />
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="font-bold text-success tabular-nums text-[14px]">
                      {done}
                    </span>
                    <span className="text-text-tertiary">done</span>
                  </span>
                </>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[11.5px] font-bold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={13} strokeWidth={2.6} />
            New project
          </button>
        </div>
      ) : (
        <header className="border-b border-xs border-border-soft bg-background">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                  Workspace · Projects
                </p>
                <h1 className="text-[26px] font-bold text-foreground leading-tight">
                  Projects
                </h1>
                <p className="text-[13px] text-text-secondary mt-1 max-w-2xl">
                  Every project across the org in one editorial grid. Open to
                  the whole team — anyone can create, update status, and track
                  progress.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[12px] font-bold px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                <Plus size={13} strokeWidth={2.6} />
                New project
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Toolbar — editorial: hairline border, quiet bg.
       *  Full width: no max-w cap so the toolbar + grid extend
       *  edge-to-edge of the page. */}
      <div className="w-full px-6 pt-4">
        <div className="rounded-xl border-xs border-border/15 bg-foreground/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-xs border-border/15 flex flex-wrap items-center gap-3">
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
            <BoardView projects={filtered} onOpen={(id) => setActiveId(id)} />
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

/**
 * BoardView — uniform 3-column grid of large project cards.
 *
 * Replaces the old 5-column-by-status kanban. The status filter
 * pills at the top of the page filter which cards render here;
 * status is now shown as a chip on each card, not as a column
 * header. Modeled on the saasfactor.co reference: title + days
 * remaining on the left, status pill on the right, visual content
 * area in the middle, owner avatars + a stat at the bottom.
 */
function BoardView({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="p-5 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  );
}

/**
 * ListView — Linear-inspired dense list. Every row is a single
 * line on desktop: status circle + title + (truncated description)
 * + priority bars + owner + due + progress. No row chrome, no
 * pill borders, just hover affordance and a hairline divider.
 *
 * The visual move that matters most: status went from a chunky
 * coloured chip with an icon and a text label to a single 14px
 * filled circle. Same information, ~1/8th the visual weight.
 * Priority moved from a labeled flag chip to a 4-bar mini chart
 * (Linear's signature). Both indicators stay color-coded so
 * scanning still works.
 */
function ListView({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-border/10">
      {/* Header strip — quieter than before; smaller caps, no bg.  */}
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary/80 border-b border-xs border-border/10">
        <div className="col-span-6">Project</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Priority</div>
        <div className="col-span-1">Owner</div>
        <div className="col-span-1">Due</div>
        <div className="col-span-1 text-right">Progress</div>
      </div>
      {projects.map((p) => {
        const days = p.due ? daysUntil(p.due) : null;
        const overdue = days !== null && days < 0;
        const dueSoon = days !== null && days >= 0 && days <= 7;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="w-full grid grid-cols-12 gap-3 px-4 py-2.5 hover:bg-foreground/[0.035] transition-colors text-left group"
          >
            {/* Project: status circle inline with title for
             *  scanning. Description sits below in a smaller, dimmer
             *  type — only shows on larger screens where there's room. */}
            <div className="col-span-12 md:col-span-6 min-w-0 flex items-start gap-2.5">
              <span className="pt-[3px] shrink-0">
                <StatusIcon status={p.status} size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
                  {p.title}
                </div>
                {p.description && (
                  <div className="hidden lg:block text-[11.5px] text-text-tertiary truncate mt-0.5">
                    {p.description}
                  </div>
                )}
              </div>
            </div>

            {/* Status label — circle is in the title column already;
             *  this column just renders the textual status, dimmed. */}
            <div className="col-span-4 md:col-span-2 flex items-center text-[11.5px] text-text-secondary">
              {STATUS_META[p.status].label}
            </div>

            {/* Priority — Linear-style bars. */}
            <div className="col-span-4 md:col-span-1 flex items-center">
              <PriorityIcon priority={p.priority} size={11} />
            </div>

            {/* Owner — bare text. */}
            <div className="col-span-4 md:col-span-1 flex items-center text-[11.5px] text-text-secondary truncate">
              {p.owner_username ?? "—"}
            </div>

            {/* Due — tabular nums, tonal warning when overdue/soon. */}
            <div className="col-span-6 md:col-span-1 flex items-center text-[11.5px] tabular-nums">
              {p.due ? (
                <span
                  className={
                    overdue
                      ? "text-destructive font-semibold"
                      : dueSoon
                      ? "text-warning font-semibold"
                      : "text-text-secondary"
                  }
                >
                  {fmtDate(p.due)}
                </span>
              ) : (
                <span className="text-text-tertiary">—</span>
              )}
            </div>

            {/* Progress — slimmer track + tighter number. */}
            <div className="col-span-6 md:col-span-1 flex items-center justify-end gap-2">
              <div className="w-12 h-[3px] rounded-full bg-foreground/[0.08] overflow-hidden">
                <div
                  className={`h-full ${
                    p.status === "completed" ? "bg-success" : "bg-foreground/70"
                  }`}
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <span className="text-[10.5px] font-semibold tabular-nums text-text-tertiary w-7 text-right">
                {p.progress}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * ProjectCard — large grid tile modeled on the saasfactor.co
 * reference design.
 *
 * Layout (top to bottom):
 *   · Title + "Nd Remaining" subtitle on the left, status pill on
 *     the right.
 *   · Visual content area in the middle — shows the description
 *     (truncated) plus a progress bar with a percentage, plus a
 *     small breakdown of tasks done vs. tasks total. Acts like the
 *     "screenshot preview" slot in the reference, but filled with
 *     real project signal instead of a fake mockup.
 *   · Owner avatar stack on the left, headline stat (tasks ratio or
 *     overdue chip) on the right.
 *
 * Rounded corners + hairline border + restrained hover lift to
 * match the reference's premium card feel.
 */
function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const days = project.due ? daysUntil(project.due) : null;
  const remainingLabel =
    project.due === null
      ? "No deadline"
      : days !== null && days < 0
        ? `${Math.abs(days)} Days Overdue`
        : days === 0
          ? "Due today"
          : `${days} Days Remaining`;
  const remainingTone =
    days === null
      ? "text-text-tertiary"
      : days < 0
        ? "text-destructive"
        : days <= 7
          ? "text-warning"
          : "text-text-tertiary";

  // Progress fill color tracks status — green when shipped, primary
  // tone otherwise. Track stays neutral so the fill reads cleanly.
  const progressFill =
    project.status === "completed"
      ? "bg-success"
      : project.status === "review"
        ? "bg-violet-500"
        : "bg-primary";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full text-left rounded-2xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/30 transition-colors p-5 flex flex-col gap-4 min-h-[240px]"
    >
      {/* Top row: status circle + title block on the left; priority
       *  bars + remaining label on the right. Linear lays out cards
       *  this way — single status circle in the top-left, no chunky
       *  pill borders. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-2.5">
          <span className="pt-[3px] shrink-0">
            <StatusIcon status={project.status} size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground leading-[1.3] line-clamp-2">
              {project.title}
            </h3>
            <p className="text-[11px] mt-1 text-text-tertiary">
              {STATUS_META[project.status].label}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <PriorityIcon priority={project.priority} size={11} />
          <span className={`text-[11px] font-medium ${remainingTone}`}>
            {remainingLabel}
          </span>
        </div>
      </div>

      {/* Body — flattened. The previous "nested inset panel" pattern
       *  added a card-inside-a-card look that Linear deliberately
       *  avoids. Same content, no second container. */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Description — 2 lines max. */}
        <p className="text-[12.5px] text-text-secondary leading-relaxed line-clamp-2 min-h-[36px]">
          {project.description || (
            <span className="text-text-tertiary italic">No description on file.</span>
          )}
        </p>

        {/* Progress — slimmer track, no uppercase eyebrow. */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[3px] rounded-full bg-foreground/[0.08] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressFill}`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-text-secondary w-8 text-right">
            {project.progress}%
          </span>
        </div>

        {/* Task breakdown — tiny stat row */}
        <div className="flex items-center gap-3 text-[10.5px] text-text-tertiary mt-auto">
          <span className="inline-flex items-baseline gap-1">
            <span className="font-bold tabular-nums text-foreground/85 text-[12px]">
              {project.tasks_done}
            </span>
            <span>done</span>
          </span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-baseline gap-1">
            <span className="font-bold tabular-nums text-foreground/85 text-[12px]">
              {Math.max(0, project.tasks_total - project.tasks_done)}
            </span>
            <span>open</span>
          </span>
        </div>
      </div>

      {/* Bottom row: avatars + stat (tasks ratio) */}
      <div className="flex items-center justify-between gap-2">
        <AvatarStack
          usernames={project.owner_username ? [project.owner_username] : []}
          max={3}
        />
        <span className="inline-flex items-baseline gap-1 text-[12.5px] tabular-nums">
          <span className="font-bold text-foreground">
            {project.tasks_done}/{project.tasks_total}
          </span>
          <span className="text-text-tertiary text-[11px]">tasks</span>
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
