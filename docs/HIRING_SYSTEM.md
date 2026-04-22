# Hiring system — end-to-end architecture

This document describes the full candidate-to-employee pipeline
inside Takeover: drafting the offer, generating companion
agreements, delivering the email, signing through a public web
page, storing proof of signature, and finally converting the
accepted offer into a real employee record.

It also covers the HMAC authentication design, why Redis was the
original plan, and why we ended up not using it.

Everything below is implemented and live. File references point at
the actual code paths so the doc doesn't drift.

---

## 1. The big picture

```
┌──────────────────────────────────────────────────────────────────┐
│  TAKEOVER DESKTOP  (Tauri · Vite · React · Supabase client)      │
│                                                                  │
│   OfferLetters page                                              │
│   ├─ draftOffer.ts   — Claude drafts the letter body             │
│   ├─ draftCompanion  — Claude drafts ICA / NDA / IP / 1099       │
│   ├─ OfferLetterPDF  — @react-pdf/renderer → branded PDF         │
│   └─ HiringActions                                               │
│       ├─ SignatureRecordRow      (audit view)                    │
│       ├─ AcceptLinkRow           (copy /offer/accept/:token)     │
│       ├─ SendEmailRow            (HMAC-signed POST → Vercel)     │
│       ├─ CompanionDocsRow        (generate + export companions)  │
│       └─ ConvertRow              (offer → app_users row)         │
└──────────────────────────────────────────────────────────────────┘
                              │
               HMAC-SHA256   │ POST /api/email/offer-letter
               Authorization │ Authorization: Bearer <hex sig>
               + timestamp   │ timestamp: 2026-04-20T22:06:13Z
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  cwa_takeover  (Next.js 16 · Hono · Vercel)                      │
│                                                                  │
│   /api/email/offer-letter                                        │
│   ├─ HMAC verify  (constant-time compare, ±5 min window)         │
│   ├─ @react-email/render  offer-letter.tsx → HTML                │
│   ├─ Build plain-text body (fallback for Gmail + text clients)   │
│   └─ Resend.emails.send({ html, text, attachments })             │
│                                                                  │
│   /offer/accept/[token]                                          │
│   ├─ Supabase anon read (RLS: token is the key)                  │
│   ├─ Multi-step stepper (offer → each doc → welcome)             │
│   ├─ Typed-name signature per step                               │
│   ├─ Print bundle → "Save a copy (PDF)" via window.print         │
│   └─ Supabase anon update (RLS: token-gated)                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                  Supabase DB │  (Takeover's project, not Simplicity's)
                              ▼
                    offer_letters + hire_documents
                             + app_users  (on convert)
```

The only secrets that ever exist on disk are:
- `EMAIL_HMAC_SECRET` (Takeover bundle + Vercel env)
- `RESEND_API_KEY` (Vercel env only)
- Supabase anon key (public, safe in bundle)
- Supabase service-role key (NOT used in this flow; everything runs
  through RLS policies gated on the unguessable token)

---

## 2. Data model

Two tables plus the existing `app_users`.

### `offer_letters`

Stores the offer itself and the full lifecycle metadata. Key columns:

| Column                       | Purpose                                         |
|------------------------------|-------------------------------------------------|
| `id`                         | UUID PK                                         |
| `acceptance_token`           | Unguessable UUID — THE security boundary        |
| `candidate_name/email`       | Candidate identity                              |
| `position_title`             | Role                                            |
| `employer_legal_name`        | "CodeWithAli LLC" / "Simplicity Funds"          |
| `brand`                      | `codeWithAli` \| `simplicityFunds`              |
| `generated_body`             | Claude-drafted letter prose                     |
| `status`                     | `draft` → `sent` → `accepted` / `declined`      |
| `offer_expires_at`           | Optional expiry (soft, enforced in UI)          |
| `emailed_at`                 | Set when Resend accepts the email               |
| `accepted_at` / `declined_at`| Set when candidate responds                     |
| `candidate_signature_name`   | Typed name at acceptance                        |
| `candidate_signature_at`     | Timestamp of typed signature                    |
| `converted_to_user_id`       | UUID → `app_users.supa_id` after conversion     |

