/**
 * shifts.ts — Supabase query + mutation hooks for the unified shifts table.
 *
 * Used by both the calendar and the timesheet. The two surfaces filter the
 * same underlying rows differently: calendar shows starts_at/ends_at
 * (planned), timesheet shows clock_in/clock_out (actual).
 *
 * All range queries cover any shift whose [starts_at, ends_at] OVERLAPS
 * the requested window — not just shifts that *start* inside it — so
 * overnight shifts straddling Sunday→Monday show up in both weeks.
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";
import { useCompanyFilter } from "./store";
import {
  expandRecurrence,
  findOverlaps,
  isVirtualInstance,
  masterIdOf,
  type Shift,
  type ShiftCreate,
  type ShiftUpdate,
} from "./shiftTypes";

const SHIFTS_TABLE = "shifts";
const MEETINGS_TABLE = "cwa_meetings";

// ============================================================
// Meeting → virtual-shift bridge.
//
// TODO(schema): replace this client-side merge with the proper
// AFTER INSERT/UPDATE/DELETE trigger on cwa_meetings that materializes
// shift rows. Until that lands, useShiftsInRange merges meetings on
// the fly so they render on the timesheet alongside real shifts.
// Virtual meeting shifts get an id of the form `meeting::<meeting.id>`
// so renderers can detect them and route clicks back to /schedule
// instead of opening the shift editor.
// ============================================================

const MEETING_PREFIX = "meeting::";

export function isMeetingVirtualShift(s: Pick<Shift, "id">): boolean {
  return typeof s.id === "string" && s.id.startsWith(MEETING_PREFIX);
}

export function meetingIdFromVirtualShift(s: Pick<Shift, "id">): string | null {
  if (!isMeetingVirtualShift(s)) return null;
  return s.id.slice(MEETING_PREFIX.length);
}

// Parse "10:00AM - 11:30 PM" / "12:00 PM" / "14:00 - 15:30" into
// { startMinutes, endMinutes } past midnight. Returns null on failure.
function parseMeetingTimeRange(
  time?: string | null,
): { startMinutes: number; endMinutes: number } | null {
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

  const a = matches[0]!;
  const start = toMinutes(parseInt(a[1]!, 10), parseInt(a[2]!, 10), a[3]);
  let end = start + 30; // default 30-minute meeting
  if (matches.length > 1) {
    const b = matches[1]!;
    const candidate = toMinutes(parseInt(b[1]!, 10), parseInt(b[2]!, 10), b[3]);
    if (candidate > start) end = candidate;
  }
  return { startMinutes: start, endMinutes: end };
}

// Shape of a row coming back from cwa_meetings (matches MeetingInterface
// in stores/query.ts, kept loose so we don't need a cross-module import).
interface MeetingRow {
  id: number | string;
  meeting_title?: string;
  time?: string;
  date?: string;
  attendees?: number;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string | null;
  hybrid_location?: { address?: string; url?: string } | null;
  company?: string | null;
}

// Convert a meeting row into a Shift-shaped object so the timesheet
// renderer treats it like any other meeting-typed entry. Returns null
// when the meeting's time can't be parsed (we'd rather drop it than
// pin it to midnight).
function meetingToVirtualShift(
  m: MeetingRow,
  filterUserSupaId?: string | null,
): Shift | null {
  if (!m.date) return null;
  const parsed = parseMeetingTimeRange(m.time);
  if (!parsed) return null;

  // `meeting.date` is stored as free-text from a `type="text"` input
  // ("May 29, 2026", "2026-05-29", "5/29/2026", etc.). Let JS Date parse
  // it, then re-anchor to local midnight of that calendar day so the
  // time-of-day from `meeting.time` lands cleanly.
  const rawDate = new Date(String(m.date));
  if (Number.isNaN(rawDate.getTime())) return null;
  const dayBase = new Date(
    rawDate.getFullYear(),
    rawDate.getMonth(),
    rawDate.getDate(),
    0,
    0,
    0,
    0,
  );

  const startMs = dayBase.getTime() + parsed.startMinutes * 60_000;
  const endMs = dayBase.getTime() + parsed.endMinutes * 60_000;
  const startsAt = new Date(startMs).toISOString();
  const endsAt = new Date(endMs).toISOString();

  const now = Date.now();
  const status: Shift["status"] = endMs < now ? "completed" : "scheduled";

  // Location: for online the URL lives on .location; for in-person it's
  // a place name. Hybrid stores both. We pick the human-readable form
  // here and stash the URL into notes so the renderer can surface it.
  let location: string | null = null;
  let notes: string | null = null;
  if (m.meeting_type === "online" && typeof m.location === "string") {
    location = "Virtual";
    notes = m.location;
  } else if (m.meeting_type === "in-person" && typeof m.location === "string") {
    location = m.location;
  } else if (m.meeting_type === "hybrid" && m.hybrid_location) {
    location = m.hybrid_location.address ?? "Hybrid";
    notes = m.hybrid_location.url ?? null;
  } else if (typeof m.location === "string") {
    location = m.location;
  }

  return {
    id: `${MEETING_PREFIX}${m.id}`,
    user_supa_id: filterUserSupaId ?? "",
    username: "",
    starts_at: startsAt,
    ends_at: endsAt,
    clock_in: null,
    clock_out: null,
    status,
    type: "meeting",
    title: m.meeting_title ?? "Meeting",
    notes,
    location,
    color: null,
    category: null,
    is_billable: false,
    company: m.company ?? "CodeWithAli",
    recurrence: null,
    recurrence_parent_id: null,
    recurrence_until: null,
    coverage_requested_at: null,
    coverage_requested_by: null,
    created_by: null,
    created_at: startsAt,
    updated_at: startsAt,
  };
}

// ============================================================
// Query keys — centralized so mutations can invalidate cleanly.
// ============================================================
export const shiftKeys = {
  all:    ["shifts"] as const,
  range:  (from: string, to: string, scope: string) =>
            ["shifts", "range", from, to, scope] as const,
  user:   (userId: string, from: string, to: string) =>
            ["shifts", "user", userId, from, to] as const,
  active: (userId: string) =>
            ["shifts", "active", userId] as const,
};

function activeCompanyLabel(): "CodeWithAli" | "simplicity" {
  const raw = useCompanyFilter.getState().activeCompany;
  return raw === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// ============================================================
// Reads
// ============================================================

/**
 * All shifts whose [starts_at, ends_at] overlaps [from, to].
 * Optionally filter to one user.
 */
