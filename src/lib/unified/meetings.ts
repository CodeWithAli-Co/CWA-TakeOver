/**
 * lib/unified/meetings.ts — Provider-neutral meetings layer.
 *
 * The first concrete instance of TakeOver's unified-data-source
 * pattern. The architecture, in five sentences:
 *
 *   1. Every meetings provider (Cal.com, Google Calendar,
 *      Calendly, TakeOver Huddle, etc.) exports a thin **adapter**
 *      function that maps its raw API response to `UnifiedMeeting[]`.
 *   2. The `useUnifiedMeetings()` hook reads from every adapter
 *      whose connector is active, merges the results, and sorts
 *      them by start time.
 *   3. UI components (MeetingsPanel, /operations Calendar card,
 *      etc.) render `UnifiedMeeting[]` and don't care which
 *      provider produced any given row.
 *   4. A `<SourceBadge source={m.source}>` per row surfaces the
 *      attribution.
 *   5. AXON's `meetings_today` and `meetings_upcoming` actions read
 *      the same unified output, so voice commands work across every
 *      provider with zero per-provider AXON logic.
 *
 * Adding a new meetings provider (e.g. Google Calendar) means:
 *   · Add the adapter in this file (~20 lines).
 *   · Wire it into the merge in `useUnifiedMeetings()` (1 line).
 *   · No UI or AXON changes required.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnectors } from "@/stores/connectors";
import {
  calcomUpcomingBookings,
  type CalBooking,
} from "@/lib/calcom";

// ────────────────────────────────────────────────
// Unified shape
// ────────────────────────────────────────────────

/** The cross-provider meeting type every adapter must produce.
 *  Fields are chosen for the union of what Cal.com, Google
 *  Calendar, Calendly, and TakeOver Huddle each expose. Optional
 *  fields signal "this provider doesn't surface it" rather than
 *  "the data is missing." */
export interface UnifiedMeeting {
  /** Globally unique id in the form `<source>:<provider_id>`. */
  id: string;
  /** Provider key — matches DATA_SOURCES registry. */
  source: string;
  /** Human-readable title (Cal.com bookings often inherit the
   *  event type's title; Google Calendar uses the event summary). */
  title: string;
  /** ISO datetime — start of the meeting. */
  starts: string;
  /** ISO datetime — end of the meeting. */
  ends: string;
  /** Attendee list. Email is required; name + timezone optional. */
  attendees: { email: string; name?: string }[];
  /** Free-text location string. Often a Zoom URL, Google Meet
   *  link, or a physical address. Cal.com uses the `location`
   *  field; Google Calendar uses `location` + `hangoutLink`. */
  location: string | null;
  /** Cancelled / pending / confirmed-ish. Provider-specific
   *  status enums normalize to these three buckets. */
  status: "confirmed" | "pending" | "cancelled";
  /** Back-link to the provider's UI for "open in Cal.com" etc. */
  url: string | null;
}

// ────────────────────────────────────────────────
// Per-provider adapters
//
// Each adapter takes the provider's raw client output + returns
// UnifiedMeeting[]. Pure functions, no React, easy to unit test.
// ────────────────────────────────────────────────

function fromCalcom(bookings: CalBooking[]): UnifiedMeeting[] {
  return bookings.map<UnifiedMeeting>((b) => ({
    id: `cal-com:${b.id}`,
    source: "cal-com",
    title: b.title,
    starts: b.startTime,
    ends: b.endTime,
    attendees: b.attendees.map((a) => ({
      email: a.email,
      name: a.name || undefined,
    })),
    location: b.location ?? null,
    status:
      b.status === "ACCEPTED"
        ? "confirmed"
        : b.status === "PENDING"
          ? "pending"
          : "cancelled",
    // Cal.com doesn't return a back-link in /v1/bookings; we'd need
    // a follow-up call. Leaving null for now — surface as
    // "open in provider" iff non-null.
    url: null,
  }));
}

// Future adapters land here as one-liners. Stubs included as
// docstrings so the pattern is obvious.

// function fromGoogleCalendar(events: GoogleEvent[]): UnifiedMeeting[] { … }
// function fromCalendly(events: CalendlyEvent[]): UnifiedMeeting[] { … }
// function fromTakeoverHuddle(huddles: Huddle[]): UnifiedMeeting[] { … }

// ────────────────────────────────────────────────
// Aggregator hook
// ────────────────────────────────────────────────