RLS policy: anon role can `SELECT` and `UPDATE` rows where
`acceptance_token` matches the request. There's no "current user" —
the unguessable token in the URL is the credential.

### `hire_documents`

One row per companion agreement for an offer. Migration at
`migrations/hire_documents_signatures.sql`.

| Column              | Purpose                                            |
|---------------------|----------------------------------------------------|
| `id`                | UUID PK                                            |
| `offer_letter_id`   | FK → `offer_letters.id`                            |
| `doc_type`          | `ica` / `employment` / `nda` / `ip` / `1099`       |
| `body`              | Claude-drafted prose                               |
| `status`            | `draft` → `pending_signature` → `signed` / `waived`|
| `signed_name`       | Typed name                                         |
| `signed_at`         | Signature timestamp                                |
| `sign_order`        | Order within this offer (stepper uses this)        |

RLS: same anon policy, but gated by the parent offer's
`acceptance_token` via a join. A trigger guard prevents anon from
editing `body` or `doc_type` — they can only flip status + write
signature fields.

---

## 3. Drafting the offer

`src/MyComponents/OfferLetters/draftOffer.ts`

Takes a structured `OfferInput` (role, comp, brand, start date,
commission terms, etc.) and hits Claude to produce polished prose
in a first-person "we're excited to offer you" voice. Output is
stored in `offer_letters.generated_body`.

Companion docs follow the same pattern in `draftCompanion.ts` but
with per-doc system prompts. `DOC_META` holds the human-facing
labels and blurbs used by both the Takeover UI and the public
accept page.

The PDF is rendered with `@react-pdf/renderer` inside the Tauri
webview. `OfferLetterPDF.tsx` has brand-aware styling (CWA red,
Simplicity emerald) and outputs a blob that:
1. Downloads to the CEO's disk (preview / archive),
2. Is base64-encoded and attached to the outgoing email.

Buffer is a Node API that @react-pdf/renderer expects; `main.tsx`
polyfills `globalThis.Buffer` at startup using the `buffer` npm
package so the renderer works in the webview.

---

## 4. Sending the email (HMAC flow)

This is the part that was rewritten three times. The final design:

### Takeover side — `sendEmailViaTakeover.ts`

```ts
// 1. Serialize the payload ONCE so the bytes we sign == the bytes
//    we send. `JSON.stringify` is non-deterministic across keys
//    but consistent within a single call.
const body = JSON.stringify(params);

// 2. Hash the body so the signature covers it byte-for-byte.
const bodyHash = await sha256HexWebCrypto(body);

// 3. ISO-8601 UTC timestamp for freshness.
const timestamp = new Date().toISOString();

// 4. HMAC-SHA256 over `timestamp + ":" + bodyHash`.
const sig = await hmacSha256HexWebCrypto(
  EMAIL_HMAC_SECRET,
  `${timestamp}:${bodyHash}`,
);

await fetch(`${VITE_TAKEOVER_SITE_URL}/api/email/offer-letter`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${sig}`,
    "timestamp": timestamp,
  },
  body,
});
```

Everything is Web Crypto API — no Node-only code. This runs inside
the Tauri webview, which doesn't have Node primitives.

### Website side — `src/app/api/email/offer-letter/route.ts`

A Hono route mounted at `/api/email`. The verification sequence:

1. **Extract** `Authorization: Bearer <64-char hex>` and `timestamp`
   headers. Reject if missing / malformed (401).
2. **Freshness** — parse the ISO timestamp, compute
   `abs(Date.now() - tsMs) / 1000`, reject if > 300 s (5 min).
   Window is configurable via `EMAIL_TIMESTAMP_WINDOW_SECONDS`.
3. **Read raw body bytes** via `c.req.text()`. Critical: we
   re-parse JSON from the exact string we hashed. Reading
   `c.req.json()` would consume the stream and we'd lose the raw
   bytes used to sign.
4. **Recompute** the signature with the same secret. `sha256(body)`
   then `hmac(secret, timestamp + ":" + bodyHash)`.
5. **Constant-time compare** via a hand-rolled hex equality check
   (`safeEqualHex`) — protects against timing oracles. Both strings
   are length-checked first, then XOR'd character by character with
   a cumulative `|`.
6. **Only after all five checks pass** do we parse the body, build
   the email, and call Resend.

### The rendering pipeline

We *used to* pass `react:` straight to `resend.emails.send()`.
Resend then ran its own render step inside the SDK, which
silently produced empty HTML in production — Gmail ended up
showing the PDF attachment card with no body above it.

Now we render ourselves:

```ts
import { render } from "@react-email/render";

