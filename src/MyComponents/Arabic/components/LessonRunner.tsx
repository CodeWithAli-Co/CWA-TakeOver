// ============================================================================
// LessonRunner — orchestrates a lesson's activities, scores, saves, and
// shows the completion screen with XP, stats, and achievements.
// ============================================================================

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Award, Sparkles, RotateCcw } from "lucide-react";
import type {
  Activity,
  ActivityKind,
  ActivityResult,
  Lesson,
  LessonRunResult,
} from "../types";
import { InfoSlide } from "./activities/shared";
import { MCQActivity } from "./activities/MCQActivity";
import { FlashcardActivity } from "./activities/FlashcardActivity";
import { MatchActivity } from "./activities/MatchActivity";
import { TypingActivity } from "./activities/TypingActivity";
import { TraceActivity } from "./activities/TraceActivity";
import { FillBlankActivity } from "./activities/FillBlankActivity";
import { ReadingActivity } from "./activities/ReadingActivity";
import { DialogueActivity } from "./activities/DialogueActivity";
import { pickLessonComplete } from "../encouragement";
import { findAchievement } from "../achievements";
import { recordLessonRun, useInvalidateArabicProgress } from "../progress";

const SCORED: Set<ActivityKind> = new Set([
  "mcq", "match", "typing", "trace", "fillblank", "reading", "dialogue",
]);

function promptKey(a: Activity, i: number): string {
  if (a.kind === "mcq") return `${i}:${a.question}`;
  if (a.kind === "typing") return `${i}:type:${a.expected}`;
  if (a.kind === "fillblank") return `${i}:fill:${a.blank}`;
  if (a.kind === "reading" || a.kind === "dialogue") return `${i}:${a.question}`;
  if (a.kind === "trace") return `${i}:trace:${a.target}`;
  return `${i}:${a.kind}`;
}

export function LessonRunner({
  username,
  lesson,
  onExit,
  onCompleted,
}: {
  username: string;
  lesson: Lesson;
  onExit: () => void;
  onCompleted: (result: LessonRunResult) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ActivityResult[]>([]);
  const [finished, setFinished] = useState<LessonRunResult | null>(null);
  const [savedAchievements, setSavedAchievements] = useState<string[] | null>(null);
  const invalidate = useInvalidateArabicProgress();
  const startRef = useRef<number>(Date.now());

  const activity = lesson.activities[idx];
  const total = lesson.activities.length;
  const progress = Math.round(((idx + (finished ? 1 : 0)) / total) * 100);

  const handleResult = (correct: boolean, answeredText?: string) => {
    setResults((r) => [
      ...r,
      {
        activityIndex: idx,
        kind: activity.kind,
        correct,
        answeredText,
        promptKey: promptKey(activity, idx),
      },
    ]);
  };

  const handleNext = () => {
    if (idx < lesson.activities.length - 1) {
      setIdx(idx + 1);
    } else {
      finishLesson();
    }
  };

  async function finishLesson() {
    const scored = results.filter((r) => SCORED.has(r.kind));
    const correct = scored.filter((r) => r.correct).length;
    const score = scored.length === 0 ? 100 : Math.round((correct / scored.length) * 100);
    const xpEarned = Math.round((score / 100) * lesson.xp);
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    const mistakes = scored.filter((r) => !r.correct).map((r) => r.promptKey);

    const run: LessonRunResult = {
      lessonId: lesson.id,
      correct,
      total: scored.length,
      score,
      xpEarned,
      mistakes,
      elapsedSeconds,
    };
    setFinished(run);

    try {
      const { newAchievementKeys } = await recordLessonRun(username, run, lesson.estimatedMinutes);
      setSavedAchievements(newAchievementKeys);
      invalidate(username);
    } catch (e) {
      console.error("recordLessonRun failed:", e);
      setSavedAchievements([]);
    }

    onCompleted(run);
  }

  const render = () => {
    if (finished) return null;
    const cb = { onResult: handleResult, onNext: handleNext };
    switch (activity.kind) {
      case "info":
        return (
          <InfoSlide
            title={activity.title}
            body={activity.body}
            tip={activity.tip}
            showcase={activity.showcase}
            onNext={handleNext}
          />
        );
      case "mcq":       return <MCQActivity activity={activity} cb={cb} />;
      case "flashcard": return <FlashcardActivity activity={activity} cb={cb} />;
      case "match":     return <MatchActivity activity={activity} cb={cb} />;
      case "typing":    return <TypingActivity activity={activity} cb={cb} />;
      case "trace":     return <TraceActivity activity={activity} cb={cb} />;
      case "fillblank": return <FillBlankActivity activity={activity} cb={cb} />;
      case "reading":   return <ReadingActivity activity={activity} cb={cb} />;
      case "dialogue": return <DialogueActivity activity={activity} cb={cb} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#050812] via-[#0a0f1e] to-[#0c1020] overflow-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-[#050812]/80 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={onExit}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            title="Exit lesson"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              {lesson.id} · {lesson.theme}
            </div>
            <div className="text-sm text-white/85 font-medium truncate">{lesson.title}</div>
          </div>

          <div className="text-xs text-white/50 font-mono">{progress}%</div>
        </div>
        <div className="h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 pb-20">
        <AnimatePresence mode="wait">
          {!finished ? (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {render()}
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
              <CompletionScreen
                lesson={lesson}
                result={finished}
                newAchievements={savedAchievements ?? []}
                onExit={onExit}
                onReplay={() => {
                  setIdx(0);
                  setResults([]);
                  setFinished(null);
                  setSavedAchievements(null);
                  startRef.current = Date.now();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Completion screen ----------

function CompletionScreen({
  lesson,
  result,
  newAchievements,
  onExit,
  onReplay,
}: {
  lesson: Lesson;
  result: LessonRunResult;
  newAchievements: string[];
  onExit: () => void;
  onReplay: () => void;
}) {
  const message = pickLessonComplete(result.score);
  const achievements = newAchievements.map((k) => findAchievement(k)).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-300" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">Lesson complete</h2>
        <p className="text-white/60 max-w-xl mx-auto leading-relaxed">{message}</p>
        {lesson.wrapUp && (
          <p className="text-sky-200/80 italic text-sm max-w-xl mx-auto mt-2">{lesson.wrapUp}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
        <StatTile label="Score" value={`${result.score}%`} />
        <StatTile label="XP earned" value={`+${result.xpEarned}`} tint="sky" />
        <StatTile label="Time" value={`${Math.max(1, Math.round(result.elapsedSeconds / 60))}m`} />
      </div>

      {achievements.length > 0 && (
        <div className="max-w-lg mx-auto rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-100 font-semibold">
            <Sparkles className="h-4 w-4" />
            New achievement{achievements.length > 1 ? "s" : ""}!
          </div>
          <div className="space-y-2">
            {achievements.map((a) =>
              a ? (
                <div key={a.key} className="flex items-center gap-3 rounded-xl bg-black/25 p-3">
                  <div className="text-2xl">{a.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{a.title}</div>
                    <div className="text-white/60 text-xs">{a.description}</div>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={onReplay}
          className="px-5 py-2.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white/85 font-medium flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" /> Replay
        </button>
        <button
          onClick={onExit}
          className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold flex items-center gap-2"
        >
          <Award className="h-4 w-4" /> Back to dashboard
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value, tint = "neutral" }: { label: string; value: string; tint?: "neutral" | "sky" }) {
  const color = tint === "sky" ? "text-sky-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={"text-xl font-bold mt-1 " + color}>{value}</div>
    </div>
  );
}
