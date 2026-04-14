// ============================================================================
// ArabicDashboard — the entry screen for the Arabic learning system.
// Sections: header stats, today's path, weekly plan, level map, achievements.
// ============================================================================

import React, { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame, Trophy, Clock, Target, BookOpen, CheckCircle2,
  Play, Sparkles, CalendarCheck2, Award, ChevronRight, Circle,
} from "lucide-react";
import { ActiveUser } from "@/stores/query";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import type { Lesson, LessonStatus, UserStatsRow } from "../types";
import { LEVELS, TOTAL_LESSONS, TOTAL_XP } from "../curriculum";
import {
  useLessonProgress, useUserStats, updateGoals, useInvalidateArabicProgress,
} from "../progress";
import {
  computeLessonStatuses, findNextLesson, buildTodayPlan,
  buildWeekPlan, buildReviewQueue,
} from "../scheduler";
import { ACHIEVEMENTS } from "../achievements";
import { LessonRunner } from "./LessonRunner";
import { streakMessage } from "../encouragement";

// ----- Root — picks up username from ActiveUser -----------------------------

export default function ArabicDashboardRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO]}>
      <Suspense fallback={<div className="p-8 text-white/50">Loading Arabic…</div>}>
        <ArabicDashboard />
      </Suspense>
    </UserView>
  );
}

function ArabicDashboard() {
  const { data: userData } = ActiveUser();
  const username = userData?.[0]?.username ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050812] via-[#070b18] to-[#0a0f1e] text-white">
      <Suspense fallback={<div className="p-8 text-white/50">Loading progress…</div>}>
        <ArabicInner username={username} />
      </Suspense>
    </div>
  );
}

