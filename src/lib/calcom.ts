/**
 * lib/calcom.ts — Cal.com Web API client, routed through takeover-B2B.
 *
 * Architecture: same proxy pattern as Slack/Gmail/Stripe. The
 * desktop never talks to api.cal.com directly. Every call goes
 * through `${VITE_TAKEOVER_SITE_URL}/api/calcom/proxy`, which:
 *
 *   1. Looks up the API key from the central `connectors` table
 *      (scoped by `company`) — OR accepts an explicit api_key in
 *      the request body for verify-on-save before the row exists.
 *   2. Calls api.cal.com/v1/{method} with ?apiKey=… server-side.
 *   3. Returns Cal.com's JSON response verbatim.
 *
 * Why the proxy hop instead of direct fetches:
 *
 *   Cal.com's v1 API doesn't accept cross-origin requests from
 *   Tauri (we get 410 + CORS rejection). Putting the call on the
 *   server side sidesteps that entirely. Same conclusion we
 *   reached for Slack — the proxy pattern is the right default
 *   for any connector whose provider isn't browser-friendly.
 *
 * Public function signatures unchanged from the direct-call
 * version, so callers in Axon/actions/calcom.ts, the unified
 * meetings adapter, and connectorVerify keep working without
 * modification.
 */

import { getStronghold } from "@/stores/stronghold";

// ────────────────────────────────────────────────
// Proxy helpers
// ────────────────────────────────────────────────

/** Build the proxy URL. Throws when VITE_TAKEOVER_SITE_URL isn't
 *  set so we don't silently fall back to direct calls and re-
 *  introduce the CORS issue. */
function proxyUrl(): string {
  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    throw new Error(
      "VITE_TAKEOVER_SITE_URL not configured — set in .env.local. " +
      "Cal.com calls route through takeover-B2B.",
    );
  }
  return `${base.replace(/\/$/, "")}/api/calcom/proxy`;
}

/** Tenant scope for lookup-mode calls. */
async function getCompanyName(): Promise<string | null> {
  try {
    const stronghold = await getStronghold();
    const name = await stronghold.getRecord("company_name");
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

/** Shared fetcher — every Cal.com call goes through here.
 *
 *  · apiKey provided  → verify-on-save mode (server forwards as-is)
 *  · apiKey == null   → lookup mode (server reads from connectors)
 */
async function calcomFetch<T>(
  apiKey: string | null,
  method: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const companyName = await getCompanyName();
  const body: Record<string, unknown> = {
    method,
    params: cleanParams(params),
    company_name: companyName,
  };
  if (apiKey) body.api_key = apiKey;

  const res = await fetch(proxyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TakeOver-App": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Proxy errors (missing connector, slack-style env issues,
    // upstream 4xx/5xx) come back as 4xx/5xx with { error }.
    const detail = await res.text().catch(() => "");
    let parsed: { error?: string; message?: string } = {};
    try { parsed = JSON.parse(detail); } catch { /* noop */ }
    const msg =
      parsed.error ?? parsed.message ?? `Cal.com proxy ${res.status}: ${detail.slice(0, 200)}`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Strip undefined keys so they don't get serialized as "undefined"
 *  query strings on the server. */
function cleanParams(
  params: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// ────────────────────────────────────────────────
// Response shapes — same as before
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

interface CalSlotsResponse {
  slots: Record<string, { time: string; attendees?: number }[]>;
}

export interface CalAvailableSlot {
  start: string;
  date: string;
}

// ────────────────────────────────────────────────
// Public helpers — same names + signatures as before
// ────────────────────────────────────────────────

/** /me — smoke test the API key. Two calling contexts:
 *    · verify-on-save (key explicit, no row yet) → pass the key.
 *    · post-save liveness check (key in DB) → pass null. */
export async function calcomMe(apiKey: string | null = null): Promise<CalUser> {
  const data = await calcomFetch<CalMeResponse>(apiKey, "me");
  return data.user;
}

/** Upcoming bookings — server reads the saved API key. */
export async function calcomUpcomingBookings(
  _ignored?: unknown, // legacy positional arg — kept for back-compat
  opts: { limit?: number } = {},
): Promise<CalBooking[]> {
  // Older callers passed (apiKey, opts). New callers can pass
  // (opts). Detect and route. If the first arg looks like an
  // opts object, treat it as the limit container.
  let limit = opts.limit;
  if (
    typeof _ignored === "object" &&
    _ignored !== null &&
    "limit" in _ignored
  ) {
    limit = (_ignored as { limit?: number }).limit ?? limit;
  }
  const after = new Date().toISOString();
  const data = await calcomFetch<CalBookingsResponse>(null, "bookings", {
    afterStart: after,
    take: limit ?? 25,
  });
  return data.bookings ?? [];
}

/** Event types — schedulable slots the user offers. */
export async function calcomListEventTypes(
  _ignored?: unknown, // legacy positional arg — kept for back-compat
): Promise<CalEventType[]> {
  const data = await calcomFetch<CalEventTypesResponse>(
    null,
    "event-types",
  );
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
// ────────────────────────────────────────────────

export async function calcomAvailableSlots(
  _ignored: unknown, // legacy positional — back-compat
  args: {
    eventTypeId: number;
    startTime: string;
    endTime: string;
    timeZone?: string;
  },
): Promise<CalAvailableSlot[]> {
  const data = await calcomFetch<CalSlotsResponse>(null, "slots", {
    eventTypeId: args.eventTypeId,
    startTime: args.startTime,
    endTime: args.endTime,
    ...(args.timeZone ? { timeZone: args.timeZone } : {}),
  });
  const flat: CalAvailableSlot[] = [];
  for (const [date, slots] of Object.entries(data.slots ?? {})) {
    for (const s of slots) flat.push({ start: s.time, date });
  }
  flat.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return flat;
}

/** Build the operator's public booking URL — pure function, no
 *  API call required. Kept here so callers can import everything
 *  Cal.com-related from one place. */
export function calcomBookingUrl(
  username: string,
  eventSlug: string,
  prefill?: {
    email?: string;
    name?: string;
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
