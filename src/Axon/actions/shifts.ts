// ───────────────────────────────────────────────────────────────────
// Shift actions — voice control over the unified timesheet.
//
// "Axon, put Mason on Tuesday 9 to 5"
//   → create_shift { user_query: "Mason", date: "2026-05-26", start: "09:00", end: "17:00" }
//
// "Axon, schedule me Monday through Friday 9 to 5 every week"
//   → create_shift { user_query: "me", date: "...", start, end, recurrence: {...} }
//
// "Axon, clock me in"  → clock_in {}
// "Axon, clock me out" → clock_out {}
// "Who's on shift today?" → list_shifts { date: "today" }
// "Mark my shift as needing cover" → request_coverage {}
//
// All these actions follow the standard input_schema contract: Claude
// converts the operator's free-text utterance into structured args
// (resolving "tomorrow" → ISO date, "Mason" → username string, etc.)
// before this code runs.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import supabase from "@/MyComponents/supabase";

const TABLE = "shifts";

// ── Shared types ──────────────────────────────────────────────────

type ShiftTypeName = "shift" | "meeting" | "break" | "training" | "off";

interface ResolvedUser {
  supa_id: string;
  username: string;
}

/**
 * Resolve a free-text "who" string into a real app_users row.
 * Accepts: "me" / "myself" → current operator
 *          a username (case-insensitive)
 *          a supa_id (UUID)
 * Returns null if no match.
 */
async function resolveUser(
  query: string | null | undefined,
  operatorSupaId: string,
  operatorUsername: string,
): Promise<ResolvedUser | null> {
  const q = (query ?? "").trim();
  if (!q || /^(me|myself|i)$/i.test(q)) {
    return { supa_id: operatorSupaId, username: operatorUsername };
  }
  // UUID?
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
    const { data } = await supabase
      .from("app_users")
      .select("supa_id, username")
      .eq("supa_id", q)
      .maybeSingle();
    if (data) return { supa_id: data.supa_id, username: data.username };
  }
  // Username (case-insensitive, exact match first)
  const { data: exact } = await supabase
    .from("app_users")
    .select("supa_id, username")
    .ilike("username", q)
    .maybeSingle();
  if (exact) return { supa_id: exact.supa_id, username: exact.username };
  // Fuzzy fallback — first prefix match.
  const { data: prefix } = await supabase
    .from("app_users")
    .select("supa_id, username")
    .ilike("username", `${q}%`)
    .limit(1);
  if (prefix && prefix[0]) return { supa_id: prefix[0].supa_id, username: prefix[0].username };
  return null;
}

/**
 * Combine YYYY-MM-DD + HH:mm in LOCAL time into an ISO timestamp.
 * (Axon hands us local wall-clock strings; the DB stores UTC.)
 */
function combineLocal(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}

