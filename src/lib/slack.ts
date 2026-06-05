/**
 * lib/slack.ts — minimal browser-side Slack Web API client.
 *
 * Slack's Web API supports CORS for bot tokens (xoxb-…) when called
 * from a browser with the Authorization header set, so we can hit
 * it straight from the Tauri webview with no Edge Function in
 * between. Same architecture as `lib/airtable.ts` — bring your own
 * token, call straight to the provider, no proxy hop.
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

const BASE_URL = "https://slack.com/api";

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
// Shared fetcher — every Slack call goes through here.
// ────────────────────────────────────────────────

async function slackFetch<T>(
  token: string,
  endpoint: string,
  init?: { method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, unknown> },
): Promise<T> {
  const method = init?.method ?? "GET";
  const url = new URL(`${BASE_URL}/${endpoint}`);

  // Slack accepts query params on GET, JSON body on POST.
  if (method === "GET" && init?.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (method === "POST") {
    // Slack requires charset=utf-8 explicitly for chat.postMessage —
    // without it the API rejects the body with `invalid_payload`.
    headers["Content-Type"] = "application/json; charset=utf-8";
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(init?.body ?? {}) : undefined,
  });

  if (!res.ok) {
    // Slack rarely returns non-2xx (it prefers 200 + ok:false), but
    // network/proxy errors can. Surface the status line so the
    // caller can show something sensible.
    throw new Error(`Slack ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as T & { ok: boolean; error?: string };
  if (!json.ok) {
    throw new Error(`Slack: ${json.error ?? "unknown error"}`);
  }
  return json as T;
}

// ────────────────────────────────────────────────
// Public helpers — one per endpoint we care about.
// ────────────────────────────────────────────────

/** auth.test — smoke test the token. Returns workspace + bot id. */
export async function slackAuthTest(token: string): Promise<SlackAuthTest> {
  return slackFetch<SlackAuthTest>(token, "auth.test", { method: "POST" });
}

/** conversations.list — the bot's visible channels. Returns at
 *  most `limit` channels (Slack caps at 1000). Excludes archived
 *  by default. Set `types` to "public_channel,private_channel" to
 *  include privates the bot has been invited to. */
export async function slackListChannels(
  token: string,
  opts: {
    limit?: number;
    types?: string;
    excludeArchived?: boolean;
  } = {},
): Promise<SlackChannel[]> {
  const res = await slackFetch<SlackConversationsListResponse>(
    token,
    "conversations.list",
    {
      method: "GET",
      query: {
        limit: String(opts.limit ?? 200),
        types: opts.types ?? "public_channel",
        exclude_archived: String(opts.excludeArchived ?? true),
      },
    },
  );
  return res.channels ?? [];
}

/** conversations.history — recent messages in one channel.
 *  Default 20 — enough for the pulse strip without flooding. */
export async function slackChannelHistory(
  token: string,
  channelId: string,
  limit = 20,
): Promise<SlackMessage[]> {
  const res = await slackFetch<SlackConversationsHistoryResponse>(
    token,
    "conversations.history",
    {
      method: "GET",
      query: { channel: channelId, limit: String(limit) },
    },
  );
  return res.messages ?? [];
}

/** chat.postMessage — send a message to a channel. The channel can
 *  be an id (`C12345`) or a name with `#` prefix (`#general`). */
export async function slackPostMessage(
  token: string,
  args: {
    channel: string;
    text: string;
    /** Optional thread to reply into. Pass an existing message ts. */
    thread_ts?: string;
    /** When true, Slack unfurls links into rich previews. Default true. */
    unfurl_links?: boolean;
  },
): Promise<{ channel: string; ts: string }> {
  const res = await slackFetch<SlackPostMessageResponse>(
    token,
    "chat.postMessage",
    {
      method: "POST",
      body: {
        channel: args.channel,
        text: args.text,
        thread_ts: args.thread_ts,
        unfurl_links: args.unfurl_links ?? true,
      },
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
export async function slackListUsers(
  token: string,
  limit = 200,
): Promise<SlackUser[]> {
  const res = await slackFetch<SlackUsersListResponse>(
    token,
    "users.list",
    { method: "GET", query: { limit: String(limit) } },
  );
  return res.members ?? [];
}

/** Smoke test — confirms the token is live and surfaces the team
 *  + bot user. Used by the connect modal to validate before save. */
export async function slackPing(token: string): Promise<{
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
