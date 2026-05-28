/**
 * Row4Section.tsx — Today-focused unified agenda.
 *
 * Replaces the prior TasksComponent + Meetings list pair with a
 * single calmer view organized around "what does today look like."
 *
 *   · Today Agenda  (col-span-7) — vertical time-anchored list of
 *                                  today's meetings as tone-tinted
 *                                  blocks. Each block surfaces the
 *                                  meeting's location (in-person) or
 *                                  Join link (virtual / hybrid) as a
 *                                  first-class element, preserving
 *                                  what made the original Meetings
 *                                  component genuinely useful. Below
 *                                  the timeline, a separate "Due
 *                                  today" section calls out task
 *                                  deadlines without forcing them
 *                                  into arbitrary time slots.
 *
 *   · Up Next       (col-span-5) — rest-of-week preview grouped by
 *                                  day (Tomorrow, Fri, Mon, …). Each
 *                                  row shows time + title + location
 *                                  pin or link icon, so meeting
 *                                  context stays one-glance even in
 *                                  the compressed week view.
 *
 * Real data — meetings via MeetingsQuery, today's task deadlines via
 * Todos(username). No mocks here.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  Clock,
  ExternalLink,
  Flame,
  Leaf,
  Link as LinkIcon,
  MapPin,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { BentoCard } from "./BentoCard";
import { ActiveUser, MeetingsQuery, Todos, type TodosInterface } from "@/stores/query";
import { AddMeeting } from "@/MyComponents/subForms/MeetingForms/addMeeting";

// Shape of a meeting row as it actually appears in the DB — matches
// the fields used by HomeDashboard/meetings.tsx.
interface MeetingLike {
  id?: string | number;
  meeting_title?: string;
  date?: string;
  time?: string;
  attendees?: number;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string;
  hybrid_location?: { address?: string; url?: string };
  company?: string;
}

type Tone = "primary" | "warning" | "destructive" | "success" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
  neutral: "text-text-tertiary",
};

const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
  success: "bg-success",
  neutral: "bg-foreground/30",
};

// Parse a time string like "12:00PM - 1:00PM", "12:00 PM", "14:00",
// into a start hour (24h) + duration in minutes.
function parseMeetingTime(
  time?: string | null,
): { startMinutes: number; durationMinutes: number } | null {
  if (!time) return null;
  const re = /(\d{1,2}):(\d{2})\s*(AM|PM)?/gi;
  const matches = [...time.matchAll(re)];
  if (matches.length === 0) return null;

  const toMinutes = (h: number, m: number, period?: string) => {
    let hh = h;
    if (period) {
      const p = period.toUpperCase();
      if (p === "PM" && hh < 12) hh += 12;
      if (p === "AM" && hh === 12) hh = 0;
    }
    return hh * 60 + m;
  };

  const [a] = matches;
  const start = toMinutes(parseInt(a![1]!, 10), parseInt(a![2]!, 10), a![3]);
  let durationMinutes = 30;
  if (matches.length > 1) {
    const b = matches[1]!;
    const end = toMinutes(parseInt(b[1]!, 10), parseInt(b[2]!, 10), b[3]);
    if (end > start) durationMinutes = end - start;
  }
  return { startMinutes: start, durationMinutes };
}

function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
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

function toneForType(type?: string): Tone {
  if (type === "online") return "primary";
  if (type === "in-person") return "warning";
  if (type === "hybrid") return "success";
  return "neutral";
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export function Row4Section() {
  // Single full-width panel. The "Up Next" preview that used to live
  // here was redundant with Row 3's Up Next panel; it's been removed.
  return <TodayAgenda />;
}

// ─────────────────────────────────────────────────────────────────
// Today Agenda
// ─────────────────────────────────────────────────────────────────

function TodayAgenda() {
  const navigate = useNavigate();
  const { data: meetings = [] } = MeetingsQuery();
  const { data: meRows } = ActiveUser();
  const username: string = (meRows?.[0] as any)?.username ?? "";
  const { data: myTodos = [] } = Todos(username || "__none__");

  const todayDate = useMemo(() => new Date(), []);
  const todayStr = todayDate.toISOString().slice(0, 10);

  // Today's meetings, sorted by start time.
  const todayMeetings = useMemo(() => {
    const list = ((meetings ?? []) as MeetingLike[])
      .filter((m) => m.date && String(m.date).slice(0, 10) === todayStr)
      .map((m) => ({ ...m, parsed: parseMeetingTime(m.time) }))
      .sort((a, b) => {
        const sa = a.parsed?.startMinutes ?? 0;
        const sb = b.parsed?.startMinutes ?? 0;
        return sa - sb;
      });
    return list;
  }, [meetings, todayStr]);

  // Today's task deadlines (own tasks, still open).
  const todayTasks = useMemo(
    () =>
      (myTodos ?? []).filter(
        (t: TodosInterface) =>
          t.deadline &&
          t.status !== "done" &&
          String(t.deadline).slice(0, 10) === todayStr,
      ),
    [myTodos, todayStr],
  );

  const dateHeading = todayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const isEmpty = todayMeetings.length === 0 && todayTasks.length === 0;

  return (
    <BentoCard span="col-span-12" delay={0.5} noPadding>
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Today
          </span>
          <span className="text-[11px] font-medium text-foreground/80">
            {dateHeading}
          </span>
          {todayMeetings.length > 0 && (
            <span className="text-[10px] font-semibold tabular-nums text-text-tertiary/60 ml-1">
              {todayMeetings.length}{" "}
              {todayMeetings.length === 1 ? "meeting" : "meetings"}
            </span>
          )}
        </div>
        {/* AddMeeting is self-contained: renders its own h-7 styled
            "Add Meeting" button + Dialog with the full create form.
            Replaces the previous navigate-to-/schedule button so people
            can actually create meetings right from the home dashboard. */}
        <AddMeeting />
      </header>

      {/* Empty state — guidance card instead of a "nothing here" strip.
          When today has no meetings or task deadlines, offer the worker
          three concrete next moves: block a focus session, grab an
          unassigned task, or step away for a break. The point is to
          make a clear day feel like an opportunity, not dead space. */}
      {isEmpty ? (
        <EmptyTodayGuidanceCard navigate={navigate} />
      ) : (
      <div className="p-4 space-y-3">
        {/* Meeting timeline */}
        {todayMeetings.length === 0 ? (
          <div className="text-[12px] text-text-tertiary italic py-2">
            No meetings on your calendar today.
          </div>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2.5">
            {todayMeetings.map((m, i) => (
              <li key={m.id ?? `${m.meeting_title}-${i}`} className="list-none">
                <MeetingTimelineBlock meeting={m} />
              </li>
            ))}
          </ul>
        )}

        {/* Due today section — only when there are task deadlines */}
        {todayTasks.length > 0 && (
          <section className="pt-3 border-t border-xs border-border-soft">
            <div className="flex items-center gap-1.5 mb-2 text-destructive">
              <Flame className="h-2.5 w-2.5" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
                Due today
              </span>
              <span className="text-[9.5px] font-semibold tabular-nums text-text-tertiary/70 ml-1">
                {todayTasks.length}
              </span>
            </div>
            <ul className="list-none p-0 m-0 space-y-1">
              {todayTasks.slice(0, 4).map((t) => (
                <li key={t.todo_id} className="list-none">
                  <TaskDueRow
                    task={t}
                    onClick={() => navigate({ to: "/task" as any })}
                  />
                </li>
              ))}
            </ul>
            {todayTasks.length > 4 && (
              <div className="text-[10px] text-text-tertiary italic mt-1.5 pl-1">
                + {todayTasks.length - 4} more due today
              </div>
            )}
          </section>
        )}
      </div>
      )}
    </BentoCard>
  );
}

