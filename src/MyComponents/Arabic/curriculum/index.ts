// ============================================================================
// Curriculum aggregator — exports the full 10-level path.
// Lessons compile out of in-repo TS so they're versioned, typed, and reviewable.
// ============================================================================

import type { Lesson, Level } from "../types";
import { level1 } from "./level1_alphabet_a";
import { level2 } from "./level2_alphabet_b";
import { level3 } from "./level3_harakat";
import { level4 } from "./level4_greetings";
import { level5 } from "./level5_pronouns";
import { level6 } from "./level6_numbers";
import { level7 } from "./level7_family";
import { level8 } from "./level8_verbs";
import { level9 } from "./level9_food";
import { level10 } from "./level10_reading";

export const LEVELS: Level[] = [
  level1, level2, level3, level4, level5,
  level6, level7, level8, level9, level10,
];

export const ALL_LESSONS: Lesson[] = LEVELS.flatMap((l) => l.lessons);

export const LESSONS_BY_ID: Record<string, Lesson> = Object.fromEntries(
  ALL_LESSONS.map((l) => [l.id, l]),
);

export const LEVEL_BY_ID: Record<string, Level> = Object.fromEntries(
  LEVELS.map((l) => [l.id, l]),
);

export function getLesson(id: string): Lesson | undefined {
  return LESSONS_BY_ID[id];
}

export function getLevel(id: string): Level | undefined {
  return LEVEL_BY_ID[id];
}

// Total counts — used for progress bars.
export const TOTAL_LESSONS = ALL_LESSONS.length;
export const TOTAL_MINUTES = ALL_LESSONS.reduce((s, l) => s + l.estimatedMinutes, 0);
export const TOTAL_XP = ALL_LESSONS.reduce((s, l) => s + l.xp, 0);
