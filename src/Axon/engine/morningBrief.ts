// ───────────────────────────────────────────────────────────────────
// Morning brief composer.
//
// Lightweight, deterministic summary fired through proactiveChannel
// at the first signed-in launch of each local day. Deliberately
// templated (not a Claude call) so it's cheap, fast, and doesn't risk
// hallucination. If we ever want LLM-varied phrasing for the morning
// brief, swap in draftOperationsBrief.ts -- the call site in
// AxonProvider stays the same.
//
// Composition rules:
//   - 1 to 2 sentences max. Spoken via TTS; long briefs are tuned out.
//   - Time-of-day greeting feels human ("morning, afternoon" rather
//     than a robotic "Good day, sir").
//   - Lead with what's next on the calendar (most actionable).
//   - Quiet days get a quiet brief -- we never manufacture urgency.
//     "Nothing urgent on the calendar -- have a good one." is fine.
//   - We DO NOT mention overdue task counts. (See Polish A.) The
//     operator explicitly turned that nag off.
//   - We DO NOT mention investor pipeline weather or runway here --
//     those have their own monitors with their own dedupe. The
//     morning brief is calendar + day shape only.
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { CompanyFilter } from "@/stores/store";

function companyLabel(active: CompanyFilter): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

function greetingForHour(h: number): string {
  if (h < 5) return "Late night, but morning brief";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

// Parse free-text meeting time strings into a Date on the given day.
// Mirrors the parser in monitors.ts/meetings-soon -- centralizing
// later if we add a third use site.
function parseMeetingTime(
  dateStr: string,
  timeStr: string | undefined,
): Date | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toLowerCase();
  let m = cleaned.match(/^(\d{1,2}):(\d{2})\s*$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const d = new Date(dateStr);
    d.setHours(h, mm, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (m[3].toLowerCase() === "am" && h === 12) h = 0;
    const d = new Date(dateStr);
    d.setHours(h, mm, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12} ${ampm}`
    : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export interface MorningBriefInput {
  /** Operator's first name (or shortened username), for the greeting. */
  operatorName?: string;
  /** Active company filter -- scopes the calendar lookup. */
  active: CompanyFilter;
}

/**
 * Compose the morning brief line. Returns null when we don't have
 * enough signal to say something useful (rare -- usually we can at
 * least greet by time of day).
 */
export async function composeMorningBrief(
  input: MorningBriefInput,
): Promise<string | null> {
  const now = new Date();
  const hour = now.getHours();
  const greeting = greetingForHour(hour);
  const todayIso = now.toISOString().slice(0, 10);

  // Today's meetings.
  let q = takeOversupabase
    .from("cwa_meetings")
    .select("id, meeting_title, time, date, meeting_type, location")
    .eq("date", todayIso)
    .limit(20);
  if (input.active !== "all") q = q.eq("company", companyLabel(input.active));
  const { data: meetings } = await q;

  // Categorize today's meetings by "still upcoming" relative to now.
  const upcoming: Array<{ title: string; start: Date; type?: string }> = [];
  for (const m of (meetings ?? []) as any[]) {
    const start = parseMeetingTime(m.date, m.time);
    if (!start) continue;
    if (start.getTime() < now.getTime()) continue;
    upcoming.push({
      title: m.meeting_title || "untitled meeting",
      start,
      type: m.meeting_type,
    });
  }
  upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Compose the brief.
  const namePart = input.operatorName ? `, ${input.operatorName}` : "";

  if (upcoming.length === 0) {
    return `${greeting}${namePart}. Calendar's clear today.`;
  }

  const next = upcoming[0];
  const total = upcoming.length;

  // 1 meeting -- lead with it.
  if (total === 1) {
    return `${greeting}${namePart}. You've got ${next.title} at ${formatClock(next.start)}, and nothing else on the calendar.`;
  }

  // 2 meetings -- name both inline.
  if (total === 2) {
    const second = upcoming[1];
    return `${greeting}${namePart}. ${next.title} at ${formatClock(next.start)}, then ${second.title} at ${formatClock(second.start)}.`;
  }

  // 3+ meetings -- lead with the first, count the rest.
  return `${greeting}${namePart}. ${next.title} at ${formatClock(next.start)} is up first, ${total - 1} more on the calendar after that.`;
}

// ── Dedupe key helpers ──────────────────────────────────────────────
//
// The morning brief fires AT MOST ONCE per local day. localStorage
// holds the date string we last fired on; the caller compares to
// today's date and skips if they match.

const STORE_KEY = "axon:proactive:morning_brief:lastFiredDay";

export function loadLastMorningBriefDay(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

export function saveMorningBriefFired(today: string): void {
  try {
    window.localStorage.setItem(STORE_KEY, today);
  } catch {
    /* private mode / quota -- the brief will fire again next launch */
  }
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}
