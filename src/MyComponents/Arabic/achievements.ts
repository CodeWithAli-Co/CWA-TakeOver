// ============================================================================
// Achievements / Badges — awarded via checkAchievements() after a lesson run.
// ============================================================================

import type { UserStatsRow } from "./types";

export interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  predicate: (stats: UserStatsRow) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_lesson",
    title: "First Steps",
    description: "Complete your first Arabic lesson.",
    emoji: "🌱",
    predicate: (s) => s.lessons_completed >= 1,
  },
  {
    key: "alphabet_started",
    title: "Alif, Ba, Ta…",
    description: "Complete 3 alphabet lessons.",
    emoji: "🔤",
    predicate: (s) => s.lessons_completed >= 3,
  },
  {
    key: "ten_lessons",
    title: "Taking Root",
    description: "Complete 10 lessons.",
    emoji: "🌿",
    predicate: (s) => s.lessons_completed >= 10,
  },
  {
    key: "twenty_five",
    title: "Quarter of the Way",
    description: "Complete 25 lessons.",
    emoji: "📘",
    predicate: (s) => s.lessons_completed >= 25,
  },
  {
    key: "fifty",
    title: "Half-Fluent Traveler",
    description: "Complete 50 lessons.",
    emoji: "🏔️",
    predicate: (s) => s.lessons_completed >= 50,
  },
  {
    key: "streak_3",
    title: "On a Roll",
    description: "3-day learning streak.",
    emoji: "🔥",
    predicate: (s) => s.current_streak >= 3,
  },
  {
    key: "streak_7",
    title: "Disciplined",
    description: "7-day learning streak.",
    emoji: "🔥🔥",
    predicate: (s) => s.current_streak >= 7,
  },
  {
    key: "streak_30",
    title: "Rooted",
    description: "30-day learning streak.",
    emoji: "🌳",
    predicate: (s) => s.current_streak >= 30,
  },
  {
    key: "xp_500",
    title: "500 XP",
    description: "Earn 500 total XP.",
    emoji: "⭐",
    predicate: (s) => s.total_xp >= 500,
  },
  {
    key: "xp_2000",
    title: "2,000 XP",
    description: "Earn 2,000 total XP.",
    emoji: "🌟",
    predicate: (s) => s.total_xp >= 2000,
  },
  {
    key: "hour_studied",
    title: "One Hour In",
    description: "Study for 60 minutes total.",
    emoji: "⏳",
    predicate: (s) => s.total_minutes >= 60,
  },
  {
    key: "ten_hours",
    title: "Ten Hours Deep",
    description: "Study for 10 hours total.",
    emoji: "🕰️",
    predicate: (s) => s.total_minutes >= 600,
  },
];

// Returns achievement keys newly earned (not previously in stats.achievements).
export function newlyEarned(stats: UserStatsRow): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => a.predicate(stats) && !stats.achievements.includes(a.key),
  );
}

export function findAchievement(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
