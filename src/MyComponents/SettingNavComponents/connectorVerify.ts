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
import { githubMe } from "@/lib/github";
import { notionMe } from "@/lib/notion";

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
      case "stripe":
        return verifyStripeFormat(creds);
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

// ─── Format-only checks (browser CORS blocks the real ping) ────

function verifyStripeFormat(
  creds: Record<string, any>,
): VerifyResult {
  const pub = String(creds.publishable_key ?? "").trim();
  const sec = String(creds.secret_key ?? "").trim();
  if (!pub || !sec) {
    return { ok: false, error: "Both publishable and secret key are required." };
  }
  if (!/^pk_/.test(pub)) {
    return { ok: false, error: "Publishable key must start with `pk_`." };
  }
  if (!/^(sk|rk)_/.test(sec)) {
    return {
      ok: false,
      error: "Secret/restricted key must start with `sk_` or `rk_`.",
    };
  }
  return {
    ok: true,
    summary:
      "Keys format-checked. Stripe blocks browser → secret-key calls, so full verification waits on the Edge Function.",
    degraded: true,
  };
}

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
