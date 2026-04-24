// ───────────────────────────────────────────────────────────────────
// Announcement actions — draft and post notifications via the
// existing broadcast mechanism.
//
// Two-phase flow for safety:
//   1. draft_announcement  → stash a preview locally (session-scoped)
//   2. confirm_announcement → actually post to #General in cwa_chat
//      AND fire a local Tauri notification so the operator sees
//      immediate confirmation on their own desktop.
//
// The announcement body is prefixed with a visible marker so it reads
// as an announcement rather than a regular chat message. Undo is
// descriptor-style (see `announcement.delete-posted` handler below),
// so "undo that" after a broadcast removes the row even across a page
// reload.
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import { sendNotification } from "@tauri-apps/plugin-notification";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { registerUndoHandler } from "../engine/undoStack";

type Audience = "CodeWithAli" | "simplicity" | "all";

interface PendingAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  createdAt: number;
}

// Session-scoped pending drafts. Discarded on reload — intentional for safety.
const drafts = new Map<string, PendingAnnouncement>();

// Prefix applied to the actual chat message so the post reads as an
// announcement regardless of which channel it lands in. Kept simple +
// greppable so it's easy to style or filter later.
const ANNOUNCEMENT_PREFIX = "📢 Announcement";

// ─── Undo handler ────────────────────────────────────────────────
// After a confirm_announcement, we push a descriptor with the row id
// and target table. Running "undo that" deletes the posted message.

registerUndoHandler<{
  table: string;
  rowId: string | number;
  title: string;
}>("announcement.delete-posted", async ({ table, rowId, title }) => {
  const { error } = await supabase
    .from(table as any)
    .delete()
    .eq("id", rowId);
  if (error) throw new Error(error.message);
  return `Retracted announcement "${title}".`;
});

// ─── Draft ───────────────────────────────────────────────────────

export const draftAnnouncementAction: AxonAction<
  { title: string; body: string; audience?: Audience },
  { draftId: string; preview: string }
> = {
  name: "draft_announcement",
  description:
    "Compose a draft announcement/notification. Does NOT send — returns a draft id that confirm_announcement uses to actually post. Always use this first; the operator will review the preview before confirming.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      audience: {
        type: "string",
        enum: ["CodeWithAli", "simplicity", "all"],
        description: "Defaults to the active company.",
      },
    },
    required: ["title", "body"],
  },
  handler: async ({ title, body, audience }, ctx) => {
    const aud: Audience =
      audience ??
      (ctx.activeCompany === "simplicityFunds"
        ? "simplicity"
        : ctx.activeCompany === "all"
          ? "all"
          : "CodeWithAli");

    const draftId = `draft-${Date.now().toString(36)}`;
    drafts.set(draftId, {
      id: draftId,
      title,
      body,
      audience: aud,
      createdAt: Date.now(),
    });

    const preview = `TITLE: ${title}\n\n${body}\n\nAUDIENCE: ${aud}`;

    ctx.logActivity({
      actionName: "draft_announcement",
      params: { title, body, audience: aud },
      summary: `Drafted announcement "${title}"`,
      result: { draftId, preview },
    });

    ctx.note(`Draft ready — ${draftId}\n${preview}`);

    return {
      summary: `Drafted "${title}" for ${aud}. Say "AXON, send it" to post, or edit the draft.`,
      data: { draftId, preview },
    };
  },
};

// ─── Confirm + send ──────────────────────────────────────────────

export const confirmAnnouncementAction: AxonAction<
  { draftId?: string },
  { sent: boolean }
> = {
  name: "confirm_announcement",
  description:
    "Send a previously drafted announcement. If draftId is omitted, sends the most recent draft. Posts to the #General company channel AND fires a local Tauri notification. Destructive — confirms with the operator before broadcasting.",
  input_schema: {
    type: "object",
    properties: {
      draftId: {
        type: "string",
        description: "Optional — defaults to the latest draft.",
      },
    },
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ draftId }, ctx) => {
    const latest =
      (draftId && drafts.get(draftId)) ||
      Array.from(drafts.values()).sort(
        (a, b) => b.createdAt - a.createdAt,
      )[0];

    if (!latest) {
      return { summary: "No pending draft to send." };
    }

    const ok = await ctx.requestConfirmation(
      `Broadcast to ${latest.audience}: "${latest.title}"?`,
    );
    if (!ok)
      return { summary: "Broadcast cancelled.", data: { sent: false } };

    // Post to the company-wide chat (cwa_chat, channel "General").
    // Matches the shape used by send_chat_message so the row looks
    // identical to any other message — no special table needed.
    const sender = ctx.operator.username;
    const chatBody =
      `${ANNOUNCEMENT_PREFIX} · ${latest.audience}\n\n` +
      `**${latest.title}**\n\n${latest.body}`;
    const payload: Record<string, any> = {
      sent_by: sender,
      message: chatBody,
    };

    const { data: inserted, error } = await supabase
      .from("cwa_chat")
      .insert(payload)
      .select()
      .single();

    if (error) {
      ctx.logActivity({
        actionName: "confirm_announcement",
        params: { draftId: latest.id },
        summary: `Broadcast failed: ${error.message}`,
        confirmed: true,
      });
      return { summary: `Broadcast failed: ${error.message}` };
    }

    // Fire a local desktop notification so the operator gets immediate
    // feedback. Failures here are silent (permission may be denied);
    // the chat row is the source of truth.
    try {
      await sendNotification({
        title: `[${latest.audience}] ${latest.title}`,
        body: latest.body,
      });
    } catch {
      // noop — notifications are best-effort
    }

    // Register undo — delete the posted chat row.
    if (inserted?.id != null) {
      ctx.pushUndo({
        actionName: "confirm_announcement",
        label: `broadcast "${latest.title}"`,
        descriptor: {
          kind: "announcement.delete-posted",
          payload: {
            table: "cwa_chat",
            rowId: inserted.id as string | number,
            title: latest.title,
          },
        },
      });
    }

    drafts.delete(latest.id);

    ctx.logActivity({
      actionName: "confirm_announcement",
      params: { draftId: latest.id },
      summary: `Broadcast "${latest.title}" to ${latest.audience} (#General)`,
      confirmed: true,
      result: { chatRowId: inserted?.id },
    });

    return {
      summary: `Broadcast sent to ${latest.audience} — posted to #General.`,
      data: { sent: true },
    };
  },
};

export function registerAnnouncementActions() {
  registerAction(draftAnnouncementAction);
  registerAction(confirmAnnouncementAction);
}
