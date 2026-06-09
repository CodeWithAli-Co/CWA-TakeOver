// ───────────────────────────────────────────────────────────────────
// Data & metrics actions — read-only Supabase queries the operator
// can ask AXON in natural language.
// ───────────────────────────────────────────────────────────────────

import { companySupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// ── Count users ────────────────────────────────────────────────────

export const countUsersAction: AxonAction<
  { role?: string; createdSinceDays?: number },
  { count: number }
> = {
  name: "count_users",
  description:
    "Return the number of users in `app_users`. Optionally filter by role or signup window. Use for 'how many users', 'how many signed up today', 'how many admins do we have'.",
  input_schema: {
    type: "object",
    properties: {
      role: { type: "string", description: "Filter by exact role label." },
      createdSinceDays: {
        type: "number",
        description: "Only count users created within the last N days.",
      },
    },
  },
  handler: async ({ role, createdSinceDays }, ctx) => {
    let q = companySupabase.from("employee").select("supa_id", { count: "exact", head: true });
    if (role) q = q.eq("role", role);
    if (createdSinceDays) {
      const since = new Date();
      since.setDate(since.getDate() - createdSinceDays);
      q = q.gte("created_at", since.toISOString());
    }
    const { count, error } = await q;
    if (error) return { summary: `Query failed: ${error.message}` };
    const n = count ?? 0;

    const window =
      createdSinceDays === 1 ? " today" : createdSinceDays ? ` in the last ${createdSinceDays} days` : "";
    const roleLabel = role ? ` with role ${role}` : "";
    const summary = `${n} user${n === 1 ? "" : "s"}${roleLabel}${window}.`;

    ctx.logActivity({ actionName: "count_users", params: { role, createdSinceDays }, summary });
    return { summary, data: { count: n } };
  },
};

// ── Recent signups ─────────────────────────────────────────────────

export const recentSignupsAction: AxonAction<
  { days?: number; limit?: number },
  { rows: unknown[] }
> = {
  name: "recent_signups",
  description: "List users who signed up recently.",
  input_schema: {
    type: "object",
    properties: {
      days: { type: "number", description: "How many days back. Default 7." },
      limit: { type: "number", description: "Max rows. Default 10." },
    },
  },
  handler: async ({ days = 7, limit = 10 }, ctx) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await companySupabase
.from("employee")
      .select("username,role,created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { summary: `Query failed: ${error.message}` };
    const rows = data ?? [];
    const summary =
      rows.length === 0
        ? `No signups in the last ${days} days.`
        : `${rows.length} signup${rows.length === 1 ? "" : "s"} in the last ${days} days: ${rows
            .slice(0, 5)
            .map((r: any) => r.username)
            .join(", ")}${rows.length > 5 ? "…" : ""}.`;
    ctx.logActivity({ actionName: "recent_signups", params: { days, limit }, summary });
    return { summary, data: { rows } };
  },
};

// ── Meetings this week ─────────────────────────────────────────────

export const upcomingMeetingsAction: AxonAction<
  { withinDays?: number },
  { count: number; rows: unknown[] }
> = {
  name: "upcoming_meetings",
  description: "List meetings scheduled within the next N days (default 7), scoped to active company.",
  input_schema: {
    type: "object",
    properties: {
      withinDays: { type: "number", description: "Default 7." },
    },
  },
  handler: async ({ withinDays = 7 }, ctx) => {
    const today = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + withinDays);

    let q = companySupabase
      .from("cwa_meetings")
      .select("*")
      .gte("date", today.toISOString().slice(0, 10))
      .lte("date", horizon.toISOString().slice(0, 10))
      .order("date", { ascending: true });

    if (ctx.activeCompany !== "all") {
      q = q.eq("company", companyLabel(ctx.activeCompany));
    }

    const { data, error } = await q;
    if (error) return { summary: `Query failed: ${error.message}` };
    const rows = data ?? [];
    const summary =
      rows.length === 0
        ? `No meetings in the next ${withinDays} days.`
        : `${rows.length} meeting${rows.length === 1 ? "" : "s"} in the next ${withinDays} days.`;
    ctx.logActivity({ actionName: "upcoming_meetings", params: { withinDays }, summary });
    return { summary, data: { count: rows.length, rows } };
  },
};

// ── Generic table row count ────────────────────────────────────────

const SAFE_TABLES = new Set([
  "cwa_todos",
  "cwa_meetings",
  "employee",
  "interns",
  "cwa_creds",
]);

export const countRowsAction: AxonAction<
  { table: string },
  { count: number; table: string }
> = {
  name: "count_rows",
  description:
    "Return the row count for a named Supabase table. Allowlisted to: cwa_todos, cwa_meetings, app_users, interns, cwa_creds. For anything else, say you cannot query it.",
  input_schema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name. Must be in the allowlist." },
    },
    required: ["table"],
  },
  handler: async ({ table }, ctx) => {
    if (!SAFE_TABLES.has(table)) {
      return { summary: `Table "${table}" is not in the safe-read allowlist.` };
    }
    const { count, error } = await companySupabase
.from(table)
      .select("*", { count: "exact", head: true });
    if (error) return { summary: `Query failed: ${error.message}` };
    const n = count ?? 0;
    ctx.logActivity({ actionName: "count_rows", params: { table }, summary: `${table}: ${n}` });
    return { summary: `${table} has ${n} rows.`, data: { count: n, table } };
  },
};

export function registerDataActions() {
  registerAction(countUsersAction);
  registerAction(recentSignupsAction);
  registerAction(upcomingMeetingsAction);
  registerAction(countRowsAction);
}
