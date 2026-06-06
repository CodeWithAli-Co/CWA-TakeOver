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
 *
 *  v2 response envelope: most v2 endpoints return
 *    { status: "success", data: <payload> }
 *  We unwrap `data` automatically so callers don't have to. When
 *  the response is already shaped like the legacy v1 (no envelope),
 *  we pass it through unchanged.
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
    // Proxy errors (missing connector, env misconfig) come back as
    // 4xx/5xx. Cal.com's own errors land here too.
    const detail = await res.text().catch(() => "");
    throw new Error(extractCalcomError(detail, res.status));
  }

  const raw = (await res.json()) as unknown;

  // v2 also returns 200 OK with { status: "error", ... } in the
  // body sometimes (e.g. when an endpoint validates input
  // server-side rather than returning a 4xx). Treat those as
  // throws too — same error semantics as a non-2xx.
  if (
    raw &&
    typeof raw === "object" &&
    "status" in raw &&
    (raw as { status?: string }).status === "error"
  ) {
    throw new Error(
      extractCalcomError(JSON.stringify(raw), res.status),
    );
  }

  // v2 success envelope: { status: "success", data: <payload> }.
  // Unwrap so callers see the same shape they always did.
  if (
    raw &&
    typeof raw === "object" &&
    "status" in raw &&
    (raw as { status?: string }).status === "success" &&
    "data" in raw
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

/** Extract a human-readable error message from a Cal.com response
 *  body. Handles every error shape we've seen in the wild:
 *
 *    · v1 legacy: { message: "..." }
 *    · v2 string: { error: "..." }
 *    · v2 object: { error: { code, message, details } }
 *    · v2 nested status: { status: "error", error: {...} }
 *    · proxy-level: { error: "..." } from our takeover-B2B route
 *    · raw text on parse failure
 *
 *  Whatever we get, NEVER let "[object Object]" leak through —
 *  that's the bug this helper exists to prevent. */
function extractCalcomError(raw: string, status: number): string {
  if (!raw || !raw.trim()) return `Cal.com ${status}`;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return `Cal.com ${status}: ${raw.slice(0, 200)}`;
  }
  if (!body || typeof body !== "object") {
    return `Cal.com ${status}`;
  }
  const b = body as Record<string, unknown>;

  // Walk down a chain of plausible error shapes — string wins
  // outright; object with .message gets that; otherwise we
  // JSON-stringify the most error-ish field as a last resort.
  const candidates: unknown[] = [
    b.message,
    b.error,
    (b.error as Record<string, unknown> | undefined)?.message,
    (b.error as Record<string, unknown> | undefined)?.details,
    b.detail,
    b.details,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return `Cal.com: ${c.trim()}`;
    }
    if (c && typeof c === "object") {
      // Last-ditch: extract .message off any nested object before
      // falling back to a JSON dump.
      const cm = (c as { message?: unknown }).message;
      if (typeof cm === "string" && cm.trim()) {
        return `Cal.com: ${cm.trim()}`;
      }
    }
  }

  // We had a JSON object but no recognizable error field. Dump it
  // (truncated) so the operator can still see what came back
  // instead of "[object Object]".
  const dump = JSON.stringify(body).slice(0, 200);
  return `Cal.com ${status}: ${dump}`;
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
  /** Minutes per slot. Cal.com v2 renamed the v1 `length` field to
   *  `lengthInMinutes`; we follow the v2 name. The proxy returns
   *  v2 shapes so this is always the live value. */
  lengthInMinutes: number;
  description: string | null;
  hidden: boolean;
  /** v2-only: official shareable booking page URL. Cal builds this
   *  server-side so we don't have to assemble it from username +
   *  slug. Optional because older event-types responses may omit
   *  it; fall back to calcomBookingUrl() if absent. */
  bookingUrl?: string;
  /** v2-only: users this event type belongs to. We mainly need
   *  `username` for constructing share links when `bookingUrl` is
   *  absent. */
  users?: { id: number; username: string | null; name: string | null }[];
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
 *    · post-save liveness check (key in DB) → pass null.
 *
 *  v2 returns the user object directly inside `data` (which the
 *  fetcher already unwrapped). The legacy v1 shape `{ user: ... }`
 *  is also handled — we look at both. */
