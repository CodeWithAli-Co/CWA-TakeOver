/**
 * Row3MemberSection.tsx — Row 3 for non-leadership employees.
 *
 *   · Team Activity (col-span-5) — backward-looking team feed.
 *   · Up Next       (col-span-4) — forward-looking schedule.
 *   · Goal & Focus  (col-span-3) — current goal + step + Axon coaching.
 *
 * The Goal & Focus panel is the *cultural* component. Rather than
 * surfacing more stats, it surfaces a single thing the employee
 * should be doing right now within the context of a larger goal,
 * paired with Axon's supportive nudge. Clicking opens a modal with
 * the full step breakdown + timeline + Axon's longer coaching note.
 *
 * The point isn't productivity gamification — it's giving employees
 * who lose focus or feel overwhelmed a calm, visible "next step" plus
 * permission to pause. Axon's voice is intentionally supportive,
 * not directive.
 *
 * Status today: UI is real, data is mocked. The schema sketch lives
 * in the GOALS_SCHEMA_NOTE constant. Once cwa_goals / cwa_goal_steps
 * tables land, swap the mock for real queries; the layout doesn't
 * need to change.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckCircle,
  Clock,
  Coffee,
  FileEdit,
  Flame,
  Pause,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { BentoCard } from "./BentoCard";
import { AllTodos, MeetingsQuery } from "@/stores/query";
import { useWorkspaceResources } from "@/stores/workspace";
import { AddMeeting } from "@/MyComponents/subForms/MeetingForms/addMeeting";

type Tone = "primary" | "warning" | "destructive" | "success" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
  neutral: "text-text-tertiary",
};

// ─────────────────────────────────────────────────────────────────
// Schema sketch — the tables we'll need once this graduates from
// mock data. Keep this comment in sync with the eventual migration.
// ─────────────────────────────────────────────────────────────────
/*
  cwa_goals
    id            uuid PK
    user_id       uuid → auth.users.id
    username      text          (denormalized for filter speed)
    title         text not null
    description   text
    status        text          ('active' | 'paused' | 'completed' | 'abandoned')
    priority      text          ('high' | 'medium' | 'low')
    start_date    date          (when work began)
    target_date   date          (deadline)
    completed_at  timestamptz
    archived      boolean default false
    created_at    timestamptz default now()

  cwa_goal_steps
    id                 uuid PK
    goal_id            uuid → cwa_goals.id on delete cascade
    title              text not null
    description        text
    status             text          ('pending' | 'in_progress' | 'done' | 'skipped')
    step_order         int not null
    estimated_minutes  int
    due_date           date
    axon_generated     boolean default false   (was this step suggested by Axon?)
    completed_at       timestamptz
    created_at         timestamptz default now()

  cwa_axon_nudges
    id              uuid PK
    goal_id         uuid → cwa_goals.id on delete cascade
    type            text          ('encouragement' | 'refocus' | 'pace' | 'rest')
    message         text not null
    surfaced_at     timestamptz   (when we showed it to the user)
    employee_reply  text          (if they responded)
    created_at      timestamptz default now()
*/

// ─────────────────────────────────────────────────────────────────
// MOCK: replace with useActiveGoal(username) once schema lands.
// Hardcoded for now so the UX is visible and the panel is reviewable
// without a migration. Step states will be mutated locally on click
// just for the demo feel.
// ─────────────────────────────────────────────────────────────────

type GoalStepStatus = "pending" | "in_progress" | "done" | "skipped";
interface GoalStep {
  id: string;
  title: string;
  description?: string;
  status: GoalStepStatus;
  stepOrder: number;
  estimatedMinutes?: number;
  dueDate?: string;
  axonGenerated?: boolean;
}
interface Goal {
  id: string;
  title: string;
  description?: string;
  status: "active" | "paused" | "completed";
  startDate: string;
  targetDate: string;
  steps: GoalStep[];
  axonNudge: { short: string; long: string };
}

