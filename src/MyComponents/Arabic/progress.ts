// ============================================================================
// Progress layer — per-user reads/writes against companySupabase// Every row is scoped by `username` so CEO, Hanif, etc. each have isolated
// progress. No table-wide writes, ever.
// ============================================================================

import { companySupabase } from "@/MyComponents/supabase";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LessonProgressRow,
  UserStatsRow,
  LessonRunResult,
} from "./types";
import { newlyEarned } from "./achievements";

const DEFAULT_STATS = (username: string): UserStatsRow => ({
  username,
  current_streak: 0,
  longest_streak: 0,
  total_xp: 0,
  total_minutes: 0,
  lessons_completed: 0,
  last_activity_date: null,
  current_lesson_id: null,
  achievements: [],
  daily_goal_minutes: 25,
  target_days_per_week: 4,
  active_days: [],
});

// --- Queries ----------------------------------------------------------------

const fetchLessonProgress = async (
  username: string,
): Promise<LessonProgressRow[]> => {
  if (!username) return [];
  const { data, error } = await companySupabase    .from("arabic_lesson_progress")
    .select("*")
    .eq("username", username);
  if (error) {
    console.error("arabic_lesson_progress fetch error:", error.message);
    return [];
  }
  return (data ?? []) as LessonProgressRow[];
};

export const useLessonProgress = (username: string) =>
  useSuspenseQuery({
    queryKey: ["arabic_lesson_progress", username],
    queryFn: () => fetchLessonProgress(username),
  });

const fetchUserStats = async (username: string): Promise<UserStatsRow> => {
  if (!username) return DEFAULT_STATS("");
  const { data, error } = await companySupabase    .from("arabic_user_stats")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    console.error("arabic_user_stats fetch error:", error.message);
    return DEFAULT_STATS(username);
  }
  if (!data) {
    // First-time user — insert a default row so subsequent upserts are cheap.
    const fresh = DEFAULT_STATS(username);
    const { error: insertErr } = await companySupabase
.from("arabic_user_stats")
      .insert(fresh);
    if (insertErr) console.error("insert default stats:", insertErr.message);
    return fresh;
  }
  return {
    ...DEFAULT_STATS(username),
    ...data,
    achievements: data.achievements ?? [],
    active_days: data.active_days ?? [],
  } as UserStatsRow;
};

export const useUserStats = (username: string) =>
  useSuspenseQuery({
    queryKey: ["arabic_user_stats", username],
    queryFn: () => fetchUserStats(username),
  });

// --- Writes -----------------------------------------------------------------

export async function recordLessonRun(
  username: string,
  result: LessonRunResult,
  lessonMinutes: number,
): Promise<{ newAchievementKeys: string[] }> {
  const today = new Date().toISOString().slice(0, 10);

  // Existing row, if any.
  const { data: existing } = await companySupabase    .from("arabic_lesson_progress")
    .select("*")
    .eq("username", username)
    .eq("lesson_id", result.lessonId)
    .maybeSingle();

  const prevBest = existing?.best_score ?? 0;
  const newBest = Math.max(prevBest, result.score);

  const isCompletion = result.score >= 60;  // pass threshold
  const status = isCompletion ? "completed" : "in_progress";

  const baseRow: Partial<LessonProgressRow> = {
    username,
    lesson_id: result.lessonId,
    status,
    attempts: (existing?.attempts ?? 0) + 1,
    best_score: newBest,
    last_score: result.score,
    xp_earned: Math.max(existing?.xp_earned ?? 0, result.xpEarned),
    minutes_studied: (existing?.minutes_studied ?? 0) + Math.round(result.elapsedSeconds / 60),
    mistakes: result.mistakes,
    last_attempted_at: new Date().toISOString(),
    completed_at: isCompletion ? new Date().toISOString() : existing?.completed_at ?? null,
  };

  const { error: upsertErr } = await companySupabase    .from("arabic_lesson_progress")
    .upsert(baseRow, { onConflict: "username,lesson_id" });
  if (upsertErr) console.error("upsert lesson progress:", upsertErr.message);

  // Update aggregate stats.
  const { data: statsRow } = await companySupabase    .from("arabic_user_stats")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  const stats: UserStatsRow = statsRow
    ? {
        ...DEFAULT_STATS(username),
        ...statsRow,
        achievements: statsRow.achievements ?? [],
        active_days: statsRow.active_days ?? [],
      }
    : DEFAULT_STATS(username);

  // Only increment lessons_completed on the FIRST time a lesson reaches "completed".
  const firstTimeComplete =
    isCompletion && (!existing || existing.status !== "completed");

  // Streak logic.
  const last = stats.last_activity_date;
  let currentStreak = stats.current_streak;
  const addedDay = !stats.active_days.includes(today);
  if (addedDay) {
    if (last) {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      currentStreak = last === yestStr ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
  }

  const nextStats: UserStatsRow = {
    ...stats,
    total_xp: stats.total_xp + result.xpEarned,
    total_minutes: stats.total_minutes + Math.max(1, Math.round(result.elapsedSeconds / 60 || lessonMinutes)),
    lessons_completed: stats.lessons_completed + (firstTimeComplete ? 1 : 0),
    last_activity_date: today,
    current_streak: currentStreak,
    longest_streak: Math.max(stats.longest_streak, currentStreak),
    current_lesson_id: result.lessonId,
    active_days: addedDay ? [...stats.active_days, today] : stats.active_days,
  };

  const earned = newlyEarned(nextStats);
  if (earned.length) {
    nextStats.achievements = [...nextStats.achievements, ...earned.map((a) => a.key)];
  }

  const { error: statsErr } = await companySupabase    .from("arabic_user_stats")
    .upsert(nextStats, { onConflict: "username" });
  if (statsErr) console.error("upsert user stats:", statsErr.message);

  return { newAchievementKeys: earned.map((a) => a.key) };
}

// Convenience: invalidate both queries for a username.
export function useInvalidateArabicProgress() {
  const qc = useQueryClient();
  return (username: string) => {
    qc.invalidateQueries({ queryKey: ["arabic_lesson_progress", username] });
    qc.invalidateQueries({ queryKey: ["arabic_user_stats", username] });
  };
}

export async function updateGoals(
  username: string,
  patch: Partial<Pick<UserStatsRow, "daily_goal_minutes" | "target_days_per_week">>,
) {
  const { error } = await companySupabase    .from("arabic_user_stats")
    .update(patch)
    .eq("username", username);
  if (error) console.error("update goals:", error.message);
}