const renderedHtml = await render(OfferLetter({...}));

await resend.emails.send({
  from, to, subject,
  html: renderedHtml,
  text: plainTextFallback,   // explicit plaintext body
  attachments,
});
```

This has two benefits:
- **Deterministic** — if rendering fails, it throws where we can
  see it, not inside Resend's black box.
- **Plain-text fallback** — every email goes out with both HTML and
  text parts. Gmail's attachment-preview mode and text-only clients
  both always show the accept URL as a clickable link.

The email template itself (`emails/offer-letter.tsx`) renders both
a styled button AND a visible plain-URL fallback panel beneath it.
Any client that strips the button still shows the URL.

---

## 5. Why HMAC and not Redis

The original plan was a bearer-token flow backed by Upstash Redis:

1. Takeover POSTs to the website to request a short-lived token.
2. Website generates a random UUID, writes it to Redis with a
   5-minute TTL, returns it to Takeover.
3. Takeover includes the token in the actual email-send request.
4. Website checks Redis, deletes on use (single-use).

We built it. Here's why we ripped it out.

### Problem 1 — Railway Redis is TCP-only

We briefly used Railway Redis because it was cheap. The Tauri
webview (which is where `sendEmailViaTakeover` runs) speaks `fetch`
over HTTPS. It has no TCP socket access. The only way to hit a
TCP-only Redis from a browser is through a proxy — which defeats
the point.

### Problem 2 — Upstash Redis REST was viable, but…

Upstash offers an HTTPS REST interface. We switched to that. Now
the Tauri side could hit Redis directly. But:

- **Round-trip latency**: every send became two HTTPS calls (get
  token → use token). From a desktop app on a home connection,
  that's 400-800 ms extra for no functional gain.
- **Rate limits + storage costs**: Upstash free tier is plenty
  for our volume, but we now had an external dep for a non-critical
  path. Outages on Upstash would take down hiring emails.
- **Operational weight**: secrets in two places, TTL cleanup
  considerations, regional selection, CORS for the REST API.

### Problem 3 — Bearer tokens don't prove body integrity

The single-use bearer approach gates "can you call this endpoint",
but not "was the body signed by the legitimate client". A bearer
token leaked in-flight (hostile proxy, browser extension, Wi-Fi
MITM within the 5-minute window) could be replayed with an
attacker-controlled body.

### The HMAC answer

Stateless, self-contained, and strictly better on the integrity
dimension:

- **No storage** — no Redis, no cleanup, no TTL bookkeeping. The
  timestamp header plus the window comparison replaces the TTL.
- **Browser-native** — Web Crypto API in Tauri, `node:crypto` on
  Vercel. Both sides speak HMAC-SHA256 natively.
- **Body-bound** — the sig covers `timestamp + ":" + sha256(body)`.
  Any byte flipped anywhere in the body invalidates the sig.
- **Replay-protected** — timestamps outside ±5 min are rejected.
  Reusing the same (sig, body, timestamp) inside the window is
  also moot because the body is already signed by us.
- **Single secret** — one `EMAIL_HMAC_SECRET` on Vercel + in
  Takeover's `.env`. No per-request round-trips.
- **Observability** — if something breaks, we see it in Vercel
  logs with the same detail as any 4xx. No separate Redis
  dashboard to check.

The one real downside is that **the secret rotates as a pair**.
Flip it on Vercel without redeploying Takeover and sends fail
until the desktop app is rebuilt with the new secret. In practice
this is a non-issue — we rebuild Takeover whenever we rotate.

---

## 6. The accept page

`cwa_takeover/src/app/offer/accept/[token]/page.tsx`

The entire page is anon — no auth, no sessions. The `[token]` slug
is the credential. Supabase RLS enforces that only rows matching
the token can be read or updated.

### Derived state — refresh-safe

The "current step" isn't stored anywhere. It's derived from the
DB every render:

```ts
if (!offerAccepted) return 0;                              // offer step
for (let i = 1; i < steps.length - 1; i++) {
  if (steps[i].doc.status !== "signed") return i;          // next unsigned
}
return steps.length - 1;                                   // done
```

So refreshing or coming back later puts the candidate on the right
step. Closed the tab after signing 2 of 4 docs? Next visit lands
on doc 3.

### Stepper

Always shows every step (offer + each companion + welcome).
Completed ones render with a checkmark; the current one is
highlighted with the brand accent. Previously the stepper only
included *pending* docs, which made already-signed ones vanish
when the candidate came back — confusing for a legal-looking flow.

### Signature gate

Each step requires the candidate to:
1. Type their legal name exactly as it appears on the offer (case-
   insensitive comparison, whitespace-trimmed).
2. Tick a consent checkbox with an explicit ESIGN statement.

Only then does the Accept / Sign button enable. The typed name +
timestamp is written to `candidate_signature_name` /
`candidate_signature_at` (offer) or `signed_name` / `signed_at`
(companion doc).

### "Save a copy (PDF)"

`window.print()` plus a scoped `@media print` stylesheet. The key
trick is a dual-render pattern:

- `[data-screen-only]` — the interactive UI (stepper, signature
  panel, header chrome). Hidden in print.
- `[data-print-only]` — a `<PrintBundle>` component that's hidden
  on screen but visible in print. Renders:
  - Cover page with candidate name, employer, generated-at stamp
  - The offer letter body + typed signature + timestamp
  - Every hire document in sign_order, each on its own page, with
    the typed signature + timestamp on signed ones
- `[data-print-doc] { page-break-before: always }` — forces each
  document onto a fresh PDF page.

This way the candidate's saved PDF is a proper multi-page legal
record — not a screenshot of whatever step they happen to be on
when they hit the button. If they hit Save from the Welcome
screen, they still get the full signed package.

---

## 7. Proof of signature — back in Takeover

`SignatureRecordRow` in `HiringActions.tsx`.

For any saved offer the CEO has sent, the top of the actions column
shows:

- **Status pill**: Sent / Signed & accepted / Declined, plus counts
  of signed + pending docs.
- **Offer signature card**: the candidate's typed name in italic
  serif (`/s/ Jack Johnson`) with the exact timestamp.
- **Per-companion card**: one card per hire document with its
  status pill (signed / pending / waived) and the typed signature
  + timestamp if signed.
- **Copy receipt** / **Save .txt**: emits a plain-text audit
  record you can paste into email, Drive, or save alongside the
  offer PDF for compliance records.

The receipt format is stable — same for every candidate, machine-
readable enough to grep, human-readable enough to send to a
lawyer.

---

## 8. Converting to employee

`ConvertRow` in `HiringActions.tsx` fires when the offer status is
`accepted` and no `converted_to_user_id` is set yet. It writes an
`app_users` row and links the offer.

Two edge cases that bit us in testing:

### a) Username already exists

`app_users.username` has a UNIQUE constraint. Re-testing with the
same candidate, or hiring someone who already had an account,
threw `app_users_username_key`. Fix:

```ts
// 1. Check if username exists.
const existing = await supabase.from("app_users")
  .select("id, supa_id, username")
  .eq("username", baseUsername)
  .maybeSingle();