function companyLabelFor(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// ──────────────────────────────────────────────────────────────────
// create_shift
// ──────────────────────────────────────────────────────────────────

interface CreateShiftInput {
  user_query?: string;            // "me", "Mason", or supa_id; defaults to operator
  date: string;                   // YYYY-MM-DD
  start_time: string;             // HH:mm (24h)
  end_time: string;               // HH:mm (24h)
  type?: ShiftTypeName;
  title?: string;
  notes?: string;
  location?: string;
  recurrence?: {
    freq: "daily" | "weekly";
    days_of_week?: number[];      // 0=Sun..6=Sat
    interval?: number;
  } | null;
  recurrence_until?: string | null;  // YYYY-MM-DD
}

export const createShiftAction: AxonAction<
  CreateShiftInput,
  { shift_id: string; username: string }
> = {
  name: "create_shift",
  description:
    "Schedule a shift on the unified timesheet. Use whenever the operator wants to plan work time for themselves or a teammate. Phrases include: 'put Mason on Tuesday 9 to 5', 'schedule me Monday 8 AM until noon', 'block off Friday morning for training', 'add a meeting for Sem tomorrow at 2 PM', 'put Ali on every Monday through Friday 9 to 5 starting next week'. The user_query field accepts 'me'/'myself' for the operator, a teammate's username, or a supa_id UUID. Always extract a specific date (resolve 'tomorrow', 'next Monday', etc.) and 24h start/end times before calling.",
  input_schema: {
    type: "object",
    properties: {
      user_query: {
        type: "string",
        description: "Who the shift is for. Use 'me' for the operator themselves, otherwise a username like 'Mason' or 'Sem'.",
      },
      date: {
        type: "string",
        description: "YYYY-MM-DD of the shift's first instance. Resolve relative dates like 'tomorrow' to an absolute date.",
      },
      start_time: {
        type: "string",
        description: "Start time in 24-hour HH:mm format (e.g. '09:00', '13:30').",
      },
      end_time: {
        type: "string",
        description: "End time in 24-hour HH:mm format. Must be after start_time.",
      },
      type: {
        type: "string",
        enum: ["shift", "meeting", "break", "training", "off"],
        description: "Category of the time block. Defaults to 'shift' for regular work.",
      },
      title: {
        type: "string",
        description: "Short label for the shift. Optional.",
      },
      notes: {
        type: "string",
        description: "Anything else worth recording. Optional.",
      },
      location: {
        type: "string",
        description: "Where the shift happens — office, remote, client site, etc. Optional.",
      },
      recurrence: {
        type: "object",
        description: "Repeat rule. Omit for one-off shifts. Use freq:'weekly' with days_of_week:[1,2,3,4,5] for weekday recurring; days_of_week omitted means 'same weekday as the date'.",
        properties: {
          freq: { type: "string", enum: ["daily", "weekly"] },
          days_of_week: {
            type: "array",
            items: { type: "integer", minimum: 0, maximum: 6 },
            description: "0=Sunday, 1=Monday, ..., 6=Saturday. Use [1,2,3,4,5] for weekdays.",
          },
          interval: { type: "integer", minimum: 1, description: "Every Nth week/day. Defaults to 1." },
        },
        required: ["freq"],
      },
      recurrence_until: {
        type: "string",
        description: "YYYY-MM-DD inclusive end date for the recurrence. Omit for open-ended.",
      },
    },
    required: ["date", "start_time", "end_time"],
  },
  mutating: true,
  requiresConfirmation: false,
  handler: async (input, ctx) => {
    const target = await resolveUser(input.user_query, ctx.operator.supa_id, ctx.operator.username);
    if (!target) {
      return { summary: `I couldn't find anyone named "${input.user_query}".` };
    }
    if (input.start_time >= input.end_time) {
      return { summary: "End time has to be after start time. Want to try again?" };
    }

    if (ctx.dryRun) {
      return {
        summary: `Dry-run: would schedule ${target.username} on ${input.date} from ${input.start_time} to ${input.end_time}.`,
      };
    }

    const starts_at = combineLocal(input.date, input.start_time);
    const ends_at = combineLocal(input.date, input.end_time);
    const company = companyLabelFor(String(ctx.activeCompany));

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_supa_id: target.supa_id,
        username: target.username,
        starts_at,
        ends_at,
        type: input.type ?? "shift",
        title: input.title ?? null,
        notes: input.notes ?? null,
        location: input.location ?? null,
        recurrence: input.recurrence ?? null,
        recurrence_until: input.recurrence_until ?? null,
        status: "scheduled",
        is_billable: true,
        company,
        created_by: ctx.operator.supa_id,
      })
      .select("id")
      .single();

    if (error) {
      return { summary: `Couldn't save that shift — ${error.message}` };
    }

    const recurrenceBlurb = input.recurrence
      ? input.recurrence.freq === "daily"
        ? " (repeats daily)"
        : input.recurrence.days_of_week && input.recurrence.days_of_week.length > 0
          ? ` (repeats weekly on ${input.recurrence.days_of_week.length} day${input.recurrence.days_of_week.length === 1 ? "" : "s"})`
          : " (repeats weekly)"
      : "";
    const summary = `Scheduled ${target.username} on ${input.date} from ${input.start_time} to ${input.end_time}${recurrenceBlurb}.`;
    ctx.speak(`Done — ${target.username === ctx.operator.username ? "you're" : target.username + " is"} on the schedule${recurrenceBlurb}.`);
    ctx.logActivity({ actionName: "create_shift", params: input as any, summary });
    ctx.pushUndo({
      label: `Undo: scheduled ${target.username}`,
      undo: async () => {
        await supabase.from(TABLE).delete().eq("id", data!.id);
      },
    } as any);
    return { summary, data: { shift_id: data!.id, username: target.username } };
  },
};

// ──────────────────────────────────────────────────────────────────
// list_shifts
// ──────────────────────────────────────────────────────────────────