function ArabicInner({ username }: { username: string }) {
  const { data: progress } = useLessonProgress(username);
  const { data: stats } = useUserStats(username);
  const invalidate = useInvalidateArabicProgress();

  const statuses = useMemo(() => computeLessonStatuses(progress), [progress]);
  const todayPlan = useMemo(() => buildTodayPlan(statuses, stats.daily_goal_minutes), [statuses, stats]);
  const weekPlan = useMemo(() => buildWeekPlan(statuses, stats), [statuses, stats]);
  const reviewQueue = useMemo(() => buildReviewQueue(progress, 4), [progress]);
  const nextUp = useMemo(() => findNextLesson(statuses), [statuses]);

  const [runningLesson, setRunningLesson] = useState<Lesson | null>(null);
  const [tab, setTab] = useState<"path" | "today" | "week" | "achievements">("today");

  const lessonsCompleted = stats.lessons_completed;
  const overallPct = Math.round((lessonsCompleted / TOTAL_LESSONS) * 100);

  if (runningLesson) {
    return (
      <LessonRunner
        username={username}
        lesson={runningLesson}
        onExit={() => {
          setRunningLesson(null);
          invalidate(username);
        }}
        onCompleted={() => { /* stats already saved inside runner */ }}
      />
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const studiedToday = stats.active_days.includes(today);
  const streakNote = streakMessage(stats.current_streak);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <header className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-sky-500/30 border border-white/15 flex items-center justify-center text-xl"
                style={{ fontFamily: '"Amiri", serif' }}>ع</div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Arabic — Foundations</h1>
                <div className="text-white/50 text-sm">
                  A structured path from alphabet to real reading · {username ? `for ${username}` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/40">Overall progress</div>
            <div className="text-3xl font-bold">{overallPct}%</div>
            <div className="text-xs text-white/50">{lessonsCompleted} / {TOTAL_LESSONS} lessons</div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Flame} tint="amber" label="Current streak" value={`${stats.current_streak}d`}
            sub={stats.longest_streak > 0 ? `best: ${stats.longest_streak}d` : "start today"} />
          <StatCard icon={Trophy} tint="sky" label="Total XP"
            value={stats.total_xp.toLocaleString()} sub={`of ${TOTAL_XP.toLocaleString()} possible`} />
          <StatCard icon={Clock} tint="emerald" label="Time studied"
            value={formatMinutes(stats.total_minutes)} sub={studiedToday ? "Studied today ✓" : "Not yet today"} />
          <StatCard icon={Target} tint="violet" label="Weekly goal"
            value={`${stats.target_days_per_week}d × ${stats.daily_goal_minutes}m`}
            sub="adjustable below" />
        </div>

        {streakNote && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-amber-100 text-sm flex items-center gap-2">
            <Flame className="h-4 w-4" /> {streakNote}
          </div>
        )}
      </header>

      {/* Continue / Next lesson banner */}
      {nextUp && (
        <section>
          <NextLessonCard
            lesson={nextUp}
            onStart={() => setRunningLesson(nextUp)}
            statuses={statuses}
          />
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(
          [
            ["today", "Today", CalendarCheck2],
            ["week", "This Week", Target],
            ["path", "Full Path", BookOpen],
            ["achievements", "Achievements", Award],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors " +
              (tab === k
                ? "border-sky-400 text-white"
                : "border-transparent text-white/50 hover:text-white/80")
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "today" && (
        <TodaySection
          plan={todayPlan}
          review={reviewQueue.map((r) => ({ lessonId: r.lesson_id, bestScore: r.best_score }))}
          onStart={(l) => setRunningLesson(l)}
          stats={stats}
          username={username}
          onGoalsChanged={() => invalidate(username)}
        />
      )}
      {tab === "week" && <WeekSection plan={weekPlan} onStart={(l) => setRunningLesson(l)} />}
      {tab === "path" && <PathSection statuses={statuses} onStart={(l) => setRunningLesson(l)} />}
      {tab === "achievements" && <AchievementSection stats={stats} />}

      <footer className="pt-10 pb-4 border-t border-white/5 text-center text-xs text-white/30">
        Progress is saved per user — your lessons are yours alone.
      </footer>
    </div>
  );
}

// ---------- Stat card ----------

function StatCard({
  icon: Icon, label, value, sub, tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
  tint: "amber" | "sky" | "emerald" | "violet";
}) {
  const ring =
    tint === "amber" ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
    : tint === "sky" ? "border-sky-500/25 bg-sky-500/10 text-sky-300"
    : tint === "emerald" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
    : "border-violet-500/25 bg-violet-500/10 text-violet-300";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <div className={"h-7 w-7 rounded-lg border flex items-center justify-center " + ring}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="text-white/40 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------- Next lesson banner ----------

function NextLessonCard({
  lesson, onStart, statuses,
}: {
  lesson: Lesson;
  onStart: () => void;
  statuses: Map<string, LessonStatus>;
}) {
  const status = statuses.get(lesson.id);
  const label = status === "in_progress" ? "Continue" : "Start";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-emerald-500/5 p-6 flex items-center justify-between gap-5 flex-wrap"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-sky-300">
          {label} your next lesson · {lesson.id}
        </div>
        <h3 className="text-2xl font-bold mt-1">{lesson.title}</h3>
        <div className="text-white/60 text-sm mt-1">{lesson.summary}</div>
        <div className="text-white/40 text-xs mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{lesson.estimatedMinutes} min</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> +{lesson.xp} XP</span>
        </div>
      </div>
      <button
        onClick={onStart}
        className="shrink-0 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        <Play className="h-4 w-4" /> {label}
      </button>
    </motion.div>
  );
}

// ---------- Today section ----------

function TodaySection({
  plan, review, onStart, stats, username, onGoalsChanged,
}: {
  plan: Lesson[];
  review: { lessonId: string; bestScore: number }[];
  onStart: (l: Lesson) => void;
  stats: UserStatsRow;
  username: string;
  onGoalsChanged: () => void;
}) {
  const [daily, setDaily] = useState(stats.daily_goal_minutes);
  const [days, setDays] = useState(stats.target_days_per_week);

  const saveGoals = async () => {
    await updateGoals(username, { daily_goal_minutes: daily, target_days_per_week: days });
    onGoalsChanged();
  };

  const totalMin = plan.reduce((s, l) => s + l.estimatedMinutes, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today's path</h2>
          <div className="text-white/50 text-xs">~{totalMin} min</div>
        </div>

        {plan.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
            You've completed everything available right now. 🌟
          </div>
        ) : (
          <div className="space-y-3">
            {plan.map((l, i) => (
              <LessonRow key={l.id} lesson={l} onStart={() => onStart(l)} index={i + 1} />
            ))}
          </div>
        )}

        {review.length > 0 && (
          <div className="pt-4">
            <h3 className="text-sm uppercase tracking-wider text-white/50 mb-3">Suggested review</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {review.map((r) => {
                const lesson = LEVELS.flatMap((l) => l.lessons).find((l) => l.id === r.lessonId);
                if (!lesson) return null;
                return (
                  <button
                    key={r.lessonId}
                    onClick={() => onStart(lesson)}
                    className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] p-4"
                  >
                    <div className="text-xs text-white/40">{lesson.id} · best {r.bestScore}%</div>
                    <div className="font-medium text-white mt-1">{lesson.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your goals</h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Daily minutes</span>
              <span className="font-mono text-white">{daily} min</span>
            </div>
            <input
              type="range" min={15} max={45} step={5}
              value={daily} onChange={(e) => setDaily(parseInt(e.target.value))}
              className="w-full mt-2 accent-sky-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Study days / week</span>
              <span className="font-mono text-white">{days}</span>
            </div>
            <input
              type="range" min={2} max={7} step={1}
              value={days} onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full mt-2 accent-sky-500"
            />
          </div>
          <button
            onClick={saveGoals}
            disabled={daily === stats.daily_goal_minutes && days === stats.target_days_per_week}
            className="w-full px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm disabled:opacity-40"
          >
            Save goals
          </button>
          <div className="text-white/40 text-xs leading-relaxed">
            Defaults are 25 minutes, 4 days/week. Plenty for steady progress without burning out.
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonRow({ lesson, onStart, index }: { lesson: Lesson; onStart: () => void; index: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-4 flex items-center gap-4 cursor-pointer transition-colors" onClick={onStart}>
      <div className="h-10 w-10 rounded-lg bg-sky-500/15 text-sky-300 font-bold flex items-center justify-center">{index}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-white/40">
          {lesson.id} · {lesson.theme}
        </div>
        <div className="font-medium text-white truncate">{lesson.title}</div>
        <div className="text-white/55 text-xs truncate">{lesson.summary}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-white/50">~{lesson.estimatedMinutes}m · +{lesson.xp} XP</div>
        <div className="mt-1 flex justify-end">
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>
    </div>
  );
}

// ---------- Week section ----------

function WeekSection({
  plan, onStart,
}: {
  plan: ReturnType<typeof buildWeekPlan>;
  onStart: (l: Lesson) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">This week</h2>
        <div className="text-white/50 text-xs">Planned across your target study days</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {plan.map((day) => {
          const isStudyDay = day.lessons.length > 0;
          const isToday = day.dayOffset === 0;
          return (
            <div
              key={day.dateStr}
              className={
                "rounded-xl border p-3 min-h-[180px] flex flex-col " +
                (day.alreadyStudied
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isStudyDay
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-white/5 bg-white/[0.01]")
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-white/50">
                  {day.dayLabel}
                </div>
                {isToday && <div className="text-[10px] rounded-full bg-sky-500/25 text-sky-100 px-2 py-0.5">today</div>}
              </div>
              <div className="text-white/80 font-semibold text-xs mt-1">{day.dateStr.slice(5)}</div>

              {day.alreadyStudied && (
                <div className="text-emerald-300 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> studied
                </div>
              )}

              <div className="mt-3 space-y-2 flex-1">
                {day.lessons.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onStart(l)}
                    className="w-full text-left rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-2.5 py-2"
                  >
                    <div className="text-[10px] text-white/40">{l.id}</div>
                    <div className="text-xs text-white font-medium line-clamp-2">{l.title}</div>
                  </button>
                ))}
                {!isStudyDay && <div className="text-white/30 text-xs italic">Rest day</div>}
              </div>

              {isStudyDay && (
                <div className="text-white/40 text-xs mt-2">~{day.totalMinutes}m</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Full path section ----------

function PathSection({
  statuses, onStart,
}: {
  statuses: Map<string, LessonStatus>;
  onStart: (l: Lesson) => void;
}) {
  return (
    <div className="space-y-6">
      {LEVELS.map((level) => {
        const doneCount = level.lessons.filter((l) => statuses.get(l.id) === "completed").length;
        const pct = Math.round((doneCount / level.lessons.length) * 100);
        return (
          <div key={level.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/40">
                  Level {level.order} · {level.theme}
                </div>
                <h3 className="text-xl font-bold mt-0.5">{level.title}</h3>
                <div className="text-white/55 text-sm">{level.subtitle}</div>
                <div className="text-white/40 text-xs italic mt-1">Goal: {level.goal}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/50">{doneCount} / {level.lessons.length}</div>
                <div className="text-2xl font-bold">{pct}%</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {level.lessons.map((l) => {
                const s = statuses.get(l.id) ?? "available";
                const done = s === "completed";
                const prog = s === "in_progress";
                return (
                  <button
                    key={l.id}
                    onClick={() => onStart(l)}
                    className={
                      "text-left rounded-xl border p-3 flex items-center gap-3 transition-all " +
                      (done
                        ? "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10"
                        : prog
                        ? "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")
                    }
                  >
                    <div
                      className={
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 " +
                        (done ? "bg-emerald-500/20 text-emerald-300"
                          : prog ? "bg-sky-500/25 text-sky-200"
                          : "bg-white/10 text-white/70")
                      }
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" />
                       : prog ? <Play className="h-3.5 w-3.5" />
                       : <Circle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/40">{l.id} · ~{l.estimatedMinutes}m</div>
                      <div className="text-sm font-medium text-white truncate">{l.title}</div>
                      <div className="text-[11px] text-white/45 truncate">{l.summary}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Achievements ----------

function AchievementSection({ stats }: { stats: UserStatsRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {ACHIEVEMENTS.map((a) => {
        const earned = stats.achievements.includes(a.key);
        return (
          <div
            key={a.key}
            className={
              "rounded-2xl border p-4 flex items-start gap-3 " +
              (earned
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-white/10 bg-white/[0.02] opacity-70")
            }
          >
            <div className="text-3xl">{a.emoji}</div>
            <div className="min-w-0">
              <div className="font-semibold text-white flex items-center gap-2">
                {a.title}
                {earned && <Sparkles className="h-3.5 w-3.5 text-amber-300" />}
              </div>
              <div className="text-white/55 text-xs mt-1">{a.description}</div>
              {!earned && <div className="text-white/30 text-[10px] uppercase tracking-wider mt-2">Locked</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- helpers ----------

function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
}
