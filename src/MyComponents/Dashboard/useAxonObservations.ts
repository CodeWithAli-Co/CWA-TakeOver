/**
 * useAxonObservations.ts — turns the founder's live workload into
 * a ranked list of Axon coaching observations.
 *
 * v1 used static templates that cycled. v2 (this file) pulls real
 * data — overdue tasks, upcoming meetings, focus streaks, recent
 * activity — and runs a fan of cheap rule-based generators. Each
 * generator returns at most one Observation; the hook then sorts
 * by priority and surfaces the top picks to AxonCoachCard.
 *
 * Why rules and not an LLM?
 *
 *   · Latency. The card lives on the home dashboard. We can't make
 *     the founder wait 1-2s every refresh for a synthesis call.
 *   · Determinism. The same workload should produce the same nudge
 *     — predictability is a feature for coaching.
 *   · Cost. This thing renders on every dashboard mount. An LLM
 *     call per render would burn tokens.
 *
 * v3 can layer a synthesis pass *on top* of the rule-selected
 * observation — e.g. rewrite the body in the user's mood, vary
 * the opening — without changing the rule output.
 */

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/routes/index.lazy";
import { ActiveUser } from "@/stores/query";

// ─────────────────────────────────────────────────────────────────
// Observation shape (mirrors AxonCoachCard's interface)
// ─────────────────────────────────────────────────────────────────

export type CoachActionFlavor =
  | "autonomous"
  | "collaborative"
  | "defer"
  | "context"
  | "ask";

export interface CoachAction {
  flavor: CoachActionFlavor;
  label: string;
  hint?: string;
  prompt: string;
}

export interface Observation {
  id: string;
  kind: string;
  body: string;
  actions: CoachAction[];
  /** Internal — used for ranking. Higher = more pressing. */
  priority: number;
}

// ─────────────────────────────────────────────────────────────────
// Generator context — everything a rule needs in one tidy object
// ─────────────────────────────────────────────────────────────────

interface OverdueTask {
  id: number;
  title: string;
  priority?: string | null;
  daysOverdue: number;
}

interface UpcomingMeeting {
  id: number;
  title: string;
  whenLabel: string; // "in 90 min" / "tomorrow 2pm"
  minutesFromNow: number;
}

interface Ctx {
  now: Date;
  username: string;
  overdue: OverdueTask[];
  dueTodayCount: number;
  closedTodayCount: number;
  upcomingMeetings: UpcomingMeeting[];
  shippingStreakDays: number;
  focusedHoursLast7: number;
}

// ─────────────────────────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────────────────────────
//
// Each function returns an Observation or null. They're independent
// and pure given Ctx — easy to unit test, easy to reason about.

/** OVERDUE CLUSTER — 3+ tasks past due, with priority signal. */
function genOverdueCluster(ctx: Ctx): Observation | null {
  if (ctx.overdue.length < 3) return null;
  const n = ctx.overdue.length;
  const oldest = ctx.overdue[0]!; // sorted by daysOverdue desc upstream
  const highCount = ctx.overdue.filter((t) => t.priority === "high").length;

  const highBit =
    highCount > 0
      ? ` ${highCount} of them flagged high.`
      : "";
  const oldestBit = oldest.daysOverdue >= 7
    ? ` Oldest is "${oldest.title}" — ${oldest.daysOverdue} days past.`
    : "";

  return {
    id: "overdue-cluster",
    kind: "Focus",
    body: `You have ${n} overdue tasks.${highBit}${oldestBit} Probably worth one clean triage pass before the day gets away from you.`,
    priority: 90 + Math.min(10, n),
    actions: [
      {
        flavor: "collaborative",
        label: "Walk me through them",
        hint: "I'll rank, you decide.",
        prompt: `Walk me through my ${n} overdue tasks and help me decide which to tackle first today.`,
      },
      {
        flavor: "autonomous",
        label: "Pick the top 3",
        hint: "I'll surface the highest-leverage three.",
        prompt: `Pick the 3 highest-leverage overdue tasks from my list and tell me why they win.`,
      },
      {
        flavor: "defer",
        label: "Snooze · 2 hours",
        prompt:
          "Snooze the overdue-tasks nudge for 2 hours. Re-raise if anything else goes overdue meanwhile.",
      },
      {
        flavor: "context",
        label: "Why these matter",
        prompt:
          "Explain which of my overdue tasks are likely blocking other work or commitments.",
      },
    ],
  };
}

