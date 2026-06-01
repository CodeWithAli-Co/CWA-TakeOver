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

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

export function useDailySnapshot() {
  const { data: activeUserRows } = ActiveUser();
  const user = activeUserRows?.[0];
  const username = user?.username ?? "";
  const supaId = (user as any)?.supa_id ?? "";

  // Anchor everything to the same reference date so memoisation +
  // cache keys are stable within a render cycle.
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => weekStart(now), [now]);
  const lastWeekStart = useMemo(
    () => addDays(thisWeekStart, -7),
    [thisWeekStart],
  );
  const fourWeeksAgoStart = useMemo(
    () => addDays(thisWeekStart, -28),
    [thisWeekStart],
  );

  return useQuery({
    queryKey: [
      "daily-snapshot",
      username,
      supaId,
      isoDate(thisWeekStart),
    ],
    enabled: !!username && !!supaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DailySnapshot> => {
      // ── Todos: pull all completions in the last 5 weeks ───────
      // Single query, partition in memory. Cheaper than 5 round trips.
      const { data: todoRows = [] } = await takeOversupabase
        .from("cwa_todos")
        .select("status,completed_at,assignee")
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
          dailyDone[dayIndex(at)]!++;
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
      };
    },
  });
}
