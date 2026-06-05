// ───────────────────────────────────────────────────────────────────
// Slack actions — lets AXON read team pulse and post into channels
// via the operator's connected Slack workspace.
//
// Six actions registered:
//
//   · slack_list_channels    — public channels the bot can see.
//   · slack_recent_messages  — last N messages from one channel.
//   · slack_post_message     — post into a channel (mutating; gated
//                              by requiresConfirmation so AXON has
//                              to read it back before sending).
//   · slack_pulse            — aggregate recent activity across the
//                              top channels for a quick "team pulse"
//                              briefing. Built on top of the others
//                              so it inherits the same auth/error
//                              handling.
//   · slack_summarize_channel — pulls history + asks the model for
//                               a one-paragraph summary. The
//                               summarization itself happens in the
//                               AXON model layer; this action just
//                               returns the raw messages.
//   · slack_resolve_channel  — converts a #name to a Slack id so the
//                              other actions can be called with
//                              either form.
//
// All actions hit slack.com/api directly via lib/slack — no proxy.
// Per-tenant safe: fetchConnectorByKind auto-resolves company from
// Stronghold, so a tenant's Slack creds are isolated.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchConnectorByKind,
  type Connector,
} from "@/stores/connectors";
import {
  slackAuthorLabel,
  slackChannelHistory,
  slackListChannels,
  slackListUsers,
  slackPostMessage,
  type SlackChannel,
  type SlackMessage,
  type SlackUser,
} from "@/lib/slack";

interface SlackCreds {
  bot_token?: string;
  default_channel?: string;
}

/** Confirm the Slack connector is wired up for this tenant — or
 *  return an error string for AXON to relay to the operator. We no
 *  longer read the bot_token out: every Slack call goes through the
 *  takeover-B2B proxy which looks the token up server-side from the
 *  tenant's `connectors` row. We only check presence + extract the
 *  default channel (which the desktop is the source of truth for
 *  since it drives the post-without-channel UX). */
function readSlackCreds(
  connector: Connector | null,
): { defaultChannel: string | null } | { error: string } {
  if (!connector) {
    return {
      error:
        "Slack is not connected for this tenant. Open Settings → Connectors and add it first.",
    };
  }
  const creds = (connector.credentials ?? {}) as SlackCreds;
  // Soft check: if bot_token is missing from the row, something
  // upstream broke the connector and the proxy will fail anyway.
  if (!creds.bot_token || !String(creds.bot_token).trim()) {
    return { error: "Slack credentials are incomplete (missing bot_token)." };
  }
  return {
    defaultChannel:
      typeof creds.default_channel === "string" && creds.default_channel.trim()
        ? creds.default_channel.trim()
        : null,
  };
}

/** Slack accepts a channel id (C12345) or a #name. We accept both,
 *  but `chat.postMessage` is picky about the leading `#`. Normalize. */
function normalizeChannel(channel: string): string {
  const t = channel.trim();
  if (!t) return t;
  // Channel ids are uppercase C/G/D followed by alphanumerics.
  if (/^[CGD][A-Z0-9]{5,}$/.test(t)) return t;
  // Already prefixed
  if (t.startsWith("#")) return t;
  return `#${t}`;
}

// ─── slack_list_channels ───────────────────────────────────────────

export const slackListChannelsAction: AxonAction<
  { limit?: number; include_private?: boolean },
  {
    count: number;
    channels: {
      id: string;
      name: string;
      num_members: number | null;
      topic: string | null;
      is_private: boolean;
    }[];
  }
> = {
  name: "slack_list_channels",
  description:
    "List Slack channels the connected bot can see. Defaults to public channels in the connected workspace. Use this BEFORE posting so you can confirm a channel name maps to an id.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max channels to return (default 50)." },
      include_private: {
        type: "boolean",
        description: "Include private channels the bot has been invited to (requires groups:read scope).",
      },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("slack");
    const creds = readSlackCreds(connector);
    if ("error" in creds) return { summary: creds.error, data: { count: 0, channels: [] } };

    const types = input.include_private
      ? "public_channel,private_channel"
      : "public_channel";
    const channels = await slackListChannels({
      limit: input.limit ?? 50,
      types,
    });
    const shaped = channels.map((c: SlackChannel) => ({
      id: c.id,
      name: c.name,
      num_members: c.num_members ?? null,
      topic: c.topic?.value ?? null,
      is_private: !!c.is_private,
    }));

    ctx.logActivity({
      actionName: "slack_list_channels",
      params: { limit: input.limit, include_private: input.include_private },
      summary: `Listed ${shaped.length} Slack channel(s)`,
    });

    return {
      summary: `Found ${shaped.length} Slack channel(s).`,
      data: { count: shaped.length, channels: shaped },
    };
  },
};

