// ───────────────────────────────────────────────────────────────────
// CEO-grade destructive actions. These delete/remove real data. They
// rely on autoApprove + the undo stack — every action here pushes an
// inverse closure so "axon undo that" can put things back.
//
// Channel resolution heuristics are shared with the chat action.
// ───────────────────────────────────────────────────────────────────

import { companySupabase } from "@/routes/index.lazy";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { pushUndo } from "../engine/undoStack";

async function resolveChannel(name: string): Promise<{ table: "cwa_chat" | "cwa_dm_chat"; group: string } | null> {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  if (n === "general" || n === "main" || n === "everyone" || n === "company") {
    return { table: "cwa_chat", group: "General" };
  }
  const bare = n.replace(/^#/, "");
  const { data, error } = await companySupabase    .from("dm_groups")
    .select("name")
    .ilike("name", `%${bare}%`)
    .limit(5);
  if (error || !data || data.length === 0) return null;
  const exact = data.find((g: any) => (g.name || "").toLowerCase() === bare);
  return { table: "cwa_dm_chat", group: (exact ?? data[0]).name };
}

// ── delete_task ────────────────────────────────────────────────────
export const deleteTaskAction: AxonAction<
  { titleOrId: string },
  { deleted: boolean }
> = {
  name: "delete_task",
  description:
    "Delete a to-do/task by its title or numeric id. Reversible via the undo stack.",
  input_schema: {
    type: "object",
    properties: {
      titleOrId: { type: "string", description: "Numeric todo_id OR case-insensitive title substring." },
    },
    required: ["titleOrId"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ titleOrId }, ctx) => {
    let target: any = null;
    const asId = Number(titleOrId);
    if (Number.isFinite(asId)) {
      const r = await companySupabase.from("cwa_todos").select("*").eq("todo_id", asId).single();
      target = r.data;
    } else {
      const r = await companySupabase
  .from("cwa_todos")
        .select("*")
        .ilike("title", `%${titleOrId}%`)
        .limit(1);
      target = r.data?.[0];
    }
    if (!target) {
      return { summary: `Couldn't find a task matching "${titleOrId}".` };
    }

    const { error } = await companySupabase.from("cwa_todos").delete().eq("todo_id", target.todo_id);
    if (error) return { summary: `Delete failed: ${error.message}` };

    pushUndo({
      actionName: "delete_task",
      label: `deleted task "${target.title}"`,
      undo: async () => {
        const { todo_id: _drop, ...restoreRow } = target;
        const { error } = await companySupabase.from("cwa_todos").insert(restoreRow);
        if (error) throw error;
        return "restored.";
      },
    });

    ctx.logActivity({
      actionName: "delete_task",
      params: { target: target.title },
      summary: `Deleted task "${target.title}"`,
      confirmed: true,
    });
    return { summary: `Deleted "${target.title}". Say "undo that" to bring it back.`, data: { deleted: true } };
  },
};

// ── delete_meeting ─────────────────────────────────────────────────
export const deleteMeetingAction: AxonAction<
  { titleOrId: string },
  { deleted: boolean }
> = {
  name: "delete_meeting",
  description:
    "Delete a meeting by title or numeric id. Reversible via the undo stack.",
  input_schema: {
    type: "object",
    properties: {
      titleOrId: { type: "string" },
    },
    required: ["titleOrId"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ titleOrId }, ctx) => {
    // Real schema: primary key is `id` (not meeting_id). Title column
    // is `meeting_title`.
    let target: any = null;
    const asId = Number(titleOrId);
    if (Number.isFinite(asId)) {
      const r = await companySupabase.from("cwa_meetings").select("*").eq("id", asId).single();
      target = r.data;
    } else {
      const r = await companySupabase
  .from("cwa_meetings")
        .select("*")
        .ilike("meeting_title", `%${titleOrId}%`)
        .limit(1);
      target = r.data?.[0];
    }
    if (!target) return { summary: `No meeting matches "${titleOrId}".` };

    const { error } = await companySupabase
.from("cwa_meetings")
      .delete()
      .eq("id", target.id);
    if (error) return { summary: `Delete failed: ${error.message}` };

    pushUndo({
      actionName: "delete_meeting",
      label: `deleted meeting "${target.meeting_title}"`,
      undo: async () => {
        // Strip the id so Postgres regenerates it; we've already
        // deleted the original and don't want the PK to collide.
        const { id: _drop, ...restoreRow } = target;
        const { error } = await companySupabase.from("cwa_meetings").insert(restoreRow);
        if (error) throw error;
        return "restored.";
      },
    });

    ctx.logActivity({
      actionName: "delete_meeting",
      params: { target: target.meeting_title },
      summary: `Deleted meeting "${target.meeting_title}"`,
      confirmed: true,
    });
    return { summary: `Deleted "${target.meeting_title}".`, data: { deleted: true } };
  },
};

// ── delete_message ─────────────────────────────────────────────────
export const deleteMessageAction: AxonAction<
  { channel: string; match: string },
  { deleted: boolean }
> = {
  name: "delete_message",
  description:
    "Soft-delete a single chat message in a channel by matching its content. Pass a substring of the message body — most-recent match wins. Reversible via undo.",
  input_schema: {
    type: "object",
    properties: {
      channel: { type: "string" },
      match: { type: "string", description: "Case-insensitive substring from the message body." },
    },
    required: ["channel", "match"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ channel, match }, ctx) => {
    const resolved = await resolveChannel(channel);
    if (!resolved) return { summary: `No channel matches "${channel}".` };

    let query = companySupabase.from(resolved.table).select("*");
    if (resolved.table === "cwa_dm_chat") query = query.eq("dm_group", resolved.group);
    query = query.ilike("message", `%${match}%`).order("msg_id", { ascending: false }).limit(1);
    const { data } = await query;
    const row = data?.[0];
    if (!row) return { summary: `No message in #${resolved.group} matches "${match}".` };

    const previousBody = row.message;
    const { error } = await companySupabase
.from(resolved.table)
      .update({ message: "[message deleted by Axon]", image_urls: null })
      .eq("msg_id", row.msg_id);
    if (error) return { summary: `Delete failed: ${error.message}` };

    pushUndo({
      actionName: "delete_message",
      label: `deleted message in #${resolved.group}`,
      undo: async () => {
        const { error } = await companySupabase
    .from(resolved.table)
          .update({ message: previousBody })
          .eq("msg_id", row.msg_id);
        if (error) throw error;
        return "message restored.";
      },
    });

    ctx.logActivity({
      actionName: "delete_message",
      params: { channel: resolved.group, msg_id: row.msg_id },
      summary: `Deleted message in #${resolved.group}`,
      confirmed: true,
    });
    return { summary: `Deleted. Undo anytime.`, data: { deleted: true } };
  },
};

// ── delete_channel ─────────────────────────────────────────────────
export const deleteChannelAction: AxonAction<
  { channel: string },
  { deleted: boolean }
> = {
  name: "delete_channel",
  description:
    "Delete a DM / channel and purge its messages. General channel cannot be deleted. Reversible only for the group row — messages are NOT restored by undo.",
  input_schema: {
    type: "object",
    properties: { channel: { type: "string" } },
    required: ["channel"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ channel }, ctx) => {
    const resolved = await resolveChannel(channel);
    if (!resolved || resolved.table === "cwa_chat") {
      return { summary: "That channel can't be deleted (either missing or General)." };
    }

    // Capture the group row for undo before we delete it.
    const { data: groupRow } = await companySupabase
.from("dm_groups")
      .select("*")
      .eq("name", resolved.group)
      .single();

    await companySupabase.from("cwa_dm_chat").delete().eq("dm_group", resolved.group);
    const { error } = await companySupabase.from("dm_groups").delete().eq("name", resolved.group);
    if (error) return { summary: `Delete failed: ${error.message}` };

    if (groupRow) {
      pushUndo({
        actionName: "delete_channel",
        label: `deleted channel "${resolved.group}"`,
        undo: async () => {
          const { error } = await companySupabase.from("dm_groups").insert(groupRow);
          if (error) throw error;
          return "channel recreated (messages were not restored).";
        },
      });
    }

    ctx.logActivity({
      actionName: "delete_channel",
      params: { channel: resolved.group },
      summary: `Deleted channel ${resolved.group}`,
      confirmed: true,
    });
    return { summary: `Channel deleted.`, data: { deleted: true } };
  },
};

// ── create_dm ──────────────────────────────────────────────────────
// Canonical-name 1-on-1 DM with another user.
function canonicalDMName(a: string, b: string): string {
  const [x, y] = [a, b].map((s) => (s || "").trim()).sort();
  return `dm::${x}::${y}`;
}

export const createDmAction: AxonAction<
  { otherUser: string },
  { group: string; created: boolean }
> = {
  name: "create_dm",
  description:
    "Start (or find) a 1-on-1 direct-message channel with another teammate by their username. Idempotent — reusing the same pair opens the existing DM.",
  input_schema: {
    type: "object",
    properties: {
      otherUser: { type: "string", description: "The OTHER person's username." },
    },
    required: ["otherUser"],
  },
  mutating: true,
  handler: async ({ otherUser }, ctx) => {
    const me = ctx.operator.username;
    const target = (otherUser || "").trim();
    if (!target) return { summary: "Which teammate should I start a DM with?" };
    const name = canonicalDMName(me, target);

    const existing = await companySupabase
.from("dm_groups")
      .select("id, name")
      .eq("name", name)
      .limit(1);
    let created = false;
    if (!existing.data || existing.data.length === 0) {
      const { error } = await companySupabase
  .from("dm_groups")
        .insert({ name, subscribers: [me, target] });
      if (error && !/duplicate key|unique/i.test(error.message)) {
        return { summary: `Could not create DM: ${error.message}` };
      }
      created = true;
    }

    if (created) {
      pushUndo({
        actionName: "create_dm",
        label: `opened DM with ${target}`,
        undo: async () => {
          await companySupabase.from("cwa_dm_chat").delete().eq("dm_group", name);
          const { error } = await companySupabase.from("dm_groups").delete().eq("name", name);
          if (error) throw error;
          return "DM removed.";
        },
      });
    }

    ctx.logActivity({
      actionName: "create_dm",
      params: { otherUser: target },
      summary: created ? `Opened DM with ${target}` : `Opened existing DM with ${target}`,
      confirmed: true,
    });
    return {
      summary: created
        ? `DM with ${target} is ready.`
        : `Opened your existing DM with ${target}.`,
      data: { group: name, created },
    };
  },
};

export function registerCeoPowerActions() {
  registerAction(deleteTaskAction);
  registerAction(deleteMeetingAction);
  registerAction(deleteMessageAction);
  registerAction(deleteChannelAction);
  registerAction(createDmAction);
}
