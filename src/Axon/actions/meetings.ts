// ───────────────────────────────────────────────────────────────────
// Meeting actions — create, list, cancel against cwa_meetings.
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

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
  },
  { id: number | null }
> = {
  name: "create_meeting",
  description:
    "Schedule a new meeting. Accepts natural phrases for date ('Friday', 'tomorrow') and time ('3pm', '15:00'). Defaults to the active company.",
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
    },
    required: ["title"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const dateIso = parseDatePhrase(input.date) ?? new Date().toISOString().slice(0, 10);
    const timeIso = parseTimePhrase(input.time);

    const row: Record<string, unknown> = {
      meeting_title: input.title,
      date: dateIso,
      time: timeIso,
      attendees: input.attendees ?? 1,
      meeting_type: input.type ?? "online",
      company: input.company ?? companyLabel(ctx.activeCompany),
    };
    if (input.type === "in-person" || input.type === "hybrid") {
      row.location = input.location ?? "";
    }
    if ((input.type === "online" || input.type === "hybrid") && input.url) {
      row.hybrid_location = { address: input.location ?? "", url: input.url };
    }

    const when = timeIso ? `${dateIso} at ${timeIso}` : dateIso;

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would schedule "${input.title}" for ${when}.`,
        data: { id: null },
      };
    }

    const { data, error } = await supabase.from("cwa_meetings").insert(row).select().single();
    if (error) {
      return { summary: `Couldn't save that meeting. ${error.message}` };
    }

    // Register undo.
    if (data?.id) {
      const deleteId = data.id;
      const title = input.title;
      ctx.pushUndo({
        actionName: "create_meeting",
        label: `scheduling of "${title}"`,
        undo: async () => {
          const { error: e2 } = await supabase
            .from("cwa_meetings")
            .delete()
            .eq("id", deleteId);
          if (e2) throw new Error(e2.message);
          return `Cancelled meeting "${title}".`;
        },
      });
    }

    ctx.logActivity({
      actionName: "create_meeting",
      params: input as Record<string, unknown>,
      summary: `Scheduled "${input.title}" for ${when}`,
      result: data,
    });
    return {
      summary: `Scheduled "${input.title}" for ${when}.`,
      data: { id: data?.id ?? null },
    };
  },
};

export function registerMeetingActions() {
  registerAction(createMeetingAction);
}
