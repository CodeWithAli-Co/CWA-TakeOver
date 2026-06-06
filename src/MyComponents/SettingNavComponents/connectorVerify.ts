/**
 * connectorVerify.ts — real credential verification per kind.
 *
 * The old pre-save check was a regex on the token prefix. That
 * caught typos but happily accepted `ntn_garbage` as a "valid"
 * Notion token. Fixed: each kind now hits the provider's auth
 * endpoint and only returns ok if the API confirms.
 *
 * For browser-CORS-blocked providers (Stripe, SendGrid, Resend),
 * we can't verify client-side. They return `ok: true` with a
 * `degraded: true` flag so the dialog can show the "saved but
 * full verification needs the Edge Function" message.
 *
 * Result shape:
 *   · { ok: true, summary, degraded? } — save the row
 *   · { ok: false, error }             — block save, surface error
 */

import { airtablePing } from "@/lib/airtable";
import { calcomPing } from "@/lib/calcom";
import { githubMe } from "@/lib/github";
import { linearPing } from "@/lib/linear";
import { notionMe } from "@/lib/notion";
import { slackPing } from "@/lib/slack";
import { stripeVerify } from "@/lib/stripe";
import { vercelPing } from "@/lib/vercel";

export interface VerifyOk {
  ok: true;
  /** One-line "what we found" string shown in the modal banner. */
  summary: string;
  /** True when we couldn't actually call the provider — saved
   *  the format-checked creds but the user should know the
   *  service hasn't actually been pinged yet. */
  degraded?: boolean;
}

export interface VerifyError {
  ok: false;
  error: string;
}

export type VerifyResult = VerifyOk | VerifyError;

/** Real network ping per kind. Throws never — all errors are
 *  packed into VerifyError. */
export async function verifyConnector(
  kind: string,
  creds: Record<string, any>,
): Promise<VerifyResult> {
  try {
    switch (kind) {
      case "airtable":
        return await verifyAirtable(creds);
      case "github":
        return await verifyGithub(creds);
      case "notion":
        return await verifyNotion(creds);
      case "openai":
        return await verifyOpenAI(creds);
      case "cal-com":
        return await verifyCalcom(creds);
      case "linear":
        return await verifyLinear(creds);
      case "slack":
        return await verifySlack(creds);
      case "vercel":
        return await verifyVercel(creds);
      case "stripe":
        return await verifyStripe(creds);
      case "sendgrid":
        return verifySendGridFormat(creds);
      case "resend":
        return verifyResendFormat(creds);
      default:
        // OAuth stubs — accept the token as-is, no network check.
        return {
          ok: true,
          summary: "Saved. This connector has not been verified yet.",
          degraded: true,
        };
    }
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? "Verification failed.",
    };
  }
}

// ─── Per-kind verifiers ─────────────────────────────────────────