// ─── slack_recent_messages ─────────────────────────────────────────

export const slackRecentMessagesAction: AxonAction<
  { channel: string; limit?: number },
  {
    channel: string;
    count: number;
    messages: {
      ts: string;
      author: string;
      text: string;
      thread_count: number;
    }[];
  }
> = {
  name: "slack_recent_messages",
  description:
    "Fetch the last N messages from one Slack channel. Channel can be an id (C12345) or a name (#general). Default limit is 20.",
  input_schema: {
    type: "object",
    properties: {
      channel: { type: "string", description: "Channel id or #name." },
      limit: { type: "number", description: "Max messages (default 20)." },
    },
    required: ["channel"],
  },
  handler: async (input, ctx) => {
    if (!input?.channel?.trim()) {
      throw new Error("slack_recent_messages needs a channel.");
    }
    const connector = await fetchConnectorByKind("slack");
    const creds = readSlackCreds(connector);
    if ("error" in creds) {
      return {
        summary: creds.error,
        data: { channel: input.channel, count: 0, messages: [] },
      };
    }

    // For history we need an id, not a name. If the caller passed
    // a name, resolve it via the channel list.
    let channelId = input.channel.trim();
    if (channelId.startsWith("#")) {
      const channels = await slackListChannels({ limit: 1000 });
      const want = channelId.slice(1).toLowerCase();
      const hit = channels.find((c) => c.name.toLowerCase() === want);
      if (!hit) {
        return {
          summary: `Couldn't find a Slack channel called ${channelId}.`,
          data: { channel: input.channel, count: 0, messages: [] },
        };
      }
      channelId = hit.id;
    }

    const [history, users] = await Promise.all([
      slackChannelHistory(channelId, input.limit ?? 20),
      slackListUsers().catch(() => [] as SlackUser[]),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u] as const));

    const messages = history.map((m: SlackMessage) => ({
      ts: m.ts,
      author: slackAuthorLabel(m, userMap),
      // Slack messages can include <@U123|name> mentions; leave them
      // raw for now. The pulse view can pretty them up.
      text: m.text ?? "",
      thread_count: m.reply_count ?? 0,
    }));

    ctx.logActivity({
      actionName: "slack_recent_messages",
      params: { channel: input.channel, limit: input.limit },
      summary: `Pulled ${messages.length} message(s) from ${input.channel}`,
    });

    return {
      summary: `${messages.length} recent message(s) in ${input.channel}.`,
      data: { channel: input.channel, count: messages.length, messages },
    };
  },
};

// ─── slack_post_message ────────────────────────────────────────────

export const slackPostMessageAction: AxonAction<
  { channel?: string; text: string; thread_ts?: string },
  { channel: string; ts: string }
