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

  created_by: string | null;
  created_at: string;
  updated_at: string;
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
