/**
 * OperationsDashboard.tsx — Two-column operations workspace.
 *
 * Layout (matches the approved mockup):
 *   ┌────────────────────────────┬──────────────────────┐
 *   │  TASKS                     │  QUOTAS              │
 *   │  [list with inline expand] │  [list]              │
 *   │                            ├──────────────────────┤
 *   │                            │  ACTIVITY            │
 *   │  PROJECTS                  │  [feed]              │
 *   │  [card grid]               │                      │
 *   └────────────────────────────┴──────────────────────┘
 *
 * Design choices (deliberate, after iteration):
 *   · No toolbar — search and the Mine/Everyone scope toggle were
 *     intentionally dropped from this view per the mockup. Default
 *     scope is "mine" for everyone (admins can flip via the small
 *     control attached to the Tasks header subtitle).
 *   · No icons in the section header — title is just caps text +
 *     a quiet subtitle string. Cleaner reading rhythm.
 *   · Buttons use a single rounded-pill language. Primary CTA
 *     (Create task) is solid; secondary (Add, New project) is
 *     outlined; inline row actions are colored outlined pills
 *     (Mark done = success, Move back = neutral) — never solid.
 *   · No slide-in drawers — clicking a row expands it inline.
 *   · `parseDaysLeft` clamps absurd values (Date.parse on "Today"
 *     used to return garbage giving ~9099d-overdue chips).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Flag,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  draftOperationsBrief,
  type OperationsSnapshot,
} from "@/Axon/engine/draftOperationsBrief";
import { ConnectorsStrip } from "./ConnectorsStrip";
import { SlackPulsePanel } from "./SlackPulsePanel";
import { MeetingsPanel } from "@/MyComponents/Meetings/MeetingsPanel";
import { FinancePanel } from "@/MyComponents/Finance/FinancePanel";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  ActiveUser,
  AllTodos,
  Employees,
  Todos,
  type TodosInterface,
} from "@/stores/query";
import { companySupabase } from "@/MyComponents/supabase";
import {
  useProjects,
  useProjectsRealtime,
  useUpdateProject,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/stores/projects";
import {
  STATUS_META as PROJECT_STATUS_META,
  AvatarStack,
} from "@/MyComponents/Projects/projectStyles";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import { QuotaFormDialog } from "@/MyComponents/WeeklyQuota";
import { Dialog } from "@/components/ui/shadcnComponents/dialog";
import { CreateProjectDialog } from "@/MyComponents/Projects/CreateProjectDialog";

// ─────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────

interface Quota {
  id: number;
  status: "pending" | "in-progress" | "completed";
  title: string;
  description?: string;
  deadline?: string;
  priority?: "low" | "medium" | "high";
  week_start?: string;
  week_end?: string;
  user_id?: string;
  carried_from_week?: string;
}

/**
 * Convert a "deadline" field into a number-of-days-from-now. Handles
 * relative phrases ("Today", "Tomorrow"), explicit "N days" form,
 * and parseable ISO/locale date strings. Returns null when the
 * input is garbage so callers can hide the chip instead of showing
 * "9099d overdue".
 */
function parseDaysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const s = String(deadline).trim();
  if (!s) return null;

  // Word forms first — Date.parse on "Today" or "Tomorrow" is
  // browser-dependent and can return garbage (Chrome returns NaN,
  // some Tauri builds return weird values that produce ~9099 days).
  const low = s.toLowerCase();
  if (low === "today") return 0;
  if (low === "tomorrow") return 1;
  if (low === "yesterday") return -1;

  // "N day" / "N days"
  const m = s.match(/^(\d+)\s*days?$/i);
  if (m) return parseInt(m[1]!, 10);

  // ISO / locale date string
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const days = Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));

  // Sanity clamp — anything more than ~3 years is almost certainly
  // a parsing artifact, not a real deadline.
  if (Math.abs(days) > 1000) return null;
  return days;
}

function dueChipText(d: number | null): string | null {
  if (d === null) return null;
  if (d < 0) return `${Math.abs(d)}d over`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d > 99) return "99d+";
  return `${d}d`;
}