/** UPCOMING MEETING PREP — meeting in < 24h, surface with prep CTA. */
function genUpcomingMeeting(ctx: Ctx): Observation | null {
  if (ctx.upcomingMeetings.length === 0) return null;
  const m = ctx.upcomingMeetings[0]!;
  // Skip if meeting > 24h away — Tomorrow strip already covers that.
  if (m.minutesFromNow > 24 * 60) return null;

  const soonish = m.minutesFromNow < 120;
  const kind = soonish ? "Heads up" : "Prep";
  const lead = soonish
    ? `"${m.title}" is ${m.whenLabel}.`
    : `"${m.title}" is coming up ${m.whenLabel}.`;
  const tail = soonish
    ? " Want a quick brief — agenda, attendees, last touchpoint?"
    : " Want me to draft an agenda and pull the last touchpoint with the attendees?";

  return {
    id: `meeting-prep:${m.id}`,
    kind,
    body: `${lead}${tail}`,
    priority: soonish ? 85 : 55,
    actions: [
      {
        flavor: "autonomous",
        label: "Draft a prep brief",
        hint: "Agenda, context, last interactions.",
        prompt: `Draft a meeting prep brief for "${m.title}". Include suggested agenda, key context, and the last touchpoint with each attendee.`,
      },
      {
        flavor: "collaborative",
        label: "Talk it through",
        hint: "Tell me what I should focus on.",
        prompt: `Talk me through what I should focus on in my upcoming meeting "${m.title}".`,
      },
      {
        flavor: "context",
        label: "Show attendees",
        prompt: `Show me who's attending "${m.title}" and our recent history with each of them.`,
      },
    ],
  };
}

/** SHIPPING STREAK — 3+ day streak, suggest a celebratory focus block. */
function genShippingStreak(ctx: Ctx): Observation | null {
  if (ctx.shippingStreakDays < 3) return null;
  if (ctx.overdue.length >= 3) return null; // overdue wins
  const n = ctx.shippingStreakDays;

  return {
    id: "shipping-streak",
    kind: "Check in",
    body: `You're on a ${n}-day shipping streak${ctx.focusedHoursLast7 >= 20 ? ` and ${ctx.focusedHoursLast7}h of focused work this week` : ""}. Want me to hold your afternoon so you can keep momentum, or are you due for a break?`,
    priority: 45,
    actions: [
      {
        flavor: "autonomous",
        label: "Hold my afternoon",
        hint: "I'll move non-urgent meetings to next week.",
        prompt:
          "Block my afternoon for focus work. Reschedule non-urgent meetings to next week and decline new ones.",
      },
      {
        flavor: "ask",
        label: "What should I tackle next?",
        hint: "Help me pick the highest-leverage thing.",
        prompt:
          "Given my goals and what's in flight, what should I actually be focused on for the rest of today?",
      },
      {
        flavor: "defer",
        label: "Snooze · tomorrow",
        prompt: "Snooze the streak check-in until tomorrow morning.",
      },
    ],
  };
}

/** QUIET DAY — past noon, nothing closed yet, no fires. */
function genQuietDay(ctx: Ctx): Observation | null {
  const h = ctx.now.getHours();
  if (h < 12) return null;
  if (ctx.closedTodayCount > 0) return null;
  if (ctx.overdue.length >= 3) return null;
  if (ctx.upcomingMeetings.some((m) => m.minutesFromNow < 60)) return null;

  return {
    id: "quiet-day",
    kind: "Nudge",
    body: `It's past noon and nothing's been closed yet today. ${ctx.dueTodayCount > 0 ? `${ctx.dueTodayCount} task${ctx.dueTodayCount === 1 ? "" : "s"} due today` : "No deadlines on the books"} — want to pick one to knock out before the day slides?`,
    priority: 50,
    actions: [
      {
        flavor: "collaborative",
        label: "Help me pick one",
        hint: "I'll find the smallest meaningful win.",
        prompt:
          "Help me pick one task to close today. I want the smallest thing that still moves the needle.",
      },
      {
        flavor: "ask",
        label: "What's blocking me?",
        hint: "Maybe it's not the task list.",
        prompt:
          "Help me figure out what's actually blocking me from making progress today.",
      },
      {
        flavor: "defer",
        label: "I'm fine · snooze 3h",
        prompt: "Snooze the quiet-day nudge for 3 hours.",
      },
    ],
  };
}

