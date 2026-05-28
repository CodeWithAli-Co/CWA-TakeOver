/**
 * TasksOverviewCard.tsx — the row-2-right dashboard panel.
 *
 * Inbox-style task panel. Two scopes:
 *
 *   · You      — Todos(currentUsername): only tasks where the operator
 *                is in the assignee[] array.
 *   · Everyone — AllTodos(): every task across the company.
 *
 * Surfaces (top → bottom):
 *   1. Header — label, total count, scope toggle.
 *   2. Overdue callout — red bar if any active tasks are past deadline.
 *   3. Status bar — single thin segmented bar showing open/active/done
 *      proportions. Replaces the previous "3 big stat tiles" pattern
 *      which felt heavy and disconnected from the rest of the card.
 *   4. Up Next — top 3 active tasks sorted by priority then deadline.
 *      Each row clickable, navigates to /task. Was a single "most
 *      urgent" card; now a real mini-list of what to do next.
 *   5. Most Loaded (Everyone mode) — top 3 users by open count with
 *      mini load bars. Clicking a row opens the per-person modal.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Zap,
  Leaf,
  CalendarClock,
  Users as UsersIcon,
  User as UserIcon,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { BentoCard } from "./BentoCard";
import { Todos, AllTodos, type TodosInterface } from "@/stores/query";
import { colorForUser } from "@/lib/yjs/awareness";

interface Props {
  username: string;
}

type Scope = "me" | "everyone";

export function TasksOverviewCard({ username }: Props) {
  const [scope, setScope] = useState<Scope>("me");
  const [focusUser, setFocusUser] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: mineRaw } = Todos(username || "__none__");
  const { data: allRaw } = AllTodos();

  const list: TodosInterface[] = useMemo(
    () => (scope === "me" ? mineRaw : allRaw) ?? [],
    [scope, mineRaw, allRaw],
  );

  const open = list.filter((t) => t.status === "to-do");
  const inProgress = list.filter((t) => t.status === "in-progress");
  const done = list.filter((t) => t.status === "done");
  const active = useMemo(() => [...open, ...inProgress], [open, inProgress]);

  // Overdue = active tasks whose deadline is in the past.
  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return active.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline).getTime();
      return !Number.isNaN(d) && d < now;
    });
  }, [active]);

  // Top 3 urgent tasks — was a single Most Urgent card, now a real
  // mini-inbox so you see what's coming next, not just what's first.
  const upNext = useMemo(() => {
    return [...active]
      .sort((a, b) => {
        const order = (b.priorityOrder ?? 0) - (a.priorityOrder ?? 0);
        if (order !== 0) return order;
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
      })
      .slice(0, 3);
  }, [active]);

  // Top assignees — group active by username, count rows, take top 3.
  const topAssignees = useMemo(() => {
    if (scope !== "everyone") return [];
    const counts = new Map<string, number>();
    for (const t of active) {
      for (const u of t.assignee ?? []) {
        if (!u) continue;
        counts.set(u, (counts.get(u) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [scope, active]);

  const maxLoad = topAssignees[0]?.count ?? 1;

  // Segmented bar widths — proportional to count, with minimum visibility
  // (a 1% floor so a column with 1 task still renders a visible sliver).
  const totalForBar = open.length + inProgress.length + done.length;
  const bar = useMemo(() => {
    if (totalForBar === 0) {
      return { openPct: 0, progressPct: 0, donePct: 0 };
    }
    const minPct = open.length > 0 || inProgress.length > 0 || done.length > 0 ? 2 : 0;
    return {
      openPct: open.length > 0 ? Math.max(minPct, (open.length / totalForBar) * 100) : 0,
      progressPct: inProgress.length > 0 ? Math.max(minPct, (inProgress.length / totalForBar) * 100) : 0,
      donePct: done.length > 0 ? Math.max(minPct, (done.length / totalForBar) * 100) : 0,
    };
  }, [open.length, inProgress.length, done.length, totalForBar]);

  return (
    <BentoCard span="col-span-4 row-span-2" delay={0.3} noPadding>
      {/* Header — label + total count + scope toggle */}
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Tasks Overview
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-text-tertiary/60">
            {list.length}
          </span>
        </div>
        <ScopeToggle scope={scope} onChange={setScope} />
      </header>

      <div className="p-4 space-y-4">
        {/* Overdue callout — only when there's actually a problem */}
        {overdueTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 rounded-lg bg-destructive/[0.08] border border-xs border-destructive/30 px-3 py-2"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            <span className="text-[12px] text-destructive font-semibold">
              {overdueTasks.length} overdue
            </span>
            <span className="text-[11px] text-text-tertiary truncate">
              · {overdueTasks[0]!.title}
            </span>
          </motion.div>
        )}

        {/* Status — thin segmented bar with inline counts above. Replaces
            the three big stat tiles. Visualizes proportions at a glance
            instead of forcing you to compare three numbers. */}
        <section>
          <div className="flex items-center gap-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
            <span className="inline-flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {open.length} open
            </span>
            <span className="inline-flex items-center gap-1 text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              {inProgress.length} active
            </span>
            <span className="inline-flex items-center gap-1 text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {done.length} done
            </span>
          </div>
          {totalForBar === 0 ? (
            <div className="h-1.5 rounded-full bg-foreground/[0.06]" />
          ) : (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-foreground/[0.06] gap-0.5">
              {bar.openPct > 0 && (
                <div
                  className="bg-primary transition-all duration-500"
                  style={{ width: `${bar.openPct}%` }}
                />
              )}
              {bar.progressPct > 0 && (
                <div
                  className="bg-warning transition-all duration-500"
                  style={{ width: `${bar.progressPct}%` }}
                />
              )}
              {bar.donePct > 0 && (
                <div
                  className="bg-success transition-all duration-500"
                  style={{ width: `${bar.donePct}%` }}
                />
              )}
            </div>
          )}
        </section>

        {/* Up Next — top 3 urgent tasks. Compact rows, no chrome. */}
        <section>
          <SectionLabel>Up next</SectionLabel>
          {upNext.length > 0 ? (
            <ul className="space-y-0.5">
              {upNext.map((t) => (
                <UrgentRow
                  key={t.todo_id}
                  task={t}
                  showAssignee={scope === "everyone"}
                  onClick={() => navigate({ to: "/task" })}
                />
              ))}
            </ul>
          ) : (
            <div className="text-[12px] text-text-tertiary py-1.5 px-2">
              Nothing open right now.
            </div>
          )}
        </section>

        {/* Most loaded — top 3 with load bars + click-to-modal */}
        {scope === "everyone" && topAssignees.length > 0 && (
          <section>
            <SectionLabel>Most loaded</SectionLabel>
            <ul className="space-y-1">
              {topAssignees.map((a) => (
                <LoadRow
                  key={a.user}
                  user={a.user}
                  count={a.count}
                  maxLoad={maxLoad}
                  onClick={() => setFocusUser(a.user)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Person modal — opens when a Most-Loaded row is clicked */}
      <AnimatePresence>
        {focusUser && (
          <PersonTasksModal
            user={focusUser}
            tasks={(allRaw ?? []).filter((t) =>
              (t.assignee ?? []).includes(focusUser),
            )}
            onClose={() => setFocusUser(null)}
            onTaskNavigate={() => {
              setFocusUser(null);
              navigate({ to: "/task" });
            }}
          />
        )}
      </AnimatePresence>
    </BentoCard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (next: Scope) => void;
}) {
  return (
    <div className="inline-flex items-center bg-background/60 border-xs border-border-soft rounded-md p-0.5">
      <ScopeButton
        active={scope === "me"}
        onClick={() => onChange("me")}
        icon={UserIcon}
        label="You"
      />
      <ScopeButton
        active={scope === "everyone"}
        onClick={() => onChange("everyone")}
        icon={UsersIcon}
        label="Everyone"
      />
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof UserIcon;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-text-tertiary hover:text-foreground"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </motion.button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
      {children}
    </div>
  );
}

/**
 * One row of the "Up Next" list. Compact: priority icon + title + deadline.
 * No background, no border, just hover affordance — the list reads as
 * scannable rows, not a stack of cards.
 */
function UrgentRow({
  task,
  showAssignee,
  onClick,
}: {
  task: TodosInterface;
  showAssignee: boolean;
  onClick: () => void;
}) {
  const isOverdue =
    task.deadline &&
    new Date(task.deadline).getTime() < Date.now();

  const PriorityIcon =
    task.priority === "high" ? Flame :
    task.priority === "medium" ? Zap :
                                 Leaf;
  const priorityCls =
    task.priority === "high" ? "text-destructive" :
    task.priority === "medium" ? "text-warning" :
                                 "text-success";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group/u w-full text-left flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-foreground/[0.04] transition-colors"
      >
        <PriorityIcon className={`h-3 w-3 flex-shrink-0 ${priorityCls}`} />
        <span className="text-[12.5px] text-foreground flex-1 truncate">
          {task.title}
        </span>
        {showAssignee && task.assignee?.[0] && (
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider flex-shrink-0">
            {task.assignee[0]}
          </span>
        )}
        {task.deadline && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider flex-shrink-0 tabular-nums ${
              isOverdue ? "text-destructive font-semibold" : "text-text-tertiary"
            }`}
          >
            <CalendarClock className="h-2.5 w-2.5" />
            {formatDeadline(task.deadline)}
          </span>
        )}
      </button>
    </li>
  );
}

function LoadRow({
  user,
  count,
  maxLoad,
  onClick,
}: {
  user: string;
  count: number;
  maxLoad: number;
  onClick: () => void;
}) {
  const pct = maxLoad > 0 ? (count / maxLoad) * 100 : 0;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-foreground/[0.04] transition-colors group/load"
      >
        <div
          className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: colorForUser(user) }}
        >
          {user.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[12px] text-foreground flex-1 truncate text-left">
          {user}
        </span>
        <div className="w-16 h-1 bg-foreground/[0.06] rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-bold tabular-nums text-text-tertiary w-5 text-right">
          {count}
        </span>
        <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/load:opacity-100 transition-opacity flex-shrink-0" />
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Person modal — opens when a Most-Loaded row is clicked
// ──────────────────────────────────────────────────────────────────
function PersonTasksModal({
  user,
  tasks,
  onClose,
  onTaskNavigate,
}: {
  user: string;
  tasks: TodosInterface[];
  onClose: () => void;
  onTaskNavigate: () => void;
}) {
  const open = tasks.filter((t) => t.status === "to-do");
  const inProgress = tasks.filter((t) => t.status === "in-progress");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = tasks.filter((t) => {
    if (!t.deadline || t.status === "done") return false;
    return new Date(t.deadline).getTime() < Date.now();
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-[560px] max-w-[92vw] max-h-[80vh] bg-card border border-xs border-border-soft rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-xs border-border-soft bg-popover/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: colorForUser(user) }}
            >
              {user.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-foreground truncate">
                {user}
              </div>
              <div className="text-[10.5px] text-text-tertiary uppercase tracking-wider">
                {tasks.length} total · {open.length + inProgress.length} active
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {overdue.length > 0 && (
            <div className="px-5 pt-3.5 pb-1">
              <div className="flex items-center gap-2 text-[11px] text-destructive font-semibold uppercase tracking-wider">
                <AlertTriangle className="h-3 w-3" />
                {overdue.length} overdue
              </div>
            </div>
          )}

          <PersonSection
            title="Open"
            accent="primary"
            tasks={open}
            onTaskClick={onTaskNavigate}
          />
          <PersonSection
            title="In progress"
            accent="warning"
            tasks={inProgress}
            onTaskClick={onTaskNavigate}
          />
          <PersonSection
            title="Done"
            accent="success"
            tasks={done.slice(0, 10)}
            onTaskClick={onTaskNavigate}
            footnote={
              done.length > 10 ? `+${done.length - 10} more completed` : undefined
            }
          />
        </div>

        <div className="px-5 py-3 border-t border-xs border-border-soft bg-popover/40 flex items-center justify-between">
          <span className="text-[10.5px] text-text-tertiary uppercase tracking-wider">
            All assigned tasks
          </span>
          <button
            type="button"
            onClick={onTaskNavigate}
            className="text-[10.5px] uppercase tracking-wider font-bold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            Open in task page
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PersonSection({
  title,
  accent,
  tasks,
  onTaskClick,
  footnote,
}: {
  title: string;
  accent: "primary" | "warning" | "success";
  tasks: TodosInterface[];
  onTaskClick: () => void;
  footnote?: string;
}) {
  if (tasks.length === 0) return null;
  const text =
    accent === "primary" ? "text-primary" :
    accent === "warning" ? "text-warning" :
                           "text-success";
  const dot =
    accent === "primary" ? "bg-primary" :
    accent === "warning" ? "bg-warning" :
                           "bg-success";

  return (
    <section className="px-5 py-3 border-b border-xs border-border-soft last:border-b-0">
      <div className={`flex items-center gap-1.5 mb-2 text-[10.5px] font-semibold uppercase tracking-wider ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {title}
        <span className="text-text-tertiary font-normal">· {tasks.length}</span>
      </div>
      <ul className="space-y-1">
        {tasks.map((t) => {
          const overdue =
            t.deadline &&
            t.status !== "done" &&
            new Date(t.deadline).getTime() < Date.now();
          return (
            <li key={t.todo_id}>
              <button
                type="button"
                onClick={onTaskClick}
                className="w-full text-left flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-foreground/[0.04] transition-colors group/task"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    t.priority === "high"
                      ? "bg-destructive"
                      : t.priority === "medium"
                      ? "bg-warning"
                      : "bg-success"
                  }`}
                />
                <span className="text-[12.5px] text-foreground truncate flex-1">
                  {t.title}
                </span>
                {t.deadline && (
                  <span
                    className={`text-[10px] uppercase tracking-wider flex-shrink-0 ${
                      overdue
                        ? "text-destructive font-semibold"
                        : "text-text-tertiary"
                    }`}
                  >
                    {formatDeadline(t.deadline)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {footnote && (
        <div className="text-[10px] text-text-tertiary italic mt-1 pl-2">
          {footnote}
        </div>
      )}
    </section>
  );
}

function formatDeadline(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((d.getTime() - now.getTime()) / dayMs);
  if (diff < -1) return `Overdue ${Math.abs(diff)}d`;
  if (diff === -1) return "Overdue 1d";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
