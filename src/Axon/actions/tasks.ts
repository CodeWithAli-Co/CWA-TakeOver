// ───────────────────────────────────────────────────────────────────
// Task (todo) actions — create, list, update, complete, delete.
// Wraps the existing Supabase `cwa_todos` table that the Todos() query
// already targets (src/stores/query.ts).
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// Parse deadline from a natural phrase. Conservative — returns null if unsure.
function parseDeadline(phrase: string | undefined): string | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().trim();
  const now = new Date();

  if (p === "today") {
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }
  if (p === "tomorrow") {
    now.setDate(now.getDate() + 1);
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = weekdays.findIndex((d) => p === d || p === `this ${d}` || p === `next ${d}`);
  if (wd !== -1) {
    const current = now.getDay();
    let diff = (wd - current + 7) % 7;
    if (diff === 0 || p.startsWith("next")) diff += 7;
    now.setDate(now.getDate() + diff);
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }

  // ISO date attempt
  const isoDate = new Date(phrase);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString();

  return null;
}

// ── Create ─────────────────────────────────────────────────────────

export const createTaskAction: AxonAction<
  {
    title: string;
    description?: string;
    assignee?: string | string[];
    deadline?: string;
    priority?: "high" | "medium" | "low";
    label?: string;
    company?: "CodeWithAli" | "simplicity";
  },
  { todo_id: number }
> = {
  name: "create_task",
  description:
    "Create a new task in the team's to-do list. Scoped to the active company unless `company` is explicitly overridden. The operator can specify an assignee, deadline (natural phrase like 'Friday' is OK), and priority.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short task title." },
      description: { type: "string", description: "Optional longer description." },
      assignee: { type: "string", description: "Username to assign to. Defaults to the operator." },
      deadline: { type: "string", description: "Deadline — ISO date or natural phrase." },
      priority: { type: "string", enum: ["high", "medium", "low"] },
      label: { type: "string", description: "Optional label/category." },
      company: { type: "string", enum: ["CodeWithAli", "simplicity"] },
    },
    required: ["title"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const assigneeArr = Array.isArray(input.assignee)
      ? input.assignee
      : input.assignee
      ? [input.assignee]
      : [ctx.operator.username];

    const priorityOrder =
      input.priority === "high" ? 3 : input.priority === "medium" ? 2 : 1;

    const row = {
      title: input.title,
      description: input.description ?? "",
      label: input.label ?? "",
      status: "to-do",
      priority: input.priority ?? "medium",
      priorityOrder,
      assignee: assigneeArr,
      deadline: parseDeadline(input.deadline) ?? "",
      company: input.company ?? companyLabel(ctx.activeCompany),
    };

    const { data, error } = await supabase
      .from("cwa_todos")
      .insert(row)
      .select()
      .single();

    if (error) {
      return { summary: `Failed to create task: ${error.message}` };
    }

    ctx.logActivity({
      actionName: "create_task",
      params: input as Record<string, unknown>,
      summary: `Created task "${input.title}" for ${assigneeArr.join(", ")}`,
      result: data,
    });

    const when = row.deadline ? ` due ${new Date(row.deadline).toLocaleDateString()}` : "";
    return {
      summary: `Task created: "${input.title}"${when}.`,
      data: { todo_id: data.todo_id },
    };
  },
};

// ── List ───────────────────────────────────────────────────────────

export const listTasksAction: AxonAction<
  {
    status?: "to-do" | "in-progress" | "done" | "overdue" | "all";
    assignee?: string;
    dueWithinDays?: number;
    company?: "CodeWithAli" | "simplicity" | "all";
    limit?: number;
  },
  { count: number; tasks: unknown[] }