if (existing.data) {
  // Link the offer to the existing user.
  return updateOffer({ converted_to_user_id: existing.data.supa_id });
}

// 2. Otherwise insert, auto-suffixing on rare name collisions.
let username = baseUsername;
let suffix = 2;
while (await taken(username) && suffix <= 20) {
  username = `${baseUsername}-${suffix++}`;
}
```

The success message differs so the CEO knows which path ran
("Linked to existing employee" vs "Created employee").

### b) `converted_to_user_id` is a UUID column

`app_users` has two id-like fields:
- `id` — integer PK
- `supa_id` — UUID from Supabase auth

The FK on `offer_letters.converted_to_user_id` is a UUID. Early
code preferred `id` and fell back to `supa_id`, which threw
`invalid input syntax for type uuid: "28"` whenever an existing
row was found. We now use `supa_id` only, with a clear error
message if the row doesn't have one ("open them in the Employees
page and assign a Supabase auth id first").

---

## 8a. Employer counter-signature (before send)

Before an offer can be emailed to a candidate, the CEO counter-
signs in Takeover using the same ESIGN typed-name pattern as the
candidate will later use. Migration at
`migrations/offer_letters_counter_signature.sql` adds:

- `offer_letters.employer_signature_name`  / `_at`  / `_user_id`
- `hire_documents.employer_signature_name` / `_at` / `_user_id`

Flow:

1. CEO drafts offer + generates any companion docs.
2. `EmployerSignRow` in `HiringActions.tsx` captures the typed
   signature. The typed name must match `employerSignerName`
   (falls back to `employerLegalName`) case-insensitively.
3. On sign, a single transaction stamps:
   - `offer_letters.employer_signature_*` on the offer row
   - `hire_documents.employer_signature_*` on every companion
4. `SendEmailRow` is gated — the email button is disabled until
   counter-signed. The PDF that goes out is rendered by
   `OfferLetterPDF` with the employer column pre-filled: italic
   `/s/ Name`, date, and an "E-SIGNED · ESIGN Act" stamp.
5. On the accept page, both the current-step view and the printed
   PDF bundle render a green "Counter-signed by employer" block
   above the candidate's own signature block.

### New docs after signing

If the CEO generates a new companion doc AFTER counter-signing,
it won't carry the sig automatically. The row shows a warning
with the unsigned count and a "Clear signature (won't send until
re-signed)" button. Re-signing re-stamps everything with a fresh
timestamp, making the signature event consistent across the
whole package.

### Clearing the sig

An escape-hatch link in the signed-state display wipes
`employer_signature_*` on both tables if something needs to be
redone. Disabled once the offer has been `emailed_at` — at that
point the candidate has the signed PDF and you can't retroactively
unsign their copy.

---

## 8b. Auto-reminders for stale offers

The cwa_takeover website runs a daily Vercel Cron that scans for
offers we sent ≥ 2 days ago without a response and sends a single
friendly nudge. One reminder per offer — no spam loops.

Full details in [`OFFER_REMINDERS.md`](./OFFER_REMINDERS.md).
Short version:

- Migration `migrations/offer_letters_reminder.sql` adds a
  `reminder_sent_at` column + partial index.
- Cron route: `cwa_takeover/src/app/api/cron/offer-reminders/route.ts`.
- Schedule: `0 15 * * *` (15:00 UTC daily).
- Email template: `cwa_takeover/emails/offer-reminder.tsx`.
- Auth: `CRON_SECRET` bearer token that Vercel sends automatically.
- Uses `SUPABASE_SERVICE_ROLE` (cron can't present an anon token).

The cron is idempotent: after sending, `reminder_sent_at` is
stamped so the row never qualifies again. On send failure the
stamp is skipped so the next run retries.

---

## 9. Environment variables

### Takeover desktop (`.env.local`)

```env
VITE_TAKEOVER_SITE_URL=https://takeover.codewithali.com
VITE_EMAIL_HMAC_SECRET=<64+ char hex>
VITE_SUPABASE_URL=<takeover project url>
VITE_SUPABASE_ANON_KEY=<takeover anon key>
```

### cwa_takeover website (Vercel env)

```env
EMAIL_HMAC_SECRET=<same 64+ char hex as Takeover>
RESEND_API_KEY=<Resend key>  # or RESEND_EMAIL_KEY — both accepted
EMAIL_TIMESTAMP_WINDOW_SECONDS=300  # optional, default 300
NEXT_PUBLIC_SUPABASE_URL=<takeover project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<takeover anon key>