> = {
  name: "slack_post_message",
  description:
    "Post a message into a Slack channel. Channel can be an id (C12345), a name (#general), or omitted to use the default_channel from the connector. Mutating — AXON should read the message back to the operator before sending.",
  input_schema: {
    type: "object",
    properties: {
      channel: { type: "string", description: "Channel id, #name, or omit for default." },
      text: { type: "string", description: "Message body." },
      thread_ts: { type: "string", description: "Optional ts of a parent message to reply into." },
    },
    required: ["text"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (input, ctx) => {
    if (!input?.text?.trim()) {
      throw new Error("slack_post_message needs non-empty text.");
    }
    const connector = await fetchConnectorByKind("slack");
    const creds = readSlackCreds(connector);
    if ("error" in creds) {
      throw new Error(creds.error);
    }

    const channel = normalizeChannel(input.channel ?? creds.defaultChannel ?? "");
    if (!channel) {
      throw new Error(
        "No Slack channel specified and no default_channel is configured on the connector.",
      );
    }

    const r = await slackPostMessage({
      channel,
      text: input.text,
      thread_ts: input.thread_ts,
    });

    ctx.logActivity({
      actionName: "slack_post_message",
      params: { channel, length: input.text.length, thread: !!input.thread_ts },
      summary: `Posted to ${channel} (${input.text.length} chars)`,
    });

    return {
      summary: `Posted to ${channel}.`,
      data: { channel: r.channel, ts: r.ts },
    };
  },
};

// ─── slack_pulse ──────────────────────────────────────────────────
// Aggregate-view: for the top-K most active public channels, pull
// the last few messages so AXON can paint a "team pulse" picture
// without the operator picking a channel first.

export const slackPulseAction: AxonAction<
  { top_channels?: number; per_channel?: number },
  {
    workspace: string;
    sampled_at: string;
    channels: {
      name: string;
      message_count: number;
      preview: { author: string; text: string }[];
    }[];
  }
> = {
  name: "slack_pulse",
  description:
    "Read a rolling 'team pulse' across the most active public channels in the connected Slack workspace. Useful for morning briefings — answers 'what's the team up to in Slack?' without picking a channel.",
  input_schema: {
    type: "object",
    properties: {
      top_channels: { type: "number", description: "How many channels to sample (default 5)." },
      per_channel: { type: "number", description: "Messages per channel (default 5)." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("slack");
    const creds = readSlackCreds(connector);
    if ("error" in creds) {
      return {
        summary: creds.error,
        data: { workspace: "", sampled_at: new Date().toISOString(), channels: [] },
      };
    }

    // Pull the directory once so we can render author labels in
    // the previews. If users.list fails (missing scope), fall back
    // to raw @user ids — non-fatal.
    const users = await slackListUsers().catch(() => [] as SlackUser[]);
    const userMap = new Map(users.map((u) => [u.id, u] as const));

    // We don't have an "activity sort" endpoint on Slack — sort by
    // member count as a rough proxy for "main channels", which
    // matches what an operator would scan first anyway.
    const channels = await slackListChannels({ limit: 100 });
    const ranked = channels
      .filter((c) => !c.is_archived && (c.is_member ?? true))
      .sort((a, b) => (b.num_members ?? 0) - (a.num_members ?? 0))
      .slice(0, input.top_channels ?? 5);

    const perChannel = input.per_channel ?? 5;
    const results = await Promise.all(
      ranked.map(async (c) => {
        const msgs = await slackChannelHistory(c.id, perChannel).catch(
          () => [] as SlackMessage[],
        );
        return {
          name: c.name,
          message_count: msgs.length,
          preview: msgs.slice(0, perChannel).map((m) => ({
            author: slackAuthorLabel(m, userMap),
            // Keep the preview compact — first 140 chars.
            text: (m.text ?? "").slice(0, 140),
          })),
        };
      }),
    );

    ctx.logActivity({
      actionName: "slack_pulse",
      params: { top_channels: input.top_channels, per_channel: input.per_channel },
      summary: `Sampled ${results.length} Slack channel(s)`,
    });

    return {
      summary: `Sampled ${results.length} Slack channel(s).`,
      data: {
        workspace: connector?.display_name ?? "",
        sampled_at: new Date().toISOString(),
        channels: results,
      },
    };
  },
};

// ─── slack_resolve_channel ────────────────────────────────────────
// Converts a channel name → id. Useful when AXON has a name from
// the operator ("post in #engineering") and an action needs the id.

export const slackResolveChannelAction: AxonAction<
  { name: string },
  { id: string | null; name: string; is_member: boolean }
> = {
  name: "slack_resolve_channel",
  description:
    "Resolve a Slack channel name (with or without leading #) to its channel id. Returns null id if no matching channel is visible.",
  input_schema: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  },
  handler: async (input) => {
    if (!input?.name?.trim()) throw new Error("slack_resolve_channel needs a name.");
    const connector = await fetchConnectorByKind("slack");
    const creds = readSlackCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { id: null, name: input.name, is_member: false } };
    }
    const want = input.name.replace(/^#/, "").trim().toLowerCase();
    const channels = await slackListChannels({ limit: 1000 });
    const hit = channels.find((c) => c.name.toLowerCase() === want);
    if (!hit) {
      return {
        summary: `No Slack channel named #${want} visible to the bot.`,
        data: { id: null, name: input.name, is_member: false },
      };
    }
    return {
      summary: `#${hit.name} resolves to ${hit.id}.`,
      data: { id: hit.id, name: hit.name, is_member: !!hit.is_member },
    };
  },
};

export function registerSlackActions() {
  registerAction(slackListChannelsAction);
  registerAction(slackRecentMessagesAction);
  registerAction(slackPostMessageAction);
  registerAction(slackPulseAction);
  registerAction(slackResolveChannelAction);
}
