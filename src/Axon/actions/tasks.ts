// ───────────────────────────────────────────────────────────────────
// Task (todo) actions — create, list, update, complete, delete.
// Wraps the existing Supabase `cwa_todos` table that the Todos() query
// already targets (src/stores/query.ts).
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { registerUndoHandler } from "../engine/undoStack";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// ─── Persistable undo handlers ────────────────────────────────────
// Registered once at module load. The `kind` strings are stable keys
// that round-trip through localStorage alongside the serialized payload,
// so "undo that" still works after a page reload.

registerUndoHandler<{ todoId: number; title: string }>(
  "task.delete-created",
  async ({ todoId, title }) => {
    const { error } = await supabase
      .from("cwa_todos")
      .delete()
      .eq("todo_id", todoId);
    if (error) throw new Error(error.message);
    return `Reverted — deleted task "${title}".`;
  },
);

registerUndoHandler<{
  todoId: number;
  title: string;
  previousStatus: string;
}>("task.restore-status", async ({ todoId, title, previousStatus }) => {
  const { error } = await supabase
    .from("cwa_todos")
    .update({ status: previousStatus })
    .eq("todo_id", todoId);
  if (error) throw new Error(error.message);
  return `Reverted "${title}" back to ${previousStatus}.`;
});

registerUndoHandler<{
  snapshot: Record<string, unknown>;
  title: string;
}>("task.restore-deleted", async ({ snapshot, title }) => {
  const { error } = await supabase.from("cwa_todos").insert(snapshot);
  if (error) throw new Error(error.message);
  return `Restored "${title}".`;
});

// Parse deadline from a natural phrase. Conservative — returns null if unsure.
function parseDeadline(phrase: string | undefined): string | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().trim();
  const now = new Date();

  if (p === "today" || p === "eod" || p === "end of day") {
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }
  if (p === "tomorrow") {
    now.setDate(now.getDate() + 1);
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }
  if (p === "end of week" || p === "eow" || p === "this week") {
    const dow = now.getDay();
    const daysToFri = (5 - dow + 7) % 7 || 7;
    now.setDate(now.getDate() + daysToFri);
    now.setHours(17, 0, 0, 0);
    return now.toISOString();
  }
  if (p === "next week") {
    const dow = now.getDay();
    const daysToNextMon = ((1 - dow + 7) % 7) + 7;
    now.setDate(now.getDate() + daysToNextMon);
    now.setHours(9, 0, 0, 0);
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

  // "in 3 days" / "in a week"
  const inM = p.match(/^in\s+(\d+|a|an)\s+(day|days|week|weeks)$/);
  if (inM) {
    const n = inM[1] === "a" || inM[1] === "an" ? 1 : Number(inM[1]);
    const unit = inM[2];
    const mult = unit.startsWith("week") ? 7 : 1;
    now.setDate(now.getDate() + n * mult);
    now.setHours(23, 59, 0, 0);
    return now.toISOString();
  }

  // ISO date attempt
  const isoDate = new Date(phrase);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString();

  return null;
}

/** Infer priority from free-text title or description. */
function inferPriority(text: string): "high" | "medium" | "low" | null {
  const t = text.toLowerCase();
  if (/\b(urgent|asap|immediately|critical|emergency|now|today)\b/.test(t)) return "high";
  if (/\b(when you can|eventually|sometime|low priority|someday|nice to have)\b/.test(t)) return "low";
  return null;
}

