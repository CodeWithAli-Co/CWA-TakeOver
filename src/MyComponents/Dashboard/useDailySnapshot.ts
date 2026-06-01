/**
 * useDailySnapshot.ts — central hook for the DailySnapshotCard.
 *
 * Pulls the founder's week from cwa_todos + time_entries and
 * computes:
 *
 *   · this-week totals    — done count, focused hours
 *   · last-week totals    — for change-velocity deltas
 *   · 4-week rolling avg  — for stability deltas
 *   · composition         — minutes by Deep / Meetings / Admin
 *   · daily bars          — 7 entries (Mon..Sun) normalised to peak
 *
 * Pass 1 surfaces only this slice. Pass 2 will add streaks, Pass 3
 * the heatmap + tomorrow setup. Hook signature is forward-compatible
 * — sub-objects can grow without breaking call sites.
 */

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { takeOversupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import type { TimeCategory } from "@/stores/timeTrackingTypes";

// ─────────────────────────────────────────────────────────────────
// Category bucketing
// ─────────────────────────────────────────────────────────────────
// We collapse 12 time-tracking categories into 3 "shape" buckets so
// the composition bar reads at a glance. Deep work is the prize
// metric; meetings are the cost; admin is the rest.

const DEEP_CATS: TimeCategory[] = [
  "Development",
  "Design",
  "Research",
  "Documentation",
];
const MEETING_CATS: TimeCategory[] = ["Meetings"];
// Everything else collapses to admin (Business, Marketing, Planning,
// Testing, Deployment, Support, Other).

function bucketFor(cat: string): "deep" | "meetings" | "admin" {
  if (DEEP_CATS.includes(cat as TimeCategory)) return "deep";
  if (MEETING_CATS.includes(cat as TimeCategory)) return "meetings";
  return "admin";
}

// ─────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────

/** Monday of the week containing `d`, at 00:00 local time. */
function weekStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? 6 : day - 1; // back to Monday
  out.setDate(out.getDate() - diff);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in local timezone — matches the way time_entries.date
  // is stored (date-only, no zone offset).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayIndex(d: Date): number {
  // Mon = 0, Tue = 1, ..., Sun = 6 — matches our weekStart anchor.
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

// ─────────────────────────────────────────────────────────────────
// Result shape
// ─────────────────────────────────────────────────────────────────

export interface CompositionSlice {
  deep: number; // minutes
  meetings: number;
  admin: number;
  total: number;
}

export interface DailySnapshot {
  thisWeek: {
    doneCount: number;
    focusedHours: number;
    composition: CompositionSlice;
    /** Mon..Sun task-completion counts. Used by the activity bars. */
    dailyDone: number[];
    /** Mon..Sun focused minutes. Used by the activity bars. */
    dailyMinutes: number[];
    /** Mon..Sun arrays of the actual task titles closed that day.
     *  Used by the day-bar tooltips so the founder can see *what*
     *  they shipped Tuesday vs Wednesday, not just the count. */
    dailyTaskTitles: string[][];
  };
  lastWeek: {
    doneCount: number;
    focusedHours: number;
  };
  fourWeekAvg: {
    /** Average weekly focused hours over the prior 4 weeks (excludes
     *  this week). Used as the stability baseline. */
    focusedHours: number;
  };
  deltas: {
    /** This week's done count − last week's. */
    doneVsLastWeek: { value: number; pct: number; direction: "up" | "down" | "flat" };
    /** This week's focused hours − 4-week avg. */
    focusedVsAvg: { value: number; pct: number; direction: "up" | "down" | "flat" };
  };
  streaks: {
    /** Contiguous days ending today where at least one task was
     *  closed. Resets at day boundaries. */
    shipping: { current: number; record: number };
    /** Contiguous days ending today where at least one time entry
     *  was logged. */
    tracking: { current: number; record: number };
  };
  /** 4×7 heatmap of task completions over the last 28 days.
   *  Rows are time-of-day buckets (morning, midday, evening, night);
   *  columns are days of the week (Mon..Sun). Computed from
   *  cwa_todos.completed_at so we get an hour-level signal without
   *  needing time-of-day on time_entries. */
  heatmap: {
    /** [bucket][dayOfWeek] = count. 4 rows × 7 cols. */
    cells: number[][];
    /** Display labels for the 4 time buckets (rows). */
    bucketLabels: string[];
    /** Hour range labels, used in tooltips. */
    bucketRanges: string[];
    /** Peak cell value — used by the renderer to normalise heat. */
    peak: number;
  };
  /** Forward-looking strip — always anchored to tomorrow regardless
   *  of which week the user is viewing. Bridges the snapshot from
   *  "week so far" to "here's what's next." */
  tomorrow: {
    /** Open tasks whose deadline falls on tomorrow. Capped at 5. */
    dueTomorrow: Array<{
      id: number;
      title: string;
      priority?: string | null;
    }>;
    /** Total open tasks with a deadline in the past. */
    overdueCount: number;
    /** Most-overdue open task — surfaces the longest-stuck item so
     *  the founder doesn't have to dig to find it. */
    topOverdue?: {
      id: number;
      title: string;
      daysOverdue: number;
    };
  };
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

/**
 * @param weekOffset 0 = this week (default), -1 = last week,
 *                   +1 = next week (typically empty), etc.
 *                   Streak metrics are NOT shifted — they always
 *                   anchor on today, because streaks describe
 *                   "where you are now."
 */
export function useDailySnapshot(weekOffset: number = 0) {
  const { data: activeUserRows } = ActiveUser();
  const user = activeUserRows?.[0];
  const username = user?.username ?? "";
  const supaId = (user as any)?.supa_id ?? "";

  // Live invalidation: when any cwa_todos or time_entries row changes,
  // nudge the snapshot to refetch immediately. Avoids "I closed a task
  // and the card still shows 0" — without forcing every surface that
  // edits a task to know about this hook's queryKey.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!username || !supaId) return;
    const channel = takeOversupabase
      .channel(`daily-snapshot:${supaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_todos" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] }),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [username, supaId, queryClient]);

  // Anchor everything to the same reference date so memoisation +
  // cache keys are stable within a render cycle.
  const now = useMemo(() => new Date(), []);
  // The "viewed" week shifts by the offset; everything below is
  // computed relative to it (deltas, 4-wk avg, daily bars, etc.).
  const thisWeekStart = useMemo(
    () => addDays(weekStart(now), weekOffset * 7),
    [now, weekOffset],
  );
  const lastWeekStart = useMemo(
    () => addDays(thisWeekStart, -7),
    [thisWeekStart],
  );
  const fourWeeksAgoStart = useMemo(
    () => addDays(thisWeekStart, -28),
    [thisWeekStart],
  );
  // Streak history window: 90 days back. Enough to find a personal
  // record that feels earned but small enough to keep the queries
  // cheap. Records reset when this window slides forward.
  const streakWindowStart = useMemo(
    () => addDays(now, -90),
    [now],
  );

  return useQuery({
    queryKey: [
      "daily-snapshot",
      username,
      supaId,
      isoDate(thisWeekStart),
      weekOffset,
    ],
    enabled: !!username && !!supaId,
    // Short stale + focus-refetch so closing a task in the Tasks
    // widget updates the snapshot card within seconds, not minutes.
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DailySnapshot> => {
      // ── Todos: pull all completions in the last 5 weeks ───────
      // Single query, partition in memory. Cheaper than 5 round trips.
      // Include title so the day-bar tooltip can list what got shipped.
      const { data: todoRows = [] } = await takeOversupabase
        .from("cwa_todos")
        .select("status,completed_at,assignee,title")
        .contains("assignee", [username])
        .eq("status", "done")
        .gte("completed_at", fourWeeksAgoStart.toISOString());

      // ── Time entries: same window, my user_id only ────────────
      const { data: entryRows = [] } = await takeOversupabase
        .from("time_entries")
        .select("date,duration_minutes,category")
        .eq("user_id", supaId)
        .gte("date", isoDate(fourWeeksAgoStart));

      // ── Partition todos into 5 weekly buckets ─────────────────
      // index 0 = this week, 1 = last, 2/3/4 = prior 3 weeks.
      const todosByWeek = [0, 0, 0, 0, 0];
      // Mon..Sun task completion counts for this week
      const dailyDone = [0, 0, 0, 0, 0, 0, 0];
      // Mon..Sun titles of tasks closed each day (for tooltip details)
      const dailyTaskTitles: string[][] = [[], [], [], [], [], [], []];
      for (const r of todoRows ?? []) {
        const at = r.completed_at ? new Date(r.completed_at) : null;
        if (!at) continue;
        const weeks = Math.floor(
          (thisWeekStart.getTime() - weekStart(at).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        if (weeks >= 0 && weeks < 5) todosByWeek[weeks]!++;
        if (weeks === 0) {
          // Within this week — also bucket by day for the bars.
          const di = dayIndex(at);
          dailyDone[di]!++;
          const title = (r as any).title;
          if (typeof title === "string" && title.trim()) {
            dailyTaskTitles[di]!.push(title.trim());
          }
        }
      }

      // ── Partition time entries: composition + weekly + daily ──
      let thisWeekDeep = 0;
      let thisWeekMeetings = 0;
      let thisWeekAdmin = 0;
      const minutesByWeek = [0, 0, 0, 0, 0];
      const dailyMinutes = [0, 0, 0, 0, 0, 0, 0];
      for (const r of entryRows ?? []) {
        if (!r.date) continue;
        const entryDate = new Date(`${r.date}T00:00:00`);
        const weeks = Math.floor(
          (thisWeekStart.getTime() - weekStart(entryDate).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        const mins = Number(r.duration_minutes) || 0;
        if (weeks >= 0 && weeks < 5) minutesByWeek[weeks]! += mins;
        if (weeks === 0) {
          dailyMinutes[dayIndex(entryDate)]! += mins;
          const bucket = bucketFor(r.category);
          if (bucket === "deep") thisWeekDeep += mins;
          else if (bucket === "meetings") thisWeekMeetings += mins;
          else thisWeekAdmin += mins;
        }
      }

      const compositionTotal =
        thisWeekDeep + thisWeekMeetings + thisWeekAdmin;
      const composition: CompositionSlice = {
        deep: thisWeekDeep,
        meetings: thisWeekMeetings,
        admin: thisWeekAdmin,
        total: compositionTotal,
      };

      // ── Hours rollups ────────────────────────────────────────
      const thisWeekHours = +(minutesByWeek[0]! / 60).toFixed(1);
      const lastWeekHours = +(minutesByWeek[1]! / 60).toFixed(1);
      const fourWkAvgHours = +(
        (minutesByWeek[1]! +
          minutesByWeek[2]! +
          minutesByWeek[3]! +
          minutesByWeek[4]!) /
        4 /
        60
      ).toFixed(1);

      // ── Streaks + tomorrow look-ahead ────────────────────────
      // Streaks pull a longer window than the 5-week summary so the
      // "record" value feels earned. The tomorrow query grabs every
      // open assigned task with a deadline — tiny payload because
      // we only need open ones — and we slice it in memory.
      // Note: tomorrow anchors on "now", not on the viewed week.
      const tomorrowStart = new Date(now);
      tomorrowStart.setHours(0, 0, 0, 0);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const [streakTodosRes, streakEntriesRes, openTodosRes] =
        await Promise.all([
          takeOversupabase
            .from("cwa_todos")
            .select("completed_at,assignee")
            .contains("assignee", [username])
            .eq("status", "done")
            .gte("completed_at", streakWindowStart.toISOString()),
          takeOversupabase
            .from("time_entries")
            .select("date")
            .eq("user_id", supaId)
            .gte("date", isoDate(streakWindowStart)),
          takeOversupabase
            .from("cwa_todos")
            .select("todo_id,title,priority,deadline,status,assignee")
            .contains("assignee", [username])
            .neq("status", "done")
            .not("deadline", "is", null),
        ]);

      const shippingDays = new Set<string>();
      for (const r of streakTodosRes.data ?? []) {
        if (!r.completed_at) continue;
        shippingDays.add(isoDate(new Date(r.completed_at)));
      }
      const trackingDays = new Set<string>();
      for (const r of streakEntriesRes.data ?? []) {
        if (!r.date) continue;
        trackingDays.add(r.date);
      }

      const shippingStreaks = computeStreaks(shippingDays, now);
      const trackingStreaks = computeStreaks(trackingDays, now);

      // ── Heatmap: 4 buckets × 7 days, 28-day window ───────────
      // Reuse the streak query data (already loaded) but clip to
      // last 28 days so the heat reflects current rhythm — not what
      // the founder was doing two months ago. Hour bucketing uses
      // the user's local timezone (completed_at is timestamptz; we
      // just call getHours on the deserialised Date).
      //
      //   bucket 0 → 06:00–11:59  morning
      //   bucket 1 → 12:00–16:59  midday
      //   bucket 2 → 17:00–21:59  evening
      //   bucket 3 → 22:00–05:59  night (wraps past midnight)
      //
      // dayIndex() already returns Mon=0..Sun=6 which is what we want.
      const HEATMAP_DAYS = 28;
      const heatmapStart = addDays(now, -HEATMAP_DAYS);
      const heatmapCells: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      let heatmapPeak = 0;
      for (const r of streakTodosRes.data ?? []) {
        if (!r.completed_at) continue;
        const t = new Date(r.completed_at);
        if (isNaN(t.getTime())) continue;
        if (t < heatmapStart) continue;
        const h = t.getHours();
        const bucket =
          h >= 6 && h < 12
            ? 0
            : h >= 12 && h < 17
              ? 1
              : h >= 17 && h < 22
                ? 2
                : 3;
        const di = dayIndex(t);
        heatmapCells[bucket]![di]!++;
        if (heatmapCells[bucket]![di]! > heatmapPeak) {
          heatmapPeak = heatmapCells[bucket]![di]!;
        }
      }

      // ── Tomorrow look-ahead ──────────────────────────────────
      // Partition open tasks into "due tomorrow" + "overdue" lists.
      // Tomorrow window already calculated above.
      const dueTomorrow: Array<{
        id: number;
        title: string;
        priority?: string | null;
      }> = [];
      let overdueCount = 0;
      let topOverdue:
        | { id: number; title: string; daysOverdue: number }
        | undefined;
      let topOverdueDays = -Infinity;

      for (const r of openTodosRes.data ?? []) {
        const deadlineStr = (r as any).deadline;
        if (!deadlineStr) continue;
        const d = new Date(deadlineStr);
        if (isNaN(d.getTime())) continue;

        if (d >= tomorrowStart && d < tomorrowEnd) {
          dueTomorrow.push({
            id: (r as any).todo_id,
            title: (r as any).title ?? "(untitled)",
            priority: (r as any).priority ?? null,
          });
        } else if (d < todayStart) {
          overdueCount++;
          const days = Math.floor(
            (todayStart.getTime() - d.getTime()) /
              (24 * 60 * 60 * 1000),
          );
          if (days > topOverdueDays) {
            topOverdueDays = days;
            topOverdue = {
              id: (r as any).todo_id,
              title: (r as any).title ?? "(untitled)",
              daysOverdue: days,
            };
          }
        }
      }
      // Cap dueTomorrow at 5 — sorted by priority (high → low) then
      // by title for stability.
      const PRIORITY_RANK: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      dueTomorrow.sort((a, b) => {
        const ra = PRIORITY_RANK[a.priority ?? ""] ?? 3;
        const rb = PRIORITY_RANK[b.priority ?? ""] ?? 3;
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });
      const dueTomorrowCapped = dueTomorrow.slice(0, 5);

      // ── Deltas ───────────────────────────────────────────────
      const doneDeltaValue = todosByWeek[0]! - todosByWeek[1]!;
      const doneDeltaPct = todosByWeek[1]!
        ? Math.round((doneDeltaValue / todosByWeek[1]!) * 100)
        : doneDeltaValue > 0
          ? 100
          : 0;

      const focusedDeltaValue = +(thisWeekHours - fourWkAvgHours).toFixed(1);
      const focusedDeltaPct = fourWkAvgHours
        ? Math.round((focusedDeltaValue / fourWkAvgHours) * 100)
        : focusedDeltaValue > 0
          ? 100
          : 0;

      return {
        thisWeek: {
          doneCount: todosByWeek[0]!,
          focusedHours: thisWeekHours,
          composition,
          dailyDone,
          dailyMinutes,
          dailyTaskTitles,
        },
        lastWeek: {
          doneCount: todosByWeek[1]!,
          focusedHours: lastWeekHours,
        },
        fourWeekAvg: { focusedHours: fourWkAvgHours },
        deltas: {
          doneVsLastWeek: {
            value: doneDeltaValue,
            pct: doneDeltaPct,
            direction:
              doneDeltaValue > 0
                ? "up"
                : doneDeltaValue < 0
                  ? "down"
                  : "flat",
          },
          focusedVsAvg: {
            value: focusedDeltaValue,
            pct: focusedDeltaPct,
            direction:
              focusedDeltaValue > 0
                ? "up"
                : focusedDeltaValue < 0
                  ? "down"
                  : "flat",
          },
        },
        streaks: {
          shipping: shippingStreaks,
          tracking: trackingStreaks,
        },
        tomorrow: {
          dueTomorrow: dueTomorrowCapped,
          overdueCount,
          topOverdue,
        },
        heatmap: {
          cells: heatmapCells,
          bucketLabels: ["Morn", "Mid", "Eve", "Night"],
          bucketRanges: ["6a–12p", "12–5p", "5–10p", "10p–6a"],
          peak: heatmapPeak,
        },
      };
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Streak computation
// ─────────────────────────────────────────────────────────────────
// `days` is a Set of YYYY-MM-DD strings indicating "had activity that
// day." Returns the current ongoing streak ending today (or yesterday
// if today is empty — we don't punish people for checking the
// dashboard before they ship that day) and the longest streak in the
// window. `record` is at least as large as `current`.

function computeStreaks(
  days: Set<string>,
  now: Date,
): { current: number; record: number } {
  // Walk back from today. If today's empty but yesterday is non-empty,
  // anchor on yesterday so the streak doesn't drop until the day
  // actually ends.
  let cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(isoDate(cursor)) && days.has(isoDate(addDays(cursor, -1)))) {
    cursor = addDays(cursor, -1);
  }

  let current = 0;
  while (days.has(isoDate(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Longest contiguous run anywhere in the window.
  const sorted = Array.from(days).sort();
  let record = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev === null) {
      run = 1;
    } else {
      const prevDate = new Date(`${prev}T00:00:00`);
      const expected = isoDate(addDays(prevDate, 1));
      if (d === expected) run++;
      else run = 1;
    }
    if (run > record) record = run;
    prev = d;
  }

  return { current, record: Math.max(record, current) };
}