interface ListShiftsInput {
  user_query?: string;            // optional filter; default = all
  from_date?: string;             // YYYY-MM-DD
  to_date?: string;
  status?: "scheduled" | "in_progress" | "completed" | "no_show" | "cancelled";
  limit?: number;
}

export const listShiftsAction: AxonAction<
  ListShiftsInput,
  { count: number }
> = {
  name: "list_shifts",
  description:
    "List shifts matching optional filters. Use for questions like 'who's on shift today?', 'what's Mason scheduled for this week?', 'show me my next three shifts'. Return summary is human-readable.",
  input_schema: {
    type: "object",
    properties: {
      user_query: { type: "string", description: "'me' or a username. Omit to see everyone." },
      from_date: { type: "string", description: "YYYY-MM-DD lower bound (inclusive). Omit for today." },
      to_date:   { type: "string", description: "YYYY-MM-DD upper bound (inclusive). Omit for from_date + 7 days." },
      status:    { type: "string", enum: ["scheduled","in_progress","completed","no_show","cancelled"] },
      limit:     { type: "integer", minimum: 1, maximum: 50 },
    },
  },
  mutating: false,
  handler: async (input, ctx) => {
    let userFilter: ResolvedUser | null = null;
    if (input.user_query) {
      userFilter = await resolveUser(input.user_query, ctx.operator.supa_id, ctx.operator.username);
      if (!userFilter) return { summary: `No one named "${input.user_query}" on the team.` };
    }

    const today = new Date();
    const fromIso = input.from_date
      ? combineLocal(input.from_date, "00:00")
      : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0).toISOString();
    const toDate = input.to_date ? new Date(input.to_date + "T23:59:59") : (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);
      return d;
    })();
    const toIso = toDate.toISOString();

    let q = supabase
      .from(TABLE)
      .select("id, username, starts_at, ends_at, status, title, type")
      .lte("starts_at", toIso)
      .gte("ends_at", fromIso)
      .order("starts_at", { ascending: true })
      .limit(input.limit ?? 20);
    if (userFilter) q = q.eq("user_supa_id", userFilter.supa_id);
    if (input.status) q = q.eq("status", input.status);

    const { data, error } = await q;
    if (error) return { summary: `Couldn't read the schedule — ${error.message}` };
    const rows = data ?? [];
    if (rows.length === 0) {
      const who = userFilter ? userFilter.username : "anyone";
      return { summary: `No shifts found for ${who} in that range.` };
    }
    const lines = rows.slice(0, 8).map((r) => {
      const sd = new Date(r.starts_at);
      const ed = new Date(r.ends_at);
      const day = sd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const t = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `· ${r.username} — ${day} ${t(sd)}–${t(ed)}${r.title ? ` (${r.title})` : ""} [${r.status}]`;
    });
    const more = rows.length > 8 ? `\n· …and ${rows.length - 8} more` : "";
    return { summary: `Found ${rows.length} shift${rows.length === 1 ? "" : "s"}:\n${lines.join("\n")}${more}`, data: { count: rows.length } };
  },
};

// ──────────────────────────────────────────────────────────────────
// clock_in / clock_out
// ──────────────────────────────────────────────────────────────────

export const clockInAction: AxonAction<
  Record<string, never>,
  { shift_id: string | null }
