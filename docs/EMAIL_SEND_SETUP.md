# Email send — setup guide

Transactional email from Takeover flows through the **cwa_takeover
Next.js website** (deployed on Vercel). The website is the only
process that holds the Resend API key. Takeover authenticates each
request to the website via an HMAC-SHA256 signature — **no Redis,
no token storage, no extra infrastructure**.

```
┌─────────────┐                              ┌─────────────────────┐
│ Takeover    │   POST /api/email/offer-letter ▶  cwa_takeover     │
│ (Tauri)     │   Authorization: Bearer <sig>     (Next.js + Hono) │
│             │   timestamp: 2026-...             on Vercel        │
│             │   body: OfferLetterParams      │                    │
│             │                                │  ┌─ HMAC verify
│             │                                │  └─ Resend
└─────────────┘                                └────────────────────┘

Both sides share EMAIL_HMAC_SECRET. The signature is:
  sig = HMAC-SHA256(secret, timestamp + ":" + sha256(body))
```

The signature covers the **timestamp + the exact body bytes**,
so:
- Replaying a captured request after the 5-minute window is rejected
  on freshness.
- Tampering with any byte of the body (even within the window)
  invalidates the sig.
- No storage means no cleanup, no TTLs, no rate-limit considerations
  on a Redis tier.

---

## 1. Generate a shared HMAC secret

The same value goes on both sides. Generate any way you like — must
be at least 32 chars. Easiest:

```bash
# macOS / Linux / Git Bash:
openssl rand -hex 32

# PowerShell:
[BitConverter]::ToString([byte[]] (1..32 | ForEach { Get-Random -Max 256 })).Replace("-","").ToLower()
```

Either gives you a 64-char hex string like:
`8a1d5e3fa9b2c0...` — keep it somewhere safe; you'll paste it
twice (once into Vercel, once into your local Takeover .env).

## 2. Resend (~3 minutes)

1. Sign up at [resend.com](https://resend.com)
2. Add a domain (`codewithali.com` etc.) and complete DNS verification
3. Dashboard → API Keys → Create → copy the `re_...` key

## 3. cwa_takeover website env vars (Vercel)

Vercel dashboard → cwa_takeover → Settings → Environment Variables.
Add these two, scoped to **Production + Preview + Development**:

- `EMAIL_HMAC_SECRET` → the 64-char hex from step 1
- `RESEND_API_KEY`    → your Resend `re_...` key

Then **redeploy** so the new env takes effect: Deployments tab →
latest deployment → ⋮ → Redeploy.

Verify the route:

```bash
curl -i https://takeover.systems/api/email/offer-letter
# 405 Method Not Allowed (GET not supported)  ← route is live

curl -i -X POST https://takeover.systems/api/email/offer-letter \
  -H "Authorization: Bearer 0000000000000000000000000000000000000000000000000000000000000000" \
  -H "timestamp: 2026-04-20T21:00:00.000Z" \
  -H "Content-Type: application/json" \
  -d "{}"
# 401  {"message":"Invalid signature ..."}  ← HMAC layer working
```

## 4. Takeover (desktop) env vars

Add to `CWA-Manager/.env`:

```bash
VITE_TAKEOVER_SITE_URL="https://takeover.systems"
VITE_EMAIL_HMAC_SECRET="<paste the same 64-char hex from step 1>"
```

Restart `bun run tauri dev` so Vite picks up the new env.

## 5. Send a test email

Open Takeover → Offers → create or open an offer letter → enter your
own email → Send. You should see:

```
✔ Sent to you@example.com.
```

The Resend dashboard's Activity tab should show the email within
~2 seconds.

---

## Troubleshooting

### `401 Invalid signature`
The body or timestamp got tampered between sign and send, OR the
secrets don't match between the two repos. Recheck both .env values
are identical.

### `401 timestamp is outside the ±300s window`
Your machine's clock is off by more than 5 minutes. Sync via Windows
Settings → Date & Time → Sync now.

### `EMAIL_HMAC_SECRET is missing or too short`
The website env doesn't have it set, or the value is shorter than
32 chars. Use `openssl rand -hex 32` to get a proper one and re-add
it on Vercel.

### `502 Resend rejected the request`
Check:
- `RESEND_API_KEY` is correct on Vercel.
- The `from` domain is verified in Resend.
- Recipient isn't blacklisted.

---

## Why HMAC instead of Redis bearer?

We started with a per-request bearer token stored in Redis with a
24-hour TTL. That worked but added an external dependency that
turned out to be overkill for the use case:

- **Browser-compatible**: Web Crypto's `crypto.subtle.sign` works
  natively in the Tauri webview. No need for Redis to bridge a TCP
  socket the browser can't open.
- **Stateless**: server doesn't store anything; verification is pure
  computation. No Redis tier to maintain, no TTL bookkeeping, no
  cold-start TCP overhead from serverless.
- **Same security guarantees**: timestamp window prevents replay,
  body-hash inclusion prevents tampering, constant-time compare
  prevents timing attacks. The Redis approach added single-use,
  but for a HTTPS-protected API where you're the only client, that's
  a small marginal benefit at significant infra cost.

If you ever want stronger replay protection (e.g., a public API where
you can't trust the network), add a per-request nonce stored
server-side — but at that point you've grown out of "CEO's email
helper" and into "real public API". This is the right architecture
for now.

---

## Security notes

- **Constant-time HMAC compare** prevents timing attacks on the
  signature.
- **5-minute timestamp window** (configurable via
  `EMAIL_TIMESTAMP_WINDOW_SECONDS`) is generous for clock drift but
  tight against replay.
- **Body bytes are hashed**, so tampering with attachment, recipient,
  or any other field invalidates the sig — even a single-byte change.
- **Secret rotation**: change `EMAIL_HMAC_SECRET` on Vercel + in
  Takeover's .env, redeploy + restart Takeover, and you're rotated.
  All in-flight requests fail mid-flight (acceptable; just retry).
- **Secret must be ≥ 32 chars**. The route refuses to start
  validating shorter secrets — better to fail early than ship weak
  auth.