/** ALL CLEAR — fallback when nothing notable. Friendly, not preachy. */
function genAllClear(ctx: Ctx): Observation | null {
  return {
    id: "all-clear",
    kind: "Status",
    body: `Nothing urgent on the board${ctx.shippingStreakDays > 0 ? ` and you're on a ${ctx.shippingStreakDays}-day streak` : ""}. Good moment for a strategic look — want to plan tomorrow, or zoom out on this quarter?`,
    priority: 10,
    actions: [
      {
        flavor: "collaborative",
        label: "Plan tomorrow",
        hint: "I'll surface what's worth tackling.",
        prompt: "Help me plan tomorrow — what's worth tackling, in what order?",
      },
      {
        flavor: "ask",
        label: "Quarterly check-in",
        hint: "Are we on track?",
        prompt:
          "Walk me through where I'm tracking against my quarter goals and what's slipping.",
      },
      {
        flavor: "defer",
        label: "Just hide for now",
        prompt: "Hide the coach card until tomorrow morning.",
      },
    ],
  };
}

const GENERATORS = [
  genOverdueCluster,
  genUpcomingMeeting,
  genShippingStreak,
  genQuietDay,
  genAllClear,
];

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

/**
 * Returns prioritised observations + loading state. The card itself
 * picks which one(s) to render — usually the top one, with a "next"
 * affordance to rotate.
 */
