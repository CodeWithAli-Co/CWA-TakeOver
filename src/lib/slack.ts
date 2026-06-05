/**
 * lib/slack.ts — Slack Web API client, routed through takeover-B2B.
 *
 * Architecture: same proxy pattern as Gmail (stores/gmail.ts) and
 * Stripe (lib/stripe.ts). The desktop never talks to slack.com
 * directly. Every call goes through the takeover-B2B proxy at
 * `${VITE_TAKEOVER_SITE_URL}/api/slack/proxy`, which:
 *
 *   1. Looks up the bot token from the central `connectors` table
 *      (scoped by `company`) — OR accepts an explicit `token` in
 *      the request body for verify-on-save before the row exists.
 *   2. Form-encodes the call body with the token + params.
 *   3. POSTs to https://slack.com/api/{method}.
 *   4. Returns the parsed JSON response verbatim.
 *
 * Why the proxy hop (vs. direct from the desktop):
 *
 *   · Bot tokens never get loaded into the webview after the
 *     initial save — server holds them and forwards calls.
 *   · No CORS to fight (slack.com's preflight rejects browser
 *     Authorization headers; the proxy doesn't care).
 *   · Receivable webhook URLs (Slack → takeover-B2B → user) become
 *     possible — useful for "AXON notices when someone @mentions
 *     you in Slack" features down the line.
 *   · Server-side audit logging, rate limiting, retry all live in
 *     one place across every connector.
 *
 * Public function signatures are unchanged from the direct-call
 * version, so callers in Axon/actions/slack.ts, SlackPulsePanel,
 * connectorVerify, and connectorSummary all keep working without
 * modification.
 *
 * Why bot tokens (xoxb) and not full OAuth?
 *
 *   The OAuth dance requires a redirect URL Slack can call back to.
 *   Our desktop has no public callback URL, so we'd need the
 *   takeover-B2B proxy to act as the redirect handler — same
 *   pattern as Gmail uses, but a whole separate epic to wire up
 *   safely for every tenant. Bot tokens give us 95% of the demo
 *   value (post + read channels) with zero backend work.
 *
 *   The setup story for the operator is:
 *     1. Go to api.slack.com/apps → Create New App → From scratch.
 *     2. Pick the workspace. Name it "Takeover" (or whatever).
 *     3. Under OAuth & Permissions → Scopes → Bot Token Scopes:
 *        add `chat:write`, `channels:read`, `channels:history`,
 *        `groups:read`, `groups:history`, `users:read`.
 *     4. Install to Workspace.
 *     5. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
 *        and paste it into TakeOver's Settings → Connectors → Slack.
 *
 * Auth: `Authorization: Bearer xoxb-…` header on every call.
 *
 * Slack quirk: every successful response still has `ok: false` if
 * the call itself failed (rate limit, missing scope, channel
 * archived, etc). So we check `ok` on every response and throw the
 * `error` string up.
 */

import { getStronghold } from "@/stores/stronghold";

/** Build the proxy URL once per call — reads VITE_TAKEOVER_SITE_URL
 *  lazily so vite-dev can swap envs without a rebuild. Throws if
 *  the env is missing so we don't silently fall back to direct
 *  slack.com calls and re-introduce the CORS bug. */
function proxyUrl(): string {
  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    throw new Error(
      "VITE_TAKEOVER_SITE_URL not configured — set in .env.local. " +
      "Slack calls route through takeover-B2B.",
    );
  }
  return `${base.replace(/\/$/, "")}/api/slack/proxy`;
}

/** Tenant scope for connector lookup. The proxy uses this to find
 *  the right `connectors` row when no explicit token is passed. */
async function getCompanyName(): Promise<string | null> {
  try {
    const stronghold = await getStronghold();
    const name = await stronghold.getRecord("company_name");
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────
// Response shapes — Slack API surface is huge; we
// type only the fields we actually use.
// ────────────────────────────────────────────────

/** auth.test — confirms the token is live and tells us who we are. */
export interface SlackAuthTest {
  ok: true;
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
  is_enterprise_install?: boolean;
}

/** conversations.list — channels visible to the bot. */
export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_archived?: boolean;
  is_private?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: { value: string };
  purpose?: { value: string };
  created?: number;
}

interface SlackConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

/** conversations.history — recent messages in one channel. */
export interface SlackMessage {
  /** Unix timestamp as a string, e.g. "1717520000.000200". This
   *  doubles as the message's primary key inside its channel. */
  ts: string;
  type?: string;
  /** Slack user id of the author. Bot messages have `bot_id` set
   *  instead and may omit `user`. */
  user?: string;
  bot_id?: string;
  text: string;
  reply_count?: number;
  reactions?: { name: string; count: number; users: string[] }[];
  /** Present when the message has a parent — i.e. it's a reply
   *  inside a thread. We mostly ignore threads in the pulse view. */
  thread_ts?: string;
  /** Present on bot-sent app posts. */
  username?: string;
}

interface SlackConversationsHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
  error?: string;
}

/** chat.postMessage — outbound. */
interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: { text: string; ts: string };
  error?: string;
}

/** users.list — used to translate user ids → display names for
 *  the pulse view. Bot only needs `users:read` scope for this. */
export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; image_48?: string };
  is_bot?: boolean;
  deleted?: boolean;
}