export function useShiftsInRange(
  from: Date,
  to: Date,
  opts: { userSupaId?: string | null; enabled?: boolean } = {},
) {
  const { activeCompany } = useCompanyFilter();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const scope = `${activeCompany}::${opts.userSupaId ?? "all"}`;

  return useQuery({
    queryKey: shiftKeys.range(fromIso, toIso, scope),
    enabled: opts.enabled !== false,
    queryFn: async (): Promise<Shift[]> => {
      // Two passes, OR'd client-side:
      //   1. Concrete rows whose [starts_at, ends_at] overlaps [from, to].
      //   2. Recurrence masters that *could* generate instances inside the
      //      window — i.e. their anchor is <= to AND (recurrence_until is
      //      NULL OR >= from). We then expand them client-side.
      const overlapQuery = companySupabase
        .from(SHIFTS_TABLE)
        .select("*")
        .lte("starts_at", toIso)
        .gte("ends_at", fromIso)
        .is("recurrence", null);

      const recurringQuery = companySupabase
        .from(SHIFTS_TABLE)
        .select("*")
        .not("recurrence", "is", null)
        .lte("starts_at", toIso);

      // Meeting bridge — fetch cwa_meetings and filter client-side.
      // `cwa_meetings.date` is a free-text input ("May 29, 2026" style)
      // so server-side lexicographic comparison against ISO dates
      // would silently exclude valid rows. Pull all meetings (small
      // table) and let new Date() parse them in JS, then filter to
      // those whose virtual start/end overlaps [from, to].
      const meetingsQuery = companySupabase.from(MEETINGS_TABLE).select("*");

      let oq = overlapQuery;
      let rq = recurringQuery;
      let mq = meetingsQuery;

      if (opts.userSupaId) {
        oq = oq.eq("user_supa_id", opts.userSupaId);
        rq = rq.eq("user_supa_id", opts.userSupaId);
      }
      if (activeCompany !== "all") {
        const label = activeCompanyLabel();
        oq = oq.eq("company", label);
        rq = rq.eq("company", label);
        mq = mq.eq("company", label);
      }

      const [overlapRes, recurringRes, meetingsRes] = await Promise.all([
        oq,
        rq,
        mq,
      ]);

      const handle = (res: typeof overlapRes) => {
        if (res.error) {
          const code = (res.error as any).code;
          const msg = code === "42P01"
            ? `Table does not exist (code 42P01): ${res.error.message}`
            : res.error.message;
          throw new Error(msg);
        }
        return (res.data ?? []) as Shift[];
      };

      const concrete = handle(overlapRes);
      const masters = handle(recurringRes);

      // Expand recurring masters into virtual instances within the window.
      // Drop any expansion whose date matches a concrete clock-in row (so a
      // recurring template never double-renders on top of its materialized
      // copy — e.g. an admin manually edited the Tuesday instance).
      const concreteDateKeys = new Set(
        concrete
          .filter((s) => s.recurrence_parent_id)
          .map((s) => `${s.recurrence_parent_id}::${s.starts_at.slice(0, 10)}`),
      );

      const expanded: Shift[] = [];
      for (const m of masters) {
        for (const inst of expandRecurrence(m, from, to)) {
          const key = `${m.id}::${inst.starts_at.slice(0, 10)}`;
          if (!concreteDateKeys.has(key)) expanded.push(inst);
        }
      }

      // Meetings — converted to virtual shifts and merged in. Meetings
      // failing to parse a time string are dropped (rather than pinned
      // to midnight) so they don't render in surprising positions.
      // Virtual meeting shifts are SHARED across the company — they have
      // no organizer in cwa_meetings, so we leave user_supa_id empty
      // and let the WeekGrid fan them out across every employee row
      // in TEAM view (see isMeetingVirtualShift handling there).
      const meetingRows = (meetingsRes.error ? [] : meetingsRes.data ?? []) as MeetingRow[];
      const meetingShifts: Shift[] = [];
      for (const m of meetingRows) {
        const virt = meetingToVirtualShift(m, null);
        if (!virt) continue;
        // Range filter — only include if the virtual window actually
        // overlaps [from, to]. Edge cases where the meeting's date is
        // on the boundary day but its time falls outside the window.
        const vs = new Date(virt.starts_at).getTime();
        const ve = new Date(virt.ends_at).getTime();
        if (ve >= from.getTime() && vs <= to.getTime()) {
          meetingShifts.push(virt);
        }
      }

      // Final list: concrete shifts + recurrence instances + virtual
      // meeting shifts, sorted by start time.
      return [...concrete, ...expanded, ...meetingShifts].sort((a, b) =>
        a.starts_at.localeCompare(b.starts_at),
      );
    },
  });
}