export function useAxonObservations() {
  const { data: activeUserRows } = ActiveUser();
  const user = activeUserRows?.[0];
  const username = user?.username ?? "";

  const queryClient = useQueryClient();

  // Live refetch on relevant table mutations so the coach card
  // reacts when the founder closes a task or moves a meeting.
  useEffect(() => {
    if (!username) return;
    const ch = companySupabase
      .channel(`axon-coach:${username}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_todos" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["axon-observations"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_meetings" },
        () =>
          queryClient.invalidateQueries({ queryKey: ["axon-observations"] }),
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [username, queryClient]);

  // Anchor "now" once per query so the rule cutoffs are stable.
  const now = useMemo(() => new Date(), []);

  return useQuery({
    queryKey: ["axon-observations", username, dayKey(now)],
    enabled: !!username,
    // 1-minute stale — the rules can shift within a workday (e.g.
    // "past noon" toggle, "meeting in 90min" decay).
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Observation[]> => {
      // ── Pull the slices we need in parallel ──────────────────
      const todayStart = startOfDay(now);
      const sevenDaysAgo = addDays(todayStart, -7);
      const ninetyDaysAgo = addDays(todayStart, -90);
      const tomorrowEnd = addDays(todayStart, 1);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const [openTodosRes, recentDoneRes, meetingsRes, timeEntriesRes] =
        await Promise.all([
          // Open assigned tasks with deadlines — drives overdue +
          // due-today counts.
          companySupabase
            .from("cwa_todos")
            .select("todo_id,title,priority,deadline,status,assignee")
            .contains("assignee", [username])
            .neq("status", "done")
            .not("deadline", "is", null),
          // Recent closures — drives streak + closed-today count.
          companySupabase
            .from("cwa_todos")
            .select("completed_at,assignee")
            .contains("assignee", [username])
            .eq("status", "done")
            .gte("completed_at", ninetyDaysAgo.toISOString()),
          // Meetings — free-text date column means we filter in
          // memory after parsing. Limit to a reasonable window.
          companySupabase
            .from("cwa_meetings")
            .select("id,meeting_title,date,time,attendees")
            .limit(80),
          // Time entries — drives focused-hours signal.
          companySupabase
            .from("time_entries")
            .select("date,duration_minutes")
            .eq("user_id", (user as any)?.supa_id ?? "")
            .gte("date", isoDate(sevenDaysAgo)),
        ]);

      // ── Partition open todos into overdue / due-today ─────────
      const overdue: OverdueTask[] = [];
      let dueTodayCount = 0;
      for (const r of openTodosRes.data ?? []) {
        const deadlineStr = (r as any).deadline;
        if (!deadlineStr) continue;
        const d = new Date(deadlineStr);
        if (isNaN(d.getTime())) continue;
        if (d < todayStart) {
          const days = Math.floor(
            (todayStart.getTime() - d.getTime()) / (24 * 60 * 60 * 1000),
          );
          overdue.push({
            id: (r as any).todo_id,
            title: (r as any).title ?? "(untitled)",
            priority: (r as any).priority ?? null,
            daysOverdue: days,
          });
        } else if (d < addDays(todayStart, 1)) {
          dueTodayCount++;
        }
      }
      // Most-overdue first so genOverdueCluster's "oldest" pick is
      // deterministic.
      overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

      // ── Closed today + shipping streak ───────────────────────
      const shippingDays = new Set<string>();
      let closedTodayCount = 0;
      for (const r of recentDoneRes.data ?? []) {
        const completedAt = (r as any).completed_at;
        if (!completedAt) continue;
        const t = new Date(completedAt);
        if (isNaN(t.getTime())) continue;
        if (t >= todayStart) closedTodayCount++;
        shippingDays.add(isoDate(t));
      }
      const shippingStreakDays = computeCurrentStreak(shippingDays, now);

      // ── Upcoming meetings (next 48h) ─────────────────────────
      const upcomingMeetings: UpcomingMeeting[] = [];
      for (const r of meetingsRes.data ?? []) {
        const dt = parseMeetingDateTime(
          (r as any).date,
          (r as any).time,
          now,
        );
        if (!dt) continue;
        const mins = Math.floor((dt.getTime() - now.getTime()) / 60000);
        if (mins < 0 || mins > 48 * 60) continue;
        upcomingMeetings.push({
          id: (r as any).id,
          title: (r as any).meeting_title ?? "(untitled meeting)",
          whenLabel: humanLabel(mins),
          minutesFromNow: mins,
        });
      }
      upcomingMeetings.sort((a, b) => a.minutesFromNow - b.minutesFromNow);

      // ── Focused hours over the last 7 days ───────────────────
      let focusedMinutes = 0;
      for (const r of timeEntriesRes.data ?? []) {
        focusedMinutes += Number((r as any).duration_minutes) || 0;
      }
      const focusedHoursLast7 = Math.round(focusedMinutes / 60);

      const ctx: Ctx = {
        now,
        username,
        overdue,
        dueTodayCount,
        closedTodayCount,
        upcomingMeetings,
        shippingStreakDays,
        focusedHoursLast7,
      };

      const observations = GENERATORS.map((g) => g(ctx)).filter(
        (o): o is Observation => o !== null,
      );
      observations.sort((a, b) => b.priority - a.priority);
      return observations;
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKey(d: Date): string {
  // Used in the queryKey so the cache busts at midnight.
  return isoDate(d);
}

function computeCurrentStreak(days: Set<string>, now: Date): number {
  let cursor = startOfDay(now);
  // Permit a one-day grace — if today's empty but yesterday landed
  // a close, we still count yesterday as the streak head.
  if (!days.has(isoDate(cursor)) && days.has(isoDate(addDays(cursor, -1)))) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (days.has(isoDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Best-effort parser for the free-text meeting date column.
 * Handles common formats: "2026-06-02", "06/02/2026", "Jun 2 2026",
 * "tomorrow", "today". Returns null if we can't make sense of it.
 * Time defaults to noon if not parseable.
 */
function parseMeetingDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
  now: Date,
): Date | null {
  if (!dateStr) return null;
  const lower = String(dateStr).trim().toLowerCase();
  let base: Date | null = null;

  if (lower === "today") {
    base = startOfDay(now);
  } else if (lower === "tomorrow") {
    base = startOfDay(addDays(now, 1));
  } else {
    // Try the native parser first — handles ISO, US slashes, and
    // most English month names.
    const t = Date.parse(dateStr);
    if (!isNaN(t)) {
      base = new Date(t);
    }
  }
  if (!base) return null;

  // Layer time on top if present. Accept "2pm", "14:00", "2:30 PM".
  if (timeStr) {
    const tm = String(timeStr)
      .trim()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (tm) {
      let hh = parseInt(tm[1]!, 10);
      const mm = tm[2] ? parseInt(tm[2]!, 10) : 0;
      const ampm = tm[3]?.toLowerCase();
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      base.setHours(hh, mm, 0, 0);
    } else {
      base.setHours(12, 0, 0, 0);
    }
  } else {
    base.setHours(12, 0, 0, 0);
  }
  return base;
}

function humanLabel(minutesFromNow: number): string {
  if (minutesFromNow < 60) return `in ${minutesFromNow} min`;
  if (minutesFromNow < 90) return "in about an hour";
  const hours = Math.round(minutesFromNow / 60);
  if (hours < 12) return `in ${hours} hours`;
  if (hours < 24) return "later today";
  if (hours < 36) return "tomorrow";
  return `in ${Math.round(hours / 24)} days`;
}
