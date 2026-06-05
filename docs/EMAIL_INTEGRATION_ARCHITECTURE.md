# Email integration architecture — Gmail OAuth

Status: **decisions locked-in below**. Awaiting Google Cloud setup before code lands.

## Decisions made (2026-06)

| Decision | Choice | Rationale |
|---|---|---|
| OAuth callback location | takeover-B2B at `https://www.takeover.systems/api/gmail/oauth-callback`. Also register the apex `https://takeover.systems/api/gmail/oauth-callback` and `http://localhost:3000/api/gmail/oauth-callback` for dev. | Client secret stays server-side; same pattern as Stripe connect. Both apex and www registered because Google doesn't follow redirects on the callback URL. |
| Token storage DB | **Per-tenant Supabase** (`companySupabase`), not master | Multi-tenant isolation — each customer's Gmail tokens never share storage with another's. See "Multi-tenant note" below. |
| Encryption | AES-256-GCM with `EMAIL_TOKEN_SECRET` server-side | Desktop never sees plaintext tokens |
| Connect → desktop handshake | Realtime subscription on `gmail_connections` filtered by `user_supa_id` | Same proven pattern as Stripe; no per-OS protocol handlers |
| Scopes | `gmail.send` + `gmail.readonly` | Minimum needed for draft-and-send + inbox sync. Avoid `gmail.modify` so we don't have label-edit power we don't need. |
| Verification status | "Testing" mode in Google Cloud, max 100 listed test users | Acceptable for early adopters; full verification is its own multi-week project for general launch |

## Multi-tenant note (important)

The CRM is going to production for **every company using Takeover**, not just CWA. This means:

1. **`gmail_connections` lives on the per-tenant `companySupabase`**, not the master `takeOversupabase`. That way one tenant's compromised database can't expose any other tenant's Gmail tokens. The takeover-B2B proxy needs to resolve which tenant's Supabase to write to before persisting tokens — it can do this by looking up the user's tenant in the master `takeover_companies` registry (keyed by `user_supa_id`).

2. **The CRM tables themselves (`crm_companies`, `crm_contacts`, `crm_deals`, `crm_activities`) are currently on the master DB and should also move to per-tenant.** Same reasoning. This is technical debt, not Gmail-arc scope, but it's the next architectural fix after email integration ships. Flagged here so it doesn't get forgotten.

3. **The encryption key (`EMAIL_TOKEN_SECRET`) is global** to takeover-B2B, not per-tenant. That's fine — the server owns the key, and per-tenant DB isolation already prevents one tenant from reading another's encrypted blobs even if both used the same key. If we ever want per-tenant keys (KMS-style), that's a future enhancement and doesn't change the desktop-side API.

## Goal

Let reps connect their own Gmail account, draft + send emails from inside the deal/contact drawers, and have replies + sent messages auto-log as `crm_activities` against the right contact and deal.

## The three big questions

These determine the architecture. Once decided everything else is plumbing.

### Q1. Where does the OAuth callback land?

Google requires a public HTTPS redirect URI. The Tauri desktop app is on the user's machine, so the callback has to hit something publicly addressable, then hand control back to the desktop.

Three options:

**Option A — takeover-B2B route (recommended).**
Callback hits `https://codewithali.com/api/gmail/oauth-callback`. Server exchanges code → tokens → encrypts → writes to `gmail_connections`. Server then renders a "You can close this tab" success page. Desktop is already subscribed to the realtime channel for `gmail_connections` (filtered by the user's `user_supa_id`), sees the new row appear, flips its UI to "Connected".

Why this is clean: one redirect URI registered with Google, no platform-specific URL scheme handlers, works on Windows/Mac/Linux identically, server holds the client secret (not the desktop binary).

**Option B — Tauri deep link (`takeover://oauth/google/callback`).**
Register a custom URL scheme in `tauri.conf.json`. Google redirects to it. OS routes back to the running desktop app via the protocol handler. Desktop handles the code exchange itself.

Why I don't love this: the **client secret would have to ship in the desktop binary** to do the code exchange. Anyone can decompile and pull it. Public OAuth clients exist (PKCE flow without client secret) but Google's gmail.send and gmail.modify scopes typically require a confidential client. Also Windows protocol handler registration is finicky.

**Option C — localhost server in Tauri.**
Tauri spins up `http://localhost:<random>/oauth/callback`. Google redirects there. Same client-secret-in-binary problem as B, plus firewall prompts on first run.

**Recommendation: Option A.** It's how Zapier, Calendly, and HubSpot do it. The desktop polls Supabase realtime for the new connection record and updates UI; no custom protocol handlers required.

### Q2. Where are tokens stored, and how are they encrypted?

`gmail_connections` table on the **master Supabase** (takeOversupabase). One row per `(user_supa_id, email)` pair — a user could connect multiple Gmail accounts if we ever want that.

```sql
CREATE TABLE public.gmail_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_supa_id    uuid NOT NULL,
  email           text NOT NULL,
  access_token    text NOT NULL,     -- encrypted
  refresh_token   text NOT NULL,     -- encrypted
  expires_at      timestamptz NOT NULL,
  scopes          text[] NOT NULL,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_sync_at    timestamptz,
  UNIQUE (user_supa_id, email)
);
```

**Encryption.** Tokens are encrypted with `pgsodium` (or app-level AES-256-GCM if we don't want to enable pgsodium) using a server-side secret stored in the takeover-B2B environment. The encryption key never leaves the server — the desktop client never sees plaintext tokens, it only ever sends "send this email" / "sync this contact" requests through the takeover-B2B proxy, which decrypts the token, calls Gmail, and returns the result.

**RLS.** `SELECT/UPDATE/DELETE` allowed only when `user_supa_id = auth.uid()`. Insert + write of the token columns is done via the service-role key on the server-side callback route only — never from the client.

### Q3. How does the desktop know the connection succeeded?

After the OAuth callback finishes its work, the user is sitting on the "You can close this tab" page. The desktop needs to know "the user just connected" without manual refresh.

**Realtime subscription on `gmail_connections`** filtered by `user_supa_id`. When the row appears, the connect modal flips to the success state showing the connected email + a "Done" button. Same pattern Stripe uses today after the proxy route writes a `stripe_connections` row.

Backup: refetch on window focus, in case realtime is down.

---

## Sequence diagrams

### Connect Gmail

```
Desktop                    Browser                    takeover-B2B           Google
   │                          │                            │                    │
   │  build authorize URL     │                            │                    │
   │ ────────────────────────►│                            │                    │
   │   open in default browser│  redirect with code+state  │                    │
   │                          │ ───────────────────────────┼────────────────────►
   │                          │                            │   /authorize       │
   │                          │ ◄──────────────────────────┼─────────────────── │
   │                          │   GET /api/gmail/oauth-callback?code=...        │
   │                          │ ──────────────────────────►│                    │
   │                          │                            │  POST /token       │
   │                          │                            │ ──────────────────►│
   │                          │                            │  {access,refresh}  │
   │                          │                            │ ◄────────────────  │
   │                          │                            │ encrypt + insert   │
   │                          │                            │ into gmail_conns   │
   │                          │  "you can close this tab"  │                    │
   │                          │ ◄──────────────────────────│                    │
   │  realtime INSERT event   │                            │                    │
   │ ◄────────────────────────┼────────────────────────────┤                    │
   │  flip UI to "Connected"  │                            │                    │
```

### Send email

```
Desktop                   takeover-B2B                   Google Gmail
   │                          │                                 │
   │ POST /api/gmail/send     │                                 │
   │  {to, subject, body}     │                                 │
   │ ────────────────────────►│                                 │
   │                          │ lookup gmail_conns by user      │
   │                          │ decrypt access_token            │
   │                          │ if expires_at < now: refresh    │
   │                          │ encode RFC822                   │
   │                          │ POST messages.send              │
   │                          │ ───────────────────────────────►│
   │                          │ ◄───────────────────────────────│
   │  {sent_id, thread_id}    │                                 │
   │ ◄────────────────────────│                                 │
   │ INSERT crm_activity      │                                 │
   │   type=email,            │                                 │
   │   contact_id, deal_id    │                                 │
```

### Sync inbox per contact

Called when a contact drawer opens. Pulls last 20 messages between the connected user and that contact's email and upserts them as `crm_activities`.

Dedup by `gmail_message_id` (new column on `crm_activities`) so re-syncing doesn't dupe. Body stored as `body_md`; subject as `title`; `happened_at` from message date.

---

## File-level plan

### takeover-B2B (server-side)

| Path | Purpose |
|---|---|
| `app/api/gmail/oauth-start/route.ts` | Returns the Google authorize URL with our client id, scopes, signed state |
| `app/api/gmail/oauth-callback/route.ts` | Exchanges code → tokens, encrypts, inserts row, renders success page |
| `app/api/gmail/send/route.ts` | Decrypts tokens, sends via Gmail API, refreshes token if needed |
| `app/api/gmail/sync/route.ts` | Lists messages between connected user and a contact email |
| `lib/gmail.ts` | Shared client (refresh, encode RFC822, decrypt helper) |
| `lib/crypto.ts` | Token encryption (AES-256-GCM with `EMAIL_TOKEN_SECRET`) |

### CWA-Manager (desktop client)

| Path | Purpose |
|---|---|
| `migrations/gmail_connections.sql` | Schema + RLS |
| `src/stores/gmail.ts` | TanStack Query hooks: useGmailConnection, useSendEmail, useSyncContactInbox |
| `src/MyComponents/Settings/GmailConnection.tsx` | Connect / Disconnect UI |
| `src/MyComponents/Sales/DealAiStrip.tsx` | Wire Send button to useSendEmail (replaces disabled stub) |
| `src/MyComponents/Sales/ContactsView.tsx` | Pull synced messages into the activity timeline |

---

## What I need from you before I start writing code

Walk through the **Google Cloud setup** section below end-to-end. Once that's done, I start on Email 2 (schema on per-tenant Supabase) and work down. The architecture decisions in the table at the top of this doc are locked.

## Google Cloud setup — step by step

This is what you need to do before I start writing code. Should take about 20-30 minutes the first time. I'll walk you through each step; nothing on this list is optional.

### Step 1 — Create (or pick) a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Top bar, project dropdown → "New Project".
3. Name it something like `takeover-prod` (or reuse an existing project if you have one for the company).
4. No need to pick an organization unless you have a Google Workspace org.
5. Hit Create. Wait ~10 seconds, then make sure that project is selected in the top-bar dropdown.

### Step 2 — Enable the Gmail API

1. Left nav → "APIs & Services" → "Library".
2. Search "Gmail API". Click the result.
3. Hit "Enable". This takes a few seconds.

(You only need this one API enabled. We're not touching Calendar, Drive, Contacts, or anything else for this arc.)

### Step 3 — Configure the OAuth consent screen

This is what users see when they click "Connect Gmail" and Google asks them to grant permission.

1. Left nav → "APIs & Services" → "OAuth consent screen".
2. User type: **External**. (Internal only works if you have a Google Workspace org and want to restrict to it.)
3. Click Create.

Fill in:

- **App name**: `Takeover` (or whatever your customer-facing name is)
- **User support email**: your email
- **App logo**: optional for now — Google requires it only at full verification time
- **App domain — homepage**: `https://www.takeover.systems`
- **App domain — privacy policy URL**: needs to exist at e.g. `https://www.takeover.systems/privacy` (Google will validate this URL when you submit for verification; for Testing mode you can technically skip but I'd put a stub page up now)
- **App domain — terms of service URL**: same deal — e.g. `https://www.takeover.systems/terms`
- **Authorized domains**: add `takeover.systems` (apex form only, no `www.`, no https://, no paths — this single entry covers all subdomains including `www.`)
- **Developer contact information**: your email

Click Save and Continue.

### Step 4 — Add scopes

On the Scopes screen:

1. Click "Add or Remove Scopes".
2. Search for `gmail.send` — check the box for `https://www.googleapis.com/auth/gmail.send`.
3. Search for `gmail.readonly` — check the box for `https://www.googleapis.com/auth/gmail.readonly`.
4. Click "Update". Both scopes should now show under "Restricted scopes" with a yellow icon — that's expected; these are restricted scopes that require verification before going to general production (still fine for Testing mode).
5. Click Save and Continue.

### Step 5 — Add yourself + early adopters as test users

While the app is in Testing mode, only emails on the test users list can connect Gmail. Max 100.

1. On the Test users screen, click "Add users".
2. Add your email. Add any teammates or design partners who'll be testing.
3. Click Save and Continue.

You can add more later from the same screen. Hitting 100 means it's time to submit for verification.

### Step 6 — Create the OAuth client

1. Left nav → "APIs & Services" → "Credentials".
2. Click "Create Credentials" at the top → "OAuth client ID".
3. Application type: **Web application**.
4. Name: `Takeover (takeover-B2B)`.
5. **Authorized redirect URIs** — add ALL THREE:
   - `https://www.takeover.systems/api/gmail/oauth-callback` ← canonical, what the desktop app sends
   - `https://takeover.systems/api/gmail/oauth-callback` ← apex form, registered as a safety net because Google does NOT follow redirects on the callback URL; if your edge ever sends Google to apex by mistake the call would otherwise fail with `redirect_uri_mismatch`
   - `http://localhost:3000/api/gmail/oauth-callback` ← local dev
6. Leave "Authorized JavaScript origins" empty — we don't need them for server-side flow.
7. Click Create.

A modal appears with:

- **Client ID** — looks like `123456789012-abcdefgh.apps.googleusercontent.com`
- **Client secret** — looks like `GOCSPX-something`

Copy both. You'll paste them as environment variables next.

### Step 7 — Set environment variables on takeover-B2B

In your takeover-B2B deployment (Vercel, etc.) and your local `.env.local`, add these three:

```
GOOGLE_OAUTH_CLIENT_ID=<the client id from step 6>
GOOGLE_OAUTH_CLIENT_SECRET=<the client secret from step 6>
EMAIL_TOKEN_SECRET=<run `openssl rand -hex 32` and paste the output>
```

The `EMAIL_TOKEN_SECRET` is what we use to encrypt tokens at rest. **Generate it once and never change it** — rotating it would invalidate every existing Gmail connection. If you ever do need to rotate, that's a separate migration where we decrypt with the old key and re-encrypt with the new one.

For local dev: same three vars in `.env.local` of the takeover-B2B repo. Different `EMAIL_TOKEN_SECRET` value is fine for local — tokens written in dev won't decrypt in prod and vice versa, which is what you want.

### Step 8 — Tell me you're done

When all of the above is in place, just say "Google setup done" and I start on Email 2 (schema). I'll need you to confirm:

- [ ] Project created and Gmail API enabled
- [ ] OAuth consent screen configured (External, Testing mode, both scopes added)
- [ ] Your email is on the test users list
- [ ] OAuth client created with both redirect URIs registered
- [ ] All three env vars set on takeover-B2B production and local

### Troubleshooting tips for later

- "access_denied" on the consent screen → user isn't on the test users list, or the app is in a verification-pending state with restricted scopes.
- "redirect_uri_mismatch" → the URI in the OAuth client doesn't exactly match what the app sends. They have to match including the trailing path and protocol.
- "invalid_grant" on refresh → the refresh token has been revoked (user disconnected from Google's side, or 6 months of inactivity in Testing mode). Re-auth is the only fix.

## What I'm not doing in this arc

These are out of scope for the first email build. Capturing them so they don't get forgotten:

- **Outlook / Microsoft 365 OAuth.** Same pattern, different provider. Easy to layer once Gmail works.
- **Email open / click tracking.** Requires a tracking pixel + redirect server. Separate epic.
- **Templates with merge tags.** The AI draft mostly replaces this.
- **Bulk send / sequences.** Separate epic.
- **Inbound spam handling.** Gmail does this for us — our sync just consumes the inbox as-is.
