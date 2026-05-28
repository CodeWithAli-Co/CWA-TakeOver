/**
 * TasksOverviewCard.tsx — donut + interactive callouts edition.
 *
 *   · Header           — scope toggle (You / Everyone) + total count.
 *   · Donut            — proportional status chart (open / active / done)
 *                        with total in the center. Legend rows on the
 *                        right; hovering a row dims the other slices.
 *   · 2×2 Callouts     — Overdue · High priority · This week · Completed.
 *                        Clicking a tile "drills in": the tile gets a
 *                        selected ring and the row below the grid is
 *                        replaced with a mini-list of that bucket's
 *                        tasks. Click the same tile to collapse.
 *   · Drill-down list  — top 5 tasks from the selected bucket, each
 *                        clickable straight to /task. When no bucket
 *                        is selected this slot shows the single Most
 *                        Urgent task across the whole list.
 *   · Most loaded      — top 3 assignees with mini load bars (Everyone
 *                        scope only). Clicking opens the per-person modal.
 *
 * Design choices worth noting:
 *   · No soothing "all clear ✓" state on the alarm tones. Week-scale
 *     workflows have real work in flight even when overdue = 0, so a
 *     green checkmark would create false comfort.
 *   · "Due today" was removed — replaced with "High priority". On a
 *     week-scale workflow, due-today was almost always zero, so the
 *     tile became permanent dead weight.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Flame,
  Zap,
  Leaf,
  Users as UsersIcon,
  User as UserIcon,
  ChevronRight,
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
type Tone = "destructive" | "warning" | "primary" | "success";
type BucketKey = "overdue" | "highPriority" | "thisWeek" | "completed";

/**
 * AnimatedNumber — smooth count-up between value changes.
 * Uses easeOutCubic for a snappy-but-natural feel.
 */
