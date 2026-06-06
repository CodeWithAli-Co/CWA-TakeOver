// ───────────────────────────────────────────────────────────────────
// Unified meetings actions — provider-neutral. Read from
// lib/unified/meetings.ts which merges every connected meetings
// provider (Cal.com, Google Calendar, Calendly, …) into a single
// chronological list.
//
// AXON doesn't need to know whether the meeting lives in Cal.com,
// Google Calendar, Calendly, or somewhere else — these actions
// work the same regardless. Each row carries a `source` field so
// AXON can mention provider attribution when relevant.
//
// Distinct from `meetings.ts` in this directory, which manages
// TakeOver's own native cwa_meetings table.
//
// Two actions registered:
//
//   · meetings_today    — bookings whose start is today, all providers
//   · meetings_upcoming — next N meetings across all providers
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchUnifiedMeetings,
  filterToday,
  type UnifiedMeeting,
} from "@/lib/unified/meetings";

interface MeetingDTO {
  source: string;
  title: string;
  starts: string;
  ends: string;
  attendees: string[];
  location: string | null;
  status: string;
}

function shape(m: UnifiedMeeting): MeetingDTO {
  return {
    source: m.source,
    title: m.title,
    starts: m.starts,
    ends: m.ends,
    attendees: m.attendees.map((a) => a.name || a.email),
    location: m.location,
    status: m.status,
  };
}

// ─── meetings_today ──────────────────────────────────────────────

export const meetingsTodayAction: AxonAction<
  Record<string, never>,
  {
    count: number;
    by_source: Record<string, number>;
    meetings: MeetingDTO[];
  }
> = {
  name: "meetings_today",
  description:
    "List today's meetings across every connected meetings provider (Cal.com, Google Calendar, Calendly, TakeOver). Use this for 'what's my day look like?', 'what's my next meeting?'. Each meeting includes a `source` field — AXON can mention 'this is on Cal.com' vs 'this is on Google Calendar' if relevant.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const all = await fetchUnifiedMeetings({ limit: 100 });
    const today = filterToday(all);

    const by_source: Record<string, number> = {};
    for (const m of today) {
      by_source[m.source] = (by_source[m.source] ?? 0) + 1;
    }

    ctx.logActivity({
      actionName: "meetings_today",
      params: {},
      summary: `${today.length} meeting(s) today`,
    });

    return {
      summary:
        today.length === 0
          ? "Nothing on the calendar today."
          : `${today.length} meeting(s) today.`,
      data: {
        count: today.length,
        by_source,
        meetings: today.map(shape),
      },
    };
  },
};

// ─── meetings_upcoming ───────────────────────────────────────────

export const meetingsUpcomingAction: AxonAction<
  { limit?: number; source?: string },
  {
    count: number;
    by_source: Record<string, number>;
    meetings: MeetingDTO[];
  }
> = {
  name: "meetings_upcoming",
  description:
    "List upcoming meetings across every connected meetings provider, soonest first. Optionally filter to one provider via `source` (e.g. 'cal-com', 'google-calendar', 'calendly').",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max meetings (default 25)." },
      source: {
        type: "string",
        description:
          "Filter to one provider id (cal-com / google-calendar / calendly / takeover). Omit for all.",
      },
    },
  },
  handler: async (input, ctx) => {
    const all = await fetchUnifiedMeetings({ limit: (input.limit ?? 25) * 2 });
    const filtered = input.source
      ? all.filter((m) => m.source === input.source)
      : all;
    const slice = filtered.slice(0, input.limit ?? 25);

    const by_source: Record<string, number> = {};
    for (const m of slice) {
      by_source[m.source] = (by_source[m.source] ?? 0) + 1;
    }

    ctx.logActivity({
      actionName: "meetings_upcoming",
      params: { limit: input.limit, source: input.source },
      summary: `${slice.length} upcoming meeting(s)`,
    });

    return {
      summary: `${slice.length} upcoming meeting(s)${input.source ? ` from ${input.source}` : ""}.`,
      data: {
        count: slice.length,
        by_source,
        meetings: slice.map(shape),
      },
    };
  },
};

export function registerUnifiedMeetingsActions() {
  registerAction(meetingsTodayAction);
  registerAction(meetingsUpcomingAction);
}