async function verifyAirtable(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const pat = String(creds.pat ?? "").trim();
  const baseId = String(creds.base_id ?? "").trim();
  if (!pat || !baseId) {
    return { ok: false, error: "PAT and base id are required." };
  }
  try {
    const r = await airtablePing(pat, baseId);
    return {
      ok: true,
      summary:
        r.tableCount > 0
          ? `Found ${r.tableCount} table(s)${r.firstTable ? ` — first: "${r.firstTable}".` : "."}`
          : "Base reachable but has no tables yet.",
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Airtable rejected the request." };
  }
}

async function verifyGithub(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const token = String(creds.token ?? "").trim();
  if (!token) return { ok: false, error: "Personal access token is required." };
  try {
    const me = await githubMe(token);
    const handle = me.name ? `${me.name} (@${me.login})` : `@${me.login}`;
    return {
      ok: true,
      summary: `Authenticated as ${handle} — ${me.public_repos} public repo(s).`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "GitHub rejected the token." };
  }
}

async function verifyNotion(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const token = String(creds.token ?? "").trim();
  if (!token) return { ok: false, error: "Integration token is required." };
  try {
    const me = await notionMe(token);
    const label = me.name ?? "integration";
    return {
      ok: true,
      summary:
        me.type === "bot"
          ? `Authenticated as bot "${label}". Remember to share pages with the integration.`
          : `Authenticated as ${label}.`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Notion rejected the token." };
  }
}

async function verifyCalcom(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const key = String(creds.api_key ?? "").trim();
  if (!key) return { ok: false, error: "API key is required." };
  try {
    const r = await calcomPing(key);
    return {
      ok: true,
      summary: `Authenticated as ${r.name} (${r.email}, ${r.timezone}).`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Cal.com rejected the key." };
  }
}

async function verifyVercel(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const token = String(creds.token ?? "").trim();
  if (!token) return { ok: false, error: "Token is required." };
  try {
    const r = await vercelPing(token);
    return {
      ok: true,
      summary: `Authenticated as ${r.name} (@${r.username}).`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Vercel rejected the token." };
  }
}

async function verifyLinear(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const token = String(creds.token ?? "").trim();
  if (!token) return { ok: false, error: "Personal API key is required." };
  if (!/^lin_api_/.test(token)) {
    return { ok: false, error: "Key should start with `lin_api_`." };
  }
  try {
    const r = await linearPing(token);
    return {
      ok: true,
      summary: `Connected to "${r.org}" as ${r.name}.`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Linear rejected the key." };
  }
}

async function verifySlack(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const token = String(creds.bot_token ?? "").trim();
  if (!token) return { ok: false, error: "Bot User OAuth Token is required." };
  if (!/^xoxb-/.test(token)) {
    return {
      ok: false,
      error: "Bot token should start with `xoxb-`. Check OAuth & Permissions in your Slack App.",
    };
  }
  try {
    const r = await slackPing(token);
    return {
      ok: true,
      summary: `Connected to "${r.team}" as @${r.user}.`,
    };
  } catch (e: any) {
    // Slack returns helpful error strings on auth.test:
    //   not_authed, invalid_auth, account_inactive, missing_scope, …
    // Pass them through so the operator can act on them.
    return { ok: false, error: e?.message ?? "Slack rejected the token." };
  }
}

async function verifyOpenAI(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const key = String(creds.api_key ?? "").trim();
  if (!key) return { ok: false, error: "API key is required." };
  // GET /v1/models is the lightest authed endpoint. CORS-friendly.
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.ok) {
    const body = (await res.json()) as { data?: { id: string }[] };
    const count = body.data?.length ?? 0;
    return {
      ok: true,
      summary: `Authenticated — ${count} model(s) available.`,
    };
  }
  let msg = `OpenAI ${res.status}`;
  try {
    const errBody = await res.json();
    if (errBody?.error?.message) msg = `OpenAI: ${errBody.error.message}`;
  } catch {
    // ignore
  }
  return { ok: false, error: msg };
}

// ─── Stripe: real verification via the takeover-B2B proxy ─────

async function verifyStripe(
  creds: Record<string, any>,
): Promise<VerifyResult> {
  const sec = String(creds.secret_key ?? "").trim();
  if (!sec) {
    return { ok: false, error: "Restricted API key is required." };
  }
  if (!/^(sk|rk)_(live|test)_/.test(sec)) {
    return {
      ok: false,
      error:
        "Key must start with `rk_` (restricted, recommended) or `sk_` (secret), in live or test mode.",
    };
  }
  try {
    const { account } = await stripeVerify(sec);
    const mode = account.livemode ? "Live" : "Test";
    const tag = account.charges_enabled
      ? ""
      : " — charges disabled on this account";
    return {
      ok: true,
      summary: `Connected to ${account.display_name} (${mode})${tag}.`,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? "Stripe rejected the key.",
    };
  }
}

// ─── Format-only checks (browser CORS blocks the real ping) ────

function verifySendGridFormat(
  creds: Record<string, any>,
): VerifyResult {
  const key = String(creds.api_key ?? "").trim();
  const from = String(creds.from_email ?? "").trim();
  if (!key) return { ok: false, error: "API key is required." };
  if (!from) return { ok: false, error: "Default from-address is required." };
  if (!/^SG\./.test(key)) {
    return { ok: false, error: "SendGrid key should start with `SG.`." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    return { ok: false, error: "From-address doesn't look like a valid email." };
  }
  return {
    ok: true,
    summary:
      "Saved. SendGrid blocks browser calls — full verification runs through the Edge Function.",
    degraded: true,
  };
}

function verifyResendFormat(
  creds: Record<string, any>,
): VerifyResult {
  const key = String(creds.api_key ?? "").trim();
  const from = String(creds.from_email ?? "").trim();
  if (!key) return { ok: false, error: "API key is required." };
  if (!from) return { ok: false, error: "Default from-address is required." };
  if (!/^re_/.test(key)) {
    return { ok: false, error: "Resend key should start with `re_`." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    return { ok: false, error: "From-address doesn't look like a valid email." };
  }
  return {
    ok: true,
    summary:
      "Saved. Resend blocks browser calls — full verification runs through the Edge Function.",
    degraded: true,
  };
}
