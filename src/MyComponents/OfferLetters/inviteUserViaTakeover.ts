/**
 * inviteUserViaTakeover.ts — create a Supabase auth user + send
 * the invite email, proxied through the cwa_takeover website.
 *
 * Why a proxy route instead of calling Supabase directly from
 * Takeover: the admin invite API requires the service-role key,
 * which must never ship in the desktop bundle (extractable). The
 * cwa_takeover server route is the only place that key lives.
 *
 * Auth: same HMAC-SHA256 signature machinery as sendEmailViaTakeover
 * — shared `VITE_EMAIL_HMAC_SECRET` + ISO-8601 timestamp + sha256
 * over the body.
 *
 * Returns the Supabase auth user UUID on success — caller should
 * stamp that onto `app_users.supa_id` so the user's DB row matches
 * the auth.users row they'll authenticate against on first login.
 */

export interface InviteUserParams {
  email: string;
  /** Optional — stored in Supabase user_metadata.candidate_name. */
  candidateName?: string;
  /** Optional — override the set-password landing URL. Defaults to
   *  `${VITE_TAKEOVER_SITE_URL}/auth/set-password` on the server. */
  redirectTo?: string;
}

export interface InviteResult {
  ok: boolean;
  userId?: string;
  email?: string;
  /** Optional set-password / accept-invite link returned by the
   *  takeover server. Used by the Direct Hire flow to show a
   *  copy-able URL alongside the auto-sent invite email so the
   *  operator can also share via Slack / DM / SMS. The server
   *  exposes this from supabase admin.generateLink (recovery type).
   *  Will be undefined if the server hasn't been updated to surface
   *  it — UI should fall back to "invite email sent" messaging. */
  actionLink?: string;
  /** True when the user already had a Supabase auth account — the
   *  caller can use this to skip the invite step next time but
   *  still link to the existing user id (returned as undefined in
   *  the 409 response; caller should look it up via email). */
  alreadyRegistered?: boolean;
  error?: string;
  providerCode?: string;
}

// ── Config (shared with sendEmailViaTakeover) ──────────────────

function getSiteUrl(): string {
  const url = import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined;
  if (!url) {
    throw new Error(
      "VITE_TAKEOVER_SITE_URL is required (e.g. https://takeover.systems).",
    );
  }
  return url.replace(/\/+$/, "");
}

function getHmacSecret(): string {
  const secret = import.meta.env.VITE_EMAIL_HMAC_SECRET as string | undefined;
  if (!secret || secret.length < 32) {
    throw new Error(
      "VITE_EMAIL_HMAC_SECRET is missing or too short (need >= 32 chars). " +
      "Add to CWA-Manager/.env. Same value as EMAIL_HMAC_SECRET on Vercel.",
    );
  }
  return secret;
}

// ── Crypto helpers (Web Crypto — works in the Tauri webview) ──

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s;
}

// ── Main entry point ───────────────────────────────────────────

export async function inviteUserViaTakeover(
  params: InviteUserParams,
): Promise<InviteResult> {
  let siteUrl: string;
  let secret: string;
  try {
    siteUrl = getSiteUrl();
    secret = getHmacSecret();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Serialize ONCE — same bytes we sign + send.
  const rawBody = JSON.stringify(params);
  const timestamp = new Date().toISOString();

  let signature: string;
  try {
    const bodyHash = await sha256Hex(rawBody);
    signature = await hmacHex(secret, `${timestamp}:${bodyHash}`);
  } catch (e) {
    return {
      ok: false,
      error: `HMAC computation failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let res: Response;
  try {
    res = await fetch(`${siteUrl}/api/auth/invite-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${signature}`,
        timestamp,
        "content-type": "application/json",
      },
      body: rawBody,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Network error reaching ${siteUrl}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `Non-JSON response: ${res.status} ${res.statusText}` };
  }

  if (!res.ok) {
    // Preserve the 409 "already registered" detail so callers can
    // decide whether to retry vs. just link to the existing user.
    if (res.status === 409 && json?.alreadyRegistered) {
      return {
        ok: false,
        alreadyRegistered: true,
        error: json.error ?? "User already has an auth account.",
        providerCode: json.providerCode,
      };
    }
    return {
      ok: false,
      error: json?.error ?? `HTTP ${res.status} ${res.statusText}`,
      providerCode: json?.providerCode,
    };
  }

  return {
    ok: true,
    userId: json.userId,
    email: json.email,
    // action_link / actionLink: snake_case from the GoTrue admin
    // response, camelCase if the server normalized it. Either way
    // we surface it as actionLink. Undefined when the server hasn't
    // been updated to expose it.
    actionLink: json.actionLink ?? json.action_link ?? undefined,
  };
}
