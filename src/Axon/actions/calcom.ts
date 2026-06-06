// ───────────────────────────────────────────────────────────────────
// Cal.com actions — read upcoming meetings + event types so AXON
// can answer "what's on my calendar?" in real time.
//
// Three actions registered:
//
//   · calcom_upcoming_meetings — next N bookings, newest first
//   · calcom_today             — bookings whose start is today
//   · calcom_event_types       — schedulable slot types the operator offers
//
// All hit api.cal.com/v1 directly with the api_key query param.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchConnectorByKind,
  type Connector,
} from "@/stores/connectors";
import {
  calcomAvailableSlots,
  calcomBookingUrl,
  calcomListEventTypes,
  calcomMe,
  calcomUpcomingBookings,
} from "@/lib/calcom";

interface CalcomCreds {
  api_key?: string;
}

function readCalcomCreds(
  connector: Connector | null,
): { apiKey: string } | { error: string } {
  if (!connector) {
    return {
      error:
        "Cal.com is not connected. Open Settings → Connectors and add it first.",
    };
  }
  const creds = (connector.credentials ?? {}) as CalcomCreds;
  const apiKey = (creds.api_key ?? "").trim();
  if (!apiKey) return { error: "Cal.com credentials are incomplete." };
  return { apiKey };
}

// ─── calcom_upcoming_meetings ────────────────────────────────────

export const calcomUpcomingMeetingsAction: AxonAction<
  { limit?: number },
  {
    count: number;
    meetings: {
      id: number;
      title: string;
      starts: string;
      ends: string;
      attendees: string[];
      status: string;
      location: string | null;
    }[];
  }
> = {
  name: "calcom_upcoming_meetings",
  description:
    "List the operator's upcoming Cal.com meetings, newest first. Use this for 'what's on my calendar?' or 'who am I meeting tomorrow?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max meetings (default 25)." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("cal-com");
    const creds = readCalcomCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, meetings: [] } };
    }
    const raw = await calcomUpcomingBookings(creds.apiKey, {
      limit: input.limit ?? 25,
    });
    const meetings = raw.map((b) => ({
      id: b.id,
      title: b.title,
      starts: b.startTime,
      ends: b.endTime,
      attendees: b.attendees.map((a) => a.email),
      status: b.status,
      location: b.location ?? null,
    }));
    ctx.logActivity({
      actionName: "calcom_upcoming_meetings",
      params: { limit: input.limit },
      summary: `${meetings.length} upcoming Cal.com meeting(s)`,
    });
    return {
      summary: `${meetings.length} upcoming meeting(s).`,
      data: { count: meetings.length, meetings },
    };
  },
};

// ─── calcom_today ────────────────────────────────────────────────

export const calcomTodayAction: AxonAction<
  Record<string, never>,
  {
    count: number;
    meetings: {
      id: number;
      title: string;
      starts: string;
      attendees: string[];
    }[];
  }
> = {
  name: "calcom_today",
  description:
    "List today's Cal.com meetings in chronological order. Use this for 'what's my day look like?' or 'what's my next meeting?'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const connector = await fetchConnectorByKind("cal-com");
    const creds = readCalcomCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, meetings: [] } };
    }
    const raw = await calcomUpcomingBookings(creds.apiKey, { limit: 50 });

    // Filter to bookings whose startTime is today, local time.
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const tomorrowStart = todayStart + 86_400_000;
    const todays = raw
      .filter((b) => {
        const t = Date.parse(b.startTime);
        return t >= todayStart && t < tomorrowStart;
      })
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

    const meetings = todays.map((b) => ({
      id: b.id,
      title: b.title,
      starts: b.startTime,
      attendees: b.attendees.map((a) => a.email),
    }));

    ctx.logActivity({
      actionName: "calcom_today",
      params: {},
      summary: `${meetings.length} Cal.com meeting(s) today`,
    });
    return {
      summary:
        meetings.length === 0
          ? "Nothing on the Cal.com calendar today."
          : `${meetings.length} meeting(s) today.`,
      data: { count: meetings.length, meetings },
    };
  },
};

// ─── calcom_event_types ──────────────────────────────────────────

export const calcomEventTypesAction: AxonAction<
  Record<string, never>,
  {
    count: number;
    event_types: {
      id: number;
      title: string;
      slug: string;
      minutes: number;
      hidden: boolean;
    }[];
  }
> = {
  name: "calcom_event_types",
  description:
    "List the schedulable event types the operator offers (e.g. '15-min intro', '30-min sync'). Useful for 'what kinds of meetings can people book with me?'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const connector = await fetchConnectorByKind("cal-com");
    const creds = readCalcomCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, event_types: [] } };
    }
    const raw = await calcomListEventTypes(creds.apiKey);
    const types = raw.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      minutes: e.length,
      hidden: e.hidden,
    }));
    ctx.logActivity({
      actionName: "calcom_event_types",
      params: {},
      summary: `${types.length} Cal.com event type(s)`,
    });
    return {
      summary: `${types.length} event type(s) offered.`,
      data: { count: types.length, event_types: types },
    };
  },
};