function AnimatedNumber({
  value,
  duration = 650,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (end - start) * eased);
      setDisplay(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevValue.current = end;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}

export function TasksOverviewCard({ username }: Props) {
  const [scope, setScope] = useState<Scope>("me");
  const [focusUser, setFocusUser] = useState<string | null>(null);
  // Which bucket is the user drilling into right now. Null = show the
  // single Most Urgent task across the whole list.
  const [selectedBucket, setSelectedBucket] = useState<BucketKey | null>(null);
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

  // ── Buckets ──
  const buckets = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
    const nowMs = now.getTime();

    const overdue: TodosInterface[] = [];
    const thisWeek: TodosInterface[] = [];
    const highPriority: TodosInterface[] = [];

    for (const t of active) {
      if (t.priority === "high") highPriority.push(t);
      if (!t.deadline) continue;
      const ms = new Date(t.deadline).getTime();
      if (Number.isNaN(ms)) continue;
      if (ms < nowMs) overdue.push(t);
      else if (ms < weekEnd) thisWeek.push(t);
    }

    return { overdue, thisWeek, highPriority, completed: done };
  }, [active, done]);

  // Sort helper for the drill-down list — priority DESC then deadline ASC.
  const sortByUrgency = (tasks: TodosInterface[]) =>
    [...tasks].sort((a, b) => {
      const p = (b.priorityOrder ?? 0) - (a.priorityOrder ?? 0);
      if (p !== 0) return p;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  // ── Most urgent (when no bucket is selected) ──
  const mostUrgent = useMemo(() => sortByUrgency(active)[0], [active]);

  // ── Drill-down tasks for the currently-selected bucket ──
  const drillTasks = useMemo(() => {
    if (!selectedBucket) return [] as TodosInterface[];
    const src = buckets[selectedBucket] ?? [];
    return sortByUrgency(src).slice(0, 5);
  }, [selectedBucket, buckets]);

  // ── Top assignees by active load ──
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

  // ── Donut slices ──
  const total = list.length;
  const slices = useMemo(
    () =>
      [
        { key: "open", count: open.length, color: "hsl(var(--primary))" },
        { key: "progress", count: inProgress.length, color: "hsl(var(--warning))" },
        { key: "done", count: done.length, color: "hsl(var(--success))" },
      ].filter((s) => s.count > 0),
    [open.length, inProgress.length, done.length],
  );

  const completionPct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  // Tile click toggles selection. Same tile twice = collapse.
  const toggleBucket = (key: BucketKey) =>
    setSelectedBucket((cur) => (cur === key ? null : key));

  // Reset the drill-down whenever scope flips so we don't get stuck
  // looking at a bucket that no longer makes sense.
  useEffect(() => {
    setSelectedBucket(null);
  }, [scope]);

  return (
    <BentoCard span="col-span-4 row-span-2" delay={0.3} noPadding>
      {/* Header */}
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
        {/* Donut */}
        <Donut
          slices={slices}
          total={total}
          openCount={open.length}
          progressCount={inProgress.length}
          doneCount={done.length}
        />

        {/* 2×2 Callouts — clicking a tile selects it and drills the row
            below the grid down to that bucket's tasks. */}
        <div className="grid grid-cols-2 gap-2">
          <Callout
            icon={AlertTriangle}
            label="Overdue"
            count={buckets.overdue.length}
            tone="destructive"
            hint={buckets.overdue[0]?.title ?? "Past deadline"}
            selected={selectedBucket === "overdue"}
            onClick={() => toggleBucket("overdue")}
            delay={0.05}
          />
          <Callout
            icon={Flame}
            label="High priority"
            count={buckets.highPriority.length}
            tone="warning"
            hint={buckets.highPriority[0]?.title ?? "Top-priority active"}
            selected={selectedBucket === "highPriority"}
            onClick={() => toggleBucket("highPriority")}
            delay={0.1}
          />
          <Callout
            icon={CalendarDays}
            label="This week"
            count={buckets.thisWeek.length}
            tone="primary"
            hint={buckets.thisWeek[0]?.title ?? "Due in the next 7 days"}
            selected={selectedBucket === "thisWeek"}
            onClick={() => toggleBucket("thisWeek")}
            delay={0.15}
          />
          <Callout
            icon={CheckCircle2}
            label="Completed"
            count={done.length}
            tone="success"
            hint={`${completionPct}% of total`}
            selected={selectedBucket === "completed"}
            onClick={() => toggleBucket("completed")}
            delay={0.2}
          />
        </div>

        {/* Drill-down list OR Most Urgent row */}
        <AnimatePresence mode="wait" initial={false}>
          {selectedBucket ? (
            <motion.div
              key={`drill-${selectedBucket}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <DrillDownList
                bucketKey={selectedBucket}
                tasks={drillTasks}
                totalCount={buckets[selectedBucket].length}
                showAssignees={scope === "everyone"}
                onTaskClick={() => navigate({ to: "/task" })}
                onClose={() => setSelectedBucket(null)}
              />
            </motion.div>
          ) : mostUrgent ? (
            <motion.div
              key="most-urgent"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <MostUrgentRow
                task={mostUrgent}
                onClick={() => navigate({ to: "/task" })}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-text-tertiary py-1.5 px-2 italic"
            >
              Nothing active right now.
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* Person modal */}
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
// Donut
// ──────────────────────────────────────────────────────────────────

function Donut({
  slices,
  total,
  openCount,
  progressCount,
  doneCount,
}: {
  slices: { key: string; count: number; color: string }[];
  total: number;
  openCount: number;
  progressCount: number;
  doneCount: number;
}) {
  const size = 132;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;

  const [hover, setHover] = useState<string | null>(null);

  let cumulative = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ overflow: "visible" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--foreground) / 0.06)"
            strokeWidth={stroke}
            fill="none"
          />
          {total > 0 &&
            slices.map((slice) => {
              const fraction = slice.count / total;
              const length = c * fraction;
              const offset = c * (cumulative / total);
              cumulative += slice.count;
              const dim = hover !== null && hover !== slice.key;
              return (
                <motion.circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="butt"
                  initial={{ strokeDasharray: `0 ${c}`, opacity: 1 }}
                  animate={{
                    strokeDasharray: `${length} ${c - length}`,
                    strokeDashoffset: -offset,
                    opacity: dim ? 0.18 : 1,
                  }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="text-[26px] font-bold tabular-nums text-foreground leading-none"
          >
            <AnimatedNumber value={total} />
          </motion.div>
          <div className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-text-tertiary mt-1.5">
            Total
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <LegendItem sliceKey="open" color="hsl(var(--primary))" label="Open" count={openCount} total={total} onHover={setHover} />
        <LegendItem sliceKey="progress" color="hsl(var(--warning))" label="Active" count={progressCount} total={total} onHover={setHover} />
        <LegendItem sliceKey="done" color="hsl(var(--success))" label="Done" count={doneCount} total={total} onHover={setHover} />
      </div>
    </div>
  );
}

function LegendItem({
  sliceKey,
  color,
  label,
  count,
  total,
  onHover,
}: {
  sliceKey: string;
  color: string;
  label: string;
  count: number;
  total: number;
  onHover: (key: string | null) => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      onMouseEnter={() => onHover(sliceKey)}
      onMouseLeave={() => onHover(null)}
      className="flex items-center gap-2 min-w-0 py-0.5 px-1 -mx-1 rounded-md hover:bg-foreground/[0.04] transition-colors cursor-default"
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-foreground font-medium flex-1 truncate">{label}</span>
      <span className="text-[11px] tabular-nums text-foreground font-semibold">
        <AnimatedNumber value={count} />
      </span>
      <span className="text-[10px] tabular-nums text-foreground/55 font-medium w-8 text-right">
        <AnimatedNumber value={pct} />%
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Callout
// ──────────────────────────────────────────────────────────────────

/**
 * One of four stat tiles. Click to drill — `selected` shows the active
 * state. No soothing empty state on zero counts.
 */
function Callout({
  icon: Icon,
  label,
  count,
  tone,
  hint,
  selected,
  onClick,
  delay = 0,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  tone: Tone;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  delay?: number;
}) {
  const toneCls = {
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
    success: "text-success",
  }[tone];

  const selectedBorderCls = {
    destructive: "border-destructive/40 bg-destructive/[0.06]",
    warning: "border-warning/40 bg-warning/[0.06]",
    primary: "border-primary/40 bg-primary/[0.06]",
    success: "border-success/40 bg-success/[0.06]",
  }[tone];

  const isActive = count > 0;
  const pulseDot = isActive && (tone === "destructive" || tone === "warning");

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay }}
      aria-pressed={selected}
      className={`relative block w-full text-left rounded-lg border-xs px-2.5 py-2 transition-colors cursor-pointer ${
        selected
          ? selectedBorderCls
          : "bg-foreground/[0.025] border-border-soft hover:bg-foreground/[0.05] hover:border-foreground/15"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-1.5 ${
          isActive ? toneCls : "text-text-tertiary"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {pulseDot && (
            <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
              <span
                className={`absolute inset-0 rounded-full ${
                  tone === "destructive" ? "bg-destructive" : "bg-warning"
                } opacity-70 animate-ping`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  tone === "destructive" ? "bg-destructive" : "bg-warning"
                }`}
              />
            </span>
          )}
          <Icon className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] truncate">
            {label}
          </span>
        </div>
        <span
          className={`text-[15px] font-bold tabular-nums leading-none ${
            isActive ? toneCls : "text-text-tertiary/50"
          }`}
        >
          <AnimatedNumber value={count} />
        </span>
      </div>
      <div className="mt-1.5 text-[10.5px] truncate text-text-tertiary">
        {hint || " "}
      </div>
    </motion.button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Drill-down list — appears in place of Most Urgent when a bucket is selected
// ──────────────────────────────────────────────────────────────────

const BUCKET_META: Record<
  BucketKey,
  { label: string; tone: Tone; emptyMessage: string }
> = {
  overdue: { label: "Overdue", tone: "destructive", emptyMessage: "No overdue tasks." },
  highPriority: { label: "High priority", tone: "warning", emptyMessage: "No high-priority active tasks." },
  thisWeek: { label: "This week", tone: "primary", emptyMessage: "No tasks due in the next 7 days." },
  completed: { label: "Completed", tone: "success", emptyMessage: "Nothing completed yet." },
};

function DrillDownList({
  bucketKey,
  tasks,
  totalCount,
  showAssignees,
  onTaskClick,
  onClose,
}: {
  bucketKey: BucketKey;
  tasks: TodosInterface[];
  totalCount: number;
  showAssignees: boolean;
  onTaskClick: (task: TodosInterface) => void;
  onClose: () => void;
}) {
  const meta = BUCKET_META[bucketKey];
  const toneCls = {
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
    success: "text-success",
  }[meta.tone];

  // Tone-matched panel border ties it visually back to the selected tile
  // above (no more floating chevron pip needed).
  const borderTone = {
    destructive: "border-destructive/30 bg-destructive/[0.03]",
    warning: "border-warning/30 bg-warning/[0.03]",
    primary: "border-primary/30 bg-primary/[0.03]",
    success: "border-success/30 bg-success/[0.03]",
  }[meta.tone];

  const showingSubset = tasks.length < totalCount;

  return (
    <div className={`rounded-lg border-xs overflow-hidden ${borderTone}`}>
      {/* Tiny header strip */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5 border-b border-xs border-border-soft">
        <div className={`flex items-center gap-1.5 ${toneCls}`}>
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
            {meta.label}
          </span>
          <span className="text-[9px] font-semibold tabular-nums opacity-60">
            {showingSubset ? `${tasks.length} of ${totalCount}` : totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down"
          className="p-0.5 rounded text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-text-tertiary italic">
          {meta.emptyMessage}
        </div>
      ) : (
        <ul className="list-none py-1 m-0">
          {tasks.map((t) => (
            <DrillRow
              key={t.todo_id}
              task={t}
              showAssignee={showAssignees}
              onClick={() => onTaskClick(t)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DrillRow({
  task,
  showAssignee,
  onClick,
}: {
  task: TodosInterface;
  showAssignee: boolean;
  onClick: () => void;
}) {
  const PriorityIcon =
    task.priority === "high" ? Flame : task.priority === "medium" ? Zap : Leaf;
  const priorityCls =
    task.priority === "high"
      ? "text-destructive"
      : task.priority === "medium"
      ? "text-warning"
      : "text-success";

  const isOverdue =
    task.deadline &&
    task.status !== "done" &&
    new Date(task.deadline).getTime() < Date.now();

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className="group/d w-full text-left flex items-center gap-2.5 px-3 py-1.5 hover:bg-foreground/[0.04] transition-colors"
      >
        <PriorityIcon className={`h-3 w-3 flex-shrink-0 ${priorityCls}`} />
        <span className="text-[12px] text-foreground flex-1 truncate">
          {task.title}
        </span>
        {showAssignee && task.assignee?.[0] && (
          <span
            className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: colorForUser(task.assignee[0]) }}
            title={task.assignee[0]}
          >
            {task.assignee[0].slice(0, 2).toUpperCase()}
          </span>
        )}
        {task.deadline && (
          <span
            className={`text-[10px] uppercase tracking-wider tabular-nums flex-shrink-0 ${
              isOverdue ? "text-destructive font-semibold" : "text-text-tertiary"
            }`}
          >
            {formatDeadline(task.deadline)}
          </span>
        )}
        <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/d:opacity-100 transition-opacity flex-shrink-0" />
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Most Urgent — shown when no bucket is selected
// ──────────────────────────────────────────────────────────────────

function MostUrgentRow({
  task,
  onClick,
}: {
  task: TodosInterface;
  onClick: () => void;
}) {
  const PriorityIcon =
    task.priority === "high" ? Flame : task.priority === "medium" ? Zap : Leaf;
  const priorityCls =
    task.priority === "high"
      ? "text-destructive"
      : task.priority === "medium"
      ? "text-warning"
      : "text-success";
  const railCls =
    task.priority === "high"
      ? "bg-destructive"
      : task.priority === "medium"
      ? "bg-warning"
      : "bg-success";

  const isOverdue =
    task.deadline && new Date(task.deadline).getTime() < Date.now();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className="group/u relative w-full text-left flex items-center gap-2.5 rounded-lg bg-popover/60 border-xs border-border-soft hover:border-foreground/15 hover:bg-popover/80 transition-colors pl-3.5 pr-3 py-2 overflow-hidden"
    >
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[2px] ${railCls} opacity-80`} />
      <div className={`flex items-center gap-1.5 ${priorityCls} flex-shrink-0`}>
        <PriorityIcon className="h-3 w-3" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
          Most urgent
        </span>
      </div>
      <span className="text-[12.5px] text-foreground font-medium flex-1 truncate">
        {task.title}
      </span>
      {task.deadline && (
        <span
          className={`text-[10px] uppercase tracking-wider tabular-nums flex-shrink-0 ${
            isOverdue ? "text-destructive font-semibold" : "text-text-tertiary"
          }`}
        >
          {formatDeadline(task.deadline)}
        </span>
      )}
      <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/u:opacity-100 transition-opacity flex-shrink-0" />
    </motion.button>
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
      <ScopeButton active={scope === "me"} onClick={() => onChange("me")} icon={UserIcon} label="You" />
      <ScopeButton active={scope === "everyone"} onClick={() => onChange("everyone")} icon={UsersIcon} label="Everyone" />
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
        active ? "bg-foreground/[0.08] text-foreground" : "text-text-tertiary hover:text-foreground"
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
        <span className="text-[12px] text-foreground flex-1 truncate text-left">{user}</span>
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
// Person modal
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
              <div className="text-[14px] font-bold text-foreground truncate">{user}</div>
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

          <PersonSection title="Open" accent="primary" tasks={open} onTaskClick={onTaskNavigate} />
          <PersonSection title="In progress" accent="warning" tasks={inProgress} onTaskClick={onTaskNavigate} />
          <PersonSection
            title="Done"
            accent="success"
            tasks={done.slice(0, 10)}
            onTaskClick={onTaskNavigate}
            footnote={done.length > 10 ? `+${done.length - 10} more completed` : undefined}
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
                <span className="text-[12.5px] text-foreground truncate flex-1">{t.title}</span>
                {t.deadline && (
                  <span
                    className={`text-[10px] uppercase tracking-wider flex-shrink-0 ${
                      overdue ? "text-destructive font-semibold" : "text-text-tertiary"
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
        <div className="text-[10px] text-text-tertiary italic mt-1 pl-2">{footnote}</div>
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
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  // Force "MMM D" so the month is always visible — locale-dependent
  // formatters were occasionally rendering as just the day number.
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}
