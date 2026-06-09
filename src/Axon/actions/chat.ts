// ───────────────────────────────────────────────────────────────────
// Chat actions — Axon can post messages on the operator's behalf.
//
// Two-step safety: send_chat_message requires confirmation by default,
// so "hey Axon, message the team that I'll be late" pops a confirm
// dialog before anything hits the database.
//
// Channel resolution:
//   · "General" / "the main channel" / "everyone" → cwa_chat table.
//   · Otherwise looks up dm_groups by name (case-insensitive).
// ───────────────────────────────────────────────────────────────────

import { companySupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

interface ResolvedChannel {
  table: "cwa_chat" | "cwa_dm_chat";
  group: string;
}

async function resolveChannel(name: string): Promise<ResolvedChannel | null> {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  if (n === "general" || n === "main" || n === "everyone" || n === "company") {
    return { table: "cwa_chat", group: "General" };
  }
  // Strip leading '#' if the user said "#foo"
  const bare = n.replace(/^#/, "");
  const { data, error } = await companySupabase    .from("dm_groups")
    .select("name")
    .ilike("name", `%${bare}%`)
    .limit(5);
  if (error || !data || data.length === 0) return null;
  // Prefer exact (case-insensitive) match.
  const exact = data.find((g: any) => (g.name || "").toLowerCase() === bare);
  const pick = exact ?? data[0];
  return { table: "cwa_dm_chat", group: pick.name };
}

export const sendChatMessageAction: AxonAction<
  { channel: string; message: string },
  { sent: boolean; table: string; group: string }
> = {
  name: "send_chat_message",
  description:
    "Post a message to a chat channel on the operator's behalf. Resolves channel by name — 'general' or a DM/channel name. Requires operator confirmation before sending (destructive).",
  input_schema: {
    type: "object",
    properties: {
      channel: {
        type: "string",
        description:
          "Target channel name. 'General' / 'main' / 'everyone' means the company-wide channel. Otherwise a DM/channel name (case-insensitive substring match).",
      },
      message: {
        type: "string",
        description:
          "The message body to post. Write naturally in first person — Axon is posting AS the operator, not quoting them.",
      },
    },
    required: ["channel", "message"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ channel, message }, ctx) => {
    const text = (message || "").trim();
    if (!text) return { summary: "Message body is empty — nothing to send." };

    const resolved = await resolveChannel(channel);
    if (!resolved) {
      return {
        summary: `I couldn't find a channel matching "${channel}". Use the exact channel name or say "General".`,
      };
    }

    const ok = await ctx.requestConfirmation(
      `Post to #${resolved.group}: "${text.slice(0, 160)}${text.length > 160 ? "…" : ""}"?`,
    );
    if (!ok) {
      return {
        summary: "Message cancelled.",
        data: { sent: false, table: resolved.table, group: resolved.group },
      };
    }

    // Minimal payload — the progressive-fallback pattern we use in
    // MessageComposer isn't worth replicating here. If columns aren't
    // present the insert will fail gracefully and we'll report it.
    const sender = ctx.operator.username;
    const payload: Record<string, any> = {
      sent_by: sender,
      message: text,
    };
    if (resolved.table === "cwa_dm_chat") payload.dm_group = resolved.group;

    const { error } = await companySupabase.from(resolved.table).insert(payload);
    if (error) {
      ctx.logActivity({
        actionName: "send_chat_message",
        params: { channel: resolved.group, message: text },
        summary: `Failed to send: ${error.message}`,
        confirmed: true,
      });
      return { summary: `Send failed: ${error.message}` };
    }

    ctx.logActivity({
      actionName: "send_chat_message",
      params: { channel: resolved.group, message: text },
      summary: `Posted to #${resolved.group}`,
      confirmed: true,
    });

    return {
      summary: `Sent to #${resolved.group}.`,
      data: { sent: true, table: resolved.table, group: resolved.group },
    };
  },
};

export const draftChatMessageAction: AxonAction<
  { channel: string; message: string },
  { draft: string; channel: string }
> = {
  name: "draft_chat_message",
  description:
    "Compose (but do NOT send) a chat message and read it back to the operator for review. Useful when the operator wants to hear the phrasing before sending.",
  input_schema: {
    type: "object",
    properties: {
      channel: { type: "string" },
      message: { type: "string" },
    },
    required: ["channel", "message"],
  },
  handler: async ({ channel, message }, ctx) => {
    const preview = `Draft for #${channel}:\n"${message}"`;
    ctx.note(preview);
    return {
      summary: `Drafted for #${channel}: ${message}. Say "send it" to post.`,
      data: { draft: message, channel },
    };
  },
};

export function registerChatActions() {
  registerAction(sendChatMessageAction);
  registerAction(draftChatMessageAction);
}