// ─── calcom_available_slots ──────────────────────────────────────
// "Hey AXON, find me a 30-min slot next week to meet with Sarah."
//
// Looks up the matching event type by minutes (or by slug if the
// operator was specific), fetches open slots in the requested
// window, and returns the candidate times plus a personalized
// booking URL that prefills Sarah's email so she lands on a clean
// view of the calendar.

export const calcomAvailableSlotsAction: AxonAction<
  {
    minutes?: number;
    event_slug?: string;
    starts: string;
    ends: string;
    attendee_email?: string;
    attendee_name?: string;
    limit?: number;
  },
  {
    event_type: { id: number; slug: string; title: string; minutes: number };
    slots: { start: string; date: string }[];
    booking_url: string;
  }
> = {
  name: "calcom_available_slots",
  description:
    "Find available booking slots for a Cal.com event type within a window. Use this for 'find a 30-min slot next week to meet with Sarah'. Pass either `minutes` (we pick the matching event type) or `event_slug` (exact match). Returns candidate slot start times plus a prefilled booking URL the operator can send to the attendee.",
  input_schema: {
    type: "object",
    properties: {
      minutes: {
        type: "number",
        description:
          "Meeting length in minutes — used to pick the matching event type (e.g. 15, 30, 60). Either this or event_slug is required.",
      },
      event_slug: {
        type: "string",
        description: "Exact event type slug, e.g. '30min'. Optional.",
      },
      starts: {
        type: "string",
        description: "Window start (ISO datetime). 'Next Monday 9am' → operator's tz.",
      },
      ends: {
        type: "string",
        description: "Window end (ISO datetime).",
      },
      attendee_email: {
        type: "string",
        description: "Optional — prefilled on the booking URL so attendee lands ready to book.",
      },
      attendee_name: {
        type: "string",
        description: "Optional — prefilled on the booking URL.",
      },
      limit: {
        type: "number",
        description: "Cap on slot count returned (default 10).",
      },
    },
    required: ["starts", "ends"],
  },
  handler: async (input, ctx) => {
    if (!input.starts || !input.ends) {
      throw new Error("calcom_available_slots needs starts + ends.");
    }
    const connector = await fetchConnectorByKind("cal-com");
    const creds = readCalcomCreds(connector);
    if ("error" in creds) throw new Error(creds.error);

    // Resolve event type: by slug if provided, else by minutes.
    const types = await calcomListEventTypes(creds.apiKey);
    let eventType =
      (input.event_slug && types.find((t) => t.slug === input.event_slug)) ||
      (input.minutes && types.find((t) => t.length === input.minutes)) ||
      null;
    if (!eventType) {
      const detail = input.event_slug
        ? `slug "${input.event_slug}"`
        : input.minutes
          ? `${input.minutes}-min duration`
          : "any match";
      throw new Error(`No Cal.com event type found for ${detail}.`);
    }

    // Fetch the operator's identity for the URL.
    const me = await calcomMe(creds.apiKey);

    // Pull slots and cap.
    const all = await calcomAvailableSlots(creds.apiKey, {
      eventTypeId: eventType.id,
      startTime: input.starts,
      endTime: input.ends,
      timeZone: me.timeZone,
    });
    const slots = all.slice(0, input.limit ?? 10);

    // Build the operator's booking URL, prefilled for the attendee.
    const bookingUrl = calcomBookingUrl(me.username, eventType.slug, {
      email: input.attendee_email,
      name: input.attendee_name,
    });

    ctx.logActivity({
      actionName: "calcom_available_slots",
      params: {
        event_type: eventType.slug,
        starts: input.starts,
        ends: input.ends,
        slot_count: slots.length,
      },
      summary: `${slots.length} slot(s) found for ${eventType.title}`,
    });

    return {
      summary:
        slots.length === 0
          ? `No open ${eventType.title} slots in that window.`
          : `${slots.length} open slot(s) for ${eventType.title}.`,
      data: {
        event_type: {
          id: eventType.id,
          slug: eventType.slug,
          title: eventType.title,
          minutes: eventType.length,
        },
        slots,
        booking_url: bookingUrl,
      },
    };
  },
};

export function registerCalcomActions() {
  registerAction(calcomUpcomingMeetingsAction);
  registerAction(calcomTodayAction);
  registerAction(calcomEventTypesAction);
  registerAction(calcomAvailableSlotsAction);
}
