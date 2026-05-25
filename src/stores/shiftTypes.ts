/**
 * shiftTypes.ts — single source of truth for the unified Shift model.
 *
 * Replaces the dual world of `schedule_events` + `time_entries`. A shift
 * has both *planned* time (starts_at / ends_at) and *actual* time
 * (clock_in / clock_out). `status` drives the workflow:
 *
 *   scheduled   — planned, not yet started
 *   in_progress — clocked in, clock_out is null
 *   completed   — clocked in and out
 *   no_show     — shift ended without a clock_in
 *   cancelled   — removed before it could happen
 *
 * The DB has triggers that auto-bump status when clock_in / clock_out
 * are written, so the UI rarely needs to set it directly.
 */

export const SHIFT_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const SHIFT_TYPES = [
  "shift",
  "meeting",
  "break",
  "training",
  "off",
] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export interface Shift {
  id: string;
  user_supa_id: string;
  username: string;

  // Planned
  starts_at: string;          // ISO timestamptz
  ends_at: string;            // ISO timestamptz

  // Actual
  clock_in: string | null;    // ISO timestamptz (null until clocked in)
  clock_out: string | null;   // ISO timestamptz (null until clocked out)

  status: ShiftStatus;
  type: ShiftType;

  title: string | null;
  notes: string | null;
  location: string | null;
  color: string | null;       // optional hex override

  category: string | null;    // legacy TimeCategory
  is_billable: boolean;

  company: string;            // "CodeWithAli" | "simplicity"

  // Recurrence (master row only — generated instances are virtual)
  recurrence: Recurrence | null;
  recurrence_parent_id: string | null;
  recurrence_until: string | null;     // YYYY-MM-DD, inclusive

  // Coverage-request flow ("needs cover")
  coverage_requested_at: string | null;
  coverage_requested_by: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Lightweight recurrence rule. Stored as jsonb on the master row. The
 * client expands it inside the visible date range — we never persist
 * the generated instances.
 */
export interface Recurrence {
  freq: "daily" | "weekly";
  /** 0 = Sun ... 6 = Sat. Required for weekly. */
  days_of_week?: number[];
  /** Every Nth week/day. Defaults to 1. */
  interval?: number;
}

// Insert payload — server fills the rest.
export type ShiftCreate = Pick<
  Shift,
  | "user_supa_id"
  | "username"
  | "starts_at"
  | "ends_at"
  | "type"
> &
  Partial<
    Pick<
      Shift,
      | "title"
      | "notes"
      | "location"
      | "color"
      | "category"
      | "is_billable"
      | "company"
      | "status"
    >
  >;

export type ShiftUpdate = Partial<Omit<Shift, "id" | "created_at">> & {
  id: string;
};

// ============================================================
// Visual meta — colors per type AND per status.
// Status overlay (in_progress glow, no_show red overlay) is
// composed on top of the type accent in ShiftBlock.
// ============================================================

export interface TypeMeta {
  label: string;
  accent: string;       // hex/rgb for primary accent
  bgTint: string;       // background tint (alpha-low form of accent)
}

export const SHIFT_TYPE_META: Record<ShiftType, TypeMeta> = {
  shift:    { label: "Shift",    accent: "rgb(239,68,68)",  bgTint: "rgba(239,68,68,0.12)"  },
  meeting:  { label: "Meeting",  accent: "rgb(14,165,233)", bgTint: "rgba(14,165,233,0.12)" },
  break:    { label: "Break",    accent: "rgb(251,191,36)", bgTint: "rgba(251,191,36,0.12)" },
  training: { label: "Training", accent: "rgb(168,85,247)", bgTint: "rgba(168,85,247,0.12)" },
  off:      { label: "Off",      accent: "rgb(110,110,116)",bgTint: "rgba(110,110,116,0.12)" },
};

export interface StatusMeta {
  label: string;
  dot: string;          // dot color for legend / chip
  ring?: string;        // optional outer ring style class
}

export const SHIFT_STATUS_META: Record<ShiftStatus, StatusMeta> = {
  scheduled:   { label: "Scheduled",   dot: "rgb(148,163,184)" },          // slate-400
  in_progress: { label: "On the clock",dot: "rgb(34,197,94)",  ring: "ring-2 ring-emerald-400/60" },
  completed:   { label: "Completed",   dot: "rgb(100,116,139)" },          // slate-500
  no_show:     { label: "No-show",     dot: "rgb(239,68,68)" },
  cancelled:   { label: "Cancelled",   dot: "rgb(82,82,91)" },             // zinc-600
};

// ============================================================
// Helpers (pure)
// ============================================================

/** Difference between two ISO timestamps in minutes. */
export function diffMinutes(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

/** Hours worked for a shift — uses clock times if present, else planned. */
export function shiftHours(s: Shift): number {
  const inT  = s.clock_in  ?? s.starts_at;
  const outT = s.clock_out ?? s.ends_at;
  return diffMinutes(inT, outT) / 60;
}

/** "9:00 AM" formatter. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** "Mon" / "Tue" weekday abbreviation. */
export function weekdayAbbr(d: Date): string {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]!;
}

/** Start of week (Mon 00:00) for a given date — matches the Mon-Sun grid. */
export function startOfWeekMonday(d: Date = new Date()): Date {
  const out = new Date(d);
  const dow = out.getDay();              // 0 = Sun
  const delta = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + delta);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** End of week (Sun 23:59:59.999) for a given date. */
export function endOfWeekSunday(d: Date = new Date()): Date {
  const start = startOfWeekMonday(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** 7 Date objects, Mon→Sun, for the week containing `d`. */
export function weekDays(d: Date = new Date()): Date[] {
  const start = startOfWeekMonday(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
}

/** True if `iso` falls on the same calendar day as `day`. */
export function isSameDay(iso: string, day: Date): boolean {
  const t = new Date(iso);
  return (
    t.getFullYear() === day.getFullYear() &&
    t.getMonth() === day.getMonth() &&
    t.getDate() === day.getDate()
  );
}

/** "9:00 AM – 5:00 PM" composer for a shift. */
export function shiftTimeRange(s: Shift): string {
  return `${formatClock(s.starts_at)} – ${formatClock(s.ends_at)}`;
}

/** True if `now` is inside the planned window (used for "should be clocked in" warnings). */
export function isInPlannedWindow(s: Shift, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= new Date(s.starts_at).getTime() && t <= new Date(s.ends_at).getTime();
}

// ============================================================
// v2 helpers — overlap, weekly hours, recurrence, overnight
// ============================================================

/** True if two ISO time ranges overlap (open intervals — a shift ending exactly when another starts is fine). */
export function rangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

/** Returns conflicting shifts (other than `ignoreId`) for the same user that overlap [starts_at, ends_at]. */
export function findOverlaps(
  shifts: Shift[],
  userId: string,
  starts_at: string,
  ends_at: string,
  ignoreId?: string,
): Shift[] {
  return shifts.filter(
    (s) =>
      s.user_supa_id === userId &&
      s.id !== ignoreId &&
      s.status !== "cancelled" &&
      rangesOverlap(s.starts_at, s.ends_at, starts_at, ends_at),
  );
}

/** Rolls up planned hours per user across the given shifts. */
export function weekHoursByUser(shifts: Shift[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of shifts) {
    if (s.status === "cancelled") continue;
    out.set(s.user_supa_id, (out.get(s.user_supa_id) ?? 0) + shiftHours(s));
  }
  return out;
}

/**
 * If a shift's window spans midnight, return one segment per calendar
 * day it touches. Each segment keeps the original id but adds a
 * `_segmentIndex` and `_segmentCount` for the renderer.
 *
 * Single-day shifts return [s] unchanged so callers can flat-map every
 * shift through this function unconditionally.
 */
export interface ShiftSegment extends Shift {
  _segmentIndex: number;
  _segmentCount: number;
  _segmentStart: string;
  _segmentEnd: string;
}

export function splitAcrossMidnight(s: Shift): ShiftSegment[] {
  const start = new Date(s.starts_at);
  const end = new Date(s.ends_at);

  // Same calendar day → no split needed.
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return [{
      ...s,
      _segmentIndex: 0,
      _segmentCount: 1,
      _segmentStart: s.starts_at,
      _segmentEnd: s.ends_at,
    }];
  }

  const segments: ShiftSegment[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    // End-of-day for the cursor's calendar day.
    const eod = new Date(cursor);
    eod.setHours(23, 59, 59, 999);
    const segEnd = eod < end ? eod : end;
    segments.push({
      ...s,
      _segmentIndex: segments.length,
      _segmentCount: -1, // patched after loop
      _segmentStart: cursor.toISOString(),
      _segmentEnd: segEnd.toISOString(),
    });
    // Advance to start of next day.
    const nextDay = new Date(cursor);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    cursor = nextDay;
  }

  for (const seg of segments) seg._segmentCount = segments.length;
  return segments;
}

/**
 * Expand a recurring master row into virtual instances that overlap
 * [rangeStart, rangeEnd]. The original row's date is taken as the
 * pattern anchor; each instance keeps the same wall-clock window but
 * shifted onto matching days. Generated instances inherit a synthetic
 * id of the form "<masterId>::<yyyy-mm-dd>" so React keys stay stable.
 */
export function expandRecurrence(
  master: Shift,
  rangeStart: Date,
  rangeEnd: Date,
): Shift[] {
  if (!master.recurrence) return [master];
  const { freq, days_of_week = [], interval = 1 } = master.recurrence;
  if (interval < 1) return [master];

  const anchorStart = new Date(master.starts_at);
  const anchorEnd = new Date(master.ends_at);
  const durationMs = anchorEnd.getTime() - anchorStart.getTime();

  // Cap expansion at the recurrence_until date if present.
  const hardEnd = master.recurrence_until
    ? new Date(master.recurrence_until + "T23:59:59")
    : rangeEnd;
  const effectiveEnd = hardEnd < rangeEnd ? hardEnd : rangeEnd;

  // Start walking from the earlier of (anchor day) or (rangeStart day) so
  // an instance whose week-anchor lives in the past still shows up.
  const walk = new Date(rangeStart);
  walk.setHours(0, 0, 0, 0);
  if (anchorStart > walk) walk.setTime(anchorStart.getTime());
  walk.setHours(0, 0, 0, 0);

  const out: Shift[] = [];
  const MAX_ITERATIONS = 366; // hard cap so a malformed rule can't hang the UI
  let iter = 0;

  while (walk <= effectiveEnd && iter < MAX_ITERATIONS) {
    iter++;
    let match = false;
    if (freq === "daily") {
      // Days-of-week filter is optional for daily.
      match =
        days_of_week.length === 0 || days_of_week.includes(walk.getDay());
    } else if (freq === "weekly") {
      // Weekly with no days → use the master's anchor weekday.
      const targetDays =
        days_of_week.length > 0 ? days_of_week : [anchorStart.getDay()];
      match = targetDays.includes(walk.getDay());
      // Interval check: count whole weeks since anchor's Monday.
      if (match && interval > 1) {
        const weekDiff = Math.floor(
          (walk.getTime() - startOfWeekMonday(anchorStart).getTime()) /
            (7 * 86400_000),
        );
        match = weekDiff >= 0 && weekDiff % interval === 0;
      }
    }

    if (match) {
      const instanceStart = new Date(walk);
      instanceStart.setHours(
        anchorStart.getHours(),
        anchorStart.getMinutes(),
        0,
        0,
      );
      const instanceEnd = new Date(instanceStart.getTime() + durationMs);

      // Don't emit the master row again (instances live at different dates
      // than the anchor, except when the anchor itself matches the rule).
      const isAnchor =
        instanceStart.getTime() === anchorStart.getTime();
      if (isAnchor) {
        out.push(master);
      } else if (instanceEnd >= rangeStart) {
        const dateKey = instanceStart.toISOString().split("T")[0]!;
        out.push({
          ...master,
          id: `${master.id}::${dateKey}`,
          starts_at: instanceStart.toISOString(),
          ends_at: instanceEnd.toISOString(),
          recurrence_parent_id: master.id,
          // Virtual instances are never themselves clocked.
          clock_in: null,
          clock_out: null,
          status: "scheduled",
        });
      }
    }
    walk.setDate(walk.getDate() + 1);
  }

  return out;
}

/** True if this Shift is a virtual instance generated by expandRecurrence. */
export function isVirtualInstance(s: Shift): boolean {
  return typeof s.id === "string" && s.id.includes("::");
}

/** Pull the master id off either a virtual instance or a real row. */
export function masterIdOf(s: Shift): string {
  if (isVirtualInstance(s)) return s.id.split("::")[0]!;
  return s.recurrence_parent_id ?? s.id;
}