/** The currently-active shift for a user (status = in_progress), or null. */
export function useActiveShift(userSupaId: string | null | undefined) {
  return useQuery({
    queryKey: shiftKeys.active(userSupaId ?? "none"),
    enabled: !!userSupaId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Shift | null> => {
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .select("*")
        .eq("user_supa_id", userSupaId!)
        .eq("status", "in_progress")
        .order("clock_in", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Shift) ?? null;
    },
  });
}

/**
 * The next upcoming scheduled shift for a user — used by the ClockBar
 * to show "Next: Tomorrow 9 AM" even when no shift is in progress.
 */
export function useNextShift(userSupaId: string | null | undefined) {
  return useQuery({
    queryKey: ["shifts", "next", userSupaId ?? "none"],
    enabled: !!userSupaId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Shift | null> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .select("*")
        .eq("user_supa_id", userSupaId!)
        .eq("status", "scheduled")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Shift) ?? null;
    },
  });
}

// ============================================================
// Writes
// ============================================================

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ShiftCreate): Promise<Shift> => {
      const company = payload.company ?? activeCompanyLabel();
      const { data: auth } = await companySupabase.auth.getUser();
      const insert = {
        ...payload,
        company,
        status: payload.status ?? "scheduled",
        is_billable: payload.is_billable ?? true,
        created_by: auth.user?.id ?? null,
      };
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: ShiftUpdate): Promise<Shift> => {
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await companySupabase
  .from(SHIFTS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/**
 * Clock in to a shift. DB trigger flips status → in_progress.
 * If no `shiftId` is provided, creates a fresh ad-hoc shift starting now.
 */
export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      shiftId?: string;
      userSupaId: string;
      username: string;
    }): Promise<Shift> => {
      const now = new Date().toISOString();

      if (args.shiftId) {
        const { data, error } = await companySupabase
    .from(SHIFTS_TABLE)
          .update({ clock_in: now })
          .eq("id", args.shiftId)
          .select()
          .single();
        if (error) throw error;
        return data as Shift;
      }

      // No scheduled shift → create an ad-hoc one (4-hour default window).
      const plannedEnd = new Date(Date.now() + 4 * 3600_000).toISOString();
      const { data: auth } = await companySupabase.auth.getUser();
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .insert({
          user_supa_id: args.userSupaId,
          username: args.username,
          starts_at: now,
          ends_at: plannedEnd,
          clock_in: now,
          status: "in_progress",
          type: "shift",
          company: activeCompanyLabel(),
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/** Clock out of an in-progress shift. DB trigger flips status → completed. */
export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string): Promise<Shift> => {
      const now = new Date().toISOString();
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .update({ clock_out: now, ends_at: now })
        .eq("id", shiftId)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

// ============================================================
// v2 — realtime sync, conflict check, copy-week, coverage flow
// ============================================================

/**
 * Subscribes to Supabase `postgres_changes` on the shifts table and
 * invalidates the TanStack cache on any change. Mount once at the top
 * of the page; teardown handled in effect cleanup.
 */
export function useShiftsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = companySupabase
      .channel("shifts_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SHIFTS_TABLE },
        () => {
          // Cheap invalidate-all — granular patching is possible but the
          // grid re-renders fast and the wins aren't worth the complexity
          // until we see scale issues.
          qc.invalidateQueries({ queryKey: shiftKeys.all });
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [qc]);
}

/**
 * Returns conflicting shifts for a user within [starts_at, ends_at],
 * excluding the row being edited (if any). Operates on already-loaded
 * data so the editor can show conflicts inline without a round-trip.
 */
export function findConflictsAgainst(
  shifts: Shift[],
  userId: string,
  starts_at: string,
  ends_at: string,
  ignoreId?: string,
): Shift[] {
  // Treat virtual instances as their master for the ignore filter so
  // re-saving a recurring master doesn't conflict with itself.
  const baseIgnore = ignoreId ? masterIdOf({ id: ignoreId } as Shift) : undefined;
  return findOverlaps(shifts, userId, starts_at, ends_at, baseIgnore).filter(
    (s) => !isVirtualInstance(s) || masterIdOf(s) !== baseIgnore,
  );
}

/**
 * Copy every shift in `[fromStart, fromEnd]` into `[toStart, toEnd]`
 * shifted by 7 days. Skips virtual recurrence instances (their masters
 * already repeat) and any cancelled rows. Returns the new row count.
 */
export function useCopyWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      sourceWeekStart: Date;
      destWeekStart: Date;
      userSupaId?: string | null;
    }): Promise<number> => {
      const { sourceWeekStart, destWeekStart, userSupaId } = args;
      const sourceEnd = new Date(sourceWeekStart);
      sourceEnd.setDate(sourceEnd.getDate() + 7);
      const shiftMs =
        destWeekStart.getTime() - sourceWeekStart.getTime();

      // Pull only concrete rows for the source week — recurring masters
      // are excluded because they already paint forward on their own.
      let q = companySupabase
        .from(SHIFTS_TABLE)
        .select("*")
        .gte("starts_at", sourceWeekStart.toISOString())
        .lt("starts_at", sourceEnd.toISOString())
        .is("recurrence", null)
        .neq("status", "cancelled");
      if (userSupaId) q = q.eq("user_supa_id", userSupaId);

      const { data: source, error: srcErr } = await q;
      if (srcErr) throw srcErr;
      if (!source || source.length === 0) return 0;

      const { data: auth } = await companySupabase.auth.getUser();

      const inserts = (source as Shift[]).map((s) => ({
        user_supa_id: s.user_supa_id,
        username: s.username,
        starts_at: new Date(new Date(s.starts_at).getTime() + shiftMs).toISOString(),
        ends_at:   new Date(new Date(s.ends_at).getTime()   + shiftMs).toISOString(),
        type: s.type,
        title: s.title,
        notes: s.notes,
        location: s.location,
        color: s.color,
        category: s.category,
        is_billable: s.is_billable,
        company: s.company,
        status: "scheduled" as const,
        created_by: auth.user?.id ?? null,
      }));

      const { error: insErr, data: inserted } = await companySupabase
  .from(SHIFTS_TABLE)
        .insert(inserts)
        .select("id");
      if (insErr) throw insErr;
      return inserted?.length ?? inserts.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/**
 * Flag this shift as "needs cover" — anyone in the org can claim it
 * from the OpenShiftsInbox.
 */
export function useRequestCoverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string): Promise<Shift> => {
      const { data: auth } = await companySupabase.auth.getUser();
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .update({
          coverage_requested_at: new Date().toISOString(),
          coverage_requested_by: auth.user?.id ?? null,
        })
        .eq("id", shiftId)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/** Cancel a coverage request — restores the shift to normal "yours" state. */
export function useCancelCoverageRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string): Promise<Shift> => {
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .update({
          coverage_requested_at: null,
          coverage_requested_by: null,
        })
        .eq("id", shiftId)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/**
 * Claim an open shift — reassigns user_supa_id to the claimer and
 * clears the coverage flag. The previous owner keeps no link to the
 * shift; if you need an audit trail later, capture it here.
 */
export function useClaimShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      shiftId: string;
      claimerSupaId: string;
      claimerUsername: string;
    }): Promise<Shift> => {
      const { data, error } = await companySupabase
  .from(SHIFTS_TABLE)
        .update({
          user_supa_id: args.claimerSupaId,
          username: args.claimerUsername,
          coverage_requested_at: null,
          coverage_requested_by: null,
        })
        .eq("id", args.shiftId)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/** All shifts currently flagged as "needs cover" — used by OpenShiftsInbox. */
export function useOpenShifts() {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["shifts", "open", activeCompany],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Shift[]> => {
      let q = companySupabase
        .from(SHIFTS_TABLE)
        .select("*")
        .not("coverage_requested_at", "is", null)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (activeCompany !== "all") q = q.eq("company", activeCompanyLabel());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
  });
}
