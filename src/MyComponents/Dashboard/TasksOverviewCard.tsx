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
import {
  Todos,
  AllTodos,
  Employees,
  type TodosInterface,
} from "@/stores/query";
import { colorForUser } from "@/lib/yjs/awareness";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { companySupabase } from "@/MyComponents/supabase";

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
  const { data: employees } = Employees();

  // Resolve username → avatar URL for the "Most loaded" rows.
  // Supports both legacy bucket-filename avatars and full URL
  // avatars (DiceBear, Direct Hire flow). Built once per employee
  // list change; the LoadRow does a Map.get for O(1) lookup.
  const avatarsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (employees as any[] | undefined) ?? []) {
      if (!e?.username) continue;
      let url: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        url = e.avatar;
      } else if (e.avatar) {
        const { data } = companySupabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        url = data?.publicUrl;
      }
      if (url) map.set(e.username, url);
    }
    return map;
  }, [employees]);

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
  // Editorial donut palette — emerald for done, amber for in-progress,
  // soft rose for open. Lifts the donut off the brand-red default
  // so it sits in the same family as the rest of the dashboard
  // (Sales cards, Inbox pills, callouts).
  const slices = useMemo(
    () =>
      [
        { key: "open", count: open.length, color: "rgb(251 113 133)" },        // rose-400
        { key: "progress", count: inProgress.length, color: "rgb(251 191 36)" }, // amber-400
        { key: "done", count: done.length, color: "rgb(52 211 153)" },          // emerald-400
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
      {/* Editorial header — typography + divider match the meetings
       *  and tasks widget headers (px-5 py-3.5 + border-border/15)
       *  so the dashboard reads as one design language.
       *  The You/Everyone toggle is gated to leadership only
       *  (CEO, COO, Head of Growth) so non-leadership roles can't peek
       *  at the whole team's task load. */}
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
            Tasks Overview
          </span>
          <span className="text-[10.5px] text-zinc-500 tabular-nums">
            {list.length}
          </span>
        </div>
        <UserView userRole={[Role.CEO, Role.COO, Role.HeadOfGrowth]}>
          <ScopeToggle scope={scope} onChange={setScope} />
        </UserView>
      </header>

      {/* Body padding tightened to space-y-3 — the donut, callout
       *  grid, drill area, and most-loaded sections felt too padded
       *  apart at space-y-4 inside the narrower col-span-4 card. */}
      <div className="p-4 space-y-3">
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
                avatarsByName={avatarsByName}
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
            {/* list-none + p-0 + m-0 kills the browser default
             *  list-item bullets that were showing as white dots
             *  next to the avatars. */}
            <ul className="list-none p-0 m-0 space-y-1">
              {topAssignees.map((a) => (
                <LoadRow
                  key={a.user}
                  user={a.user}
                  count={a.count}
                  maxLoad={maxLoad}
                  avatarUrl={avatarsByName.get(a.user)}
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

/**
 * Donut — refined circular donut chart with a hero center stat and
 * a sidebar legend whose rows have per-status mini progress bars.
 *
 * Design choices vs the previous attempt:
 *   · Bigger canvas (156 vs 140) so the donut reads as the visual
 *     anchor of the row rather than a decorative element.
 *   · Thicker stroke (14 vs 10) — more presence, more "premium"
 *     feel, less spindly.
 *   · Rounded caps with a small inter-segment gap so the slices
 *     read as capsule pills rather than colliding bands.
 *   · SVG glow filter applied to the focused segment on hover so it
 *     lifts off the canvas without a heavy drop shadow.
 *   · Center stack: big % (38px) → small "DONE" caps subtitle →
 *     "X of Y" tabular line. Three tiers of typography in <60px of
 *     vertical space so it reads as a refined infographic, not a
 *     stat block.
 *   · Sidebar legend with per-row mini progress bars — each row
 *     shows the status' share of the total via a thin filled bar
 *     under the count. Linear-analytics style.
 */
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
  // Sizing — bigger and thicker than the prior pass for a more
  // substantial, premium feel in the col-span-4 card.
  const size = 156;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  // Small inter-segment gap — combined with rounded caps this gives
  // each slice clean capsule ends without colliding into neighbours.
  // 1% of circumference is enough at this stroke weight.
  const gapLen = c * 0.01;

  const [hover, setHover] = useState<string | null>(null);

  let cumulative = 0;
  const pctDone = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ overflow: "visible" }}
        >
          {/* SVG filter for the focused-segment glow. Soft, refined,
           *  no heavy drop shadow — just a subtle bloom so the hovered
           *  slice lifts off the canvas. */}
          <defs>
            <filter id="cwa-donut-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track — quiet ring grounding the segments. Slightly
           *  more visible (9% alpha) than before so a dominant
           *  single-slice state still feels like a "container." */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--foreground) / 0.07)"
            strokeWidth={stroke}
            fill="none"
          />

          {/* Slices — each is a circle with a strokeDasharray + offset
           *  trick to paint just its arc. Visible length is shortened
           *  by gapLen so rounded caps land inside the segment's
           *  claimed arc, not over the next one. Sequential delay
           *  (0.08s × index) gives a refined cascading entrance. */}
          {total > 0 &&
            slices.map((slice, i) => {
              const fraction = slice.count / total;
              const arcLen = c * fraction;
              const visible = Math.max(0, arcLen - gapLen);
              const offset = c * (cumulative / total) + gapLen / 2;
              cumulative += slice.count;
              const dim = hover !== null && hover !== slice.key;
              const focused = hover === slice.key;
              return (
                <motion.circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={focused ? stroke + 1.5 : stroke}
                  fill="none"
                  strokeLinecap="round"
                  filter={focused ? "url(#cwa-donut-glow)" : undefined}
                  initial={{ strokeDasharray: `0 ${c}`, opacity: 1 }}
                  animate={{
                    strokeDasharray: `${visible} ${c - visible}`,
                    strokeDashoffset: -offset,
                    opacity: dim ? 0.2 : 1,
                  }}
                  transition={{
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.08 * i,
                  }}
                />
              );
            })}
        </svg>

        {/* Editorial center stack — Newsreader serif hero %, mono
         *  uppercase "Done" eyebrow in emerald, quiet tabular "X of Y"
         *  meta line. Same typography language as the Sales hero
         *  totals and Inbox row numbers. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="flex items-baseline gap-0.5"
          >
            <span
              className="text-[40px] tabular-nums text-zinc-100 leading-none font-medium"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              <AnimatedNumber value={pctDone} />
            </span>
            <span
              className="text-[18px] text-zinc-500 leading-none"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              %
            </span>
          </motion.div>
          <div className="text-[9px] font-mono uppercase tracking-[0.24em] text-emerald-400/80 mt-2">
            Done
          </div>
          <div className="text-[10px] tabular-nums text-zinc-500 mt-1.5 font-mono">
            <AnimatedNumber value={doneCount} /> of {total}
          </div>
        </div>
      </div>

      {/* Editorial legend — colored dots match the donut's desaturated
       *  rose/amber/emerald palette so the rows + slices read as one.
       *  Bars dropped to /60 opacity to stop competing with the donut. */}
      <div className="flex flex-col gap-2.5 min-w-0 flex-1">
        <LegendBar
          sliceKey="open"
          color="bg-rose-400/70"
          label="Open"
          count={openCount}
          total={total}
          dim={hover !== null && hover !== "open"}
          onHover={setHover}
        />
        <LegendBar
          sliceKey="progress"
          color="bg-amber-400/70"
          label="Active"
          count={progressCount}
          total={total}
          dim={hover !== null && hover !== "progress"}
          onHover={setHover}
        />
        <LegendBar
          sliceKey="done"
          color="bg-emerald-400/70"
          label="Done"
          count={doneCount}
          total={total}
          dim={hover !== null && hover !== "done"}
          onHover={setHover}
        />
      </div>
    </div>
  );
}

