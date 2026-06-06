/**
 * lib/calcom.ts — minimal browser-side Cal.com REST client.
 *
 * Cal.com's v1 REST API uses `?apiKey=…` query-string auth (not a
 * Bearer header) and is CORS-friendly, so we hit it directly from
 * the Tauri webview. Same shape as Airtable / Linear / Vercel.
 *
 * Auth: `?apiKey=<key>` on every request. The key is created at
 * cal.com/settings/developer/api-keys.
 */

const BASE_URL = "https://api.cal.com/v1";

interface CalErrorBody {
  message?: string;
  error?: string;
}

async function calcomFetch<T>(
  apiKey: string,
  path: string,
  query?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("apiKey", apiKey);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    let msg = `Cal.com ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as CalErrorBody;
      if (body?.message) msg = `Cal.com: ${body.message}`;
      else if (body?.error) msg = `Cal.com: ${body.error}`;
    } catch {
      // ignore — keep status line
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ────────────────────────────────────────────────
// Response shapes
// ────────────────────────────────────────────────

export interface CalUser {
  id: number;
  username: string;
  name: string;
  email: string;
  timeZone: string;
  defaultScheduleId?: number | null;
}

interface CalMeResponse {
  user: CalUser;
}

export interface CalBooking {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: "ACCEPTED" | "PENDING" | "CANCELLED" | "REJECTED";
  attendees: { email: string; name: string; timeZone: string }[];
  location?: string | null;
  metadata?: Record<string, unknown>;
  eventTypeId?: number | null;
}

interface CalBookingsResponse {
  bookings: CalBooking[];
}

export interface CalEventType {
  id: number;
  title: string;
  slug: string;
  length: number;
  description: string | null;
  hidden: boolean;
}

interface CalEventTypesResponse {
  event_types: CalEventType[];
}

// ────────────────────────────────────────────────
// Public helpers
// ────────────────────────────────────────────────

/** /me — smoke test the API key. */
export async function calcomMe(apiKey: string): Promise<CalUser> {
  const data = await calcomFetch<CalMeResponse>(apiKey, "/me");
  return data.user;
}

/** Upcoming bookings, default 25 newest. */
export async function calcomUpcomingBookings(
  apiKey: string,
  opts: { limit?: number } = {},
): Promise<CalBooking[]> {
  // Cal.com filters by ISO date string. Use NOW so we get only
  // future meetings.
  const after = new Date().toISOString();
  const data = await calcomFetch<CalBookingsResponse>(apiKey, "/bookings", {
    afterStart: after,
    take: opts.limit ?? 25,
  });
  return data.bookings ?? [];
}

/** Event types — schedulable slots the user offers. */
export async function calcomListEventTypes(
  apiKey: string,
): Promise<CalEventType[]> {
  const data = await calcomFetch<CalEventTypesResponse>(apiKey, "/event-types");
  return data.event_types ?? [];
}

/** Smoke test for the connect dialog. */
export async function calcomPing(apiKey: string): Promise<{
  name: string;
  email: string;
  timezone: string;
}> {
  const u = await calcomMe(apiKey);
  return { name: u.name, email: u.email, timezone: u.timeZone };
}

// ────────────────────────────────────────────────
// Availability / slots
//
// Used by the outbound-scheduling AXON action — "find a 30-min slot
// next week to meet with Sarah". We hit Cal.com's /v1/slots endpoint
// with an event type id + a time window, get back a map of date →
// available start times, and return them in the operator's tz.
// ────────────────────────────────────────────────

interface CalSlotsResponse {
  /** Map of YYYY-MM-DD → array of slot objects. */
  slots: Record<string, { time: string; attendees?: number }[]>;
}

export interface CalAvailableSlot {
  /** Full ISO datetime of the slot start. */
  start: string;
  /** Date bucket Cal.com grouped it under (YYYY-MM-DD). */
  date: string;
}

/** Available slots for an event type in a given window. */
export async function calcomAvailableSlots(
  apiKey: string,
  args: {
    eventTypeId: number;
    startTime: string; // ISO
    endTime: string;   // ISO
    timeZone?: string;
  },
): Promise<CalAvailableSlot[]> {
  const data = await calcomFetch<CalSlotsResponse>(apiKey, "/slots", {
    eventTypeId: args.eventTypeId,
    startTime: args.startTime,
    endTime: args.endTime,
    ...(args.timeZone ? { timeZone: args.timeZone } : {}),
  });
  const flat: CalAvailableSlot[] = [];
  for (const [date, slots] of Object.entries(data.slots ?? {})) {
    for (const s of slots) flat.push({ start: s.time, date });
  }
  // Order earliest first
  flat.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return flat;
}

/** Build the operator's public booking URL for a given event slug.
 *  Optionally pre-fill the prefill query params Cal.com supports —
 *  ?email=, ?name=, ?date= — so an outbound link goes straight to
 *  Sarah's view of the calendar with her info already entered. */
export function calcomBookingUrl(
  username: string,
  eventSlug: string,
  prefill?: {
    email?: string;
    name?: string;
    /** YYYY-MM-DD to land on. */
    date?: string;
  },
): string {
  const base = `https://cal.com/${username}/${eventSlug}`;
  if (!prefill) return base;
  const params = new URLSearchParams();
  if (prefill.email) params.set("email", prefill.email);
  if (prefill.name) params.set("name", prefill.name);
  if (prefill.date) params.set("date", prefill.date);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