const MOCK_GOAL: Goal = {
  id: "g-1",
  title: "Ship the enterprise tier",
  description: "Get our first three enterprise pilots onto the new tier with self-serve provisioning.",
  status: "active",
  startDate: "2026-05-22",
  targetDate: "2026-06-05",
  steps: [
    { id: "s1", title: "Research enterprise feature requests", status: "done", stepOrder: 1, dueDate: "2026-05-23" },
    { id: "s2", title: "Define MVP feature set",              status: "done", stepOrder: 2, dueDate: "2026-05-25" },
    { id: "s3", title: "Draft pricing model",                  status: "done", stepOrder: 3, dueDate: "2026-05-26" },
    { id: "s4", title: "Write API spec doc",                   status: "in_progress", stepOrder: 4, dueDate: "2026-05-28", estimatedMinutes: 45, axonGenerated: true },
    { id: "s5", title: "Build SDK scaffolding",                status: "pending", stepOrder: 5, dueDate: "2026-05-30", estimatedMinutes: 180, axonGenerated: true },
    { id: "s6", title: "Set up sandbox environment",           status: "pending", stepOrder: 6, dueDate: "2026-06-01", estimatedMinutes: 120, axonGenerated: true },
    { id: "s7", title: "Ship beta to 3 pilot accounts",        status: "pending", stepOrder: 7, dueDate: "2026-06-05" },
  ],
  axonNudge: {
    short: "You're 2 days ahead on this. The spec is the keystone — once it lands, the SDK flows from it.",
    long:
      "You're moving fast on this one — three steps done in five days, and you're tracking two days ahead of pace. The API spec is the keystone step; once it's clear, the SDK and sandbox can move in parallel rather than sequentially, which gives you breathing room for the pilot conversations. I'd suggest blocking 90 minutes tomorrow morning for the spec draft — your calendar is light until 11. No pressure if you'd rather pause and come back to it Wednesday; this goal has slack.",
  },
};