/**
 * LegendBar — sidebar legend row for the Donut. Top line shows the
 * colored dot, the status label, and the count + percentage; bottom
 * line is a thin proportional bar showing the slice's share of the
 * total. Hover the row to highlight the matching donut segment.
 *
 * This is the "Linear analytics" style legend treatment — each row
 * tells you the count AND visually echoes the donut's proportion via
 * the bar fill, so the eye can match a slice to a row instantly.
 */
function LegendBar({
  sliceKey,
  color,
  label,
  count,
  total,
  dim,
  onHover,
}: {
  sliceKey: string;
  color: string;
  label: string;
  count: number;
  total: number;
  dim: boolean;
  onHover: (key: string | null) => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      onMouseEnter={() => onHover(sliceKey)}
      onMouseLeave={() => onHover(null)}
      className="cursor-default transition-opacity"
      style={{ opacity: dim ? 0.4 : 1 }}
    >
      {/* Quieter editorial row — mono uppercase label, tabular count
       *  in zinc-200 instead of bold-foreground, percentage in faint
       *  zinc-500. The bar opacity below dims so the proportions read
       *  without competing with the donut's slices upstream. */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-zinc-300 flex-1 truncate">
          {label}
        </span>
        <span className="text-[12px] tabular-nums text-zinc-200">
          <AnimatedNumber value={count} />
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500 w-8 text-right">
          <AnimatedNumber value={pct} />%
        </span>
      </div>
      <div className="mt-1.5 h-[2px] rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%`, opacity: 0.75 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
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
  // Editorial tone tokens — emerald lean for positive, amber for
  // warnings, soft rose for destructive. Same family as the rest of
  // the dashboard so the page reads as one piece.
  const toneAccent = {
    destructive: "text-rose-300",
    warning: "text-amber-300",
    primary: "text-emerald-300",
    success: "text-emerald-300",
  }[tone];

  const toneDot = {
    destructive: "bg-rose-400",
    warning: "bg-amber-400",
    primary: "bg-emerald-400",
    success: "bg-emerald-400",
  }[tone];

  const selectedBorderCls = {
    destructive: "border-rose-500/30 bg-rose-500/[0.04]",
    warning: "border-amber-500/30 bg-amber-500/[0.04]",
    primary: "border-emerald-500/30 bg-emerald-500/[0.04]",
    success: "border-emerald-500/30 bg-emerald-500/[0.04]",
  }[tone];

  const isActive = count > 0;
  // Quietened pulse — only fire on destructive (overdue), and even
  // then with a much softer animation than before. The eye still
  // catches it without the card feeling loud.
  const pulseDot = isActive && tone === "destructive";

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
      className={`relative block w-full text-left rounded-lg border px-3.5 py-3 transition-colors cursor-pointer ${
        selected
          ? selectedBorderCls
          : "bg-zinc-900/40 border-white/[0.05] hover:bg-zinc-900/60 hover:border-white/[0.1]"
      }`}
    >
      {/* Eyebrow — colored dot + mono uppercase tracking label.
       *  Restraint here is the point: the card carries information,
       *  not noise. The count below does the heavy lifting. */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
          {pulseDot && (
            <span className={`absolute inset-0 rounded-full ${toneDot} opacity-60 animate-ping`} />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              isActive ? toneDot : "bg-zinc-700"
            }`}
          />
        </span>
        <Icon className={`h-3 w-3 flex-shrink-0 ${isActive ? toneAccent : "text-zinc-600"}`} />
        <span className="text-[9.5px] font-mono uppercase tracking-[0.18em] truncate text-zinc-400">
          {label}
        </span>
      </div>

      {/* Hero count — Newsreader serif, the focal number of each
       *  callout. Tone-tinted when active, quieter zinc when zero. */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span
          className={`text-[24px] leading-none font-medium tabular-nums ${
            isActive ? toneAccent : "text-zinc-600"
          }`}
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        >
          <AnimatedNumber value={count} />
        </span>
      </div>

      {/* Hint — quietened to zinc-500 so the count + eyebrow own the
       *  visual hierarchy. Min-h preserves alignment across cards. */}
      <div className="mt-1.5 text-[10.5px] text-zinc-500 truncate min-h-[14px]">
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
  avatarsByName,
  onTaskClick,
  onClose,
}: {
  bucketKey: BucketKey;
  tasks: TodosInterface[];
  totalCount: number;
  showAssignees: boolean;
  /** username → avatar URL. Threaded down so DrillRow can show
   *  real avatars instead of colored initials. */
  avatarsByName?: Map<string, string>;
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

  // Tone-colored left rail — replaces the washed-out tinted
  // background. The rail is bold and saturated so the tone reads
  // clearly without the surface feeling "tinted but faded."
  const railBgCls = {
    destructive: "bg-destructive",
    warning: "bg-warning",
    primary: "bg-primary",
    success: "bg-success",
  }[meta.tone];

  const showingSubset = tasks.length < totalCount;

  return (
    // Clean editorial surface — same bg-foreground/[0.03] as the
    // task/meeting cards on the home dashboard. The tone now lives
    // entirely in the left rail + the label text, not in a low-alpha
    // background tint that made the whole panel feel washed out.
    <div className="relative rounded-lg border-xs border-border-soft bg-foreground/[0.03] overflow-hidden">
      {/* Left tone rail — full panel height. Read as "this drill is
       *  scoped to <tone>" without painting the whole surface. */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${railBgCls}`}
      />

      {/* Header strip — crisper than before. Label bumped to bold +
       *  11px from 9px so it's actually legible; "X of Y" promoted
       *  from 60% opacity to a clean text-foreground/65 so it reads
       *  but doesn't compete. Divider uses the same border/15 we use
       *  on the dashboard headers. */}
      <div className="flex items-center justify-between gap-2 pl-4 pr-2 py-2 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10.5px] font-bold uppercase tracking-[0.14em] ${toneCls}`}
          >
            {meta.label}
          </span>
          <span className="text-[10.5px] font-semibold tabular-nums text-foreground/65">
            {showingSubset ? `${tasks.length} of ${totalCount}` : totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down"
          className="p-1 rounded text-text-tertiary hover:text-foreground hover:bg-foreground/[0.08] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="pl-4 pr-3 py-3 text-[11.5px] text-foreground/60 italic">
          {meta.emptyMessage}
        </div>
      ) : (
        <ul className="list-none py-1 m-0">
          {tasks.map((t) => (
            <DrillRow
              key={t.todo_id}
              task={t}
              showAssignee={showAssignees}
              avatarsByName={avatarsByName}
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
  avatarsByName,
  onClick,
}: {
  task: TodosInterface;
  showAssignee: boolean;
  avatarsByName?: Map<string, string>;
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

  // Resolve real avatar for the first assignee. Falls back to the
  // colored-initials circle when no URL is set (legacy users / no
  // avatar uploaded).
  const firstAssignee = task.assignee?.[0];
  const avatarUrl =
    firstAssignee && avatarsByName ? avatarsByName.get(firstAssignee) : undefined;

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className="group/d w-full text-left flex items-center gap-2.5 pl-4 pr-3 py-1.5 hover:bg-foreground/[0.05] transition-colors"
      >
        <PriorityIcon className={`h-3 w-3 flex-shrink-0 ${priorityCls}`} />
        <span className="text-[12px] text-foreground flex-1 truncate">
          {task.title}
        </span>
        {showAssignee && firstAssignee && (
          <div
            className="relative h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: colorForUser(firstAssignee) }}
            title={firstAssignee}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={firstAssignee}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              firstAssignee.slice(0, 2).toUpperCase()
            )}
          </div>
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
  avatarUrl,
  onClick,
}: {
  user: string;
  count: number;
  maxLoad: number;
  /** Optional real avatar URL. When present, renders an <img>;
   *  otherwise falls back to the colored-initials circle so legacy
   *  users (no avatar set) still get a recognizable marker. */
  avatarUrl?: string;
  onClick: () => void;
}) {
  const pct = maxLoad > 0 ? (count / maxLoad) * 100 : 0;
  return (
    // list-none kills any inherited list-item bullet from the parent
    // ul. Belt-and-suspenders alongside the parent's list-none class.
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-foreground/[0.04] transition-colors group/load"
      >
        {/* Avatar with two-step degradation:
         *  1. If avatarUrl is set → render real <img>, underlay with
         *     a colored circle so a slow/broken image still shows
         *     something.
         *  2. If no avatarUrl → render just the colored circle with
         *     initials (the legacy behavior).
         *  An onError handler hides a broken image so the underlay
         *  shows through cleanly instead of a cracked-glyph icon. */}
        <div
          className="relative h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: colorForUser(user) }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            user.slice(0, 2).toUpperCase()
          )}
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

type FilterKey =
  | "all"
  | "overdue"
  | "highPriority"
  | "thisWeek"
  | "noDeadline";

type PillTone = "neutral" | "destructive" | "warning" | "primary";

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
  // Active filter — defaults to "all" on every open since this is local state.
  const [filter, setFilter] = useState<FilterKey>("all");

  // ── Counts — computed against the full task set so pills always
  //    show the true bucket size regardless of which filter is active. ──
  const counts = useMemo(() => {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = today.getTime() + 7 * 24 * 60 * 60 * 1000;

    let overdue = 0;
    let highPriority = 0;
    let thisWeek = 0;
    let noDeadline = 0;

    for (const t of tasks) {
      if (t.status === "done") continue;
      if (t.priority === "high") highPriority++;
      if (!t.deadline) {
        noDeadline++;
        continue;
      }
      const ms = new Date(t.deadline).getTime();
      if (Number.isNaN(ms)) continue;
      if (ms < now) overdue++;
      else if (ms < weekEnd) thisWeek++;
    }

    return { overdue, highPriority, thisWeek, noDeadline };
  }, [tasks]);

  // ── Predicate for the active filter ──
  const matchesFilter = (t: TodosInterface): boolean => {
    if (filter === "all") return true;
    if (t.status === "done") return false; // all filters exclude done
    if (filter === "overdue") {
      if (!t.deadline) return false;
      const ms = new Date(t.deadline).getTime();
      return !Number.isNaN(ms) && ms < Date.now();
    }
    if (filter === "highPriority") return t.priority === "high";
    if (filter === "thisWeek") {
      if (!t.deadline) return false;
      const ms = new Date(t.deadline).getTime();
      if (Number.isNaN(ms)) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = today.getTime() + 7 * 24 * 60 * 60 * 1000;
      return ms >= Date.now() && ms < weekEnd;
    }
    if (filter === "noDeadline") return !t.deadline;
    return true;
  };

  const visible = tasks.filter(matchesFilter);
  const open = visible.filter((t) => t.status === "to-do");
  const inProgress = visible.filter((t) => t.status === "in-progress");
  const done = visible.filter((t) => t.status === "done");
  const visibleTotal = open.length + inProgress.length + done.length;
  const overdueTotal = counts.overdue;

  // Pill defs — `count` is the unfiltered bucket size for clarity.
  const pills: { key: FilterKey; label: string; count?: number; tone: PillTone }[] = [
    { key: "all", label: "All", count: tasks.length, tone: "neutral" },
    { key: "overdue", label: "Overdue", count: counts.overdue, tone: "destructive" },
    { key: "highPriority", label: "High priority", count: counts.highPriority, tone: "warning" },
    { key: "thisWeek", label: "This week", count: counts.thisWeek, tone: "primary" },
    { key: "noDeadline", label: "No deadline", count: counts.noDeadline, tone: "neutral" },
  ];

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
        {/* Header */}
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
                {tasks.length} total · {tasks.filter((t) => t.status !== "done").length} active
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

        {/* Filter pills */}
        <div className="px-4 py-2.5 border-b border-xs border-border-soft bg-card flex items-center gap-1.5 overflow-x-auto">
          {pills.map((p) => (
            <FilterPill
              key={p.key}
              label={p.label}
              count={p.count}
              tone={p.tone}
              active={filter === p.key}
              onClick={() => setFilter(p.key)}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Clickable overdue banner — toggles the overdue filter */}
          {overdueTotal > 0 && (
            <div className="px-5 pt-3 pb-1">
              <button
                type="button"
                onClick={() =>
                  setFilter((cur) => (cur === "overdue" ? "all" : "overdue"))
                }
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border-xs transition-colors ${
                  filter === "overdue"
                    ? "bg-destructive/[0.12] border-destructive/40 text-destructive"
                    : "bg-destructive/[0.05] border-destructive/20 text-destructive hover:bg-destructive/[0.09]"
                }`}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                  <AlertTriangle className="h-3 w-3" />
                  {filter === "overdue"
                    ? `Showing ${overdueTotal} overdue`
                    : `${overdueTotal} overdue`}
                </span>
                <span className="text-[9.5px] opacity-70 normal-case tracking-normal">
                  {filter === "overdue" ? "Tap to clear" : "Tap to filter"}
                </span>
              </button>
            </div>
          )}

          {/* Sections OR filtered-empty state */}
          {visibleTotal === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="text-[12px] text-text-tertiary mb-2">
                No tasks match this filter.
              </div>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-[10.5px] uppercase tracking-wider font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Show all tasks
              </button>
            </div>
          ) : (
            <>
              <PersonSection title="Open" accent="primary" tasks={open} onTaskClick={onTaskNavigate} />
              <PersonSection title="In progress" accent="warning" tasks={inProgress} onTaskClick={onTaskNavigate} />
              <PersonSection
                title="Done"
                accent="success"
                tasks={done.slice(0, 10)}
                onTaskClick={onTaskNavigate}
                footnote={done.length > 10 ? `+${done.length - 10} more completed` : undefined}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-xs border-border-soft bg-popover/40 flex items-center justify-between">
          <span className="text-[10.5px] text-text-tertiary uppercase tracking-wider">
            {filter === "all"
              ? "All assigned tasks"
              : `Filtered · ${visibleTotal} of ${tasks.length}`}
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

/**
 * One pill in the modal's filter row. Active state uses tone-tinted bg +
 * border, inactive uses neutral border-soft. Count badge embedded inline.
 */
function FilterPill({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  tone: PillTone;
  active: boolean;
  onClick: () => void;
}) {
  const activeToneCls = {
    neutral: "bg-foreground/[0.10] border-foreground/15 text-foreground",
    destructive: "bg-destructive/[0.15] border-destructive/30 text-destructive",
    warning: "bg-warning/[0.15] border-warning/30 text-warning",
    primary: "bg-primary/[0.15] border-primary/30 text-primary",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 h-6 rounded-md border-xs text-[10.5px] font-semibold uppercase tracking-wider transition-colors ${
        active
          ? activeToneCls
          : "border-border-soft text-text-tertiary hover:text-foreground hover:bg-foreground/[0.04]"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={`tabular-nums ${active ? "opacity-70" : "opacity-50"}`}>
          {count}
        </span>
      )}
    </button>
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
      {/* Section header — bumped to 11.5px with a heavier dot so it
          reads as a proper heading instead of a form label. */}
      <div className={`flex items-center gap-2 mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] ${text}`}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span>{title}</span>
        <span className="text-text-tertiary/80 font-semibold">·</span>
        <span className="text-foreground/60 font-bold tabular-nums">{tasks.length}</span>
      </div>
      <ul className="list-none m-0 p-0 space-y-0.5">
        {tasks.map((t) => {
          const overdue =
            t.deadline &&
            t.status !== "done" &&
            new Date(t.deadline).getTime() < Date.now();
          // Flame / Zap / Leaf — same icon vocabulary the drill
          // panel uses, so the priority signal is consistent.
          const PriorityIcon =
            t.priority === "high" ? Flame :
            t.priority === "medium" ? Zap :
                                      Leaf;
          const priorityCls =
            t.priority === "high"
              ? "text-destructive"
              : t.priority === "medium"
              ? "text-warning"
              : "text-success";
          return (
            <li key={t.todo_id} className="list-none">
              <button
                type="button"
                onClick={onTaskClick}
                className="w-full text-left flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-foreground/[0.06] transition-colors group/task"
              >
                <PriorityIcon className={`h-3 w-3 flex-shrink-0 ${priorityCls}`} />
                <span className="text-[12.5px] text-foreground truncate flex-1">{t.title}</span>
                {t.deadline && (
                  <span
                    className={`text-[10px] uppercase tracking-wider tabular-nums flex-shrink-0 ${
                      overdue ? "text-destructive font-semibold" : "text-text-tertiary"
                    }`}
                  >
                    {formatDeadline(t.deadline)}
                  </span>
                )}
                <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/task:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      {footnote && (
        <div className="text-[10px] text-text-tertiary italic mt-1.5 pl-2">{footnote}</div>
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

  // Cap absurd overdue values so a bad data row doesn't scream
  // "OVERDUE 9005D" at the user. Anything past a year reads "1y+".
  if (diff < -1) {
    const absDays = Math.abs(diff);
    if (absDays >= 365) return "Overdue 1y+";
    if (absDays >= 60) return `Overdue ${Math.floor(absDays / 30)}mo`;
    return `Overdue ${absDays}d`;
  }
  if (diff === -1) return "Overdue 1d";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  // Force "MMM D" so the month is always visible — locale-dependent
  // formatters were occasionally rendering as just the day number.
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}