interface SlackUsersListResponse {
  ok: boolean;
  members?: SlackUser[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

// ────────────────────────────────────────────────
// Shared fetcher — every Slack call goes through the proxy.
//
// Two calling modes:
//   · Explicit token (verify-on-save, before the connector row
//     exists): caller passes the xoxb-… string. The proxy
//     forwards it as-is to slack.com.
//   · Lookup (everything after save): caller passes `null` for
//     token. The proxy reads the bot_token from the tenant's
//     `connectors` row, scoped by company_name.
// ────────────────────────────────────────────────

async function slackFetch<T>(
  token: string | null,
  method: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const companyName = await getCompanyName();

  // Body schema — kept flat so the proxy can validate easily.
  const body: Record<string, unknown> = {
    method,
    params,
    company_name: companyName,
  };
  if (token) body.token = token;

  const res = await fetch(proxyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TakeOver-App header matches the convention Gmail uses, so
      // the proxy can reject random web requests at the edge.
      "TakeOver-App": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Proxy errors (token lookup failed, missing connector, slack.com
    // 5xx) come back as 4xx/5xx. Surface what we can.
    const detail = await res.text().catch(() => "");
    let parsed: { error?: string } = {};
    try { parsed = JSON.parse(detail); } catch { /* noop */ }
    throw new Error(
      parsed.error ?? `Slack proxy ${res.status}: ${detail.slice(0, 200)}`,
    );
  }

  // The proxy returns Slack's response verbatim — same { ok, ... }
  // shape we'd see from a direct call.
  const json = (await res.json()) as T & { ok: boolean; error?: string };
  if (!json.ok) {
    throw new Error(`Slack: ${json.error ?? "unknown error"}`);
  }
  return json as T;
}

// ────────────────────────────────────────────────
// Public helpers — one per endpoint we care about.
// ────────────────────────────────────────────────

/** auth.test — smoke test the token. Returns workspace + bot id.
 *  Called in two contexts:
 *    · verify-on-save (token explicit, no row yet) → pass the token.
 *    · post-save liveness check (token in DB) → pass null. */
export async function slackAuthTest(token: string | null = null): Promise<SlackAuthTest> {
  return slackFetch<SlackAuthTest>(token, "auth.test");
}

/** conversations.list — the bot's visible channels. Returns at
 *  most `limit` channels (Slack caps at 1000). Excludes archived
 *  by default. Set `types` to "public_channel,private_channel" to
 *  include privates the bot has been invited to. */
export async function slackListChannels(
  opts: {
    limit?: number;
    types?: string;
    excludeArchived?: boolean;
  } = {},
): Promise<SlackChannel[]> {
  const res = await slackFetch<SlackConversationsListResponse>(
    null,
    "conversations.list",
    {
      limit: opts.limit ?? 200,
      types: opts.types ?? "public_channel",
      exclude_archived: opts.excludeArchived ?? true,
    },
  );
  return res.channels ?? [];
}

/** conversations.history — recent messages in one channel.
 *  Default 20 — enough for the pulse strip without flooding. */
export async function slackChannelHistory(
  channelId: string,
  limit = 20,
): Promise<SlackMessage[]> {
  const res = await slackFetch<SlackConversationsHistoryResponse>(
    null,
    "conversations.history",
    { channel: channelId, limit },
  );
  return res.messages ?? [];
}

/** chat.postMessage — send a message to a channel. The channel can
 *  be an id (`C12345`) or a name with `#` prefix (`#general`). */
export async function slackPostMessage(args: {
  channel: string;
  text: string;
  /** Optional thread to reply into. Pass an existing message ts. */
  thread_ts?: string;
  /** When true, Slack unfurls links into rich previews. Default true. */
  unfurl_links?: boolean;
}): Promise<{ channel: string; ts: string }> {
  const res = await slackFetch<SlackPostMessageResponse>(
    null,
    "chat.postMessage",
    {
      channel: args.channel,
      text: args.text,
      thread_ts: args.thread_ts,
      unfurl_links: args.unfurl_links ?? true,
    },
  );
  return {
    channel: res.channel ?? args.channel,
    ts: res.ts ?? res.message?.ts ?? "",
  };
}

/** users.list — directory snapshot used for id → display-name
 *  lookups in the pulse view. Cap at 200 by default — typical
 *  team workspaces fit comfortably. */
export async function slackListUsers(limit = 200): Promise<SlackUser[]> {
  const res = await slackFetch<SlackUsersListResponse>(
    null,
    "users.list",
    { limit },
  );
  return res.members ?? [];
}

/** Smoke test — confirms the token is live and surfaces the team
 *  + bot user. Used by the connect modal to validate before save
 *  (token explicit) and by the connectorSummary tile (token=null,
 *  proxy looks it up). */
export async function slackPing(token: string | null = null): Promise<{
  team: string;
  team_id: string;
  user: string;
  user_id: string;
}> {
  const r = await slackAuthTest(token);
  return {
    team: r.team,
    team_id: r.team_id,
    user: r.user,
    user_id: r.user_id,
  };
}

/** Convenience: extract a friendly author label from a Slack
 *  message + a user directory. Bot posts surface their username;
 *  human posts try display_name → real_name → @id. */
export function slackAuthorLabel(
  m: SlackMessage,
  users: Map<string, SlackUser>,
): string {
  if (m.bot_id || m.username) return m.username ?? "Slack bot";
  if (!m.user) return "unknown";
  const u = users.get(m.user);
  if (!u) return `@${m.user.slice(0, 6)}`;
  return (
    u.profile?.display_name ||
    u.profile?.real_name ||
    u.real_name ||
    u.name ||
    `@${u.id.slice(0, 6)}`
  );
}