> = {
  name: "clock_in",
  description:
    "Clock the operator in to their current or imminent shift. Use phrases like 'clock me in', 'start my shift', 'I'm starting work'. If no scheduled shift is found within 30 min of now, creates an ad-hoc shift starting now.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: false,
  handler: async (_input, ctx) => {
    const userId = ctx.operator.supa_id;
    const username = ctx.operator.username;
    if (ctx.dryRun) return { summary: `Dry-run: would clock you in.` };

    // Look for a scheduled shift within 60 min of now (past or future).
    const now = new Date();
    const winStart = new Date(now.getTime() - 60 * 60_000).toISOString();
    const winEnd   = new Date(now.getTime() + 60 * 60_000).toISOString();
    const { data: candidates } = await supabase
      .from(TABLE)
      .select("id")
      .eq("user_supa_id", userId)
      .eq("status", "scheduled")
      .lte("starts_at", winEnd)
      .gte("ends_at", winStart)
      .order("starts_at", { ascending: true })
      .limit(1);
    const target = candidates?.[0];

    if (target) {
      const { error } = await supabase
        .from(TABLE)
        .update({ clock_in: now.toISOString() })
        .eq("id", target.id);
      if (error) return { summary: `Couldn't clock in — ${error.message}` };
      ctx.speak("You're on the clock.");
      ctx.logActivity({ actionName: "clock_in", params: {}, summary: `Clocked in to scheduled shift ${target.id}.` });
      return { summary: "Clocked in to your scheduled shift.", data: { shift_id: target.id } };
    }

    // No scheduled shift → create ad-hoc.
    const plannedEnd = new Date(Date.now() + 4 * 3600_000).toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_supa_id: userId,
        username,
        starts_at: now.toISOString(),
        ends_at: plannedEnd,
        clock_in: now.toISOString(),
        status: "in_progress",
        type: "shift",
        company: companyLabelFor(String(ctx.activeCompany)),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return { summary: `Couldn't clock in — ${error.message}` };
    ctx.speak("Clocked in. I started a fresh shift since there wasn't one scheduled.");
    ctx.logActivity({ actionName: "clock_in", params: {}, summary: `Created ad-hoc shift ${data!.id}.` });
    return { summary: "Clocked in (ad-hoc shift created).", data: { shift_id: data!.id } };
  },
};

export const clockOutAction: AxonAction<
  Record<string, never>,
  { shift_id: string | null }
> = {
  name: "clock_out",
  description:
    "Clock the operator out of their currently-running shift. Use for 'clock me out', 'end my shift', 'I'm done for the day'.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: false,
  handler: async (_input, ctx) => {
    if (ctx.dryRun) return { summary: `Dry-run: would clock you out.` };
    const userId = ctx.operator.supa_id;
    const { data: active } = await supabase
      .from(TABLE)
      .select("id")
      .eq("user_supa_id", userId)
      .eq("status", "in_progress")
      .order("clock_in", { ascending: false })
      .limit(1);
    const target = active?.[0];
    if (!target) {
      return { summary: "You're not clocked in to anything right now." };
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE)
      .update({ clock_out: now, ends_at: now })
      .eq("id", target.id);
    if (error) return { summary: `Couldn't clock out — ${error.message}` };
    ctx.speak("Clocked out.");
    ctx.logActivity({ actionName: "clock_out", params: {}, summary: `Clocked out of shift ${target.id}.` });
    return { summary: "Clocked out.", data: { shift_id: target.id } };
  },
};

// ──────────────────────────────────────────────────────────────────
// request_coverage — mark "my next shift" (or a specified one) as
// needing cover so the OpenShiftsInbox surfaces it.
// ──────────────────────────────────────────────────────────────────

interface RequestCoverageInput {
  shift_id?: string;             // optional — defaults to operator's next scheduled shift
}

export const requestCoverageAction: AxonAction<
  RequestCoverageInput,
  { shift_id: string }
> = {
  name: "request_coverage",
  description:
    "Mark one of the operator's upcoming shifts as 'needs cover' so teammates can claim it. Use for 'I need someone to cover my shift', 'mark my Tuesday shift open', 'request coverage for tomorrow morning'. If no shift_id given, targets the operator's next scheduled shift.",
  input_schema: {
    type: "object",
    properties: {
      shift_id: { type: "string", description: "UUID of a specific shift. Omit to target the next upcoming scheduled shift." },
    },
  },
  mutating: true,
  requiresConfirmation: false,
  handler: async (input, ctx) => {
    if (ctx.dryRun) return { summary: `Dry-run: would mark your shift as needing cover.` };
    let shiftId = input.shift_id;
    if (!shiftId) {
      const { data } = await supabase
        .from(TABLE)
        .select("id")
        .eq("user_supa_id", ctx.operator.supa_id)
        .eq("status", "scheduled")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1);
      shiftId = data?.[0]?.id;
      if (!shiftId) return { summary: "You don't have any upcoming shifts to request coverage on." };
    }
    const { error } = await supabase
      .from(TABLE)
      .update({
        coverage_requested_at: new Date().toISOString(),
        coverage_requested_by: ctx.operator.supa_id,
      })
      .eq("id", shiftId);
    if (error) return { summary: `Couldn't request coverage — ${error.message}` };
    ctx.speak("Marked as needing cover.");
    ctx.logActivity({ actionName: "request_coverage", params: { shift_id: shiftId }, summary: `Requested coverage on shift ${shiftId}.` });
    return { summary: "Your shift is now open for anyone to claim.", data: { shift_id: shiftId } };
  },
};