// ─────────────────────────────────────────────────────────────────
// Meeting block — the centerpiece. Time on the left, content card
// on the right with mode-tinted left rail. Location or Join link
// is a first-class footer element.
// ─────────────────────────────────────────────────────────────────

function MeetingTimelineBlock({
  meeting,
}: {
  meeting: MeetingLike & {
    parsed: ReturnType<typeof parseMeetingTime>;
  };
}) {
  const navigate = useNavigate();
  const tone = toneForType(meeting.meeting_type);
  const isOnline = meeting.meeting_type === "online";
  const isInPerson = meeting.meeting_type === "in-person";
  const isHybrid = meeting.meeting_type === "hybrid";

  const startLabel =
    meeting.parsed != null ? formatHourLabel(meeting.parsed.startMinutes) : "—";
  const duration = meeting.parsed?.durationMinutes ?? 30;

  // For "online" the `location` field actually holds the URL.
  const onlineLink = isOnline && typeof meeting.location === "string" ? meeting.location : undefined;
  const inPersonLoc = isInPerson && typeof meeting.location === "string" ? meeting.location : undefined;
  const hybridLink = isHybrid ? meeting.hybrid_location?.url : undefined;
  const hybridAddr = isHybrid ? meeting.hybrid_location?.address : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-stretch gap-3"
    >
      {/* Time column — clickable → /timesheet (the meeting → shift
          trigger auto-syncs every meeting as a shift, so this jumps
          straight to the corresponding time entry). */}
      <button
        type="button"
        onClick={() => navigate({ to: "/timesheet" as any })}
        title="View in timesheet"
        className="group/ts flex-shrink-0 w-16 pt-2 text-right hover:opacity-100 transition-opacity"
      >
        <div className="text-[11px] font-bold tabular-nums text-foreground leading-none group-hover/ts:text-primary transition-colors">
          {startLabel}
        </div>
        <div className="text-[9.5px] uppercase tracking-wider text-text-tertiary mt-1 inline-flex items-center justify-end gap-0.5 w-full group-hover/ts:text-foreground/70 transition-colors">
          <Clock className="h-2 w-2 opacity-0 group-hover/ts:opacity-100 transition-opacity" />
          {duration}m
        </div>
      </button>

      {/* Card with mode rail */}
      <button
        type="button"
        onClick={() => navigate({ to: "/schedule" as any })}
        className="group/m relative flex-1 text-left rounded-lg bg-popover/60 border-xs border-border-soft hover:border-foreground/15 hover:bg-popover/80 transition-colors pl-3.5 pr-3 py-2 overflow-hidden"
      >
        <span
          aria-hidden
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${TONE_BG[tone]} opacity-90`}
        />
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-[12.5px] font-semibold text-foreground leading-snug truncate">
            {meeting.meeting_title ?? "Untitled meeting"}
          </span>
          <span
            className={`text-[9px] font-semibold uppercase tracking-[0.14em] flex-shrink-0 ${TONE_TEXT[tone]}`}
          >
            {meeting.meeting_type ?? "meeting"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[10.5px]">
          <span className="inline-flex items-center gap-1 text-text-tertiary uppercase tracking-wider">
            <Users className="h-2.5 w-2.5" />
            {meeting.attendees ?? 1}
          </span>

          {/* Location for in-person */}
          {inPersonLoc && (
            <span className="inline-flex items-center gap-1 text-warning">
              <MapPin className="h-2.5 w-2.5" />
              <span className="font-medium">{inPersonLoc}</span>
            </span>
          )}

          {/* Join link for online */}
          {onlineLink && (
            <a
              href={onlineLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              <LinkIcon className="h-2.5 w-2.5" />
              Join virtual
              <ExternalLink className="h-2 w-2 opacity-60" />
            </a>
          )}

          {/* Hybrid: both address + Join link */}
          {isHybrid && hybridAddr && (
            <span className="inline-flex items-center gap-1 text-success">
              <MapPin className="h-2.5 w-2.5" />
              <span className="font-medium">{hybridAddr}</span>
            </span>
          )}
          {isHybrid && hybridLink && (
            <a
              href={hybridLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-success hover:text-success/80 transition-colors font-semibold"
            >
              <LinkIcon className="h-2.5 w-2.5" />
              Join
              <ExternalLink className="h-2 w-2 opacity-60" />
            </a>
          )}

          {meeting.company && (
            <span className="text-text-tertiary uppercase tracking-wider ml-auto">
              {meeting.company === "simplicity" ? "Simpl" : "CWA"}
            </span>
          )}
        </div>
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Task due row
// ─────────────────────────────────────────────────────────────────

function TaskDueRow({
  task,
  onClick,
}: {
  task: TodosInterface;
  onClick: () => void;
}) {
  const Icon =
    task.priority === "high" ? Flame : task.priority === "medium" ? Zap : Leaf;
  const tone: Tone =
    task.priority === "high"
      ? "destructive"
      : task.priority === "medium"
      ? "warning"
      : "success";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/t w-full text-left flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
    >
      <Icon className={`h-3 w-3 flex-shrink-0 ${TONE_TEXT[tone]}`} />
      <span className="text-[11.5px] text-foreground flex-1 truncate font-medium">
        {task.title}
      </span>
      <span
        className={`text-[9.5px] font-semibold uppercase tracking-wider flex-shrink-0 ${TONE_TEXT[tone]}`}
      >
        {task.priority ?? "low"}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Empty-day guidance card — shown when today has no meetings AND no
// task deadlines. Replaces the previous "nothing to see here" strip
// with three concrete next moves so a clear day feels like an
// opportunity instead of dead space.
// ─────────────────────────────────────────────────────────────────

function EmptyTodayGuidanceCard({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="p-4">
      <div className="rounded-lg bg-gradient-to-br from-success/[0.06] via-transparent to-primary/[0.06] border-xs border-border-soft p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-7 w-7 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-success" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold text-foreground leading-tight">
              No meetings or deadlines today.
            </div>
            <div className="text-[11px] text-text-tertiary mt-0.5">
              A clear day is rare — pick a way to use it well.
            </div>
          </div>
        </div>

        {/* Three concrete actions side-by-side */}
        <div className="grid grid-cols-3 gap-2">
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/schedule" as any })}
            className="group/g rounded-lg bg-foreground/[0.025] border-xs border-border-soft hover:bg-foreground/[0.05] hover:border-foreground/15 transition-colors px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-1.5 mb-1 text-warning">
              <Clock className="h-2.5 w-2.5" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em]">
                Block focus
              </span>
            </div>
            <div className="text-[11px] text-foreground font-medium leading-snug">
              Reserve a 90-minute deep-work session.
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/task" as any })}
            className="group/g rounded-lg bg-foreground/[0.025] border-xs border-border-soft hover:bg-foreground/[0.05] hover:border-foreground/15 transition-colors px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-1.5 mb-1 text-primary">
              <Flame className="h-2.5 w-2.5" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em]">
                Grab a task
              </span>
            </div>
            <div className="text-[11px] text-foreground font-medium leading-snug">
              Pull something from the queue to ship.
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/" as any })}
            className="group/g rounded-lg bg-foreground/[0.025] border-xs border-border-soft hover:bg-foreground/[0.05] hover:border-foreground/15 transition-colors px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-1.5 mb-1 text-success">
              <Sparkles className="h-2.5 w-2.5" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em]">
                Take a break
              </span>
            </div>
            <div className="text-[11px] text-foreground font-medium leading-snug">
              Step away. Rest is part of the work.
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
