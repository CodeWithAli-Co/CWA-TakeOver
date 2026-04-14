// ============================================================================
// Scheduler — turns "current lesson" + goals into a daily / weekly plan.
// Pure functions; no Supabase or React here.
// ============================================================================

import type { Lesson, LessonProgressRow, LessonStatus, UserStatsRow } from "./types";
import { ALL_LESSONS } from "./curriculum";

// Decide each lesson's status for the current learner.
export function computeLessonStatuses(
  progressRows: LessonProgressRow[],
): Map<string, LessonStatus> {
  const byId = new Map<string, LessonProgressRow>();
  progressRows.forEach((p) => byId.set(p.lesson_id, p));

  const statuses = new Map<string, LessonStatus>();

  for (const lesson of ALL_LESSONS) {
    const row = byId.get(lesson.id);
    if (row?.status === "completed") {
      statuses.set(lesson.id, "completed");
      continue;
    }
    if (row?.status === "in_progress") {
      statuses.set(lesson.id, "in_progress");
      continue;
    }
    // Every lesson is open — Hanif can skip ahead whenever he wants.
    // Prerequisites are still defined in the curriculum for recommended order,
    // but they never gate access.
    statuses.set(lesson.id, "available");
  }

  return statuses;
}

// Next lesson the user should tackle.
export function findNextLesson(
  statuses: Map<string, LessonStatus>,
): Lesson | undefined {
  for (const lesson of ALL_LESSONS) {
    const s = statuses.get(lesson.id);
    if (s === "in_progress" || s === "available") return lesson;
  }
  return undefined;
}

// Today's plan — lessons to tackle in the current session, sized to hit the
// daily minute goal (default 25). Always at least one lesson.
export function buildTodayPlan(
  statuses: Map<string, LessonStatus>,
  dailyGoalMinutes: number,
): Lesson[] {
  const target = Math.max(15, dailyGoalMinutes);
  const out: Lesson[] = [];
  let minutes = 0;

  for (const lesson of ALL_LESSONS) {
    const s = statuses.get(lesson.id);
    if (s !== "in_progress" && s !== "available") continue;
    out.push(lesson);
    minutes += lesson.estimatedMinutes;
    if (minutes >= target) break;
  }

  return out.length ? out : ALL_LESSONS.slice(0, 1);
}

// Rough weekly plan preview — target X days/week of study.
export interface WeekDayPlan {
  dayOffset: number;           // 0 = today, 1 = tomorrow, …
  dayLabel: string;            // "Mon", "Tue"
  dateStr: string;             // YYYY-MM-DD
  lessons: Lesson[];
  totalMinutes: number;
  alreadyStudied: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildWeekPlan(
  statuses: Map<string, LessonStatus>,
  stats: UserStatsRow,
): WeekDayPlan[] {
  const target = stats.target_days_per_week;
  const daily = stats.daily_goal_minutes;
  const activeDays = new Set(stats.active_days);

  // Pool of upcoming lessons (available / in_progress).
  const pool: Lesson[] = ALL_LESSONS.filter(
    (l) => {
      const s = statuses.get(l.id);
      return s === "available" || s === "in_progress";
    },
  );

  const out: WeekDayPlan[] = [];
  let poolIdx = 0;
  let studyDaysPlanned = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = DAY_LABELS[d.getDay()];

    const lessons: Lesson[] = [];
    let minutes = 0;

    const shouldPlan = studyDaysPlanned < target && poolIdx < pool.length;
    if (shouldPlan) {
      while (poolIdx < pool.length && minutes < daily) {
        const lesson = pool[poolIdx];
        lessons.push(lesson);
        minutes += lesson.estimatedMinutes;
        poolIdx++;
      }
      if (lessons.length) studyDaysPlanned++;
    }

    out.push({
      dayOffset: i,
      dayLabel,
      dateStr,
      lessons,
      totalMinutes: minutes,
      alreadyStudied: activeDays.has(dateStr),
    });
  }

  return out;
}

// Lessons the learner has completed but may benefit from replaying (spaced review).
export function buildReviewQueue(
  progressRows: LessonProgressRow[],
  limit = 5,
): LessonProgressRow[] {
  const done = progressRows.filter((r) => r.status === "completed");
  // Prioritize: oldest completion first, lowest best_score first.
  return [...done]
    .sort((a, b) => {
      const byScore = a.best_score - b.best_score;
      if (byScore !== 0) return byScore;
      const ad = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bd = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return ad - bd;
    })
    .slice(0, limit);
}