// ──────────────────────────────────────────────────────────────────
// claim_open_shift — counterpart to request_coverage.
// ──────────────────────────────────────────────────────────────────

interface ClaimOpenShiftInput {
  shift_id: string;
}

export const claimOpenShiftAction: AxonAction<
  ClaimOpenShiftInput,
  { shift_id: string }
> = {
  name: "claim_open_shift",
  description:
    "Claim an open shift that another teammate has requested coverage for. Reassigns the shift to the operator and clears the coverage flag.",
  input_schema: {
    type: "object",
    properties: {
      shift_id: { type: "string", description: "UUID of the open shift to claim." },
    },
    required: ["shift_id"],
  },
  mutating: true,
  requiresConfirmation: false,
  handler: async ({ shift_id }, ctx) => {
    if (ctx.dryRun) return { summary: `Dry-run: would claim shift ${shift_id}.` };
    const { error } = await supabase
      .from(TABLE)
      .update({
        user_supa_id: ctx.operator.supa_id,
        username: ctx.operator.username,
        coverage_requested_at: null,
        coverage_requested_by: null,
      })
      .eq("id", shift_id);
    if (error) return { summary: `Couldn't claim — ${error.message}` };
    ctx.speak("Claimed.");
    ctx.logActivity({ actionName: "claim_open_shift", params: { shift_id }, summary: `Claimed shift ${shift_id}.` });
    return { summary: "Shift claimed and added to your schedule.", data: { shift_id } };
  },
};

// ──────────────────────────────────────────────────────────────────
// Pattern detection — see ./shifts_patterns.ts for the helpers; here
// we expose them to the LLM. Lives in this file to keep the action
// registration centralized.
// ──────────────────────────────────────────────────────────────────

interface SuggestPatternsInput {
  user_query?: string;            // "me" or username; default = operator
  lookback_weeks?: number;        // default 4
  min_occurrences?: number;       // default 3
}

export const suggestPatternsAction: AxonAction<
  SuggestPatternsInput,
  { patterns: any[] }
> = {
  name: "suggest_patterns",
  description:
    "Detect stable weekly work patterns by looking back over recent shifts. Use for 'what's my usual schedule?', 'do I have a regular pattern?', 'detect Mason's typical week'. Returns a list of recurring (weekday + start + end) buckets that have fired in most of the lookback window.",
  input_schema: {
    type: "object",
    properties: {
      user_query: { type: "string", description: "'me' or a username; defaults to operator." },
      lookback_weeks: { type: "integer", minimum: 1, maximum: 12, description: "How many weeks of history to scan. Defaults to 4." },
      min_occurrences: { type: "integer", minimum: 1, maximum: 12, description: "How many weeks a pattern must fire in to count as stable. Defaults to 3." },
    },
  },
  mutating: false,
  handler: async (input, ctx) => {
    const target = await resolveUser(input.user_query, ctx.operator.supa_id, ctx.operator.username);
    if (!target) return { summary: `No one named "${input.user_query}".` };

    const lookback = input.lookback_weeks ?? 4;
    const minOcc = input.min_occurrences ?? Math.max(2, lookback - 1);

    const since = new Date();
    since.setDate(since.getDate() - lookback * 7);
    const { data, error } = await supabase
      .from(TABLE)
      .select("starts_at, ends_at, user_supa_id, type, status")
      .eq("user_supa_id", target.supa_id)
      .gte("starts_at", since.toISOString())
      .in("status", ["scheduled", "in_progress", "completed"])
      .is("recurrence", null);                    // ignore generated instances
    if (error) return { summary: `Couldn't read history — ${error.message}` };

    // Bucket by (dow, startHHmm, endHHmm).
    const buckets = new Map<string, { dow: number; start: string; end: string; weeks: Set<string> }>();
    for (const row of data ?? []) {
      const s = new Date(row.starts_at);
      const e = new Date(row.ends_at);
      const dow = s.getDay();
      const start = `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`;
      const end = `${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`;
      const key = `${dow}|${start}|${end}`;
      // Week stamp = Monday's ISO date for that shift.
      const weekStart = new Date(s);
      const delta = weekStart.getDay() === 0 ? -6 : 1 - weekStart.getDay();
      weekStart.setDate(weekStart.getDate() + delta);
      const weekKey = weekStart.toISOString().split("T")[0]!;
      let b = buckets.get(key);
      if (!b) {
        b = { dow, start, end, weeks: new Set() };
        buckets.set(key, b);
      }
      b.weeks.add(weekKey);
    }

    const stable = Array.from(buckets.values())
      .filter((b) => b.weeks.size >= minOcc)
      .sort((a, b) => a.dow - b.dow || a.start.localeCompare(b.start))
      .map((b) => ({ dow: b.dow, start: b.start, end: b.end, occurrences: b.weeks.size }));

    if (stable.length === 0) {
      return { summary: `No stable pattern detected for ${target.username} in the last ${lookback} weeks.` };
    }
    const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const lines = stable.map((p) => `· ${dayName[p.dow]} ${p.start}–${p.end} (${p.occurrences}/${lookback} weeks)`);
    return {
      summary: `${target.username}'s stable pattern:\n${lines.join("\n")}`,
      data: { patterns: stable },
    };
  },
};