function dueChipTone(d: number | null, done: boolean): string {
  if (done) return "text-text-tertiary/70";
  if (d === null) return "text-text-tertiary";
  if (d < 0) return "text-destructive";
  if (d <= 1) return "text-destructive";
  if (d <= 7) return "text-warning";
  return "text-text-tertiary";
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export function OperationsDashboard() {
  const { data: meRows } = ActiveUser();
  const me = meRows?.[0];
  const username = me?.username ?? "";
  const role = (me?.role ?? "") as string;
  const isAdmin = ["CEO", "COO", "CFO", "Admin"].includes(role);

  const [scope, setScope] = useState<"mine" | "everyone">("mine");
  const effectiveScope = isAdmin ? scope : "mine";

  // Shared data feeding the new widgets above the main grid. The
  // existing sections (TasksSection, ProjectsSection) call these
  // same TanStack hooks internally — same queryKey = cached, so
  // there's no double network fetch.
  const { data: mineTodos } = Todos(username);
  const { data: everyoneTodos } = AllTodos();
  const todos =
    ((effectiveScope === "everyone"
      ? everyoneTodos
      : mineTodos) as TodosInterface[] | undefined) ?? [];
  const { data: projects = [] } = useProjects();
  const { aux } = useOpsAggregate(todos, projects);

  return (
    <div className="w-full h-full overflow-y-auto bg-background">
      <div className="px-5 py-4 space-y-3">
        {/* Axon brief — slim full-width banner. */}
        <AxonBriefBanner
          todos={todos}
          projects={projects}
          aux={aux}
          username={username}
        />

        {/* Connectors strip — horizontal cards showing live data
         *  from each connected SaaS. Auto-hides when no
         *  connectors are wired up, so fresh installs don't see
         *  a stub. */}
        <ConnectorsStrip />

        {/* Slack pulse — live channel activity preview from the
         *  connected workspace. Auto-hides when Slack isn't
         *  connected, so the same null-state contract as
         *  ConnectorsStrip — no empty card on fresh installs. */}
        <SlackPulsePanel />

        {/* Meetings — provider-neutral schedule pulled from every
         *  connected meetings provider (Cal.com, Google Calendar,
         *  Calendly, etc). Source badge per row, optional per-
         *  provider filter. Auto-hides when nothing's connected. */}
        <MeetingsPanel />

        {/* Finance — provider-neutral cash + MRR + burn + runway
         *  pulled from every connected finance provider (Stripe
         *  today; Mercury, Plaid, Brex, Toast slot in). Source
         *  badge per transaction. Auto-hides when not connected. */}
        <FinancePanel />

        {/* Unified bento — single 3-col grid. Activity removed
         *  per ops feedback (low signal); Quotas now spans the
         *  same 2 rows as Tasks to fill the gap.
         *
         *    Row 1:  Tasks (col 1, rowspan 2)   Quotas (rs 2)  Focus
         *    Row 2:  Tasks (continued)          Quotas (cont)  Stuck
         *    Row 3:  Projects (colspan 2)                      Velocity
         */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-stretch">
          {/* Tasks — col 1, spans rows 1+2. */}
          <div className="lg:row-span-2 min-w-0 min-h-0">
            <TasksSection
              scope={effectiveScope}
              username={username}
              isAdmin={isAdmin}
              onScopeChange={setScope}
            />
          </div>

          {/* Quotas — col 2, spans rows 1+2. */}
          <div className="lg:row-span-2 min-w-0 min-h-0">
            <QuotasSection me={me} />
          </div>

          {/* Today's Focus — col 3, row 1. */}
          <div className="min-w-0 min-h-0">
            <TodaysFocus todos={todos} projects={projects} />
          </div>

          {/* Status — col 3, row 2. Replaces the old Stuck radar
           *  and the top KPI strip; consolidates Due Today,
           *  Overdue, In Progress, Done-this-week into a single
           *  2×2 stat grid. */}
          <div className="min-w-0 min-h-0">
            <StatusGrid todos={todos} aux={aux} />
          </div>

          {/* Projects — cols 1+2, row 3. */}
          <div className="lg:col-span-2 min-w-0 min-h-0">
            <ProjectsSection me={me} />
          </div>

          {/* Velocity — col 3, row 3. Week-over-week completion
           *  bar chart with prev/next nav so you can walk back
           *  through recent weeks and compare pace. */}
          <div className="min-w-0 min-h-0">
            <CompletionVelocity />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Shared section chrome — rounded-2xl card, slim text-only header
// ═════════════════════════════════════════════════════════════════

function SectionCard({
  title,
  subtitle,
  action,
  children,
  bodyClassName = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] overflow-hidden flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/85 shrink-0">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10.5px] text-text-tertiary truncate">
              {subtitle}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Outlined rounded-pill secondary button — "+ Add", "+ New project". */
function PillButton({
  label,
  onClick,
  icon = <Plus size={12} strokeWidth={2.8} />,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.04] transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center px-5 py-10">
      <p className="text-[12px] text-text-tertiary italic leading-relaxed">
        {label}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Linear-inspired indicators — shared by the Tasks + Projects
// sections below. Same visual vocabulary the standalone Projects
// and Tasks pages use: a single filled circle for status, a
// stacked bar mini-chart for priority. Co-located here so the
// dashboard surfaces stay self-contained.
// ═════════════════════════════════════════════════════════════════

function OpsStatusCircle({
  status,
  size = 12,
}: {
  status: string;
  size?: number;
}) {
  // Map across the task + project enum variants — both use these.
  const tone =
    status === "done" || status === "completed"
      ? "text-success"
      : status === "in-progress" || status === "in_progress"
        ? "text-sky-500"
        : status === "review"
          ? "text-violet-500"
          : status === "on_hold"
            ? "text-text-tertiary"
            : "text-amber-500"; // to-do / to_do default
  const isDone = status === "done" || status === "completed";
  const isProgress = status === "in-progress" || status === "in_progress";
  const isReview = status === "review";
  const isOnHold = status === "on_hold";

  return (
    <span
      className={`relative inline-flex shrink-0 ${tone}`}
      style={{ width: size, height: size }}
      title={status}
    >
      {!isDone && !isProgress && !isReview && !isOnHold && (
        <span className="absolute inset-0 rounded-full border-[2px] border-current opacity-70" />
      )}
      {isProgress && (
        <>
          <span className="absolute inset-0 rounded-full border-[2px] border-current opacity-60" />
          <span
            className="absolute inset-[2px] rounded-full bg-current opacity-90"
            style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
          />
        </>
      )}
      {isReview && (
        <>
          <span className="absolute inset-0 rounded-full bg-current opacity-90" />
          <span className="absolute inset-[3px] rounded-full bg-background" />
          <span className="absolute inset-[5px] rounded-full bg-current" />
        </>
      )}
      {isDone && (
        <>
          <span className="absolute inset-0 rounded-full bg-current" />
          <svg
            viewBox="0 0 12 12"
            className="absolute inset-0 m-auto"
            style={{ width: size * 0.7, height: size * 0.7 }}
          >
            <path
              d="M2.5 6.5l2.4 2.4 4.6-4.8"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}
      {isOnHold && (
        <span className="absolute inset-0 rounded-full bg-current opacity-40" />
      )}
    </span>
  );
}

function OpsPriorityBars({
  priority,
  size = 10,
}: {
  priority: string;
  size?: number;
}) {
  const tone =
    priority === "critical"
      ? "text-destructive"
      : priority === "high"
        ? "text-orange-500"
        : priority === "medium"
          ? "text-amber-500"
          : "text-emerald-500";
  const active =
    priority === "critical" ? 4 :
    priority === "high"     ? 3 :
    priority === "medium"   ? 2 :
                              1;
  const slots = priority === "critical" ? 4 : 3;
  const slotWidth = size / slots - 0.5;

  return (
    <span
      className={`inline-flex items-end gap-[1.5px] shrink-0 ${tone}`}
      style={{ height: size, width: size }}
      title={`Priority: ${priority}`}
    >
      {Array.from({ length: slots }).map((_, i) => {
        const isOn = i < active;
        const fillH = size * (0.4 + 0.2 * i);
        return (
          <span
            key={i}
            className={`rounded-[1px] ${isOn ? "bg-current" : "bg-current opacity-20"}`}
            style={{ width: slotWidth, height: fillH }}
          />
        );
      })}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════
// TasksSection
// ═════════════════════════════════════════════════════════════════

function TasksSection({
  scope,
  username,
  isAdmin,
  onScopeChange,
}: {
  scope: "mine" | "everyone";
  username: string;
  isAdmin: boolean;
  onScopeChange: (s: "mine" | "everyone") => void;
}) {
  const { data: mineTodos, refetch: refetchMine } = Todos(username);
  const { data: everyoneTodos, refetch: refetchEveryone } = AllTodos();
  const todos =
    scope === "everyone"
      ? (everyoneTodos as TodosInterface[] | undefined) ?? []
      : (mineTodos as TodosInterface[] | undefined) ?? [];

  const { data: AllEmployees } = Employees();

  useEffect(() => {
    const ch = companySupabase
      .channel("ops_dash_tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_todos" },
        () => {
          refetchMine();
          refetchEveryone();
        },
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [refetchMine, refetchEveryone]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const meta = todos[0];
  const total = meta?.allCount ?? todos.length;
  const active =
    meta?.inProgressCount ??
    todos.filter((t) => t.status === "in-progress").length;
  const done = meta?.doneCount ?? todos.filter((t) => t.status === "done").length;

  const sorted = useMemo(() => {
    const rank: Record<string, number> = {
      "in-progress": 0,
      "to-do": 1,
      done: 2,
    };
    const pri: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...todos].sort((a, b) => {
      const sr = (rank[a.status as string] ?? 1) - (rank[b.status as string] ?? 1);
      if (sr !== 0) return sr;
      const pr = (pri[b.priority as string] ?? 0) - (pri[a.priority as string] ?? 0);
      if (pr !== 0) return pr;
      const ad = parseDaysLeft(a.deadline as any) ?? Infinity;
      const bd = parseDaysLeft(b.deadline as any) ?? Infinity;
      return ad - bd;
    });
  }, [todos]);

  const onStatusChange = async (id: number, status: string) => {
    // Stamp completed_at on the transition so the Velocity widget
    // has a real "completion time" to query against. Null it back
    // out if a task is being moved out of "done" (reopen).
    const patch: { status: string; completed_at: string | null } = {
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    };
    await companySupabase
.from("cwa_todos")
      .update(patch)
      .eq("todo_id", id);
  };

  const subtitle = (
    <>
      <span className="font-semibold tabular-nums text-foreground/70">{total}</span>
      <span className="mx-1.5">·</span>
      {active} active
      <span className="mx-1.5">·</span>
      {done} done
    </>
  );

  // Bucket sorted tasks into the 3 kanban columns by status.
  const cols = useMemo(() => {
    return {
      todo: sorted.filter((t) => t.status === "to-do"),
      inProgress: sorted.filter((t) => t.status === "in-progress"),
      done: sorted.filter((t) => t.status === "done"),
    };
  }, [sorted]);

  return (
    <SectionCard
      title="Tasks"
      subtitle={subtitle}
      action={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <ScopeToggle scope={scope} onChange={onScopeChange} />
          )}
          <AddTodo Users={AllEmployees || []} />
        </div>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState label="Inbox zero. Nothing on your plate." />
      ) : (
        // Linear-style grouped list: one column, status section
        // headers ("To do · 14", "In Progress · 3", "Done · 33"),
        // bare rows separated only by a hairline. Replaces the
        // previous 3-column kanban grid.
        <div className="max-h-[540px] overflow-y-auto">
          <TaskListGroup
            label="In Progress"
            status="in-progress"
            tasks={cols.inProgress}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onStatusChange={onStatusChange}
          />
          <TaskListGroup
            label="To Do"
            status="to-do"
            tasks={cols.todo}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onStatusChange={onStatusChange}
          />
          <TaskListGroup
            label="Done"
            status="done"
            tasks={cols.done}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onStatusChange={onStatusChange}
            defaultCollapsed
          />
        </div>
      )}
    </SectionCard>
  );
}

/** Compute a label-tone class. Maps known categories to semantic
 *  tints (bug/red, design/yellow, etc.), neutral fallback otherwise. */
function labelTone(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("bug") || l.includes("blocked"))
    return "bg-destructive/15 text-destructive";
  if (l.includes("design") || l.includes("ux"))
    return "bg-warning/15 text-warning";
  if (l.includes("help") || l.includes("review"))
    return "bg-primary/15 text-primary";
  if (l.includes("ship") || l.includes("done"))
    return "bg-success/15 text-success";
  return "bg-foreground/[0.07] text-text-secondary";
}

// ═════════════════════════════════════════════════════════════════
// Linear-style grouped list — single column with collapsible status
// section headers + bare rows. Replaces the 3-column kanban grid.
// ═════════════════════════════════════════════════════════════════

function TaskListGroup({
  label,
  status,
  tasks,
  expandedId,
  setExpandedId,
  onStatusChange,
  defaultCollapsed = false,
}: {
  label: string;
  status: string;
  tasks: TodosInterface[];
  expandedId: number | null;
  setExpandedId: React.Dispatch<React.SetStateAction<number | null>>;
  onStatusChange: (id: number, status: string) => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  if (tasks.length === 0) return null;

  return (
    <div>
      {/* Section header — Linear pattern: status circle, label,
       *  count, chevron. Subtle bg tint when expanded so the
       *  header sticks out a hair from the rows below. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left bg-foreground/[0.025] hover:bg-foreground/[0.04] border-b border-xs border-border/15 sticky top-0 z-[1]"
      >
        <span className="text-text-tertiary text-[10px] font-bold">
          {collapsed ? "▸" : "▾"}
        </span>
        <OpsStatusCircle status={status} size={10} />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/85">
          {label}
        </span>
        <span className="text-[10.5px] font-semibold tabular-nums text-text-tertiary">
          {tasks.length}
        </span>
      </button>

      {!collapsed && (
        <div>
          {tasks.map((task) => (
            <TaskListRow
              key={task.todo_id}
              task={task}
              isExpanded={expandedId === task.todo_id}
              onToggle={() =>
                setExpandedId(expandedId === task.todo_id ? null : task.todo_id)
              }
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskListRow({
  task,
  isExpanded,
  onToggle,
  onStatusChange,
}: {
  task: TodosInterface;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const status = task.status as string;
  const d = parseDaysLeft(task.deadline as any);
  const done = status === "done";
  const showLabel = task.label && task.label !== "Personal";
  const assignees = Array.isArray(task.assignee)
    ? (task.assignee as string[])
    : task.assignee
      ? [String(task.assignee)]
      : [];

  return (
    <div className="group border-b border-xs border-border/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-foreground/[0.035] transition-colors"
      >
        {/* Status circle — left edge, the row's primary anchor. */}
        <OpsStatusCircle status={status} size={12} />

        {/* Title — bare text, medium weight not bold. Strikethrough
         *  when done. This is the dominant element in the row. */}
        <span
          className={`flex-1 text-[12.5px] truncate ${
            done
              ? "line-through text-foreground/55"
              : "text-foreground/95 font-medium"
          }`}
        >
          {task.title}
        </span>

        {/* Trailing meta cluster, right-aligned. Order matches
         *  Linear: priority bars → label dot → due → assignee.
         *  Each piece auto-hides when irrelevant. */}
        <div className="flex items-center gap-2 shrink-0">
          {task.priority && (
            <OpsPriorityBars priority={String(task.priority)} size={9} />
          )}
          {showLabel && (
            <span
              className={`text-[9.5px] font-semibold uppercase tracking-[0.10em] px-1.5 py-0.5 rounded ${labelTone(String(task.label))}`}
            >
              {task.label}
            </span>
          )}
          {d !== null && (
            <span
              className={`text-[10.5px] tabular-nums font-semibold ${dueChipTone(d, done)}`}
            >
              {dueChipText(d)}
            </span>
          )}
          <AvatarStack usernames={assignees} max={1} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-foreground/[0.02]"
          >
            <div className="px-3 py-2 pl-[34px] space-y-2">
              {task.description && (
                <p className="text-[11.5px] text-text-secondary leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {String(task.description).replace(/\n{3,}/g, "\n\n")}
                </p>
              )}
              {/* Quick status-cycle action */}
              {(() => {
                const nextStatus =
                  status === "to-do"
                    ? "in-progress"
                    : status === "in-progress"
                      ? "done"
                      : null;
                if (!nextStatus) return null;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.todo_id, nextStatus);
                    }}
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary hover:opacity-80"
                  >
                    {nextStatus === "in-progress" ? "Start" : "Mark done"}
                    <ChevronRight size={10} strokeWidth={3} />
                  </button>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// QuotasSection
// ═════════════════════════════════════════════════════════════════

function QuotasSection({ me }: { me: any }) {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quota | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);
  const ws = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const we = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekRange = `${format(ws, "MMM d")}–${format(we, "d")}`;

  useEffect(() => {
    let alive = true;
    const fetchQuotas = async () => {
      const { data } = await companySupabase
  .from("weekly_quotas")
        .select("*")
        .gte("week_start", format(ws, "yyyy-MM-dd"))
        .lte("week_end", format(we, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      if (alive) setQuotas((data as Quota[] | null) ?? []);
    };
    fetchQuotas();
    const ch = companySupabase
      .channel("ops_dash_quotas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_quotas" },
        () => fetchQuotas(),
      )
      .subscribe();
    return () => {
      alive = false;
      ch.unsubscribe();
    };
  }, [ws, we]);

  const sorted = useMemo(() => {
    const statusRank: Record<string, number> = {
      "in-progress": 0,
      pending: 1,
      completed: 2,
    };
    return [...quotas].sort((a, b) => {
      const sr = statusRank[a.status] - statusRank[b.status];
      if (sr !== 0) return sr;
      const ad = parseDaysLeft(a.deadline ?? null) ?? Infinity;
      const bd = parseDaysLeft(b.deadline ?? null) ?? Infinity;
      return ad - bd;
    });
  }, [quotas]);

  const onSave = async (data: any) => {
    if (!me?.supa_id) return;
    if (data.id) {
      await companySupabase
  .from("weekly_quotas")
        .update({
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          deadline: data.deadline,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    } else {
      await companySupabase.from("weekly_quotas").insert({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        deadline: data.deadline,
        user_id: me.supa_id,
        week_start: format(ws, "yyyy-MM-dd"),
        week_end: format(we, "yyyy-MM-dd"),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  const onStatusChange = async (id: number, status: string) => {
    await companySupabase
.from("weekly_quotas")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  return (
    <>
      <SectionCard
        title="Quotas"
        subtitle={weekRange}
        action={
          <PillButton
            label="Add"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        }
      >
        {sorted.length === 0 ? (
          <EmptyState label="No quotas this week." />
        ) : (
          <ul className="list-none px-2 pb-3 m-0 max-h-[540px] overflow-y-auto">
            {sorted.map((q, i) => (
              <QuotaRow
                key={q.id}
                quota={q}
                delay={Math.min(i, 8) * 0.025}
                isExpanded={expandedId === q.id}
                onToggle={() =>
                  setExpandedId((x) => (x === q.id ? null : q.id))
                }
                onStatusChange={onStatusChange}
                onEdit={() => {
                  setEditing(q);
                  setDialogOpen(true);
                }}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <QuotaFormDialog
          isOpen={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={onSave}
          editingQuota={editing as any}
        />
      </Dialog>
    </>
  );
}

function QuotaRow({
  quota,
  delay,
  isExpanded,
  onToggle,
  onStatusChange,
  onEdit,
}: {
  quota: Quota;
  delay: number;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: number, status: string) => void;
  onEdit: () => void;
}) {
  // Status dot tone — matches the colored-dot language in the mockup.
  const dotTone =
    quota.status === "completed"
      ? "bg-success"
      : quota.status === "in-progress"
        ? "bg-primary"
        : quota.status === "pending"
          ? "bg-warning"
          : "border border-border-soft bg-transparent";
  const d = parseDaysLeft(quota.deadline ?? null);
  const done = quota.status === "completed";
  const nextStatus =
    quota.status === "pending"
      ? "in-progress"
      : quota.status === "in-progress"
        ? "completed"
        : null;

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.16, 1, 0.3, 1] }}
      className="list-none"
    >
      <div
        className={`rounded-lg transition-colors ${isExpanded ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.03]"}`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotTone}`} />
          <span
            className={`text-[13px] font-semibold truncate flex-1 ${done ? "line-through text-foreground/55" : "text-foreground"}`}
          >
            {quota.title}
          </span>
          {quota.carried_from_week && (
            <Sparkles
              size={10}
              className="text-text-tertiary shrink-0"
              aria-label="Carried over"
            />
          )}
          {d !== null && (
            <span
              className={`text-[11px] tabular-nums font-semibold shrink-0 ${dueChipTone(d, done)}`}
            >
              {dueChipText(d)}
            </span>
          )}
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-0.5 pl-8 space-y-2.5">
                {quota.description ? (
                  <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-4">
                    {quota.description}
                  </p>
                ) : (
                  <p className="text-[11.5px] text-text-tertiary italic">
                    No description.
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {nextStatus && (
                    <InlineAction
                      tone={nextStatus === "in-progress" ? "primary" : "success"}
                      onClick={() => onStatusChange(quota.id, nextStatus)}
                    >
                      {nextStatus === "in-progress" ? "Start" : "Mark done"}
                    </InlineAction>
                  )}
                  {quota.status === "in-progress" && (
                    <InlineAction
                      tone="neutral"
                      onClick={() => onStatusChange(quota.id, "pending")}
                    >
                      Move back
                    </InlineAction>
                  )}
                  {quota.status === "completed" && (
                    <InlineAction
                      tone="neutral"
                      onClick={() => onStatusChange(quota.id, "pending")}
                    >
                      Reopen
                    </InlineAction>
                  )}
                  <InlineAction tone="neutral" onClick={onEdit}>
                    Edit
                  </InlineAction>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

// ═════════════════════════════════════════════════════════════════
// ActivityFeed
// ═════════════════════════════════════════════════════════════════

interface ActivityEvent {
  id: string;
  kind: "task" | "quota" | "project";
  title: string;
  status: string;
  when: string;
  ts: number;
}

function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [tasksRes, quotasRes, projectsRes] = await Promise.all([
        companySupabase
          .from("cwa_todos")
          .select("todo_id, title, created_at, status")
          .order("created_at", { ascending: false })
          .limit(8),
        companySupabase
          .from("weekly_quotas")
          .select("id, title, created_at, status")
          .order("created_at", { ascending: false })
          .limit(8),
        companySupabase
          .from("cwa_projects")
          .select("id, title, created_at, status")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const merged: ActivityEvent[] = [];
      for (const t of (tasksRes.data as any[] | null) ?? [])
        merged.push({
          id: `t-${t.todo_id}`,
          kind: "task",
          title: t.title ?? "(Untitled)",
          status: t.status ?? "",
          when: relativeTime(t.created_at),
          ts: Date.parse(t.created_at) || 0,
        });
      for (const q of (quotasRes.data as any[] | null) ?? [])
        merged.push({
          id: `q-${q.id}`,
          kind: "quota",
          title: q.title,
          status: q.status ?? "",
          when: relativeTime(q.created_at),
          ts: Date.parse(q.created_at) || 0,
        });
      for (const p of (projectsRes.data as any[] | null) ?? [])
        merged.push({
          id: `p-${p.id}`,
          kind: "project",
          title: p.title,
          status: p.status ?? "",
          when: relativeTime(p.created_at),
          ts: Date.parse(p.created_at) || 0,
        });
      merged.sort((a, b) => b.ts - a.ts);
      if (alive) setEvents(merged.slice(0, 10));
    };
    load();
  }, []);

  const kindTone = (k: ActivityEvent["kind"]): string =>
    k === "task"
      ? "bg-primary"
      : k === "quota"
        ? "bg-warning"
        : "bg-success";

  return (
    <SectionCard
      title="Activity"
      subtitle={
        <span className="font-semibold tabular-nums text-foreground/70">
          {events.length}
        </span>
      }
    >
      {events.length === 0 ? (
        <EmptyState label="No recent activity yet." />
      ) : (
        <ul className="list-none px-2 pb-3 m-0 max-h-[280px] overflow-y-auto">
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(i, 8) * 0.025,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="list-none flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${kindTone(e.kind)}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                  {e.title}
                </p>
                <p className="text-[11px] text-text-tertiary mt-1 capitalize">
                  {e.kind} · {e.status.replace(/-/g, " ")}
                </p>
              </div>
              <span className="text-[11px] text-text-tertiary tabular-nums shrink-0 mt-0.5 font-medium">
                {e.when}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ═════════════════════════════════════════════════════════════════
// ProjectsSection
// ═════════════════════════════════════════════════════════════════

function ProjectsSection({ me }: { me: any }) {
  useProjectsRealtime();
  const { data: projects = [] } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inFlight = projects.filter(
    (p) => p.status === "in_progress" || p.status === "review",
  ).length;
  const done = projects.filter((p) => p.status === "completed").length;

  const subtitle = `${inFlight} in flight · ${done} done`;

  return (
    <>
      <SectionCard
        title="Projects"
        subtitle={subtitle}
        action={
          <PillButton
            label="New project"
            onClick={() => setCreateOpen(true)}
          />
        }
        // min-h so the card has presence even with a single project.
        // Reduced now that Projects shares a row with Velocity in
        // the compact bento — doesn't need to hold its own against
        // a tall Tasks column anymore.
        bodyClassName="min-h-[260px]"
      >
        {projects.length === 0 ? (
          <EmptyState label="No projects yet. Spin one up." />
        ) : (
          <div className="px-3 pb-3 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-min">
            {projects.map((p, i) => (
              <ProjectCardCompact
                key={p.id}
                project={p}
                delay={Math.min(i, 8) * 0.03}
                isExpanded={expandedId === p.id}
                onToggle={() =>
                  setExpandedId((x) => (x === p.id ? null : p.id))
                }
                onEdit={() => setEditingProject(p)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {createOpen && (
        <CreateProjectDialog
          onClose={() => setCreateOpen(false)}
          me={me}
          onCreated={() => setCreateOpen(false)}
        />
      )}

      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          onClose={() => setEditingProject(null)}
          me={me}
        />
      )}
    </>
  );
}

function ProjectCardCompact({
  project,
  delay,
  isExpanded,
  onToggle,
  onEdit,
}: {
  project: Project;
  delay: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const sm = PROJECT_STATUS_META[project.status];
  const days = project.due
    ? Math.round((Date.parse(project.due) - Date.now()) / 86_400_000)
    : null;
  const remaining =
    project.due === null
      ? "No deadline"
      : days !== null && days < 0
        ? `${Math.abs(days)} days overdue`
        : days === 0
          ? "Due today"
          : `${days} days remaining`;
  const remainingTone =
    days === null
      ? "text-text-tertiary"
      : days < 0
        ? "text-destructive"
        : days <= 7
          ? "text-warning"
          : "text-text-tertiary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/30 transition-colors overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex flex-col gap-3"
      >
        {/* Top row — Linear-style: status circle inline with title,
         *  priority bars + remaining label on the right. Same
         *  pattern as the standalone Projects page card view. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-start gap-2">
            <span className="pt-[3px] shrink-0">
              <OpsStatusCircle status={project.status} size={12} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold text-foreground leading-[1.25] line-clamp-2">
                {project.title}
              </h3>
              <p className="text-[10.5px] mt-0.5 text-text-tertiary">
                {sm.label}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {project.priority && (
              <OpsPriorityBars priority={project.priority} size={10} />
            )}
            <p className={`text-[10.5px] font-medium ${remainingTone}`}>
              {remaining}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1">
            <span>Progress</span>
            <span className="tabular-nums text-foreground/80">
              {project.progress}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
            <motion.div
              className={`h-full rounded-full origin-left ${project.status === "completed" ? "bg-success" : "bg-primary"}`}
              initial={{ width: 0, scaleY: 0.4 }}
              animate={{ width: `${project.progress}%`, scaleY: 1 }}
              transition={{
                width: {
                  duration: 0.9,
                  delay: delay + 0.25,
                  ease: [0.16, 1, 0.3, 1],
                },
                scaleY: {
                  duration: 0.4,
                  delay: delay + 0.15,
                  ease: [0.16, 1, 0.3, 1],
                },
              }}
            />
          </div>
        </div>

        {/* Bottom row — owner avatar + task count. Priority moved
         *  up into the header row alongside status, so this row
         *  stays quiet. */}
        <div className="flex items-center justify-between gap-2">
          <AvatarStack
            usernames={project.owner_username ? [project.owner_username] : []}
            max={3}
          />
          <span className="inline-flex items-baseline gap-1 text-[11.5px] tabular-nums shrink-0">
            <span className="font-semibold text-foreground">
              {project.tasks_done}/{project.tasks_total}
            </span>
            <span className="text-text-tertiary text-[10px]">tasks</span>
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-xs border-border/15">
              {project.description ? (
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {project.description}
                </p>
              ) : (
                <p className="text-[11px] text-text-tertiary italic">
                  No description.
                </p>
              )}
              {project.tags && project.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {project.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-bold uppercase tracking-[0.10em] text-text-tertiary bg-foreground/[0.06] px-1.5 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold text-foreground/85 border border-border-soft hover:border-primary/40 hover:text-primary hover:bg-primary/[0.06] transition-colors"
                >
                  <Pencil size={10} strokeWidth={2.4} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] text-text-tertiary hover:text-foreground transition-colors"
                >
                  <ChevronDown size={11} className="rotate-180" />
                  <span>Collapse</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════
// useOpsAggregate — shared cross-domain data hook
// ═════════════════════════════════════════════════════════════════
// Pulls everything the new widgets need in one place. Counts that
// can't be derived from in-memory data (done-this-week needs a
// status+timestamp filter, stuck count needs an "untouched" filter)
// run as small COUNT-only Supabase queries — no row payloads.
// ═════════════════════════════════════════════════════════════════

interface OpsAux {
  pendingQuotas: number;
  doneThisWeek: number;
  stuckCount: number;
}

function useOpsAggregate(
  todos: TodosInterface[],
  projects: Project[],
): { aux: OpsAux; refreshAux: () => void } {
  const [aux, setAux] = useState<OpsAux>({
    pendingQuotas: 0,
    doneThisWeek: 0,
    stuckCount: 0,
  });
  const [auxTick, setAuxTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    (async () => {
      const [quotasRes, doneRes, stuckRes] = await Promise.all([
        companySupabase
          .from("weekly_quotas")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("week_start", format(ws, "yyyy-MM-dd"))
          .lte("week_end", format(we, "yyyy-MM-dd")),
        companySupabase
          .from("cwa_todos")
          .select("todo_id", { count: "exact", head: true })
          .eq("status", "done")
          .not("completed_at", "is", null)
          .gte("completed_at", ws.toISOString()),
        companySupabase
          .from("cwa_todos")
          .select("todo_id", { count: "exact", head: true })
          .neq("status", "done")
          // `cwa_todos` has no `updated_at` column — use created_at
          // as the aging proxy. "Created >7d ago and still not done"
          // is actually a clean definition of stuck.
          .lt("created_at", sevenDaysAgo),
      ]);
      if (alive) {
        setAux({
          pendingQuotas: quotasRes.count ?? 0,
          doneThisWeek: doneRes.count ?? 0,
          stuckCount: stuckRes.count ?? 0,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [auxTick, todos.length, projects.length]);

  const refreshAux = useCallback(() => setAuxTick((x) => x + 1), []);
  return { aux, refreshAux };
}

// ═════════════════════════════════════════════════════════════════
// AxonBriefBanner — LLM-generated 15-25 word status briefing
// ═════════════════════════════════════════════════════════════════
// Varies every call because the underlying request uses
// temperature 1.0 + a random "framing angle" hint + time-of-day
// signal. Same numbers twice in a row will still yield different
// briefings.
// ═════════════════════════════════════════════════════════════════

function AxonBriefBanner({
  todos,
  projects,
  aux,
  username,
}: {
  todos: TodosInterface[];
  projects: Project[];
  aux: OpsAux;
  username: string;
}) {
  const [brief, setBrief] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);

    const dueToday = todos.filter(
      (t) => parseDaysLeft(t.deadline as any) === 0 && t.status !== "done",
    ).length;
    const overdue = todos.filter((t) => {
      const d = parseDaysLeft(t.deadline as any);
      return d !== null && d < 0 && t.status !== "done";
    }).length;
    const inProgress = todos.filter((t) => t.status === "in-progress").length;
    const highPriorityCount = todos.filter(
      (t) => t.priority === "high" && t.status !== "done",
    ).length;
    const activeProjects = projects.filter(
      (p) => p.status === "in_progress" || p.status === "review",
    ).length;
    const topTitles = [...todos]
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        const ad = parseDaysLeft(a.deadline as any) ?? Infinity;
        const bd = parseDaysLeft(b.deadline as any) ?? Infinity;
        return ad - bd;
      })
      .slice(0, 3)
      .map((t) => t.title ?? "Untitled");

    const snap: OperationsSnapshot = {
      operator: username || "you",
      hour: new Date().getHours(),
      dueToday,
      overdue,
      inProgress,
      doneThisWeek: aux.doneThisWeek,
      activeProjects,
      pendingQuotas: aux.pendingQuotas,
      stuckCount: aux.stuckCount,
      highPriorityCount,
      topTitles,
    };

    const res = await draftOperationsBrief(snap);
    if (res.error) setError(res.error);
    else setBrief(res.text);
    setLoading(false);
  }, [todos, projects, aux, username]);

  // Auto-generate once when meaningful data is available. We wait
  // for any data signal so the first brief isn't generated against
  // an empty snapshot.
  useEffect(() => {
    if (hasGenerated) return;
    if (
      todos.length > 0 ||
      projects.length > 0 ||
      aux.pendingQuotas > 0 ||
      aux.doneThisWeek > 0
    ) {
      setHasGenerated(true);
      generate();
    }
  }, [hasGenerated, todos.length, projects.length, aux, generate]);

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl border-xs border-border-soft overflow-hidden"
    >
      {/* Soft primary wash on the left — gives the banner a hint of
       *  Axon-brand identity without a loud full-bleed gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          background:
            "radial-gradient(45% 100% at 0% 50%, hsl(var(--primary)) 0%, transparent 70%)",
        }}
      />
      {/* Shimmer sweep — primary-tinted gradient that travels
       *  across the card every ~9 seconds. Subtle ambient motion
       *  signals the banner is "alive" without distracting. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-2/3"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.14) 50%, transparent 100%)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "220%" }}
        transition={{
          duration: 2.6,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 6.5,
        }}
      />
      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/90">
              Axon Brief
            </span>
            <span className="text-[9px] text-text-tertiary">· live</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-text-tertiary">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[12px] italic">Reading the room…</span>
            </div>
          ) : error ? (
            <p className="text-[11.5px] text-destructive/90">{error}</p>
          ) : brief ? (
            <p className="text-[12.5px] text-foreground/90 leading-snug">
              {brief}
            </p>
          ) : (
            <p className="text-[12px] text-text-tertiary italic">
              Click refresh for a status read.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10.5px] font-semibold text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.04] transition-colors disabled:opacity-50"
          title="Regenerate brief"
        >
          <RefreshCw
            size={10}
            strokeWidth={2.4}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>
    </motion.section>
  );
}

// ═════════════════════════════════════════════════════════════════
// KpiStrip — 4 metric tiles row
// ═════════════════════════════════════════════════════════════════

function KpiStrip({
  todos,
  aux,
}: {
  todos: TodosInterface[];
  aux: OpsAux;
}) {
  const stats = useMemo(() => {
    const dueToday = todos.filter(
      (t) => parseDaysLeft(t.deadline as any) === 0 && t.status !== "done",
    ).length;
    const overdue = todos.filter((t) => {
      const d = parseDaysLeft(t.deadline as any);
      return d !== null && d < 0 && t.status !== "done";
    }).length;
    const inProgress = todos.filter((t) => t.status === "in-progress").length;
    return { dueToday, overdue, inProgress };
  }, [todos]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        label="Due Today"
        value={stats.dueToday}
        Icon={Calendar}
        tone="warning"
      />
      <KpiTile
        label="Overdue"
        value={stats.overdue}
        Icon={AlertTriangle}
        tone="destructive"
      />
      <KpiTile
        label="In Progress"
        value={stats.inProgress}
        Icon={CircleDashed}
        tone="primary"
      />
      <KpiTile
        label="Done"
        sublabel="this week"
        value={aux.doneThisWeek}
        Icon={CheckCircle2}
        tone="success"
      />
    </div>
  );
}

function KpiTile({
  label,
  sublabel,
  value,
  Icon,
  tone,
}: {
  label: string;
  sublabel?: string;
  value: number;
  Icon: typeof Calendar;
  tone: "warning" | "destructive" | "primary" | "success";
}) {
  const toneCls =
    tone === "destructive"
      ? { text: "text-destructive", bg: "bg-destructive/12" }
      : tone === "warning"
        ? { text: "text-warning", bg: "bg-warning/12" }
        : tone === "success"
          ? { text: "text-success", bg: "bg-success/12" }
          : { text: "text-primary", bg: "bg-primary/12" };

  return (
    <div className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] px-3 py-2.5 flex items-center gap-2.5">
      <div
        className={`w-7 h-7 rounded-lg ${toneCls.bg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`h-3.5 w-3.5 ${toneCls.text}`} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-[18px] font-bold tabular-nums leading-none ${value === 0 ? "text-foreground/40" : toneCls.text}`}
          >
            {value}
          </span>
          {sublabel && (
            <span className="text-[9.5px] text-text-tertiary truncate">
              {sublabel}
            </span>
          )}
        </div>
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// TodaysFocus — top priority items across tasks + quotas + projects
// ═════════════════════════════════════════════════════════════════

interface FocusItem {
  id: string;
  kind: "task" | "quota" | "project";
  title: string;
  due: number | null;
  score: number;
  status: string;
}

function TodaysFocus({
  todos,
  projects,
}: {
  todos: TodosInterface[];
  projects: Project[];
}) {
  const [quotas, setQuotas] = useState<Quota[]>([]);

  useEffect(() => {
    let alive = true;
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    (async () => {
      const { data } = await companySupabase
  .from("weekly_quotas")
        .select("id, title, status, deadline, priority")
        .gte("week_start", format(ws, "yyyy-MM-dd"))
        .lte("week_end", format(we, "yyyy-MM-dd"))
        .neq("status", "completed");
      if (alive) setQuotas((data as Quota[] | null) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Score each item by urgency × priority × kind-weight. Items
  // already done are excluded. Returns top 5.
  const items: FocusItem[] = useMemo(() => {
    const out: FocusItem[] = [];
    const priWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const urgency = (d: number | null) => {
      if (d === null) return 0;
      if (d < 0) return 6; // overdue beats everything
      if (d === 0) return 5;
      if (d <= 3) return 3;
      if (d <= 7) return 1;
      return 0;
    };

    for (const t of todos) {
      if (t.status === "done") continue;
      const d = parseDaysLeft(t.deadline as any);
      const score =
        urgency(d) + (priWeight[(t.priority as string) ?? "low"] ?? 1);
      out.push({
        id: `t-${t.todo_id}`,
        kind: "task",
        title: t.title ?? "Untitled",
        due: d,
        score,
        status: (t.status as string) ?? "",
      });
    }
    for (const q of quotas) {
      const d = parseDaysLeft(q.deadline ?? null);
      const score =
        urgency(d) + (priWeight[q.priority ?? "low"] ?? 1) + 0.5;
      out.push({
        id: `q-${q.id}`,
        kind: "quota",
        title: q.title,
        due: d,
        score,
        status: q.status,
      });
    }
    for (const p of projects) {
      if (p.status === "completed") continue;
      const d = p.due
        ? Math.round((Date.parse(p.due) - Date.now()) / 86_400_000)
        : null;
      const score =
        urgency(d) +
        (priWeight[(p.priority as string) ?? "medium"] ?? 2) +
        0.5;
      out.push({
        id: `p-${p.id}`,
        kind: "project",
        title: p.title,
        due: d,
        score,
        status: p.status,
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [todos, quotas, projects]);

  return (
    <SectionCard
      title="Today's Focus"
      subtitle={`top ${items.length} by urgency`}
    >
      {items.length === 0 ? (
        <EmptyState label="Nothing pressing. Coast." />
      ) : (
        <ul className="list-none px-2 pb-3 m-0 max-h-[280px] overflow-y-auto">
          {items.map((it, i) => (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(i, 4) * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="list-none flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors"
            >
              {/* Rank number — small chip showing position */}
              <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/[0.06] text-text-tertiary text-[10px] font-bold tabular-nums flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">
                  {it.title}
                </p>
                <p className="text-[10.5px] text-text-tertiary mt-0.5 capitalize">
                  {it.kind} · {it.status.replace(/-/g, " ").replace(/_/g, " ")}
                </p>
              </div>
              {it.due !== null && (
                <span
                  className={`text-[10.5px] tabular-nums font-semibold shrink-0 ${dueChipTone(it.due, false)}`}
                >
                  {dueChipText(it.due)}
                </span>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ═════════════════════════════════════════════════════════════════
// StuckItems — items untouched for >7d
// ═════════════════════════════════════════════════════════════════

interface StuckRow {
  id: string;
  kind: "task" | "project";
  title: string;
  ageDays: number;
  status: string;
}

function StuckItems() {
  const [rows, setRows] = useState<StuckRow[]>([]);

  useEffect(() => {
    let alive = true;
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 86_400_000,
    ).toISOString();

    (async () => {
      // `cwa_todos` has no `updated_at` column; use `created_at`.
      // `cwa_projects` does have `updated_at` so keep that.
      const [tasksRes, projectsRes] = await Promise.all([
        companySupabase
          .from("cwa_todos")
          .select("todo_id, title, status, created_at")
          .neq("status", "done")
          .lt("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true })
          .limit(8),
        companySupabase
          .from("cwa_projects")
          .select("id, title, status, updated_at")
          .neq("status", "completed")
          .lt("updated_at", sevenDaysAgo)
          .order("updated_at", { ascending: true })
          .limit(6),
      ]);

      const out: StuckRow[] = [];
      const now = Date.now();
      for (const t of (tasksRes.data as any[] | null) ?? []) {
        const age = Math.floor(
          (now - Date.parse(t.created_at)) / 86_400_000,
        );
        out.push({
          id: `t-${t.todo_id}`,
          kind: "task",
          title: t.title ?? "Untitled",
          ageDays: age,
          status: t.status ?? "",
        });
      }
      for (const p of (projectsRes.data as any[] | null) ?? []) {
        const age = Math.floor(
          (now - Date.parse(p.updated_at)) / 86_400_000,
        );
        out.push({
          id: `p-${p.id}`,
          kind: "project",
          title: p.title ?? "Untitled",
          ageDays: age,
          status: p.status ?? "",
        });
      }
      out.sort((a, b) => b.ageDays - a.ageDays);
      if (alive) setRows(out.slice(0, 6));
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionCard
      title="Stuck"
      subtitle={
        rows.length > 0 ? `${rows.length} idle >7d` : "nothing aging"
      }
    >
      {rows.length === 0 ? (
        <EmptyState label="No stuck items. Clean board." />
      ) : (
        <ul className="list-none px-2 pb-3 m-0 max-h-[280px] overflow-y-auto">
          {rows.map((r, i) => {
            const ageTone =
              r.ageDays >= 30
                ? "text-destructive"
                : r.ageDays >= 14
                  ? "text-warning"
                  : "text-text-tertiary";
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(i, 4) * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="list-none flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors"
              >
                <AlertTriangle
                  size={11}
                  strokeWidth={2.4}
                  className={`shrink-0 ${ageTone}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">
                    {r.title}
                  </p>
                  <p className="text-[10.5px] text-text-tertiary mt-0.5 capitalize">
                    {r.kind} ·{" "}
                    {r.status.replace(/-/g, " ").replace(/_/g, " ")}
                  </p>
                </div>
                <span
                  className={`text-[10.5px] tabular-nums font-semibold shrink-0 ${ageTone}`}
                >
                  {r.ageDays}d
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ═════════════════════════════════════════════════════════════════
// VelocityPulse — sparkline of daily completions (14d)
// ═════════════════════════════════════════════════════════════════

function VelocityPulse() {
  const [daily, setDaily] = useState<number[]>(new Array(14).fill(0));
  const [thisWeek, setThisWeek] = useState(0);
  const [lastWeek, setLastWeek] = useState(0);

  useEffect(() => {
    let alive = true;
    const start = new Date(Date.now() - 13 * 86_400_000);
    start.setHours(0, 0, 0, 0);

    (async () => {
      const { data } = await companySupabase
  .from("cwa_todos")
        .select("updated_at")
        .eq("status", "done")
        .gte("updated_at", start.toISOString())
        .limit(500);

      const buckets = new Array(14).fill(0);
      for (const row of (data as { updated_at: string }[] | null) ?? []) {
        const t = Date.parse(row.updated_at);
        if (!Number.isFinite(t)) continue;
        const idx = 13 - Math.floor((Date.now() - t) / 86_400_000);
        if (idx >= 0 && idx < 14) buckets[idx] = (buckets[idx] ?? 0) + 1;
      }
      if (!alive) return;
      setDaily(buckets);
      const last = buckets.slice(0, 7).reduce((a, b) => a + b, 0);
      const cur = buckets.slice(7).reduce((a, b) => a + b, 0);
      setLastWeek(last);
      setThisWeek(cur);
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Week-over-week delta percentage. Clamp display range.
  const delta =
    lastWeek === 0 && thisWeek === 0
      ? 0
      : lastWeek === 0
        ? 100
        : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  const deltaSign = delta > 0 ? "+" : "";
  const deltaTone =
    delta > 0
      ? "text-success"
      : delta < 0
        ? "text-destructive"
        : "text-text-tertiary";

  return (
    <SectionCard title="Velocity" subtitle="last 14 days · tasks done">
      <div className="px-5 pb-4 pt-1 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold tabular-nums leading-none text-foreground">
                {thisWeek}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                this week
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <TrendingUp
                size={11}
                strokeWidth={2.4}
                className={deltaTone}
                style={{
                  transform: delta < 0 ? "rotate(180deg)" : undefined,
                }}
              />
              <span
                className={`text-[11px] font-bold tabular-nums ${deltaTone}`}
              >
                {deltaSign}
                {delta}%
              </span>
              <span className="text-[10.5px] text-text-tertiary">
                vs last week ({lastWeek})
              </span>
            </div>
          </div>
        </div>

        <Sparkline values={daily} highlightFrom={7} />
      </div>
    </SectionCard>
  );
}

/** Minimal SVG sparkline. `highlightFrom` shifts the latter half
 *  of the curve to primary tone — visualizes "this week" vs the
 *  baseline week. */
function Sparkline({
  values,
  highlightFrom = 0,
}: {
  values: number[];
  highlightFrom?: number;
}) {
  const W = 320;
  const H = 56;
  const maxV = Math.max(1, ...values);
  const step = W / Math.max(1, values.length - 1);

  // Build smooth path. Vertical scale leaves 4px headroom top/bot.
  const toY = (v: number) => H - 4 - (v / maxV) * (H - 8);
  const points = values.map((v, i) => [i * step, toY(v)] as const);
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

  // Area fill goes from the line down to the baseline.
  const areaPath = `${linePath} L${(values.length - 1) * step},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-14"
      role="img"
      aria-label="14-day completions sparkline"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i >= highlightFrom ? 1.8 : 1.2}
          fill={
            i >= highlightFrom
              ? "hsl(var(--primary))"
              : "hsl(var(--primary) / 0.5)"
          }
        />
      ))}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════
// StatusGrid — all 4 KPIs packed into one card (replaces top strip)
// ═════════════════════════════════════════════════════════════════
// Same metrics that used to live in the standalone KpiStrip, now
// folded into a single bento cell as a 2×2 of compact stat tiles.
// Removes the redundant "stats above the grid" row.
// ═════════════════════════════════════════════════════════════════

function StatusGrid({
  todos,
  aux,
}: {
  todos: TodosInterface[];
  aux: OpsAux;
}) {
  const stats = useMemo(() => {
    const dueToday = todos.filter(
      (t) => parseDaysLeft(t.deadline as any) === 0 && t.status !== "done",
    ).length;
    const overdue = todos.filter((t) => {
      const d = parseDaysLeft(t.deadline as any);
      return d !== null && d < 0 && t.status !== "done";
    }).length;
    const inProgress = todos.filter((t) => t.status === "in-progress").length;
    return { dueToday, overdue, inProgress };
  }, [todos]);

  return (
    <SectionCard title="Status" subtitle="at a glance">
      <div className="px-3 pb-3 grid grid-cols-2 gap-2 auto-rows-fr">
        <StatTile
          label="Due today"
          value={stats.dueToday}
          Icon={Calendar}
          tone="warning"
        />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          Icon={AlertTriangle}
          tone="destructive"
        />
        <StatTile
          label="In progress"
          value={stats.inProgress}
          Icon={CircleDashed}
          tone="primary"
        />
        <StatTile
          label="Done"
          sublabel="this week"
          value={aux.doneThisWeek}
          Icon={CheckCircle2}
          tone="success"
        />
      </div>
    </SectionCard>
  );
}

function StatTile({
  label,
  sublabel,
  value,
  Icon,
  tone,
}: {
  label: string;
  sublabel?: string;
  value: number;
  Icon: typeof Calendar;
  tone: "warning" | "destructive" | "primary" | "success";
}) {
  const toneCls =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-primary";

  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] p-2.5 flex flex-col justify-between gap-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className={`h-3 w-3 shrink-0 ${toneCls}`} strokeWidth={2.4} />
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-tertiary truncate">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[20px] font-bold tabular-nums leading-none ${value === 0 ? "text-foreground/35" : toneCls}`}
        >
          {value}
        </span>
        {sublabel && (
          <span className="text-[9px] text-text-tertiary truncate">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// CompletionDonut — current task distribution as a ring chart
// ═════════════════════════════════════════════════════════════════
// Replaces the 14-day velocity sparkline, which depended on done
// tasks having an `updated_at` that actually flips on status change
// — unreliable in practice. The donut visualizes the CURRENT
// pipeline split (done / in progress / to do) and a hero
// completion % at the center. Pure derived state from `todos`.
// ═════════════════════════════════════════════════════════════════

function CompletionDonut({ todos }: { todos: TodosInterface[] }) {
  const stats = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    let todo = 0;
    for (const t of todos) {
      if (t.status === "done") done++;
      else if (t.status === "in-progress") inProgress++;
      else todo++;
    }
    const total = done + inProgress + todo;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, inProgress, todo, total, pct };
  }, [todos]);

  return (
    <SectionCard title="Completion" subtitle="task pipeline">
      <div className="px-4 pb-4 pt-1 flex items-center gap-4">
        <Donut
          done={stats.done}
          inProgress={stats.inProgress}
          todo={stats.todo}
          percent={stats.pct}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <LegendRow tone="success" label="Done" count={stats.done} />
          <LegendRow tone="primary" label="In progress" count={stats.inProgress} />
          <LegendRow tone="muted" label="To do" count={stats.todo} />
          <div className="pt-1.5 border-t border-xs border-border/15 flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              Total
            </span>
            <span className="text-[12.5px] font-bold tabular-nums text-foreground">
              {stats.total}
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/** SVG donut ring. Three arcs (done / in-progress / to-do)
 *  rendered via stroke-dasharray with cumulative offsets.
 *  The center shows hero % + DONE label. */
function Donut({
  done,
  inProgress,
  todo,
  percent,
}: {
  done: number;
  inProgress: number;
  todo: number;
  percent: number;
}) {
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = done + inProgress + todo;

  // Arc lengths in path units. If total is zero the ring is empty
  // (only the muted track shows).
  const doneLen = total === 0 ? 0 : (done / total) * circ;
  const progLen = total === 0 ? 0 : (inProgress / total) * circ;
  const todoLen = total === 0 ? 0 : (todo / total) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`Task pipeline: ${done} done, ${inProgress} in progress, ${todo} to do`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        style={{ stroke: "hsl(var(--foreground) / 0.06)" }}
      />
      {/* Done arc (green) */}
      {done > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "hsl(var(--success))" }}
          strokeDasharray={`${doneLen} ${circ}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {/* In-progress arc (primary) */}
      {inProgress > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "hsl(var(--primary))" }}
          strokeDasharray={`${progLen} ${circ}`}
          strokeDashoffset={-doneLen}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {/* To-do arc (muted) */}
      {todo > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "hsl(var(--foreground) / 0.28)" }}
          strokeDasharray={`${todoLen} ${circ}`}
          strokeDashoffset={-(doneLen + progLen)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {/* Center hero % */}
      <text
        x={size / 2}
        y={size / 2 - 1}
        textAnchor="middle"
        style={{
          fill: "hsl(var(--foreground))",
          fontSize: "20px",
          fontWeight: 700,
          fontFamily:
            "var(--ed-font-display, Inter), system-ui, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {percent}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        style={{
          fill: "hsl(var(--text-tertiary, var(--foreground) / 0.55))",
          fontSize: "8px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          fontFamily: "inherit",
        }}
      >
        done
      </text>
    </svg>
  );
}

function LegendRow({
  tone,
  label,
  count,
}: {
  tone: "success" | "primary" | "muted";
  label: string;
  count: number;
}) {
  const dotCls =
    tone === "success"
      ? "bg-success"
      : tone === "primary"
        ? "bg-primary"
        : "bg-foreground/30";
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
      <span className="text-text-secondary flex-1 truncate">{label}</span>
      <span className="font-bold tabular-nums text-foreground shrink-0">
        {count}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// CompletionVelocity — week-over-week velocity bar chart + nav
// ═════════════════════════════════════════════════════════════════
// Replaces the donut. Shows tasks completed for the SELECTED week
// (start at "this week"), with a hero count + delta vs the
// previous week, plus a 6-week bar chart for trend context.
// Prev / Next chevrons in the header let you walk back through
// recent weeks and compare. "Next" disables when at this week.
// ═════════════════════════════════════════════════════════════════

interface WeekWindow {
  ws: Date;
  we: Date;
  key: string;
}

function CompletionVelocity() {
  const WINDOW = 6;
  // weekOffset 0 = this week, negative = past, positive disallowed.
  const [weekOffset, setWeekOffset] = useState(0);

  // Build the 6-week window ending at the SELECTED week.
  const weeks: WeekWindow[] = useMemo(() => {
    const today = new Date();
    const list: WeekWindow[] = [];
    for (let i = WINDOW - 1; i >= 0; i--) {
      const ref = new Date(today);
      // Shift back by (i - weekOffset) weeks; weekOffset is <= 0.
      ref.setDate(ref.getDate() + (weekOffset - i) * 7);
      const ws = startOfWeek(ref, { weekStartsOn: 1 });
      const we = endOfWeek(ref, { weekStartsOn: 1 });
      list.push({ ws, we, key: format(ws, "yyyy-MM-dd") });
    }
    return list;
  }, [weekOffset]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const oldest = weeks[0]!.ws;
    const newest = weeks[weeks.length - 1]!.we;
    (async () => {
      // Query the dedicated `completed_at` column added by the
      // `cwa_todos_completed_at` migration. The partial index on
      // that column makes this range scan cheap. `status` filter
      // is belt-and-suspenders — only done rows ever get a
      // non-null completed_at, but keeps the planner happy.
      const { data } = await companySupabase
  .from("cwa_todos")
        .select("completed_at")
        .eq("status", "done")
        .not("completed_at", "is", null)
        .gte("completed_at", oldest.toISOString())
        .lte("completed_at", newest.toISOString())
        .limit(2000);
      if (!alive) return;
      const c: Record<string, number> = {};
      for (const w of weeks) c[w.key] = 0;
      for (const row of (data as { completed_at: string }[] | null) ?? []) {
        const ts = Date.parse(row.completed_at);
        if (!Number.isFinite(ts)) continue;
        for (const w of weeks) {
          if (ts >= w.ws.getTime() && ts <= w.we.getTime() + 86_400_000) {
            c[w.key] = (c[w.key] ?? 0) + 1;
            break;
          }
        }
      }
      setCounts(c);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [weeks]);

  const selected = weeks[weeks.length - 1]!;
  const previous = weeks[weeks.length - 2]!;
  const selectedCount = counts[selected.key] ?? 0;
  const prevCount = counts[previous.key] ?? 0;

  const delta =
    prevCount === 0 && selectedCount === 0
      ? 0
      : prevCount === 0
        ? 100
        : Math.round(((selectedCount - prevCount) / prevCount) * 100);
  const deltaSign = delta > 0 ? "+" : "";
  const deltaTone =
    delta > 0
      ? "text-success"
      : delta < 0
        ? "text-destructive"
        : "text-text-tertiary";

  const isCurrentWeek = weekOffset === 0;
  const maxCount = Math.max(1, ...Object.values(counts));

  // Label that contextualizes the selected week relative to "now".
  const weekContext =
    weekOffset === 0
      ? "this week"
      : weekOffset === -1
        ? "last week"
        : `${Math.abs(weekOffset)} weeks ago`;

  return (
    <SectionCard
      title="Velocity"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-0.5 -m-0.5 text-text-tertiary hover:text-foreground rounded transition-colors"
            title="Previous week"
            aria-label="Previous week"
          >
            <ChevronLeft size={11} strokeWidth={2.4} />
          </button>
          <span className="text-[10.5px] tabular-nums font-semibold text-foreground/75">
            {format(selected.ws, "MMM d")}–{format(selected.we, "d")}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
            disabled={isCurrentWeek}
            className="p-0.5 -m-0.5 text-text-tertiary hover:text-foreground rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-text-tertiary"
            title={isCurrentWeek ? "Already at this week" : "Next week"}
            aria-label="Next week"
          >
            <ChevronRight size={11} strokeWidth={2.4} />
          </button>
        </span>
      }
    >
      <div className="px-4 pb-4 pt-1 flex flex-col gap-3 h-full">
        {/* Hero — selected week count + delta vs previous.
         *  Number is keyed by selectedCount + weekOffset so it
         *  re-mounts and pops on every week navigation. */}
        <div>
          <div className="flex items-baseline gap-2">
            <motion.span
              key={`${selectedCount}-${weekOffset}`}
              initial={{ scale: 0.6, opacity: 0, y: 4 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
              className="text-[26px] font-bold tabular-nums leading-none text-foreground inline-block"
            >
              {loading && selectedCount === 0 ? (
                <Loader2 className="h-5 w-5 animate-spin text-text-tertiary inline" />
              ) : (
                selectedCount
              )}
            </motion.span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              done · {weekContext}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <TrendingUp
              size={11}
              strokeWidth={2.4}
              className={deltaTone}
              style={{
                transform: delta < 0 ? "rotate(180deg)" : undefined,
              }}
            />
            <span className={`text-[11px] font-bold tabular-nums ${deltaTone}`}>
              {deltaSign}
              {delta}%
            </span>
            <span className="text-[10.5px] text-text-tertiary">
              vs {prevCount} prior
            </span>
          </div>
        </div>

        {/* Bar chart — 6-week velocity. flex-1 so the chart fills
         *  whatever vertical space the cell has. Selected week is
         *  the rightmost bar in primary; previous is dim primary;
         *  older are muted. */}
        <div className="flex-1 flex flex-col gap-1.5 min-h-[72px]">
          <div className="flex-1 flex items-end gap-1.5">
            {weeks.map((w, i) => {
              const count = counts[w.key] ?? 0;
              const heightPct = Math.max(3, (count / maxCount) * 100);
              const isSelected = i === weeks.length - 1;
              const isPrev = i === weeks.length - 2;
              const cls = isSelected
                ? "bg-primary"
                : isPrev
                  ? "bg-primary/35"
                  : "bg-foreground/[0.10]";
              return (
                <motion.div
                  key={`${w.key}-${weekOffset}`}
                  initial={{ scaleY: 0, opacity: 0.4 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 220,
                    damping: 15,
                    delay: i * 0.06,
                  }}
                  className={`flex-1 rounded-t-md transition-colors ${cls} origin-bottom`}
                  style={{ height: `${heightPct}%` }}
                  title={`${count} done · week of ${format(w.ws, "MMM d")}`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            {weeks.map((w, i) => {
              const isSelected = i === weeks.length - 1;
              return (
                <span
                  key={w.key}
                  className={`flex-1 text-center text-[8.5px] tabular-nums ${isSelected ? "text-foreground/75 font-bold" : "text-text-tertiary/70"}`}
                >
                  {format(w.ws, "M/d")}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ═════════════════════════════════════════════════════════════════
// ScopeToggle — Mine / Everyone segmented pill (admins only)
// ═════════════════════════════════════════════════════════════════

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: "mine" | "everyone";
  onChange: (s: "mine" | "everyone") => void;
}) {
  // `layoutId` makes framer-motion glide the dark indicator pill
  // between the two buttons whenever `scope` flips. Same element
  // ID across both options = one shared layout transition.
  return (
    <div className="inline-flex items-center bg-foreground/[0.05] border border-border-soft rounded-full p-0.5">
      <button
        type="button"
        onClick={() => onChange("mine")}
        className={`relative px-2.5 h-6 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
          scope === "mine"
            ? "text-background"
            : "text-text-tertiary hover:text-foreground"
        }`}
      >
        {scope === "mine" && (
          <motion.span
            layoutId="opsScopeIndicator"
            className="absolute inset-0 bg-foreground rounded-full"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <span className="relative">Mine</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("everyone")}
        className={`relative inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
          scope === "everyone"
            ? "text-background"
            : "text-text-tertiary hover:text-foreground"
        }`}
      >
        {scope === "everyone" && (
          <motion.span
            layoutId="opsScopeIndicator"
            className="absolute inset-0 bg-foreground rounded-full"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Users className="relative h-2.5 w-2.5" />
        <span className="relative">Everyone</span>
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// EditProjectDialog — centered modal for editing an existing project
// ═════════════════════════════════════════════════════════════════
// Title, description, status, priority, due date, and progress.
// Calls useUpdateProject; the projects query auto-invalidates so the
// card refreshes immediately on save.
// ═════════════════════════════════════════════════════════════════

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "to_do", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
];

const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function EditProjectDialog({
  project,
  onClose,
  me,
}: {
  project: Project;
  onClose: () => void;
  me: any | null;
}) {
  const updateMut = useUpdateProject();
  const myUsername: string | null = me?.username ?? null;

  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<ProjectPriority>(
    (project.priority as ProjectPriority) ?? "medium",
  );
  const [due, setDue] = useState<string>(
    project.due ? String(project.due).slice(0, 10) : "",
  );
  const [progress, setProgress] = useState<number>(project.progress ?? 0);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !updateMut.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await updateMut.mutateAsync({
        id: project.id,
        patch: {
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          due: due || null,
          progress,
        },
        updatedBy: myUsername,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update project.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-background border border-border-soft shadow-2xl overflow-hidden"
      >
        <header className="px-6 pt-5 pb-4 border-b border-border-soft flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">
              Edit project
            </h2>
            <p className="text-[11.5px] text-text-tertiary mt-0.5">
              Update fields and save — changes go live immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              className="w-full px-3 py-2 bg-foreground/[0.03] border border-border-soft rounded-lg text-[13px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-3 py-2 bg-foreground/[0.03] border border-border-soft rounded-lg text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
              Status
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PROJECT_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  data-active={status === s.value}
                  className="px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors text-text-secondary border-border-soft hover:border-foreground/30 data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
              Priority
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PROJECT_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  data-active={priority === p.value}
                  className="inline-flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors text-text-secondary border-border-soft hover:border-foreground/30 data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground"
                >
                  <Flag size={9} strokeWidth={2.8} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due + Progress row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
                Due date
              </label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full px-3 py-2 bg-foreground/[0.03] border border-border-soft rounded-lg text-[12.5px] text-foreground outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
                Progress · {progress}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value, 10))}
                className="w-full accent-primary h-2 mt-2"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11.5px] text-destructive">{error}</p>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-full text-[12px] font-semibold text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 h-8 px-4 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMut.isPending && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            Save changes
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Shared inline action button — rounded-full, colored outlines
// ═════════════════════════════════════════════════════════════════

function InlineAction({
  tone,
  onClick,
  children,
}: {
  tone: "primary" | "success" | "neutral";
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Outlined rounded-full pill — colored border + text, no fill.
  // Matches "Mark done" (green) / "Move back" (neutral) styling in
  // the mockup. Primary tone is used for "Start" so the next-action
  // CTA reads as the obvious choice without dominating the row.
  const cls =
    tone === "primary"
      ? "border-primary/40 text-primary hover:bg-primary/[0.08] hover:border-primary/60"
      : tone === "success"
        ? "border-success/40 text-success hover:bg-success/[0.08] hover:border-success/60"
        : "border-border-soft text-text-secondary hover:text-foreground hover:bg-foreground/[0.04] hover:border-foreground/30";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center h-7 px-3.5 rounded-full text-[12px] font-semibold border transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
