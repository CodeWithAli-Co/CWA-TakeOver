/**
 * sendEmailViaTakeover.ts — outbound email from Takeover desktop,
 * proxied through the cwa_takeover website's Hono route.
 *
 * Auth: HMAC-SHA256 over (timestamp + body_hash). No storage.
 *
 *   1. Shared `EMAIL_HMAC_SECRET` lives in env on both sides.
 *   2. Client serializes the body to JSON, computes:
 *        bodyHash = sha256_hex(rawJson)
 *        sig      = hmac_sha256_hex(secret, timestamp + ":" + bodyHash)
 *   3. Sends:
 *        Authorization: Bearer <sig>
 *        timestamp:     <ISO-8601 UTC>
 *      with the SAME exact JSON bytes as the body.
 *   4. Server recomputes + constant-time compares. Rejects if
 *      timestamp is outside ±5 min window or sig doesn't match.
 *
 * Env (VITE_-prefixed so Vite inlines into the Tauri bundle):
 *   VITE_TAKEOVER_SITE_URL    — e.g. https://takeover.systems
 *   VITE_EMAIL_HMAC_SECRET    — same value as EMAIL_HMAC_SECRET on Vercel
 *
 * Generate the secret with: `openssl rand -hex 32` (or any source of
 * 32+ random hex chars). Set it on Vercel + in CWA-Manager/.env.
 */

export type Brand = "codeWithAli" | "simplicityFunds";

export interface OfferLetterParams {
  from: { name: string; email: string };
  to: string;                     // comma-separated for multi-recipient
  subject: string;
  body: string;
  candidateName: string;
  positionTitle: string;
  employerLegalName: string;
  brand: Brand;
  acceptUrl: string;
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType?: string;
  };
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  providerCode?: string;
}

// ── Config ─────────────────────────────────────────────────────────
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
      "Add to CWA-Manager/.env. Generate with `openssl rand -hex 32`.",
    );
  }
  return secret;
}

// ── Crypto helpers (Web Crypto API — works in Tauri webview) ──
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

// ── Main entry point ───────────────────────────────────────────────

/**
 * Send an offer-letter email via the website. Returns `{ok, ...}`
 * uniformly so callers don't need try/catch.
 */
export async function sendOfferLetterEmail(
  params: OfferLetterParams,
): Promise<SendResult> {
  let siteUrl: string;
  let secret: string;
  try {
    siteUrl = getSiteUrl();
    secret = getHmacSecret();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Serialize EXACTLY ONCE — these are the bytes we sign + send.
  // Any differences between sign-time and send-time JSON would
  // invalidate the signature.
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

  // POST to the website with the signature in the bearer slot.
  let res: Response;
  try {
    res = await fetch(`${siteUrl}/api/email/offer-letter`, {
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

  if (!res.ok || json.status !== "sent") {
    return {
      ok: false,
      error: json.error ?? json.message ?? `${res.status} ${res.statusText}`,
      providerCode: json.providerCode,
    };
  }

  return { ok: true, messageId: json.messageId as string };
}

// ── Small convenience helpers ──────────────────────────────────────

/** Convert a Blob (e.g., from @react-pdf/renderer) to raw base64 —
 *  strips the "data:...;base64," prefix that FileReader adds. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed"));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}
