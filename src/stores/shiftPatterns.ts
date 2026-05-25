/**
 * shiftPatterns.ts — Pure helpers for detecting "regular schedule"
 * patterns from a user's recent shifts.
 *
 * A pattern is a (user, weekday, startHH:mm, endHH:mm) triple that has
 * fired in most of the last N weeks. The SuggestPatternsBanner uses
 * this to nudge the operator: "you've worked Mon–Fri 9-5 in 4 of the
 * last 4 weeks; apply that to this week?"
 *
 * Pure functions only — no Supabase, no React. The detector takes an
 * array of shifts and returns the patterns it sees. The applier turns
 * a pattern + week_start into an array of ShiftCreate payloads.
 */

import type { Shift, ShiftCreate, ShiftType } from "./shiftTypes";

export interface DetectedPattern {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  /** HH:mm 24-hour format. */
  start: string;
  end: string;
  /** Distinct weeks the pattern appears in within the lookback window. */
  occurrences: number;
  /** How many weeks of lookback the count is relative to. */
  totalWeeks: number;
  /** Per-user — patterns are detected separately for each user. */
  userSupaId: string;
  username: string;
}

interface DetectOpts {
  lookbackWeeks?: number;
  minOccurrences?: number;
  /** Restrict detection to one user. */
  userSupaId?: string;
}

/**
 * Scan an array of shifts and return stable patterns per user.
 *
 * Algorithm:
 *  1. Bucket each shift by (user, dow, startHHmm, endHHmm)
 *  2. Count distinct weeks each bucket appears in (so two shifts in
 *     the same week count once)
 *  3. Keep buckets where occurrences >= minOccurrences
 *  4. Sort: highest occurrence first, then by weekday
 *
 * Recurrence-generated virtual instances and cancelled shifts are
 * skipped — we only learn from concrete history.
 */
export function detectPatterns(shifts: Shift[], opts: DetectOpts = {}): DetectedPattern[] {
  const lookbackWeeks = opts.lookbackWeeks ?? 4;
  const minOccurrences = opts.minOccurrences ?? Math.max(2, lookbackWeeks - 1);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackWeeks * 7);

  type Bucket = {
    dow: number; start: string; end: string;
    userSupaId: string; username: string;
    weeks: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const s of shifts) {
    if (s.status === "cancelled") continue;
    if (s.recurrence_parent_id) continue;           // skip virtual instances
    if (opts.userSupaId && s.user_supa_id !== opts.userSupaId) continue;
    const start = new Date(s.starts_at);
    if (start < cutoff) continue;
    const end = new Date(s.ends_at);

    const dow = start.getDay();
    const startHHmm = `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`;
    const endHHmm   = `${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}`;
    const key = `${s.user_supa_id}|${dow}|${startHHmm}|${endHHmm}`;

    // Week-stamp: the Monday of the week containing the shift's start.
    const weekStart = new Date(start);
    const delta = weekStart.getDay() === 0 ? -6 : 1 - weekStart.getDay();
    weekStart.setDate(weekStart.getDate() + delta);
    const weekKey = weekStart.toISOString().split("T")[0]!;

    let b = buckets.get(key);
    if (!b) {
      b = { dow, start: startHHmm, end: endHHmm, userSupaId: s.user_supa_id, username: s.username, weeks: new Set() };
      buckets.set(key, b);
    }
    b.weeks.add(weekKey);
  }

  return Array.from(buckets.values())
    .filter((b) => b.weeks.size >= minOccurrences)
    .map((b) => ({
      dow: b.dow,
      start: b.start,
      end: b.end,
      occurrences: b.weeks.size,
      totalWeeks: lookbackWeeks,
      userSupaId: b.userSupaId,
      username: b.username,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.dow - b.dow || a.start.localeCompare(b.start));
}

/**
 * Group detected patterns by user — handy for rendering one card per
 * teammate when multiple are surfaced.
 */
export function groupPatternsByUser(patterns: DetectedPattern[]): Map<string, DetectedPattern[]> {
  const out = new Map<string, DetectedPattern[]>();
  for (const p of patterns) {
    const arr = out.get(p.userSupaId) ?? [];
    arr.push(p);
    out.set(p.userSupaId, arr);
  }
  return out;
}

/**
 * Materialize a per-user pattern set into ShiftCreate payloads aligned
 * to a target week (anchored on the Monday).
 *
 * Skips days that already have at least one non-cancelled shift for
 * that user in `existing`, so re-applying after a partial week doesn't
 * double-book.
 */
export function patternsToShifts(
  patterns: DetectedPattern[],
  weekStart: Date,
  existing: Shift[],
  opts: { type?: ShiftType; company?: string } = {},
): ShiftCreate[] {
  if (patterns.length === 0) return [];
  const monday = new Date(weekStart);
  monday.setHours(0, 0, 0, 0);

  // Build a Set of "userId:dow" combos already covered.
  const coveredKeys = new Set<string>();
  for (const s of existing) {
    if (s.status === "cancelled") continue;
    const d = new Date(s.starts_at);
    coveredKeys.add(`${s.user_supa_id}:${d.getDay()}`);
  }

  const out: ShiftCreate[] = [];
  for (const p of patterns) {
    if (coveredKeys.has(`${p.userSupaId}:${p.dow}`)) continue;
    const day = new Date(monday);
    day.setDate(monday.getDate() + ((p.dow - 1 + 7) % 7));
    const dateStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);
    const starts = new Date(day);
    starts.setHours(sh!, sm!, 0, 0);
    const ends = new Date(day);
    ends.setHours(eh!, em!, 0, 0);
    out.push({
      user_supa_id: p.userSupaId,
      username: p.username,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      type: opts.type ?? "shift",
      company: opts.company,
      status: "scheduled",
    });
  }
  return out;
}

/**
 * Render a one-line human summary of a pattern set ("Mon–Fri 9:00–17:00").
 * Used by the banner subtitle. Falls back gracefully if patterns aren't
 * contiguous or have varying times.
 */
export function describePatternSet(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) return "";
  // Group by (start,end) so we can collapse "9-5 every weekday" runs.
  const byTime = new Map<string, DetectedPattern[]>();
  for (const p of patterns) {
    const key = `${p.start}-${p.end}`;
    const arr = byTime.get(key) ?? [];
    arr.push(p);
    byTime.set(key, arr);
  }
  const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const segments: string[] = [];
  for (const [time, group] of byTime.entries()) {
    const dows = group.map((g) => g.dow).sort();
    // Detect contiguous weekday run for prettier output.
    const isContiguous = dows.every((d, i) => i === 0 || d === dows[i-1]! + 1);
    const dayLabel = isContiguous && dows.length > 1
      ? `${dayName[dows[0]!]}–${dayName[dows[dows.length-1]!]}`
      : dows.map((d) => dayName[d]).join(", ");
    segments.push(`${dayLabel} ${time}`);
  }
  return segments.join(" · ");
}
