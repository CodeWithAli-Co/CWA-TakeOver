// ============================================================================
// Arabic Learning — Type Definitions
// Curriculum is authored in-repo (TS). Per-user progress lives in Supabase.
// ============================================================================

export type ActivityKind =
  | "info"          // teaching slide, not scored
  | "flashcard"     // reveal-style self-check
  | "mcq"           // multiple-choice question
  | "match"         // match Arabic ↔ English pairs
  | "typing"        // type the Arabic (transliteration accepted)
  | "trace"         // letter recognition (pick matching form)
  | "fillblank"     // fill the missing word
  | "reading"       // read a short passage + comprehension
  | "dialogue";     // read a back-and-forth dialogue

export type LessonTheme =
  | "alphabet"
  | "harakat"
  | "pronunciation"
  | "greetings"
  | "pronouns"
  | "numbers"
  | "time"
  | "family"
  | "food"
  | "verbs"
  | "grammar"
  | "reading"
  | "culture"
  | "review";

// Small bilingual token shown throughout the UI.
export interface BilingualWord {
  ar: string;               // Arabic script (with harakat where helpful)
  translit: string;         // Latin transliteration (e.g., "marḥaban")
  en: string;               // English meaning
  note?: string;            // optional pronunciation / cultural note
}

// ---------- Activity payloads ----------

export interface InfoActivity {
  kind: "info";
  title: string;
  body: string;                 // plain text; supports simple \n paragraphs
  showcase?: BilingualWord[];   // optional vocabulary / letter showcase
  tip?: string;                 // pronunciation or usage tip
}

export interface FlashcardActivity {
  kind: "flashcard";
  prompt: string;               // e.g., "Recall these letters"
  cards: BilingualWord[];
}

export interface MCQActivity {
  kind: "mcq";
  question: string;             // can mix ar + en
  arabicPrompt?: string;        // optional large Arabic glyph above question
  choices: string[];
  correctIndex: number;
  explain?: string;             // shown after answer
}

export interface MatchActivity {
  kind: "match";
  prompt: string;
  pairs: { ar: string; en: string; translit?: string }[];
}

export interface TypingActivity {
  kind: "typing";
  prompt: string;
  expected: string;             // accepted answer (case/space-insensitive)
  altAccepted?: string[];       // alternate acceptable answers
  hint?: string;
}

export interface TraceActivity {
  kind: "trace";
  prompt: string;               // "Pick the INITIAL form of ب"
  target: string;
  choices: string[];
  correctIndex: number;
}

export interface FillBlankActivity {
  kind: "fillblank";
  prompt: string;               // with "____" token
  blank: string;                // the actual word
  translit?: string;
  en: string;
  choices: string[];
  correctIndex: number;
  explain?: string;             // shown after answer
}

export interface ReadingActivity {
  kind: "reading";
  prompt: string;
  passageAr: string;
  translation: string;
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface DialogueActivity {
  kind: "dialogue";
  prompt: string;
  lines: { speaker: "A" | "B"; ar: string; translit: string; en: string }[];
  question: string;
  choices: string[];
  correctIndex: number;
}

export type Activity =
  | InfoActivity
  | FlashcardActivity
  | MCQActivity
  | MatchActivity
  | TypingActivity
  | TraceActivity
  | FillBlankActivity
  | ReadingActivity
  | DialogueActivity;

// ---------- Lesson / Level ----------

export interface Lesson {
  id: string;                   // stable id, e.g., "L1.2"
  levelId: string;              // parent level, e.g., "L1"
  order: number;                // order within level
  title: string;
  subtitle?: string;
  theme: LessonTheme;
  estimatedMinutes: number;     // 20–30
  xp: number;                   // base XP on completion
  prerequisites?: string[];     // lesson ids required first
  activities: Activity[];
  summary: string;              // single-line tagline for cards
  wrapUp?: string;              // closing message shown on completion
}

export interface Level {
  id: string;                   // "L1", "L2", …
  order: number;
  title: string;
  subtitle: string;
  theme: LessonTheme;
  goal: string;                 // what the learner will achieve
  lessons: Lesson[];
}

// ---------- Progress (stored in Supabase) ----------

export type LessonStatus = "locked" | "available" | "in_progress" | "completed" | "mastered";

export interface LessonProgressRow {
  id?: number;
  username: string;             // scopes to user — Hanif, CEO, etc. each have their own
  lesson_id: string;
  status: LessonStatus;
  attempts: number;
  best_score: number;           // 0–100
  last_score: number;
  xp_earned: number;
  minutes_studied: number;
  mistakes: string[];           // question ids / prompts the learner missed
  last_attempted_at: string | null;
  completed_at: string | null;
}

export interface UserStatsRow {
  username: string;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  total_minutes: number;
  lessons_completed: number;
  last_activity_date: string | null;  // YYYY-MM-DD
  current_lesson_id: string | null;
  achievements: string[];              // badge keys earned
  daily_goal_minutes: number;          // default 25
  target_days_per_week: number;        // default 4
  active_days: string[];               // YYYY-MM-DD of completed days
}

// ---------- Runner state ----------

export interface ActivityResult {
  activityIndex: number;
  kind: ActivityKind;
  correct: boolean;             // true for info/flashcard (completion), else based on answer
  answeredText?: string;
  promptKey: string;            // identifier used for mistake log
}

export interface LessonRunResult {
  lessonId: string;
  correct: number;
  total: number;                // scored activity count
  score: number;                // 0–100
  xpEarned: number;
  mistakes: string[];
  elapsedSeconds: number;
}