# Cron reminders:
CRON_SECRET=<long random string — Vercel Cron sends this as Bearer auth>
SUPABASE_URL=<takeover project url>          # same as NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE=<service-role key>     # CRON ONLY — never in client bundles
REMINDER_DELAY_DAYS=2                        # optional, default 2
REMINDER_MAX_PER_RUN=25                      # optional, safety cap
```

**Important**: `NEXT_PUBLIC_SUPABASE_URL` must point at the
*Takeover* Supabase project, not the Simplicity one. We hit this
during deploy — the accept page was querying Simplicity's DB and
returning "offer not found" for valid tokens. The anon key being
public means it's safe in the JS bundle; RLS on the offer_letters
table is the actual security layer.

---

## 10. What the system DOESN'T do (yet)

- **Final-PDF archival** to Supabase Storage for compliance. Right
  now the canonical record lives in the DB (signed_name +
  signed_at) plus whatever the candidate saved to their disk. A
  periodic job could assemble a timestamped PDF and dump it in a
  private bucket.
- **DocuSign escalation** for higher-stakes roles. Typed-name
  signatures are legally binding under ESIGN for employment + 1099
  relationships in the US; for real-estate or financial-instrument
  signings, integrate a heavier provider.

---

## 11. File index

### CWA-Manager (Takeover desktop)

| File                                                           | Purpose                               |
|----------------------------------------------------------------|---------------------------------------|
| `src/MyComponents/OfferLetters/OfferLettersDashboard.tsx`      | Main UI; drafts + saves offers        |
| `src/MyComponents/OfferLetters/HiringActions.tsx`              | Actions column (send, convert, audit) |
| `src/MyComponents/OfferLetters/OfferLetterPDF.tsx`             | @react-pdf/renderer template          |
| `src/MyComponents/OfferLetters/draftOffer.ts`                  | Claude prompt for offer letter        |
| `src/MyComponents/OfferLetters/draftCompanion.ts`              | Claude prompt for companion docs      |
| `src/MyComponents/OfferLetters/sendEmailViaTakeover.ts`        | HMAC signing + fetch                  |
| `migrations/hire_documents_signatures.sql`                     | DB migration for signature columns    |
| `docs/EMAIL_SEND_SETUP.md`                                     | Email setup walkthrough               |

### cwa_takeover (public website)

| File                                                           | Purpose                                |
|----------------------------------------------------------------|----------------------------------------|
| `src/app/api/email/offer-letter/route.ts`                      | Hono route + HMAC verify + Resend send |
| `emails/offer-letter.tsx`                                      | React Email template                   |
| `src/app/offer/accept/[token]/page.tsx`                        | Public multi-step accept page          |
| `src/lib/supabase.ts`                                          | Supabase anon client                   |

---

## 12. Deployment notes

- Takeover is built with `bun run tauri build`. Rebuild whenever
  `EMAIL_HMAC_SECRET` rotates — the secret is baked into the
  desktop bundle.
- cwa_takeover deploys to Vercel on every push. Env changes
  require a redeploy to take effect (Vercel re-injects env on
  build).
- The accept URL in emails comes from `VITE_TAKEOVER_SITE_URL`.
  If this is wrong, the email link points at localhost and the
  candidate hits a dead URL. Always sanity-check this env in the
  Tauri build before sending a real candidate their offer.
- Supabase RLS policies live alongside the schema in `migrations/`.
  If you clone the DB to a new project, run the migrations to
  get the policies.
