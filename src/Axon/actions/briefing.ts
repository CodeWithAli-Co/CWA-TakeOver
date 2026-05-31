// ───────────────────────────────────────────────────────────────────
// Briefing — "AXON, brief me" — pulls together the morning rundown.
// Composes several other actions for a single spoken summary.
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

export const briefingAction: AxonAction<
  Record<string, never>,
  { blocks: Array<{ label: string; value: string }> }
> = {
  name: "brief_me",
  description:
    "Produce a morning briefing for the operator — covers active company, overdue tasks, tasks due this week, upcoming meetings, and recent signups. Scoped to the active company. Output is intended to be spoken.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const co = companyLabel(ctx.activeCompany);
    const scoped = ctx.activeCompany !== "all";
    const now = new Date();
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);

    const overdueQ = takeOversupabase
      .from("cwa_todos")
      .select("todo_id,title,deadline,status,company")
      .neq("status", "done")
      .lt("deadline", now.toISOString())
      .gt("deadline", "");

    const thisWeekQ = takeOversupabase
      .from("cwa_todos")
      .select("todo_id,title,deadline,status,company")
      .neq("status", "done")
      .gte("deadline", now.toISOString())
      .lte("deadline", weekAhead.toISOString());

    const meetingsQ = takeOversupabase
      .from("cwa_meetings")
      .select("meeting_title,date,company")
      .gte("date", now.toISOString().slice(0, 10))
      .lte("date", weekAhead.toISOString().slice(0, 10));

    const signupsSince = new Date();
    signupsSince.setDate(signupsSince.getDate() - 1);
    const signupsQ = takeOversupabase
      .from("app_users")
      .select("username,role,created_at")
      .gte("created_at", signupsSince.toISOString());

    const [o, w, m, s] = await Promise.all([
      scoped ? overdueQ.eq("company", co) : overdueQ,
      scoped ? thisWeekQ.eq("company", co) : thisWeekQ,
      scoped ? meetingsQ.eq("company", co) : meetingsQ,
      signupsQ,
    ]);

    const overdue = o.data ?? [];
    const week = w.data ?? [];
    const meetings = m.data ?? [];
    const signups = s.data ?? [];

    const companyName = ctx.activeCompany === "simplicityFunds" ? "Simplicity" : ctx.activeCompany === "all" ? "both companies" : "CodeWithAli";
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const lines: string[] = [];
    lines.push(`${greeting}, ${ctx.operator.username}. Active context is ${companyName}.`);

    if (overdue.length > 0) {
      lines.push(
        `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} require attention${
          overdue.length <= 3 ? `: ${overdue.map((t: any) => t.title).join(", ")}` : ""
        }.`
      );
    } else {
      lines.push("No overdue tasks.");
    }

    if (week.length > 0) {
      lines.push(`${week.length} task${week.length === 1 ? "" : "s"} due this week.`);
    }

    if (meetings.length > 0) {
      lines.push(`${meetings.length} meeting${meetings.length === 1 ? "" : "s"} on the calendar this week.`);
    }

    if (signups.length > 0) {
      lines.push(`${signups.length} new signup${signups.length === 1 ? "" : "s"} in the last twenty-four hours.`);
    }

    lines.push("Standing by.");

    const spokenSummary = lines.join(" ");

    const blocks = [
      { label: "Active company", value: companyName },
      { label: "Overdue tasks", value: String(overdue.length) },
      { label: "Tasks due this week", value: String(week.length) },
      { label: "Meetings this week", value: String(meetings.length) },
      { label: "New signups (24h)", value: String(signups.length) },
    ];

    ctx.logActivity({
      actionName: "brief_me",
      params: {},
      summary: "Morning briefing compiled",
      result: blocks,
    });

    return { summary: spokenSummary, data: { blocks } };
  },
};

export function registerBriefingActions() {
  registerAction(briefingAction);
}
