// ───────────────────────────────────────────────────────────────────
// Meeting actions — create, list, cancel against cwa_meetings.
//
// `create_meeting` supports optional recurrence: when `recurrence` is
// set we expand into N distinct rows (one per occurrence) rather than
// modifying the schema, capped at MAX_OCCURRENCES as a safety valve.
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { registerUndoHandler } from "../engine/undoStack";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

/** Hard cap on the number of occurrences a single `create_meeting` call
 *  can materialize. Prevents accidental spam when the operator forgets
 *  to pass `endDate` or `occurrences`. */
const MAX_OCCURRENCES = 52;

type Recurrence = "daily" | "weekly" | "biweekly" | "monthly";

/** Advance an ISO date (`YYYY-MM-DD`) by one recurrence step. */
function advanceByRecurrence(isoDate: string, recurrence: Recurrence): string {
  const d = new Date(isoDate + "T00:00:00");
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/** Build the list of occurrence dates given a start date, recurrence,
 *  and either an end date or a count. */
function buildOccurrenceDates(
  startIso: string,
  recurrence: Recurrence,
  endIso?: string,
  occurrences?: number,
): string[] {
  const target = Math.min(occurrences ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const dates: string[] = [startIso];
  let cursor = startIso;
  while (dates.length < target) {
    const next = advanceByRecurrence(cursor, recurrence);
    if (endIso && next > endIso) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

// ─── Undo handler for recurring meetings ─────────────────────────
// Deletes a whole batch by the ids we captured at creation time.

registerUndoHandler<{ ids: number[]; title: string }>(
  "meeting.delete-batch",
  async ({ ids, title }) => {
    if (!ids.length) return `No meetings to cancel.`;
    const { error } = await supabase
      .from("cwa_meetings")
      .delete()
      .in("id", ids);
    if (error) throw new Error(error.message);
    return `Cancelled ${ids.length} occurrence${ids.length === 1 ? "" : "s"} of "${title}".`;
  },
);

/** Parse a natural-language date phrase. Returns ISO YYYY-MM-DD or null. */
function parseDatePhrase(phrase?: string): string | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().trim();
  const today = new Date();

  if (p === "today") return today.toISOString().slice(0, 10);
  if (p === "tomorrow") {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = weekdays.findIndex((d) => p === d || p === `this ${d}` || p === `next ${d}`);
  if (wd !== -1) {
    const cur = today.getDay();
    let diff = (wd - cur + 7) % 7;
    if (diff === 0 || p.startsWith("next")) diff += 7;
    const t = new Date(today);
    t.setDate(t.getDate() + diff);
    return t.toISOString().slice(0, 10);
  }

  // Try ISO / standard parse
  const parsed = new Date(phrase);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseTimePhrase(phrase?: string): string | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().trim();
  // "3pm", "3:30pm", "15:00"
  const ampm = p.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? "0");
    if (ampm[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (ampm[3].toLowerCase() === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const hm = p.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    return `${String(Number(hm[1])).padStart(2, "0")}:${hm[2]}`;
  }
  return null;
}

// ── Create meeting ─────────────────────────────────────────────────

export const createMeetingAction: AxonAction<
  {
    title: string;
    date?: string;
    time?: string;
    attendees?: number;
    type?: "online" | "in-person" | "hybrid";
    location?: string;
    url?: string;
    company?: "CodeWithAli" | "simplicity";
    /** Optional recurrence. When set, schedules multiple occurrences. */
    recurrence?: Recurrence;
    /** Optional end date for recurrence. ISO YYYY-MM-DD. Capped at
     *  MAX_OCCURRENCES from the start date. */
    endDate?: string;
    /** Optional explicit occurrence count. Overrides endDate if given.
     *  Capped at MAX_OCCURRENCES. */
    occurrences?: number;
  },
  { id: number | null; ids?: number[] }
> = {
  name: "create_meeting",
  description:
    "Schedule a new meeting. Accepts natural phrases for date ('Friday', 'tomorrow') and time ('3pm', '15:00'). Defaults to the active company. Pass `recurrence` (daily/weekly/biweekly/monthly) plus either `endDate` or `occurrences` to schedule a recurring series — capped at 52 occurrences per call.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      date: { type: "string", description: "ISO date or natural phrase." },
      time: { type: "string", description: "Like '3pm' or '15:00'." },
      attendees: { type: "number" },
      type: { type: "string", enum: ["online", "in-person", "hybrid"] },
      location: { type: "string" },
      url: { type: "string", description: "Meeting URL for online/hybrid." },
      company: { type: "string", enum: ["CodeWithAli", "simplicity"] },
      recurrence: {
        type: "string",
        enum: ["daily", "weekly", "biweekly", "monthly"],
        description:
          "Optional — repeat this meeting on the given cadence. Must also provide endDate or occurrences.",
      },
      endDate: {
        type: "string",
        description:
          "Optional recurrence end date (ISO YYYY-MM-DD). Ignored if `recurrence` is unset.",
      },
      occurrences: {
        type: "number",
        description:
          "Optional explicit occurrence count (cap 52). Takes precedence over endDate.",
      },
    },
    required: ["title"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const dateIso =
      parseDatePhrase(input.date) ?? new Date().toISOString().slice(0, 10);
    const timeIso = parseTimePhrase(input.time);

    // Build a single-row template; recurrence just stamps date field N times.
    const rowTemplate: Record<string, unknown> = {
      meeting_title: input.title,
      time: timeIso,
      attendees: input.attendees ?? 1,
      meeting_type: input.type ?? "online",
      company: input.company ?? companyLabel(ctx.activeCompany),
    };
    if (input.type === "in-person" || input.type === "hybrid") {
      rowTemplate.location = input.location ?? "";
    }
    if ((input.type === "online" || input.type === "hybrid") && input.url) {
      rowTemplate.hybrid_location = {
        address: input.location ?? "",
        url: input.url,
      };
    }

    // Materialize dates. No recurrence => single-row behavior (unchanged).
    const endIso = input.endDate
      ? parseDatePhrase(input.endDate) ?? input.endDate
      : undefined;
    const dates = input.recurrence
      ? buildOccurrenceDates(
          dateIso,
          input.recurrence,
          endIso ?? undefined,
          input.occurrences,
        )
      : [dateIso];

    const rows = dates.map((d) => ({ ...rowTemplate, date: d }));
    const when = timeIso ? `${dateIso} at ${timeIso}` : dateIso;

    // Friendly summary describes the whole series, not just the first date.
    const seriesLabel = input.recurrence
      ? ` (${input.recurrence}, ${dates.length} occurrence${dates.length === 1 ? "" : "s"})`
      : "";

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would schedule "${input.title}" for ${when}${seriesLabel}.`,
        data: { id: null },
      };
    }

    const { data, error } = await supabase
      .from("cwa_meetings")
      .insert(rows)
      .select();
    if (error) {
      return { summary: `Couldn't save that meeting. ${error.message}` };
    }

    const insertedIds = (data ?? [])
      .map((r: any) => r?.id)
      .filter((v: any): v is number => typeof v === "number");

    // Register undo — single descriptor that covers the full batch.
    if (insertedIds.length) {
      ctx.pushUndo({
        actionName: "create_meeting",
        label:
          insertedIds.length === 1
            ? `scheduling of "${input.title}"`
            : `${insertedIds.length}-occurrence series "${input.title}"`,
        descriptor: {
          kind: "meeting.delete-batch",
          payload: { ids: insertedIds, title: input.title },
        },
      });
    }

    ctx.logActivity({
      actionName: "create_meeting",
      params: input as Record<string, unknown>,
      summary: `Scheduled "${input.title}" for ${when}${seriesLabel}`,
      result: { rows: insertedIds.length, ids: insertedIds },
    });
    return {
      summary: `Scheduled "${input.title}" for ${when}${seriesLabel}.`,
      data: {
        id: insertedIds[0] ?? null,
        ids: insertedIds,
      },
    };
  },
};

export function registerMeetingActions() {
  registerAction(createMeetingAction);
}