/** Default deadline — end of current week (Friday 5pm) if none provided. */
function defaultDeadline(): string {
  const now = new Date();
  const dow = now.getDay();
  const daysToFri = (5 - dow + 7) % 7 || 7;
  now.setDate(now.getDate() + daysToFri);
  now.setHours(17, 0, 0, 0);
  return now.toISOString();
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

    const inferredPriority = inferPriority(
      `${input.title} ${input.description ?? ""}`
    );
    const priority = input.priority ?? inferredPriority ?? "medium";
    const priorityOrder = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    const parsedDeadline = parseDeadline(input.deadline) ?? defaultDeadline();

    const row = {
      title: input.title,
      description: input.description ?? "",
      label: input.label ?? "",
      status: "to-do",
      priority,
      priorityOrder,
      assignee: assigneeArr,
      deadline: parsedDeadline,
      company: input.company ?? companyLabel(ctx.activeCompany),
    };

    const when = row.deadline ? ` due ${new Date(row.deadline).toLocaleDateString()}` : "";

    // DRY-RUN — describe, don't execute.
    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would create task "${input.title}"${when}, assigned to ${assigneeArr.join(", ")}, priority ${priority}.`,
        data: { todo_id: -1 },
      };
    }

    const { data, error } = await supabase
      .from("cwa_todos")
      .insert(row)
      .select()
      .single();

    if (error) {
      return { summary: `Failed to create task: ${error.message}` };
    }

    // Register undo — delete the just-created row. Descriptor-style so
    // it survives a reload (resolved via the "task.delete-created"
    // handler registered at module load).
    const createdId = data.todo_id;
    ctx.pushUndo({
      actionName: "create_task",
      label: `create of "${input.title}"`,
      descriptor: {
        kind: "task.delete-created",
        payload: { todoId: createdId, title: input.title },
      },
    });

    ctx.logActivity({
      actionName: "create_task",
      params: input as Record<string, unknown>,
      summary: `Created task "${input.title}" for ${assigneeArr.join(", ")}`,
      result: data,
    });

    return {
      summary: `Task created: "${input.title}"${when}.`,
      data: { todo_id: createdId },
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
    /** Zero-based offset for pagination. Default 0. */
    offset?: number;
  },
  { count: number; tasks: unknown[]; nextOffset: number | null }
> = {
  name: "list_tasks",
  description:
    "Query the task list. Filters: status ('overdue' returns tasks with a past deadline and status !== 'done'), assignee, dueWithinDays (e.g. 7 = this week), company override. Defaults to active company. Supports limit + offset pagination so the operator can page through large backlogs ('next 25', 'show me 50 more').",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["to-do", "in-progress", "done", "overdue", "all"] },
      assignee: { type: "string" },
      dueWithinDays: { type: "number" },
      company: { type: "string", enum: ["CodeWithAli", "simplicity", "all"] },
      limit: { type: "number", description: "Max rows. Defaults to 25. Capped at 200." },
      offset: {
        type: "number",
        description: "Zero-based offset for pagination. Use `nextOffset` from the previous response to advance.",
      },
    },
  },
  handler: async (input, ctx) => {
    // Clamp to sane bounds so a bad prompt can't request 10k rows.
    const limit = Math.max(1, Math.min(input.limit ?? 25, 200));
    const offset = Math.max(0, input.offset ?? 0);
    let q = supabase
      .from("cwa_todos")
      .select("*")
      .order("priorityOrder", { ascending: false })
      .range(offset, offset + limit - 1);

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

    // If the caller got a full page back, more rows probably exist —
    // hand the brain a nextOffset so it knows how to paginate without
    // re-deriving the arithmetic.
    const nextOffset = rows.length >= limit ? offset + limit : null;

    ctx.logActivity({
      actionName: "list_tasks",
      params: input as Record<string, unknown>,
      summary: `Listed ${rows.length} task(s)${offset > 0 ? ` (offset ${offset})` : ""}`,
    });

    return {
      summary,
      data: { count: rows.length, tasks: rows, nextOffset },
    };
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
    let previousStatus: string | null = null;
    let taskTitle = "";

    if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
      targetId = asNum;
      const { data: row } = await supabase
        .from("cwa_todos")
        .select("status,title")
        .eq("todo_id", targetId)
        .single();
      previousStatus = row?.status ?? null;
      taskTitle = row?.title ?? `task #${targetId}`;
    } else {
      const { data } = await supabase
        .from("cwa_todos")
        .select("todo_id,title,status")
        .ilike("title", `%${titleOrId}%`)
        .limit(1);
      if (!data || data.length === 0) {
        return { summary: `No task matched "${titleOrId}".`, data: { matched: null } };
      }
      targetId = data[0].todo_id;
      previousStatus = data[0].status;
      taskTitle = data[0].title;
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would change "${taskTitle}" from ${previousStatus ?? "?"} to ${status}.`,
        data: { matched: targetId },
      };
    }

    const { error } = await supabase
      .from("cwa_todos")
      .update({ status })
      .eq("todo_id", targetId);

    if (error) return { summary: `Update failed: ${error.message}`, data: { matched: null } };

    // Register undo — restore previous status (persists across reload).
    if (previousStatus && previousStatus !== status && targetId != null) {
      ctx.pushUndo({
        actionName: "update_task_status",
        label: `status change on "${taskTitle}"`,
        descriptor: {
          kind: "task.restore-status",
          payload: {
            todoId: targetId,
            title: taskTitle,
            previousStatus,
          },
        },
      });
    }

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
    let snapshot: Record<string, unknown> | null = null;

    if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
      targetId = asNum;
      const { data: row } = await supabase
        .from("cwa_todos")
        .select("*")
        .eq("todo_id", targetId)
        .single();
      snapshot = row ?? null;
      title = (row?.title as string | undefined) ?? title;
    } else {
      const { data } = await supabase
        .from("cwa_todos")
        .select("*")
        .ilike("title", `%${titleOrId}%`)
        .limit(1);
      if (!data || data.length === 0) {
        return { summary: `No task matched "${titleOrId}".` };
      }
      targetId = data[0].todo_id;
      title = data[0].title;
      snapshot = data[0];
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would delete "${title}".`,
        data: { deleted: targetId },
      };
    }

    const confirmed = await ctx.requestConfirmation(
      `Delete task "${title}"?`
    );
    if (!confirmed) return { summary: "Deletion cancelled.", data: { deleted: null } };

    const { error } = await supabase.from("cwa_todos").delete().eq("todo_id", targetId);
    if (error) return { summary: `Delete failed: ${error.message}` };

    // Register undo — reinsert the full snapshot (persists across reload).
    if (snapshot) {
      ctx.pushUndo({
        actionName: "delete_task",
        label: `deletion of "${title}"`,
        descriptor: {
          kind: "task.restore-deleted",
          payload: { snapshot, title },
        },
      });
    }

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