/** Pulls meetings from every connected provider, merges them, and
 *  returns a single chronological UnifiedMeeting[]. Each provider's
 *  query is independent — a slow/failing provider doesn't block the
 *  others. */
export function useUnifiedMeetings(opts: { limit?: number } = {}) {
  const { data: connectors = [] } = useConnectors();

  // Provider-specific connector lookups. Each returns the
  // credentials row (or undefined). When undefined, the
  // corresponding query stays disabled.
  const calcomConn = useMemo(
    () => connectors.find((c) => c.kind === "cal-com" && c.status === "connected"),
    [connectors],
  );
  const calcomApiKey = (calcomConn?.credentials as any)?.api_key as
    | string
    | undefined;

  // ─── Cal.com ─────────────────────────────────────────────────
  const calcom = useQuery<UnifiedMeeting[]>({
    queryKey: ["unified-meetings", "cal-com", calcomConn?.id ?? "none"],
    enabled: !!calcomApiKey,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!calcomApiKey) return [];
      const raw = await calcomUpcomingBookings(calcomApiKey, {
        limit: opts.limit ?? 50,
      });
      return fromCalcom(raw);
    },
  });

  // ─── Future providers slot in here ──────────────────────────
  // const google = useQuery<UnifiedMeeting[]>({ … fromGoogleCalendar … });
  // const calendly = useQuery<UnifiedMeeting[]>({ … fromCalendly … });

  // Merge + sort. Each provider can be loading / errored
  // independently; the UI surfaces those states per provider in
  // the panel header rather than blocking the whole view.
  const merged = useMemo<UnifiedMeeting[]>(() => {
    const all: UnifiedMeeting[] = [];
    if (calcom.data) all.push(...calcom.data);
    // if (google.data) all.push(...google.data);
    // if (calendly.data) all.push(...calendly.data);
    all.sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts));
    return all;
  }, [calcom.data]);

  // Per-provider status surface so the UI can render badges like
  // "Cal.com: 12 meetings · Google: error · Calendly: not connected".
  const providerStatus = useMemo(() => {
    return [
      {
        source: "cal-com",
        connected: !!calcomApiKey,
        loading: calcom.isLoading,
        error: calcom.error as Error | null,
        count: calcom.data?.length ?? 0,
      },
      // Future providers append to this list.
    ];
  }, [calcomApiKey, calcom.isLoading, calcom.error, calcom.data]);

  return {
    meetings: merged,
    providerStatus,
    isLoading: calcom.isLoading,
    isError: !!calcom.error,
  };
}

// ────────────────────────────────────────────────
// Time-window helpers — used by AXON actions + the UI
// ────────────────────────────────────────────────

/** Returns meetings starting today, local time. */
export function filterToday(meetings: UnifiedMeeting[]): UnifiedMeeting[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 86_400_000;
  return meetings.filter((m) => {
    const t = Date.parse(m.starts);
    return t >= start && t < end;
  });
}

/** Returns meetings between two ISO datetimes (inclusive). */
export function filterWindow(
  meetings: UnifiedMeeting[],
  startIso: string,
  endIso: string,
): UnifiedMeeting[] {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  return meetings.filter((m) => {
    const t = Date.parse(m.starts);
    return t >= s && t <= e;
  });
}

// ────────────────────────────────────────────────
// Imperative merger — used by AXON actions that run outside React
// ────────────────────────────────────────────────

import { fetchConnectorByKind } from "@/stores/connectors";

/** Pull unified meetings imperatively (no React). Walks every
 *  connected meetings provider, calls its adapter, merges + sorts.
 *  Used by AXON actions which run outside the React tree.
 *
 *  Adding a new provider here is one block — mirrors the
 *  useUnifiedMeetings hook. */
export async function fetchUnifiedMeetings(opts: {
  limit?: number;
} = {}): Promise<UnifiedMeeting[]> {
  const all: UnifiedMeeting[] = [];

  // ─── Cal.com ─────────────────────────────────────────────────
  try {
    const conn = await fetchConnectorByKind("cal-com");
    const apiKey = (conn?.credentials as any)?.api_key as string | undefined;
    if (apiKey) {
      const raw = await calcomUpcomingBookings(apiKey, {
        limit: opts.limit ?? 50,
      });
      all.push(...fromCalcom(raw));
    }
  } catch {
    // Per-provider failure is non-fatal — keep merging.
  }

  // ─── Future providers append here ──────────────────────────

  all.sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts));
  return all;
}