> = {
  name: "list_tasks",
  description:
    "Query the task list. Filters: status ('overdue' returns tasks with a past deadline and status !== 'done'), assignee, dueWithinDays (e.g. 7 = this week), company override. Defaults to active company.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["to-do", "in-progress", "done", "overdue", "all"] },
      assignee: { type: "string" },
      dueWithinDays: { type: "number" },
      company: { type: "string", enum: ["CodeWithAli", "simplicity", "all"] },
      limit: { type: "number", description: "Max rows. Defaults to 25." },
    },
  },
  handler: async (input, ctx) => {
    const limit = input.limit ?? 25;
    let q = supabase
      .from("cwa_todos")
      .select("*")
      .order("priorityOrder", { ascending: false })
      .limit(limit);

    const co = input.company ?? companyLabel(ctx.activeCompany);
    if (co !== "all") q = q.eq("company", co);
    if (input.assignee) q = q.contains("assignee", [input.assignee]);

    if (input.status && input.status !== "all" && input.status !== "overdue") {
      q = q.eq("status", input.status);
    }

    if (input.dueWithinDays && input.dueWithinDays > 0) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + input.dueWithinDays);
      q = q.lte("deadline", horizon.toISOString()).gt("deadline", "");
    }

    const { data, error } = await q;
    if (error) return { summary: `Query failed: ${error.message}` };

    let rows = data ?? [];

    if (input.status === "overdue") {
      const now = new Date().toISOString();
      rows = rows.filter(
        (r: any) => r.deadline && r.deadline < now && r.status !== "done"
      );
    }

    const summary =
      rows.length === 0
        ? "No tasks match that filter."
        : `Found ${rows.length} task${rows.length === 1 ? "" : "s"}: ${rows
            .slice(0, 5)
            .map((r: any) => `"${r.title}"`)
            .join(", ")}${rows.length > 5 ? ", and more" : ""}.`;

    ctx.logActivity({
      actionName: "list_tasks",
      params: input as Record<string, unknown>,
      summary: `Listed ${rows.length} task(s)`,
    });

    return { summary, data: { count: rows.length, tasks: rows } };
  },
};

// ── Update status ──────────────────────────────────────────────────

export const updateTaskStatusAction: AxonAction<
  { titleOrId: string; status: "to-do" | "in-progress" | "done" },
  { matched: number | null }
> = {
  name: "update_task_status",
  description:
    "Update a task's status. Match by numeric todo_id or by title (fuzzy, first match wins). Use status 'done' to mark complete.",
  input_schema: {
    type: "object",
    properties: {
      titleOrId: { type: "string", description: "Numeric id or title snippet." },
      status: { type: "string", enum: ["to-do", "in-progress", "done"] },
    },
    required: ["titleOrId", "status"],
  },
  mutating: true,
  handler: async ({ titleOrId, status }, ctx) => {
    const asNum = Number(titleOrId);
    let targetId: number | null = null;

    if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
      targetId = asNum;
    } else {
      const { data } = await supabase
        .from("cwa_todos")
        .select("todo_id,title")
        .ilike("title", `%${titleOrId}%`)
        .limit(1);
      if (!data || data.length === 0) {
        return { summary: `No task matched "${titleOrId}".`, data: { matched: null } };
      }
      targetId = data[0].todo_id;
    }

    const { error } = await supabase
      .from("cwa_todos")
      .update({ status })
      .eq("todo_id", targetId);

    if (error) return { summary: `Update failed: ${error.message}`, data: { matched: null } };

    ctx.logActivity({
      actionName: "update_task_status",
      params: { titleOrId, status },
      summary: `Marked task #${targetId} as ${status}`,
    });

    return { summary: `Marked task as ${status}.`, data: { matched: targetId } };
  },
};

// ── Delete ─────────────────────────────────────────────────────────

export const deleteTaskAction: AxonAction<
  { titleOrId: string },
  { deleted: number | null }
> = {
  name: "delete_task",
  description:
    "Delete a task. Destructive — AXON will confirm with the operator before running.",
  input_schema: {
    type: "object",
    properties: {
      titleOrId: { type: "string", description: "Numeric id or title snippet." },
    },
    required: ["titleOrId"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ titleOrId }, ctx) => {
    const asNum = Number(titleOrId);
    let targetId: number | null = null;
    let title = titleOrId;

    if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
      targetId = asNum;
    } else {
      const { data } = await supabase
        .from("cwa_todos")
        .select("todo_id,title")
        .ilike("title", `%${titleOrId}%`)
        .limit(1);
      if (!data || data.length === 0) {
        return { summary: `No task matched "${titleOrId}".` };
      }
      targetId = data[0].todo_id;
      title = data[0].title;
    }

    const confirmed = await ctx.requestConfirmation(
      `Delete task "${title}"? This cannot be undone.`
    );
    if (!confirmed) return { summary: "Deletion cancelled.", data: { deleted: null } };

    const { error } = await supabase.from("cwa_todos").delete().eq("todo_id", targetId);
    if (error) return { summary: `Delete failed: ${error.message}` };

    ctx.logActivity({
      actionName: "delete_task",
      params: { titleOrId },
      summary: `Deleted task #${targetId}`,
      confirmed: true,
    });

    return { summary: "Task deleted.", data: { deleted: targetId } };
  },
};

export function registerTaskActions() {
  registerAction(createTaskAction);
  registerAction(listTasksAction);
  registerAction(updateTaskStatusAction);
  registerAction(deleteTaskAction);
}
