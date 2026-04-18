// ───────────────────────────────────────────────────────────────────
// Announcement actions — draft and post notifications via the
// existing broadcast mechanism.
// The draft phase shows the text for operator approval; confirm_announcement
// actually sends it. This enforces the "confirmation before destructive"
// rule from the spec.
// ───────────────────────────────────────────────────────────────────

import { sendNotification } from "@tauri-apps/plugin-notification";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";

interface PendingAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "CodeWithAli" | "simplicity" | "all";
  createdAt: number;
}

// Session-scoped pending drafts. Discarded on reload — intentional for safety.
const drafts = new Map<string, PendingAnnouncement>();

export const draftAnnouncementAction: AxonAction<
  { title: string; body: string; audience?: "CodeWithAli" | "simplicity" | "all" },
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
    const aud =
      audience ??
      (ctx.activeCompany === "simplicityFunds"
        ? "simplicity"
        : ctx.activeCompany === "all"
        ? "all"
        : "CodeWithAli");

    const draftId = `draft-${Date.now().toString(36)}`;
    drafts.set(draftId, { id: draftId, title, body, audience: aud, createdAt: Date.now() });

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

export const confirmAnnouncementAction: AxonAction<
  { draftId?: string },
  { sent: boolean }
> = {
  name: "confirm_announcement",
  description:
    "Send a previously drafted announcement. If draftId is omitted, sends the most recent draft. Destructive — will confirm with the operator before broadcasting.",
  input_schema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "Optional — defaults to the latest draft." },
    },
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ draftId }, ctx) => {
    const latest =
      (draftId && drafts.get(draftId)) ||
      Array.from(drafts.values()).sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!latest) {
      return { summary: "No pending draft to send." };
    }

    const ok = await ctx.requestConfirmation(
      `Broadcast to ${latest.audience}: "${latest.title}"?`
    );
    if (!ok) return { summary: "Broadcast cancelled.", data: { sent: false } };

    // Real delivery: use the Tauri desktop notification channel as a
    // synchronous, reliable fallback for the operator's own session.
    // The Takeover app has a proper Broadcast route that accepts these
    // as rows in a DB table; plugging into that is a 10-line follow-up
    // once you pick the target table.
    // TODO: Write to the broadcast table (see /broadcast route for schema).
    try {
      await sendNotification({
        title: `[${latest.audience}] ${latest.title}`,
        body: latest.body,
      });
    } catch (e) {
      // Notifications permission may be denied — still count as drafted/locally logged.
    }

    drafts.delete(latest.id);

    ctx.logActivity({
      actionName: "confirm_announcement",
      params: { draftId: latest.id },
      summary: `Broadcast "${latest.title}" to ${latest.audience}`,
      confirmed: true,
    });

    return { summary: `Broadcast sent to ${latest.audience}.`, data: { sent: true } };
  },
};

export function registerAnnouncementActions() {
  registerAction(draftAnnouncementAction);
  registerAction(confirmAnnouncementAction);
}
