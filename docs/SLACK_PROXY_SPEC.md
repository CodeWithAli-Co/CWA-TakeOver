# Slack proxy spec — takeover-B2B side

The desktop app (CWA-TakeOver) routes every Slack Web API call
through one endpoint on takeover-B2B:

```
POST ${VITE_TAKEOVER_SITE_URL}/api/slack/proxy
```

This document spec's the contract so whoever's working on
takeover-B2B can ship it.

## Request shape

```ts
type ProxyRequest = {
  /** Slack Web API method, e.g. "auth.test", "chat.postMessage",
   *  "conversations.list", "conversations.history", "users.list". */
  method: string;

  /** Params to forward to Slack. Will be form-encoded onto the
   *  outbound request alongside `token`. */
  params: Record<string, string | number | boolean>;

  /** Tenant scope. Used to look up the bot token from the
   *  `connectors` table. Required UNLESS `token` is provided
   *  (verify-on-save case). */
  company_name?: string;

  /** Explicit bot token (xoxb-…). Sent only by the verify-on-save
   *  flow before the connector row exists. When present, the
   *  proxy uses this token directly and skips the DB lookup. */
  token?: string;
};
```

Required headers:
- `Content-Type: application/json`
- `TakeOver-App: true` (same convention as `/api/gmail/*` — reject
  random web origins at the edge)

## Response shape

The proxy returns Slack's JSON response **verbatim**. That means
the `ok` field and any `error` string come straight from
slack.com. The desktop's `lib/slack.ts` already handles
`{ ok: false, error }` by throwing.

Errors **from the proxy itself** (no connector row found, env
misconfigured, slack.com unreachable) should return a non-2xx with:

```json
{ "error": "human-readable reason" }
```

## Server-side reference implementation (Next.js / Vercel)

Drop into `takeover-B2B/app/api/slack/proxy/route.ts` (App Router)
or `pages/api/slack/proxy.ts` (Pages Router). This is a Pages
Router version; adapt as needed.

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SLACK_BASE = "https://slack.com/api";

// Service-role client — same pattern Gmail uses. Reads from the
// central TakeOver project so `connectors` lookups bypass RLS.
const supa = createClient(
  process.env.NEXT_PUBLIC_TAKEOVER_SUPABASE_URL!,
  process.env.TAKEOVER_SUPABASE_SERVICE_ROLE_KEY!,
);

// Allow-list of Slack methods we proxy. Defense-in-depth — if the
// desktop is ever compromised we don't want it calling
// admin.users.session.reset on our behalf. Extend as we add
// features.
const ALLOWED_METHODS = new Set([
  "auth.test",
  "conversations.list",
  "conversations.history",
  "conversations.info",
  "chat.postMessage",
  "users.list",
  "users.info",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  if (req.headers["takeover-app"] !== "true") {
    return res.status(403).json({ error: "forbidden" });
  }

  const { method, params, company_name, token } = req.body ?? {};

  if (typeof method !== "string" || !ALLOWED_METHODS.has(method)) {
    return res.status(400).json({
      error: `method "${method}" not allowed`,
    });
  }
  if (typeof params !== "object" || params === null) {
    return res.status(400).json({ error: "params must be an object" });
  }

  // Resolve the bot token. Two modes:
  let botToken: string | null = null;
  if (typeof token === "string" && token.startsWith("xoxb-")) {
    // Verify-on-save — the desktop hasn't saved the row yet.
    botToken = token;
  } else if (typeof company_name === "string" && company_name.trim()) {
    const { data, error } = await supa
      .from("connectors")
      .select("credentials")
      .eq("kind", "slack")
      .eq("company", company_name)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) {
      return res.status(404).json({
        error: `No Slack connector found for tenant "${company_name}".`,
      });
    }
    const creds = (data.credentials ?? {}) as { bot_token?: string };
    botToken = (creds.bot_token ?? "").trim() || null;
  }
  if (!botToken) {
    return res.status(400).json({
      error: "Bot token required — pass `token` or wire up the connector.",
    });
  }

  // Form-encode params + token and forward to Slack.
  const form = new URLSearchParams();
  form.set("token", botToken);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    form.set(k, String(v));
  }

  let slackResp: Response;
  try {
    slackResp = await fetch(`${SLACK_BASE}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: form.toString(),
    });
  } catch (e: any) {
    return res.status(502).json({
      error: `Couldn't reach slack.com: ${e?.message ?? "unknown"}`,
    });
  }

  // Slack always returns 200 with { ok, ... }. Forward verbatim.
  const json = await slackResp.json().catch(() => ({
    ok: false,
    error: `slack.com returned non-JSON (${slackResp.status})`,
  }));
  return res.status(200).json(json);
}
```

## Env vars needed on takeover-B2B

- `NEXT_PUBLIC_TAKEOVER_SUPABASE_URL` — central TakeOver project URL
- `TAKEOVER_SUPABASE_SERVICE_ROLE_KEY` — service role key for the
  central project (NOT the anon key)

Both are already set for the Gmail proxy, so no new secrets to
provision.

## Testing locally

With the proxy live, the desktop's `Save` button on the Slack
connector dialog will round-trip through your local
takeover-B2B (`VITE_TAKEOVER_SITE_URL=http://localhost:3000`)
and return the workspace name on success.

A `curl` smoke test:

```bash
curl -X POST http://localhost:3000/api/slack/proxy \
  -H "Content-Type: application/json" \
  -H "TakeOver-App: true" \
  -d '{
    "method": "auth.test",
    "params": {},
    "token": "xoxb-your-test-token"
  }'
```

Should return `{ "ok": true, "team": "…", "user": "…", … }`.

## What this unlocks (and what's still TODO)

Done:
- Tokens never leave the server after the initial save
- CORS is no longer a desktop concern
- One uniform proxy pattern across Gmail / Stripe / Slack
- AXON's `slack_post_message` action now safely posts on the
  operator's behalf with the token confined to takeover-B2B

Still TODO (separate work):
- **Move `bot_token` out of `connectors.credentials` JSONB and
  into Supabase Vault** — same migration we owe Stripe and the
  other secret-holding connectors. Proxy code stays the same, just
  swap the SELECT for a Vault decrypt.
- **Slack event webhooks** (`/api/slack/events`) — for "AXON
  notices when someone @mentions you" features. Needs the bot's
  signing secret stored alongside the token + a webhook route
  that verifies Slack's HMAC signature.
- **Bot manifest auto-install** — instead of asking the operator
  to create a Slack App manually, we could host a manifest at
  takeover-B2B and direct them through Slack's "Add to Slack"
  OAuth flow. That moves us from bot-token bring-your-own to
  proper distribution-ready OAuth.
