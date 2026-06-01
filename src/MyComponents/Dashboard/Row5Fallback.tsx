/**
 * Row5Fallback.tsx — alternates for the Communication + Workspace
 * cards when both come back empty.
 *
 * The Comm + Workspace cards are great when there's activity, but
 * a fresh founder demoing the app sees Mentions: 0 / Co-editing: 0 /
 * Recent feedback: 0 — four zeros in a row. So Row5Section now
 * checks if both are empty and falls back to these two widgets:
 *
 *   1. DailySnapshotCard  — "your week so far": completed tasks,
 *                            focused hours, current streak, the
 *                            shape of your activity pattern
 *   2. QuickStartCard     — 6 large tap-to-do buttons for the most
 *                            common workflows (create task, new doc,
 *                            schedule a meeting, start a huddle, open
 *                            command palette, connect a tool)
 *
 * Both are self-contained — no external data hooks required. The
 * Snapshot uses lightweight props for now (later: real metrics from
 * cwa_todos / cwa_time_entries); the Quick Start uses sendPrompt-
 * style callbacks that the parent wires to navigate / open dialogs.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useDailySnapshot, type DailySnapshot } from "./useDailySnapshot";
import {
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  FileText,
  Calendar,
  Radio,
  Command,
  Plug,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { BentoCard } from "./BentoCard";

// ─────────────────────────────────────────────────────────────────
// Daily Snapshot
// ─────────────────────────────────────────────────────────────────

export function DailySnapshotCard() {
  // 0 = current week, -1 = last week, +1 = next week (usually empty).
  // Clamped to a sane window in the navigation handler below.
  const [weekOffset, setWeekOffset] = useState(0);
  const {
    data: snap,
    isLoading,
    isFetching,
    refetch,
  } = useDailySnapshot(weekOffset);

  // Skeleton while loading — same skeleton-only treatment so layout
  // doesn't shift when data arrives.
  if (isLoading || !snap) {
    return (
      <BentoCard span="col-span-6" delay={0.5} noPadding>
        <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              Daily snapshot
            </span>
          </div>
        </header>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-[68px] rounded-xl bg-foreground/[0.04] animate-pulse" />
            <div className="h-[68px] rounded-xl bg-foreground/[0.04] animate-pulse" />
          </div>
          <div className="h-8 rounded-md bg-foreground/[0.04] animate-pulse" />
          <div className="h-16 rounded-md bg-foreground/[0.04] animate-pulse" />
        </div>
      </BentoCard>
    );
  }

  const { thisWeek, deltas } = snap;
  const completedThisWeek = thisWeek.doneCount;
  const hoursFocused = thisWeek.focusedHours;

  // 7 daily activity bars — height normalised against the peak
  // value across both completion + minute streams so empty days
  // never disappear if there's any meaningful activity elsewhere.
  const peakDone = Math.max(1, ...thisWeek.dailyDone);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = thisWeek.dailyDone.map((n, i) => ({
    d: dayLabels[i]!,
    h: n / peakDone,
  }));

  // Streak — Pass 2 will pull from checkins. For now derive a soft
  // streak from "had at least one completion today"-style daily
  // signal. If today's bucket is non-zero, count contiguous prior
  // days that were also non-zero. Best-effort; explicit in Pass 2.
  const todayIdx = (() => {
    const wd = new Date().getDay();
    return wd === 0 ? 6 : wd - 1;
  })();
  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) {
    if (thisWeek.dailyDone[i]! > 0) streak++;
    else break;
  }

  // Composition strip — total may be 0 (no time tracked); guard.
  const comp = thisWeek.composition;
  const total = Math.max(1, comp.total);
  const deepPct = Math.round((comp.deep / total) * 100);
  const meetingsPct = Math.round((comp.meetings / total) * 100);
  const adminPct = Math.round((comp.admin / total) * 100);

  return (
    <BentoCard span="col-span-6" delay={0.5} noPadding>
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Daily snapshot
          </span>
        </div>

        {/* Week navigator. Streaks stay anchored on today regardless
         *  of which week you're viewing — see hook comment. */}
        <WeekNavigator
          offset={weekOffset}
          onChange={setWeekOffset}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </header>

      <div className="p-4 space-y-3">
        {/* ── Hero stats with deltas ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <SnapshotStat
            icon={CheckCircle2}
            label="Done this week"
            value={String(completedThisWeek)}
            sub="tasks"
            tone="text-success"
            delta={deltas.doneVsLastWeek}
            deltaLabel="vs last week"
          />
          <SnapshotStat
            icon={Clock}
            label="Focused"
            value={`${hoursFocused}h`}
            sub="tracked"
            tone="text-primary"
            delta={deltas.focusedVsAvg}
            deltaLabel="vs 4-wk avg"
          />
        </div>

        {/* ── Streaks ── */}
        <StreaksStrip
          shipping={snap.streaks.shipping}
          tracking={snap.streaks.tracking}
        />

        {/* ── Composition strip ── */}
        {comp.total > 0 ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
                Composition
              </span>
              <span className="text-[10px] text-text-tertiary tabular-nums">
                {deepPct}% deep · {meetingsPct}% meet · {adminPct}% admin
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-foreground/[0.05]">
              {comp.deep > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${deepPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-success/75"
                  title={`Deep: ${(comp.deep / 60).toFixed(1)}h`}
                />
              )}
              {comp.meetings > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${meetingsPct}%` }}
                  transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-warning/80"
                  title={`Meetings: ${(comp.meetings / 60).toFixed(1)}h`}
                />
              )}
              {comp.admin > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${adminPct}%` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-foreground/35"
                  title={`Admin: ${(comp.admin / 60).toFixed(1)}h`}
                />
              )}
            </div>
          </div>
        ) : null}

        {/* ── Weekly activity bars ──
         *  No header strip here — the WeekNavigator at the top of
         *  the card already says "This week", and the day-of-week
         *  labels under the bars carry the rest of the context.
         */}
        <div>
          <div className="grid grid-cols-7 gap-1.5 items-end">
            {days.map((d, i) => {
              const count = thisWeek.dailyDone[i]!;
              const minutes = thisWeek.dailyMinutes[i]!;
              const titles = thisWeek.dailyTaskTitles[i] ?? [];
              return (
                <div
                  key={d.d}
                  className="flex flex-col items-stretch gap-1 w-full"
                >
                  <Tooltip
                    block
                    placement="top"
                    tip={
                      <DayTooltip
                        day={d.d}
                        count={count}
                        minutes={minutes}
                        titles={titles}
                        isToday={i === todayIdx}
                      />
                    }
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(d.h * 48, 3)}px` }}
                      transition={{
                        duration: 0.5,
                        delay: 0.05 * i,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`w-full rounded-sm ${
                        d.h > 0.6
                          ? "bg-primary/70"
                          : d.h > 0.25
                            ? "bg-primary/40"
                            : d.h > 0
                              ? "bg-primary/20"
                              : "bg-foreground/10"
                      }`}
                      style={{ minHeight: 3 }}
                    />
                  </Tooltip>
                  {/* Tiny anchor dot for today only — drops six labels
                   *  of noise and still tells you where "now" is.
                   *  Hovering any bar reveals the full day name. */}
                  <span
                    className={`h-1 flex items-center justify-center ${
                      i === todayIdx ? "" : "opacity-0"
                    }`}
                    aria-hidden={i !== todayIdx}
                  >
                    <span className="w-1 h-1 rounded-full bg-foreground/70" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rhythm heatmap parked — user pulled it. Hook still
         *  computes snap.heatmap and HeatmapStrip is intact, so
         *  re-rendering it is a one-line restore.
         */}

        {/* ── Tomorrow look-ahead ── */}
        <TomorrowStrip tomorrow={snap.tomorrow} />

        {/* ── Narrative one-liner (Pass 2 will replace with Axon
         *  synthesis; for now a simple delta-driven template). ── */}
        <NarrativeInsight snap={snap} streak={streak} />
      </div>
    </BentoCard>
  );
}

/**
 * HeatmapStrip — 28-day rhythm view.
 *
 * Rows = time-of-day buckets (Morn / Mid / Eve / Night), cols = days
 * of the week (Mon..Sun). Cell intensity scales with task closes in
 * that window. Reveals at a glance whether the founder is a morning
 * person or a night owl, weekday-only or weekend-warrior, etc.
 *
 * If there's no data at all, render a quiet empty hint instead of a
 * sea of grey cells.
 */
function HeatmapStrip({
  heatmap,
}: {
  heatmap: DailySnapshot["heatmap"];
}) {
  const { cells, bucketLabels, bucketRanges, peak } = heatmap;
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const dayFullLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (peak === 0) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
            Rhythm
          </span>
          <span className="text-[10px] text-text-tertiary">last 28 days</span>
        </div>
        <div className="rounded-lg border border-border-soft/60 bg-foreground/[0.02] px-3 py-3 text-center">
          <p className="text-[10.5px] text-text-tertiary italic">
            Not enough data yet — close a few tasks and your pattern will surface here.
          </p>
        </div>
      </div>
    );
  }

  // Heat scale — 5 stops from background to fully saturated primary.
  const heatClass = (n: number) => {
    if (n === 0) return "bg-foreground/[0.04]";
    const ratio = n / peak;
    if (ratio > 0.75) return "bg-primary/80";
    if (ratio > 0.5) return "bg-primary/60";
    if (ratio > 0.25) return "bg-primary/40";
    return "bg-primary/20";
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
          Rhythm
        </span>
        <span className="text-[10px] text-text-tertiary">
          last 28 days · peak {peak}
        </span>
      </div>

      <div className="flex gap-1.5">
        {/* Row labels — 4 stacked, aligned to the cell heights */}
        <div className="flex flex-col gap-[3px] justify-between py-[1px] shrink-0">
          {bucketLabels.map((b, i) => (
            <span
              key={b}
              className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-text-tertiary tabular-nums leading-none"
              title={bucketRanges[i]}
            >
              {b}
            </span>
          ))}
        </div>

        {/* 7 day columns */}
        <div className="grid grid-cols-7 gap-[3px] flex-1">
          {/* Cell grid — 4 rows × 7 cols */}
          {cells.map((row, b) =>
            row.map((count, di) => (
              <Tooltip
                key={`${b}-${di}`}
                block
                placement={b < 2 ? "bottom" : "top"}
                tip={
                  <div className="min-w-[140px]">
                    <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-foreground/[0.06]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
                        {dayFullLabels[di]} · {bucketLabels[b]}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-foreground/90 leading-snug">
                      <span className="font-bold tabular-nums">{count}</span>{" "}
                      task{count === 1 ? "" : "s"} closed
                    </p>
                    <p className="text-[9.5px] text-text-tertiary mt-0.5">
                      {bucketRanges[b]} · last 28 days
                    </p>
                  </div>
                }
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.015 * (b * 7 + di),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`h-3.5 rounded-sm ${heatClass(count)} hover:ring-1 hover:ring-foreground/20 transition-all`}
                />
              </Tooltip>
            )),
          )}

          {/* Day labels under the grid — Mon..Sun */}
          {dayLabels.map((d, i) => (
            <span
              key={`label-${i}`}
              className="text-[8.5px] tabular-nums text-text-tertiary text-center leading-none"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * TomorrowStrip — forward-looking section of the snapshot card.
 *
 * Bridges "your week so far" → "here's what's next." Three states:
 *   1. Has tasks due tomorrow → list them (up to 3 inline rows, with
 *      "+N more" if there are extras) and a separate overdue badge
 *      if anything's already late.
 *   2. No due-tomorrow but has overdue → surfaces the longest-stuck
 *      task with how many days overdue.
 *   3. Nothing on deck and nothing overdue → quietly invites the
 *      user to plan ("Tomorrow's open — what'll you tackle?") so the
 *      empty state still feels intentional.
 *
 * Priority-coded left rail on each row (high=red, medium=amber,
 * low=neutral) so the founder can scan urgency at a glance.
 */
function TomorrowStrip({
  tomorrow,
}: {
  tomorrow: DailySnapshot["tomorrow"];
}) {
  const navigate = useNavigate();
  const { dueTomorrow, overdueCount, topOverdue } = tomorrow;
  const shown = dueTomorrow.slice(0, 3);
  const extras = Math.max(0, dueTomorrow.length - shown.length);

  // One-line summary — no rows, no header strip, no card. The
  // full breakdown (titles + priorities + overdue list) lives in
  // the hover tooltip. Click the line to drill into /tasks.

  // Build the tooltip content once — reused across the empty,
  // due-tomorrow, and overdue-only branches.
  const tipContent = (
    <div className="min-w-[200px]">
      {dueTomorrow.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground pb-1 mb-1.5 border-b border-foreground/[0.06]">
            Due tomorrow · {dueTomorrow.length}
          </div>
          <ul className="space-y-1 mb-2">
            {dueTomorrow.slice(0, 5).map((t) => {
              const dot =
                t.priority === "high"
                  ? "bg-danger/70"
                  : t.priority === "medium"
                    ? "bg-warning/70"
                    : "bg-foreground/30";
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-1.5 text-[10.5px] text-foreground/90 leading-snug"
                >
                  <span className={`mt-[5px] w-1 h-1 rounded-full shrink-0 ${dot}`} />
                  <span className="line-clamp-2 break-words">{t.title}</span>
                </li>
              );
            })}
            {extras > 0 && (
              <li className="text-[9.5px] text-text-tertiary italic pl-2.5">
                +{extras} more
              </li>
            )}
          </ul>
        </>
      )}
      {overdueCount > 0 && (
        <div className={`text-[10px] ${dueTomorrow.length > 0 ? "pt-1.5 border-t border-foreground/[0.06]" : ""}`}>
          <span className="font-bold text-danger">{overdueCount} overdue</span>
          {topOverdue && (
            <span className="text-text-tertiary">
              {" — "}oldest "{topOverdue.title}" · {topOverdue.daysOverdue}d
            </span>
          )}
        </div>
      )}
      {dueTomorrow.length === 0 && overdueCount === 0 && (
        <p className="text-[10.5px] text-text-tertiary italic">
          Open canvas — what will you tackle?
        </p>
      )}
    </div>
  );

  // Build the visible one-liner — small caps "TOMORROW" + a calm
  // summary phrase.
  const summary = (() => {
    if (dueTomorrow.length === 0 && overdueCount === 0) {
      return "nothing on deck";
    }
    const parts: string[] = [];
    if (dueTomorrow.length > 0) {
      parts.push(`${dueTomorrow.length} due`);
    }
    if (overdueCount > 0) {
      parts.push(`${overdueCount} overdue`);
    }
    return parts.join(" · ");
  })();

  const dangerTint = overdueCount > 0;

  return (
    <Tooltip tip={tipContent}>
      <div
        className="flex items-baseline justify-between gap-2 cursor-pointer group w-full"
        onClick={() => navigate({ to: "/tasks" as any })}
      >
        <span className="text-[10.5px]">
          <span className="font-bold uppercase tracking-[0.14em] text-foreground/80 mr-1.5">
            Tomorrow
          </span>
          <span className={dangerTint ? "text-danger/85" : "text-text-tertiary"}>
            {summary}
          </span>
        </span>
        <ArrowRight
          size={10}
          strokeWidth={2.4}
          className="text-text-tertiary/50 group-hover:text-foreground/70 group-hover:translate-x-0.5 transition-all shrink-0"
        />
      </div>
    </Tooltip>
  );
}

/**
 * NarrativeInsight — Pass 1 placeholder. Picks a single observation
 * based on the most non-trivial signal and renders one sentence.
 * Pass 2 will hand this off to an Axon synthesis call.
 */
function NarrativeInsight({
  snap,
  streak,
}: {
  snap: DailySnapshot;
  streak: number;
}) {
  const { thisWeek, deltas } = snap;
  const focusDelta = deltas.focusedVsAvg.value;
  const doneDelta = deltas.doneVsLastWeek.value;
  const comp = thisWeek.composition;
  const meetingShare = comp.total > 0 ? comp.meetings / comp.total : 0;

  // Pick the most attention-worthy signal.
  let body: ReactNode;
  if (meetingShare > 0.4 && comp.total > 60) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Meetings ate {Math.round(meetingShare * 100)}% of your week.
        </span>{" "}
        Block a focus window tomorrow morning before they pile up again.
      </>
    );
  } else if (doneDelta >= 5) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Up {doneDelta} tasks vs. last week.
        </span>{" "}
        You're on a hot run — keep the same shape tomorrow.
      </>
    );
  } else if (doneDelta <= -3) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Down {Math.abs(doneDelta)} tasks vs. last week.
        </span>{" "}
        One quick close before EOD evens you out.
      </>
    );
  } else if (focusDelta < -2) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Focus time is {Math.abs(focusDelta).toFixed(1)}h below your 4-week average.
        </span>{" "}
        Worth checking what shifted.
      </>
    );
  } else if (streak >= 3) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          {streak}-day streak.
        </span>{" "}
        One more close today extends it.
      </>
    );
  } else {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Steady week.
        </span>{" "}
        No alarms, no surprises.
      </>
    );
  }

  return (
    <div className="rounded-lg border border-border-soft bg-foreground/[0.03] px-3 py-2 text-[11px] text-text-tertiary leading-relaxed">
      {body}
    </div>
  );
}

/**
 * DayTooltip — content for the per-day activity bar tooltip.
 *
 * Renders a small header with the day name + summary (e.g.
 * "Tuesday · 3 closed · 2.4h tracked"), then a list of the task
 * titles closed that day. Long titles are truncated with ellipsis
 * so the bubble doesn't get unwieldy. If the day had no tasks, we
 * show a friendly placeholder instead of an empty list.
 */
function DayTooltip({
  day,
  count,
  minutes,
  titles,
  isToday,
}: {
  day: string;
  count: number;
  minutes: number;
  titles: string[];
  isToday: boolean;
}) {
  const hoursStr = minutes > 0 ? `${(minutes / 60).toFixed(1)}h tracked` : null;
  const countStr =
    count === 0 ? "nothing closed" : `${count} closed`;
  // Cap to the first 5 titles to keep the bubble compact; show a
  // "+N more" hint when there are extras so the user knows there's
  // more to see in the Tasks page.
  const MAX = 5;
  const shown = titles.slice(0, MAX);
  const extras = Math.max(0, titles.length - MAX);

  return (
    <div className="min-w-[160px]">
      <div className="flex items-center justify-between gap-2 pb-1 mb-1.5 border-b border-border-soft/60">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
          {day}
          {isToday && (
            <span className="ml-1.5 inline-block w-1 h-1 rounded-full bg-primary align-middle" />
          )}
        </span>
        <span className="text-[9.5px] text-text-tertiary tabular-nums">
          {countStr}
          {hoursStr && ` · ${hoursStr}`}
        </span>
      </div>
      {shown.length > 0 ? (
        <ul className="space-y-0.5">
          {shown.map((t, j) => (
            <li
              key={`${day}-${j}`}
              className="text-[10.5px] text-foreground/90 leading-snug flex items-start gap-1.5"
            >
              <span className="mt-[5px] inline-block w-1 h-1 rounded-full bg-success/70 shrink-0" />
              <span className="line-clamp-2 break-words">{t}</span>
            </li>
          ))}
          {extras > 0 && (
            <li className="text-[9.5px] text-text-tertiary italic pl-2.5 pt-0.5">
              +{extras} more
            </li>
          )}
        </ul>
      ) : (
        <p className="text-[10px] text-text-tertiary italic">
          {isToday ? "Nothing closed yet today." : "Quiet day."}
        </p>
      )}
    </div>
  );
}

/**
 * Tooltip — minimal hover tooltip that doesn't need a portal.
 *
 * Accepts either a string (single-line, no-wrap default) or a
 * ReactNode (multi-line composition allowed). When `wide` is true the
 * bubble grows up to ~220px and lets content wrap — useful for per-day
 * task lists. Pure CSS hover; no JS state, no portal, no positioning
 * library. Anchored above the wrapped child by default; flips below
 * via `placement="bottom"` when the parent is near the top of the
 * viewport.
 */
function Tooltip({
  tip,
  children,
  wide = false,
  placement = "top",
  block = false,
}: {
  tip: ReactNode;
  children: ReactNode;
  wide?: boolean;
  placement?: "top" | "bottom";
  /**
   * When true the wrapper takes the full available width and renders
   * as flex (column, items-stretch). Use this inside grid cells where
   * the child needs `w-full` to do anything useful — e.g. the daily
   * activity bars. Default is `inline-flex` so most usages still hug
   * their content.
   */
  block?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  // Recompute position every time we open (cheap, and avoids stale
  // coords when the snapshot card re-renders after a refetch).
  const updateCoords = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({
      x: r.left + r.width / 2,
      y: placement === "bottom" ? r.bottom + 6 : r.top - 6,
    });
  };

  // Reposition on scroll / resize while open so the tooltip tracks
  // its trigger if the page shifts under it.
  useEffect(() => {
    if (!open) return;
    const onMove = () => updateCoords();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-widen when the tip is JSX — assume it's structured content.
  const effectiveWide = wide || typeof tip !== "string";
  const wrapCls = effectiveWide
    ? "max-w-[240px] whitespace-normal text-left leading-snug"
    : "whitespace-nowrap";

  const wrapperLayout = block
    ? "inline-flex w-full self-stretch"
    : "inline-flex";

  const handleEnter = () => {
    updateCoords();
    setOpen(true);
  };
  const handleLeave = () => setOpen(false);

  return (
    <span
      ref={triggerRef}
      className={wrapperLayout}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: coords.x,
              top: coords.y,
              transform:
                placement === "bottom"
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className={[
              "pointer-events-none",
              // Hairline border — barely there in dark, just enough
              // to define the edge in light. The shadow does the
              // visual lift work.
              "rounded-lg border border-foreground/[0.08] bg-elevation-2/98 backdrop-blur-sm",
              "text-foreground text-[10.5px] font-medium px-2.5 py-1.5",
              "shadow-[0_10px_28px_-10px_rgba(0,0,0,0.65),0_2px_6px_-2px_rgba(0,0,0,0.4)]",
              wrapCls,
            ].join(" ")}
          >
            {tip}
          </div>,
          document.body,
        )}
    </span>
  );
}


/**
 * WeekNavigator — Prev / label / Next + refresh button.
 *
 *   · offset = 0  → "This week"
 *   · offset = -1 → "Last week"
 *   · offset = -N → "N weeks ago"
 *   · offset > 0  → "Next week", "In N weeks" (rare; usually empty)
 *
 * Clamps prev at -12 weeks (a quarter) so the cache key doesn't blow
 * up indefinitely. Refresh is its own button — useful when the user
 * has just closed a task elsewhere and wants to force a refetch.
 */
function WeekNavigator({
  offset,
  onChange,
  onRefresh,
  isFetching,
}: {
  offset: number;
  onChange: (next: number) => void;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const label =
    offset === 0
      ? "This week"
      : offset === -1
        ? "Last week"
        : offset < -1
          ? `${Math.abs(offset)} weeks ago`
          : offset === 1
            ? "Next week"
            : `In ${offset} weeks`;

  // Date range for the tooltip — Mon..Sun of the viewed week. The
  // label by itself ("Last week") doesn't tell you *when* that was;
  // showing "May 25 – May 31" makes scrubbing through history
  // legible at a glance.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = Sun, 1 = Mon
  const mondayDiff = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayDiff + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const rangeLabel = `${fmt(monday)} – ${fmt(sunday)}`;

  const labelTooltip =
    offset === 0
      ? `${rangeLabel} · this week`
      : offset !== 0
        ? `${rangeLabel} · click to jump back to today`
        : rangeLabel;

  const canGoBack = offset > -12;
  const canGoForward = offset < 0;

  return (
    <div className="inline-flex items-center gap-0.5">
      <Tooltip tip="Previous week">
        <button
          type="button"
          onClick={() => canGoBack && onChange(offset - 1)}
          disabled={!canGoBack}
          aria-label="Previous week"
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={13} strokeWidth={2.4} />
        </button>
      </Tooltip>

      <Tooltip tip={labelTooltip}>
        <button
          type="button"
          onClick={() => offset !== 0 && onChange(0)}
          disabled={offset === 0}
          className="h-6 px-2 inline-flex items-center text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80 hover:text-foreground rounded-md hover:bg-foreground/[0.04] transition-colors disabled:cursor-default"
        >
          {label}
        </button>
      </Tooltip>

      <Tooltip tip="Next week">
        <button
          type="button"
          onClick={() => canGoForward && onChange(offset + 1)}
          disabled={!canGoForward}
          aria-label="Next week"
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={13} strokeWidth={2.4} />
        </button>
      </Tooltip>

      <span className="w-px h-3 bg-border-soft mx-0.5" />

      <Tooltip tip="Refresh data now">
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
        >
          <RefreshCw
            size={11}
            strokeWidth={2.4}
            className={isFetching ? "animate-spin" : ""}
          />
        </button>
      </Tooltip>
    </div>
  );
}

interface StreakSpec {
  current: number;
  record: number;
}

/**
 * StreaksStrip — two compact pills surfacing the founder's
 * current shipping + tracking streaks alongside their personal
 * records. Active streaks tint warm; broken ones fade out.
 */
function StreaksStrip({
  shipping,
  tracking,
}: {
  shipping: StreakSpec;
  tracking: StreakSpec;
}) {
  // Single-line, low-vibe streak readout — replaces the two colored
  // pills that were stealing too much attention from the hero stats.
  // PB flame stays subtle and only when actually at record.
  const shippingPB = shipping.current > 0 && shipping.current >= shipping.record && shipping.record > 0;

  return (
    <div className="flex items-center gap-2.5 text-[10px] text-text-tertiary tabular-nums">
      <Tooltip
        tip={
          shipping.current > 0
            ? `${shipping.current} day${shipping.current === 1 ? "" : "s"} closing at least one task. 90-day best: ${shipping.record}.${shippingPB ? " You're at your record." : ""}`
            : `No shipping streak. 90-day best: ${shipping.record}. Close a task today to start one.`
        }
      >
        <span className="inline-flex items-baseline gap-1 cursor-default">
          <span className="text-foreground/55">Ship</span>
          <span className={`font-bold ${shipping.current > 0 ? "text-foreground" : "text-text-tertiary"}`}>
            {shipping.current}
          </span>
          {shippingPB && (
            <Flame size={9} strokeWidth={2.4} className="text-warning/90 -translate-y-px" />
          )}
        </span>
      </Tooltip>
      <span className="text-border-soft">·</span>
      <Tooltip
        tip={
          tracking.current > 0
            ? `${tracking.current} day${tracking.current === 1 ? "" : "s"} logging at least one time entry. 90-day best: ${tracking.record}.`
            : `No tracking streak. 90-day best: ${tracking.record}. Log any time entry today to restart.`
        }
      >
        <span className="inline-flex items-baseline gap-1 cursor-default">
          <span className="text-foreground/55">Track</span>
          <span className={`font-bold ${tracking.current > 0 ? "text-foreground" : "text-text-tertiary"}`}>
            {tracking.current}
          </span>
        </span>
      </Tooltip>
    </div>
  );
}

function StreakPill({
  icon: Icon,
  label,
  current,
  record,
  tip,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  current: number;
  record: number;
  tip: string;
  tone: "warning" | "primary";
}) {
  const isActive = current > 0;
  // Highlight if the user just tied or beat their record — that's
  // a meaningful "you're at your best" signal worth surfacing.
  const isPersonalBest = isActive && current >= record && record > 0;

  const bg = isActive
    ? tone === "warning"
      ? "bg-warning/12 border-warning/30"
      : "bg-primary/12 border-primary/30"
    : "bg-foreground/[0.03] border-border-soft";
  const labelTone = isActive
    ? tone === "warning"
      ? "text-warning"
      : "text-primary"
    : "text-text-tertiary";

  return (
    <Tooltip tip={tip}>
      <div
        className={`flex items-center gap-2 px-2.5 h-9 rounded-lg border ${bg} cursor-default`}
      >
        <Icon
          size={13}
          strokeWidth={2.4}
          className={isActive ? labelTone : "text-text-tertiary/70"}
        />
        <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.14em] ${labelTone}`}
          >
            {label}
          </span>
          <span className="text-[12.5px] font-bold tabular-nums text-foreground">
            {current}
          </span>
          <span className="text-[9.5px] text-text-tertiary tabular-nums">
            / record {record}
          </span>
          {isPersonalBest && (
            <span className="ml-auto text-[8.5px] font-bold uppercase tracking-[0.14em] text-success px-1 py-px rounded bg-success/12 border border-success/25">
              PB
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

function DeltaPill({
  direction,
  value,
  pct,
  label,
}: {
  direction: "up" | "down" | "flat";
  value: number;
  pct: number;
  label: string;
}) {
  // Color intent: "up" is good for done / focused; "down" is amber
  // for either. v2 can be smarter (e.g. up on meetings is bad).
  const tone =
    direction === "up"
      ? "text-success border-success/30 bg-success/10"
      : direction === "down"
        ? "text-warning border-warning/30 bg-warning/10"
        : "text-text-tertiary border-border-soft bg-foreground/[0.04]";
  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  const display = Number.isInteger(value)
    ? `${sign}${value}`
    : `${sign}${value.toFixed(1)}`;
  const pctSign = pct > 0 ? "+" : "";
  const tip =
    direction === "flat"
      ? `${label} — no change`
      : `${label}: ${pctSign}${pct}% (${display})`;
  return (
    <Tooltip tip={tip}>
      <div
        className={`inline-flex items-center gap-1 px-1.5 h-4 rounded-full border text-[9.5px] font-bold tabular-nums cursor-default ${tone}`}
      >
        <Icon size={9} strokeWidth={2.8} />
        <span>{display}</span>
      </div>
    </Tooltip>
  );
}

function SnapshotStat({
  icon: _Icon,
  label,
  value,
  sub: _sub,
  tone: _tone,
  delta,
  deltaLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: string;
  delta?: { direction: "up" | "down" | "flat"; value: number; pct: number };
  deltaLabel?: string;
}) {
  // Hero stat, maximum quiet: tiny label, big number, inline delta.
  // The `sub` unit ("tasks" / "tracked") and the `deltaLabel`
  // repeat-line are dropped — the DeltaPill's hover already carries
  // the comparison context.
  return (
    <div>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-[22px] font-bold text-foreground leading-none tabular-nums">
          {value}
        </span>
        {delta && deltaLabel ? (
          <div className="ml-auto">
            <DeltaPill
              direction={delta.direction}
              value={delta.value}
              pct={delta.pct}
              label={deltaLabel}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Quick Start — 6 large tap buttons
// ─────────────────────────────────────────────────────────────────

interface QuickAction {
  icon: LucideIcon;
  label: string;
  hint: string;
  /** Either a route to navigate to, or a custom handler. */
  to?: string;
  onClick?: () => void;
  tone?: string;
}

export function QuickStartCard() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: Plus,
      label: "New task",
      hint: "Quick capture",
      onClick: () => {
        // TODO: wire to the existing AddTodo modal via Cmd+K palette
        // or AddTodo dispatch when the imperative dialog hook lands.
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
        });
        window.dispatchEvent(event);
      },
      tone: "text-primary",
    },
    {
      icon: FileText,
      label: "New doc",
      hint: "Start writing",
      to: "/workspace",
      tone: "text-foreground/80",
    },
    {
      icon: Calendar,
      label: "Schedule meeting",
      hint: "Add to calendar",
      to: "/schedule",
      tone: "text-foreground/80",
    },
    {
      icon: Radio,
      label: "Start huddle",
      hint: "Spin up voice room",
      to: "/chat",
      tone: "text-foreground/80",
    },
    {
      icon: Command,
      label: "Command palette",
      hint: "Cmd+K · jump anywhere",
      onClick: () => {
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
        });
        window.dispatchEvent(event);
      },
      tone: "text-foreground/80",
    },
    {
      icon: Plug,
      label: "Connect a tool",
      hint: "HubSpot, Stripe, Notion…",
      to: "/settings",
      tone: "text-foreground/80",
    },
  ];

  const handleClick = (a: QuickAction) => {
    if (a.onClick) a.onClick();
    else if (a.to) navigate({ to: a.to as any });
  };

  return (
    <BentoCard span="col-span-6" delay={0.55} noPadding>
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <Command className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Quick start
          </span>
        </div>
        <span className="text-[10px] text-text-tertiary">
          one tap to get going
        </span>
      </header>

      <div className="p-3 grid grid-cols-3 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.label}
              type="button"
              onClick={() => handleClick(a)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: 0.04 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group rounded-xl border border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-foreground/25 transition-colors p-3 text-left flex flex-col gap-2 min-h-[88px]"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center bg-foreground/[0.06] border border-border-soft ${a.tone ?? "text-foreground/80"}`}
                >
                  <Icon size={14} strokeWidth={2.2} />
                </div>
                <ChevronRight
                  size={13}
                  strokeWidth={2.2}
                  className="text-text-tertiary/50 group-hover:text-foreground/70 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-[12px] font-bold text-foreground leading-tight">
                  {a.label}
                </p>
                <p className="text-[10.5px] text-text-tertiary leading-snug">
                  {a.hint}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </BentoCard>
  );
}