export async function calcomMe(apiKey: string | null = null): Promise<CalUser> {
  const raw = await calcomFetch<CalUser | CalMeResponse>(apiKey, "me");
  // v2 returns CalUser directly; v1 wrapped it in { user: ... }.
  return "user" in (raw as object)
    ? (raw as CalMeResponse).user
    : (raw as CalUser);
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
  // v2: GET /v2/bookings?afterStart=…&take=… returns either a flat
  // array (after `data` unwrap) or { bookings: […] }. Handle both.
  const raw = await calcomFetch<CalBooking[] | CalBookingsResponse>(
    null,
    "bookings",
    { afterStart: after, take: limit ?? 25 },
  );
  if (Array.isArray(raw)) return raw;
  return raw?.bookings ?? [];
}

/** Event types — schedulable slots the user offers. v2 endpoint:
 *  GET /v2/event-types. Response is either a flat array (after
 *  envelope unwrap) or { event_types: […] } (v1-style). Handle
 *  both for safety during the migration window. */
export async function calcomListEventTypes(
  _ignored?: unknown, // legacy positional arg — kept for back-compat
): Promise<CalEventType[]> {
  const raw = await calcomFetch<CalEventType[] | CalEventTypesResponse>(
    null,
    "event-types",
  );
  if (Array.isArray(raw)) return raw;
  return raw?.event_types ?? [];
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
  // v2 endpoint: GET /v2/slots/available. Returns
  //   { slots: { "YYYY-MM-DD": [{ time: "...iso..." }] } }
  // after envelope unwrap. Same shape as v1, just under a new path.
  const raw = await calcomFetch<CalSlotsResponse>(null, "slots/available", {
    eventTypeId: args.eventTypeId,
    startTime: args.startTime,
    endTime: args.endTime,
    ...(args.timeZone ? { timeZone: args.timeZone } : {}),
  });
  const flat: CalAvailableSlot[] = [];
  for (const [date, slots] of Object.entries(raw?.slots ?? {})) {
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

// ────────────────────────────────────────────────
// Bookings — write path
// ────────────────────────────────────────────────

export interface CalCreatedBooking {
  id: number;
  uid: string;
  title: string;
  start: string;
  end: string;
  status: string;
  attendees?: { name: string; email: string; timeZone?: string }[];
  meetingUrl?: string | null;
}

/**
 * Create a Cal.com booking on the operator's behalf. Used by the
 * Axon `calcom_create_booking` action when the operator says "book
 * a meeting with Lesley today at 6pm".
 *
 * Routes through a separate POST endpoint (/api/calcom/booking) so
 * the read proxy (/api/calcom/proxy) stays GET-only — clearer
 * permission boundary, simpler allowlist on each side.
 *
 * Cal.com requires `start` in UTC ISO, an `eventTypeId`, and a
 * named + emailed attendee. The proxy coerces non-UTC datetimes
 * server-side so callers can pass local-offset strings safely.
 */
export async function calcomCreateBooking(args: {
  eventTypeId: number;
  start: string;
  attendee: {
    name: string;
    email: string;
    timeZone?: string;
    language?: string;
  };
  guests?: string[];
  metadata?: Record<string, unknown>;
}): Promise<CalCreatedBooking> {
  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    throw new Error(
      "VITE_TAKEOVER_SITE_URL not configured -- Cal.com booking unavailable.",
    );
  }
  const companyName = await getCompanyName();

  const res = await fetch(
    `${String(base).replace(/\/$/, "")}/api/calcom/booking`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
      body: JSON.stringify({
        company_name: companyName,
        eventTypeId: args.eventTypeId,
        start: args.start,
        attendee: args.attendee,
        ...(args.guests ? { guests: args.guests } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(extractCalcomError(detail, res.status));
  }

  const raw = (await res.json()) as unknown;
  // Cal v2 envelope: { status: "success", data: <booking> }
  let booking: unknown = raw;
  if (
    raw &&
    typeof raw === "object" &&
    "status" in raw &&
    (raw as { status?: string }).status === "success" &&
    "data" in raw
  ) {
    booking = (raw as { data: unknown }).data;
  }
  if (!booking || typeof booking !== "object") {
    throw new Error("Cal.com returned an unexpected booking shape.");
  }
  return booking as CalCreatedBooking;
}