interface ApplyPatternInput {
  user_query?: string;
  week_start: string;             // YYYY-MM-DD (Monday)
  days: { dow: number; start: string; end: string }[];
  type?: ShiftTypeName;
}

export const applyPatternAction: AxonAction<
  ApplyPatternInput,
  { created: number }
> = {
  name: "apply_pattern",
  description:
    "Apply a pattern (set of weekday + time ranges) to a specific week — bulk-creates the shifts. Use for 'apply my usual schedule to this week', 'fill in next week with Mason's regular pattern'. Often called right after suggest_patterns.",
  input_schema: {
    type: "object",
    properties: {
      user_query: { type: "string", description: "'me' or a username; defaults to operator." },
      week_start: { type: "string", description: "YYYY-MM-DD of the Monday of the target week." },
      days: {
        type: "array",
        description: "List of day/time triples to materialize.",
        items: {
          type: "object",
          properties: {
            dow:   { type: "integer", minimum: 0, maximum: 6 },
            start: { type: "string", description: "HH:mm (24h)" },
            end:   { type: "string", description: "HH:mm (24h)" },
          },
          required: ["dow", "start", "end"],
        },
      },
      type: { type: "string", enum: ["shift","meeting","break","training","off"] },
    },
    required: ["week_start", "days"],
  },
  mutating: true,
  requiresConfirmation: false,
  handler: async (input, ctx) => {
    const target = await resolveUser(input.user_query, ctx.operator.supa_id, ctx.operator.username);
    if (!target) return { summary: `No one named "${input.user_query}".` };
    if (ctx.dryRun) return { summary: `Dry-run: would create ${input.days.length} shifts for ${target.username}.` };

    const weekStart = new Date(input.week_start + "T00:00:00");
    const company = companyLabelFor(String(ctx.activeCompany));
    const rows = input.days.map((d) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + ((d.dow - 1 + 7) % 7));  // Mon-anchored
      return {
        user_supa_id: target.supa_id,
        username: target.username,
        starts_at: combineLocal(day.toISOString().split("T")[0]!, d.start),
        ends_at:   combineLocal(day.toISOString().split("T")[0]!, d.end),
        type: input.type ?? "shift",
        status: "scheduled" as const,
        is_billable: true,
        company,
        created_by: ctx.operator.supa_id,
      };
    });
    const { error, data } = await supabase.from(TABLE).insert(rows).select("id");
    if (error) return { summary: `Couldn't apply the pattern — ${error.message}` };
    const created = data?.length ?? rows.length;
    ctx.speak(`Filled in ${created} shifts.`);
    ctx.logActivity({
      actionName: "apply_pattern",
      params: input as any,
      summary: `Applied pattern to ${target.username} for week of ${input.week_start} (${created} shifts).`,
    });
    return { summary: `Created ${created} shifts for ${target.username}.`, data: { created } };
  },
};

// ──────────────────────────────────────────────────────────────────
// Registration
// ──────────────────────────────────────────────────────────────────

export function registerShiftActions(): void {
  registerAction(createShiftAction);
  registerAction(listShiftsAction);
  registerAction(clockInAction);
  registerAction(clockOutAction);
  registerAction(requestCoverageAction);
  registerAction(claimOpenShiftAction);
  registerAction(suggestPatternsAction);
  registerAction(applyPatternAction);
}