// ─────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatTime(time?: string | null): string {
  if (!time) return "";
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]!, 10);
    const min = m[2]!;
    const period = h >= 12 ? "PM" : "AM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:${min} ${period}`;
  }
  return time;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000),
  );
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export function Row3MemberSection() {
  return (
    <>
      <ActivityFeed />
      <UpNext />
      <GoalFocusPanel />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────────────────────────

function ActivityFeed() {
  const navigate = useNavigate();
  const { data: all = [] } = AllTodos();
  const { data: items = [] } = useWorkspaceResources();
  const { data: meetings = [] } = MeetingsQuery();

  const feed = useMemo(() => {
    type Event = {
      key: string;
      ts: number;
      icon: typeof Activity;
      tone: Tone;
      actor?: string;
      verb: string;
      subject: string;
      onClick: () => void;
    };
    const events: Event[] = [];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const t of all) {
      if (t.status === "done" && t.created_at) {
        const ts = new Date(t.created_at).getTime();
        if (ts > cutoff) {
          events.push({
            key: `task-${t.todo_id}`,
            ts,
            icon: CheckCircle2,
            tone: "success",
            actor: t.assignee?.[0],
            verb: "shipped",
            subject: t.title,
            onClick: () => navigate({ to: "/task" }),
          });
        }
      }
    }
    for (const r of items as any[]) {
      if (!r.updated_at) continue;
      const ts = new Date(r.updated_at).getTime();
      if (ts > cutoff) {
        events.push({
          key: `ws-${r.kind}-${r.id}`,
          ts,
          icon: FileEdit,
          tone: "primary",
          actor: r.updated_by || r.owner,
          verb: r.kind === "document" ? "edited doc" : "edited sheet",
          subject: r.title || "Untitled",
          onClick: () => navigate({ to: "/workspace" }),
        });
      }
    }
    for (const m of (meetings ?? []) as any[]) {
      if (!m.date) continue;
      const ts = new Date(m.date).getTime();
      if (ts > cutoff && ts < Date.now()) {
        events.push({
          key: `mtg-${m.meeting_id ?? m.meeting_title}`,
          ts,
          icon: CalendarClock,
          tone: "warning",
          verb: "meeting wrapped",
          subject: m.meeting_title ?? "Untitled meeting",
          onClick: () => navigate({ to: "/schedule" }),
        });
      }
    }

    return events.sort((a, b) => b.ts - a.ts).slice(0, 7);
  }, [all, items, meetings, navigate]);

  return (
    <BentoCard span="col-span-5" delay={0.35} noPadding>
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Team Activity
          </span>
        </div>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-text-tertiary/70">
          last 14d
        </span>
      </header>

      <div className="p-3">
        {feed.length === 0 ? (
          <div className="text-[12px] text-text-tertiary italic py-8 text-center">
            No activity in the last 14 days.
          </div>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {feed.map((e) => (
              <li key={e.key} className="list-none">
                <button
                  type="button"
                  onClick={e.onClick}
                  className="group/row w-full text-left flex items-center gap-2 px-2 py-2 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
                >
                  <e.icon className={`h-3 w-3 flex-shrink-0 ${TONE_TEXT[e.tone]}`} />
                  <span className="text-[11.5px] text-foreground flex-1 truncate">
                    {e.actor ? (
                      <>
                        <span className="font-semibold">{e.actor}</span>{" "}
                        {e.verb}{" "}
                        <span className="text-foreground/85">{e.subject}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground/75">{e.verb}:</span>{" "}
                        {e.subject}
                      </>
                    )}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider tabular-nums text-text-tertiary flex-shrink-0">
                    {relTime(new Date(e.ts).toISOString())}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BentoCard>
  );
}

// ─────────────────────────────────────────────────────────────────
// Up Next
// ─────────────────────────────────────────────────────────────────

// Up Next — meetings for the next 7 days grouped by day. Each day
// section shows its label (TOMORROW / FRI / MON …) with a count badge,
// then the meetings as rows with time + title + location pin or Join
// link. The panel header includes the AddMeeting trigger so users
// can create meetings without leaving the home dashboard.
interface UpNextMeeting {
  meeting_id?: number | string;
  meeting_title?: string;
  date?: string;
  time?: string;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string;
  hybrid_location?: { address?: string; url?: string };
}

function UpNext() {
  const navigate = useNavigate();
  const { data: meetings = [] } = MeetingsQuery();

  // Filter to meetings happening today through next 7 days (inclusive),
  // then group by date string keyed yyyy-m-d local for stable buckets.
  const grouped = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const horizon = todayStart + 7 * 24 * 60 * 60 * 1000;

    const upcoming = ((meetings ?? []) as UpNextMeeting[])
      .filter((m) => {
        if (!m.date) return false;
        const ts = new Date(m.date).getTime();
        return !Number.isNaN(ts) && ts >= todayStart && ts < horizon;
      })
      .sort((a, b) => {
        const da = new Date(a.date!).getTime();
        const db = new Date(b.date!).getTime();
        if (da !== db) return da - db;
        return (a.time ?? "").localeCompare(b.time ?? "");
      });

    const groups: { date: Date; items: UpNextMeeting[] }[] = [];
    for (const m of upcoming) {
      const d = new Date(m.date!);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const last = groups[groups.length - 1];
      const lastKey = last
        ? `${last.date.getFullYear()}-${last.date.getMonth()}-${last.date.getDate()}`
        : null;
      if (last && lastKey === key) {
        last.items.push(m);
      } else {
        groups.push({ date: d, items: [m] });
      }
    }
    return groups;
  }, [meetings]);

  const totalCount = useMemo(
    () => grouped.reduce((sum, g) => sum + g.items.length, 0),
    [grouped],
  );

  return (
    <BentoCard span="col-span-4" delay={0.4} noPadding>
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="h-3 w-3 text-warning" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Up Next
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-text-tertiary/60">
            {totalCount}
          </span>
        </div>
        {/* Inline meeting creation — self-contained Dialog + button */}
        <AddMeeting />
      </header>

      <div className="p-3">
        {grouped.length === 0 ? (
          <div className="text-[12px] text-text-tertiary italic py-8 text-center">
            Nothing scheduled in the next 7 days.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group, gi) => {
              const dl = dayLabel(group.date);
              const isToday = dl === "Today";
              const isTomorrow = dl === "Tomorrow";
              return (
                <section key={gi}>
                  {/* Day header — just the relative label (TODAY /
                      TOMORROW / FRI). Dropped the redundant date
                      stamp and per-day count badge; total lives in
                      the panel header instead. */}
                  <div className="mb-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                        isToday || isTomorrow
                          ? "text-warning"
                          : "text-text-tertiary"
                      }`}
                    >
                      {dl}
                    </span>
                  </div>
                  <ul className="list-none p-0 m-0 space-y-0.5">
                    {group.items.slice(0, 4).map((m, i) => (
                      <li
                        key={m.meeting_id ?? `${m.meeting_title}-${i}`}
                        className="list-none"
                      >
                        <UpNextMeetingRow
                          meeting={m}
                          onClick={() => navigate({ to: "/schedule" as any })}
                        />
                      </li>
                    ))}
                  </ul>
                  {group.items.length > 4 && (
                    <div className="text-[9.5px] text-text-tertiary italic mt-1 pl-1">
                      + {group.items.length - 4} more
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </BentoCard>
  );
}

// One row inside an Up Next day group — time + title + location/link.
function UpNextMeetingRow({
  meeting,
  onClick,
}: {
  meeting: UpNextMeeting;
  onClick: () => void;
}) {
  const isOnline = meeting.meeting_type === "online";
  const isInPerson = meeting.meeting_type === "in-person";
  const isHybrid = meeting.meeting_type === "hybrid";

  // Treat empty / dash / whitespace as no location so a meeting with a
  // missing pin doesn't render "○ -" debris next to its title.
  const rawLoc =
    typeof meeting.location === "string" ? meeting.location.trim() : "";
  const hasLoc = rawLoc.length > 0 && rawLoc !== "-";

  const onlineLink = isOnline && hasLoc ? rawLoc : undefined;
  const inPersonLoc = isInPerson && hasLoc ? rawLoc : undefined;
  const hybridAddr = isHybrid ? meeting.hybrid_location?.address : undefined;
  const hybridLink = isHybrid ? meeting.hybrid_location?.url : undefined;

  return (
    <div className="group/r flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors">
      <span className="text-[10px] font-bold tabular-nums text-foreground/80 w-14 flex-shrink-0">
        {meeting.time ? formatTime(meeting.time) : "—"}
      </span>
      <button
        type="button"
        onClick={onClick}
        className="text-left text-[11.5px] text-foreground font-medium flex-1 truncate hover:text-primary transition-colors"
      >
        {meeting.meeting_title ?? "Untitled"}
      </button>
      {/* Quiet location — neutral tertiary text, no icon. Only renders
          when there's a real place name to show. */}
      {inPersonLoc && (
        <span
          className="text-[10px] text-text-tertiary flex-shrink-0 max-w-[110px] truncate"
          title={inPersonLoc}
        >
          {inPersonLoc}
        </span>
      )}
      {hybridAddr && (
        <span
          className="text-[10px] text-text-tertiary flex-shrink-0 max-w-[110px] truncate"
          title={hybridAddr}
        >
          {hybridAddr}
        </span>
      )}
      {/* Join link — kept actionable so it retains its tone */}
      {onlineLink && (
        <a
          href={onlineLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Join virtual meeting"
          className="text-[10px] text-primary hover:text-primary/80 font-semibold flex-shrink-0 transition-colors"
        >
          Join
        </a>
      )}
      {isHybrid && hybridLink && (
        <a
          href={hybridLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Join hybrid meeting"
          className="text-[10px] text-success hover:text-success/80 font-semibold flex-shrink-0 transition-colors"
        >
          Join
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Goal & Focus panel — the cultural component.
// ─────────────────────────────────────────────────────────────────

function GoalFocusPanel() {
  // Local mutable copy of the mock goal so step completion feels real
  // in the demo. Replace with mutation hook when schema is live.
  const [goal, setGoal] = useState<Goal>(MOCK_GOAL);
  const [modalOpen, setModalOpen] = useState(false);

  const totalSteps = goal.steps.length;
  const doneSteps = goal.steps.filter((s) => s.status === "done").length;
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  // Days remaining toward the target
  const today = new Date();
  const target = new Date(goal.targetDate);
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (target.getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  // The "DO NOW" step — first in_progress, else first pending.
  const currentStep =
    goal.steps.find((s) => s.status === "in_progress") ??
    goal.steps.find((s) => s.status === "pending");

  const markCurrentDone = () => {
    if (!currentStep) return;
    setGoal((g) => ({
      ...g,
      steps: g.steps.map((s, i, arr) => {
        if (s.id === currentStep.id) return { ...s, status: "done" as const };
        // Promote the next pending step to in_progress.
        const isNextPending =
          arr.findIndex((x) => x.id === currentStep.id) + 1 === i &&
          s.status === "pending";
        if (isNextPending) return { ...s, status: "in_progress" as const };
        return s;
      }),
    }));
  };

  return (
    <>
      <BentoCard span="col-span-3" delay={0.45} noPadding>
        {/* Soft gradient background tied to the panel's purpose —
            subtle "focus zone" cue without overpowering the row. */}
        <div className="relative h-full bg-gradient-to-br from-primary/[0.04] via-transparent to-success/[0.04]">
          <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
                Goal
              </span>
            </div>
            <span className="text-[9.5px] uppercase tracking-[0.18em] text-success/80 font-semibold">
              {goal.status}
            </span>
          </header>

          <div className="p-3 space-y-3">
            {/* Goal title + progress */}
            <div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="text-left w-full group/title"
              >
                <div className="text-[13px] font-bold text-foreground leading-snug group-hover/title:text-primary transition-colors">
                  {goal.title}
                </div>
              </button>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-gradient-to-r from-success/70 to-success rounded-full"
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-foreground">
                  {progress}%
                </span>
              </div>
              <div className="mt-1 text-[9.5px] uppercase tracking-wider text-text-tertiary">
                {doneSteps}/{totalSteps} steps · {daysLeft}d left
              </div>
            </div>

            {/* "DO NOW" — the single thing to focus on */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-warning">
                <Zap className="h-2.5 w-2.5" />
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
                  Do now
                </span>
              </div>
              {currentStep ? (
                <div className="rounded-md bg-popover/60 border-xs border-border-soft p-2.5">
                  <div className="text-[12px] font-semibold text-foreground leading-snug">
                    {currentStep.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-text-tertiary uppercase tracking-wider">
                    {currentStep.estimatedMinutes && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        ~{currentStep.estimatedMinutes}m
                      </span>
                    )}
                    {currentStep.dueDate && (
                      <span>
                        Due {dayLabel(new Date(currentStep.dueDate))}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-success/[0.06] border-xs border-success/25 p-2.5 text-[11.5px] text-success/90 italic">
                  All steps done — celebrate, then plan what's next.
                </div>
              )}
            </div>

            {/* Axon's nudge */}
            <div className="rounded-md bg-foreground/[0.025] border-xs border-border-soft p-2.5">
              <div className="flex items-center gap-1.5 mb-1 text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                  Axon
                </span>
              </div>
              <p className="text-[11px] text-foreground/85 leading-snug italic">
                &ldquo;{goal.axonNudge.short}&rdquo;
              </p>
            </div>

            {/* Primary + secondary actions */}
            <div className="space-y-1.5">
              {currentStep && (
                <motion.button
                  type="button"
                  onClick={markCurrentDone}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="group/done w-full flex items-center justify-center gap-1.5 rounded-md bg-success/[0.12] border-xs border-success/30 hover:bg-success/[0.18] hover:border-success/50 px-3 py-2 transition-colors"
                >
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                    Mark step done
                  </span>
                </motion.button>
              )}
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="group/view w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary hover:text-foreground transition-colors"
              >
                View breakdown
                <ArrowRight className="h-2.5 w-2.5 group-hover/view:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Goal detail modal */}
      <AnimatePresence>
        {modalOpen && (
          <GoalDetailModal
            goal={goal}
            progress={progress}
            daysLeft={daysLeft}
            onClose={() => setModalOpen(false)}
            onMarkStepDone={(stepId) =>
              setGoal((g) => ({
                ...g,
                steps: g.steps.map((s, i, arr) => {
                  if (s.id === stepId) return { ...s, status: "done" as const };
                  const idx = arr.findIndex((x) => x.id === stepId);
                  if (i === idx + 1 && s.status === "pending")
                    return { ...s, status: "in_progress" as const };
                  return s;
                }),
              }))
            }
            onPauseGoal={() =>
              setGoal((g) => ({
                ...g,
                status: g.status === "paused" ? "active" : "paused",
              }))
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Goal Detail modal — full breakdown, timeline, Axon coaching.
// ─────────────────────────────────────────────────────────────────

function GoalDetailModal({
  goal,
  progress,
  daysLeft,
  onClose,
  onMarkStepDone,
  onPauseGoal,
}: {
  goal: Goal;
  progress: number;
  daysLeft: number;
  onClose: () => void;
  onMarkStepDone: (stepId: string) => void;
  onPauseGoal: () => void;
}) {
  const totalDays = daysBetween(goal.startDate, goal.targetDate);
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, daysBetween(goal.startDate, new Date().toISOString().slice(0, 10))),
  );
  const segments = Math.max(1, totalDays);
  const segmentsArr = Array.from({ length: segments }, (_, i) => i);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-[620px] max-w-[94vw] max-h-[88vh] bg-card border border-xs border-border-soft rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-xs border-border-soft bg-gradient-to-br from-primary/[0.06] via-transparent to-success/[0.04]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                Goal · {goal.status}
              </span>
            </div>
            <h2 className="text-[16px] font-bold text-foreground leading-tight">
              {goal.title}
            </h2>
            {goal.description && (
              <p className="text-[11.5px] text-text-tertiary mt-1 leading-snug">
                {goal.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Progress + timeline */}
          <section className="px-5 py-4 border-b border-xs border-border-soft">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-bold tabular-nums text-foreground">
                  {progress}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  complete
                </span>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-semibold text-foreground tabular-nums">
                  {daysLeft}d left
                </div>
                <div className="text-[9.5px] uppercase tracking-wider text-text-tertiary">
                  by{" "}
                  {new Date(goal.targetDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* Day-segment timeline */}
            <div className="flex gap-0.5 mb-2">
              {segmentsArr.map((i) => {
                const isPast = i < elapsedDays;
                const isToday = i === elapsedDays - 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scaleY: 0.5 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className={`flex-1 h-2 rounded-sm ${
                      isToday
                        ? "bg-primary"
                        : isPast
                        ? "bg-success/70"
                        : "bg-foreground/[0.08]"
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[9.5px] uppercase tracking-wider text-text-tertiary tabular-nums">
              <span>
                Start ·{" "}
                {new Date(goal.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>
                Day {elapsedDays} of {totalDays}
              </span>
              <span>
                Target ·{" "}
                {new Date(goal.targetDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </section>

          {/* Steps */}
          <section className="px-5 py-4 border-b border-xs border-border-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                Breakdown
              </div>
              <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary">
                {goal.steps.filter((s) => s.axonGenerated).length} from Axon
              </span>
            </div>
            <ul className="list-none p-0 m-0 space-y-1">
              {goal.steps.map((s) => (
                <li key={s.id} className="list-none">
                  <StepRow step={s} onMarkDone={() => onMarkStepDone(s.id)} />
                </li>
              ))}
            </ul>
          </section>

          {/* Axon's coaching */}
          <section className="px-5 py-4 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Sparkles className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                Axon Coach
              </span>
            </div>
            <p className="text-[12.5px] text-foreground/90 leading-relaxed italic">
              &ldquo;{goal.axonNudge.long}&rdquo;
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-xs border-border-soft bg-popover/40 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPauseGoal}
            className="group/pause flex items-center gap-1.5 px-3 py-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            {goal.status === "paused" ? (
              <>
                <Zap className="h-3 w-3" />
                <span className="text-[10.5px] uppercase tracking-wider font-bold">
                  Resume
                </span>
              </>
            ) : (
              <>
                <Coffee className="h-3 w-3" />
                <span className="text-[10.5px] uppercase tracking-wider font-bold">
                  Pause — take a break
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[10.5px] uppercase tracking-wider font-bold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            Back to dashboard
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepRow({
  step,
  onMarkDone,
}: {
  step: GoalStep;
  onMarkDone: () => void;
}) {
  const isDone = step.status === "done";
  const isCurrent = step.status === "in_progress";
  const dueDateLabel = step.dueDate
    ? dayLabel(new Date(step.dueDate))
    : undefined;

  return (
    <div
      className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors ${
        isCurrent ? "bg-warning/[0.06] border-xs border-warning/25" : ""
      }`}
    >
      {/* Step status icon */}
      <button
        type="button"
        onClick={!isDone ? onMarkDone : undefined}
        disabled={isDone}
        className="flex-shrink-0 mt-0.5"
        aria-label={isDone ? "Step done" : "Mark step done"}
      >
        {isDone ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : isCurrent ? (
          <div className="h-4 w-4 rounded-full border-2 border-warning relative flex items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          </div>
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-foreground/15 hover:border-foreground/30 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`text-[12.5px] font-medium ${
            isDone
              ? "text-text-tertiary line-through"
              : isCurrent
              ? "text-foreground"
              : "text-foreground/85"
          }`}
        >
          {step.title}
          {step.axonGenerated && (
            <span
              title="Suggested by Axon"
              className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] text-primary/70 uppercase tracking-wider align-middle"
            >
              <Sparkles className="h-2 w-2" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">
          {step.estimatedMinutes && (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />~{step.estimatedMinutes}m
            </span>
          )}
          {dueDateLabel && <span>{dueDateLabel}</span>}
          {isCurrent && (
            <span className="text-warning font-semibold inline-flex items-center gap-0.5">
              <Flame className="h-2.5 w-2.5" />
              Doing now
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
