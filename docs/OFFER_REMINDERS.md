# Offer reminder emails — setup guide

The cwa_takeover website runs a **daily Vercel Cron** that scans
for offers we sent but haven't heard back on, and sends one
friendly nudge. One reminder per offer — no spam loops.

## How the cron picks rows

Every run scans `offer_letters` for:

- `status = 'sent'` — neither accepted nor declined
- `emailed_at < now() - REMINDER_DELAY_DAYS` (default 2 days)
- `reminder_sent_at IS NULL` — not nudged yet
- `declined_at IS NULL`
- `offer_expires_at IS NULL OR offer_expires_at > now()`
- `acceptance_token IS NOT NULL` AND `candidate_email IS NOT NULL`

For each match:
1. Renders `emails/offer-reminder.tsx` to HTML via
   `@react-email/render`.
2. Sends via Resend with both HTML + plain-text bodies.
3. On success, stamps `reminder_sent_at = now()` so no future run
   picks it up again.
4. On failure, leaves the row alone — the next day's run will try
   again.

## Schedule

Defined in `cwa_takeover/vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/offer-reminders", "schedule": "0 15 * * *" }
  ]
}
```

15:00 UTC = 8 AM Pacific / 11 AM Eastern — candidates see the
nudge in their morning inbox. Change the cron expression if you
want a different cadence.

Vercel's cron precision is "within the hour", not "at the second",
so don't tie anything time-sensitive to this.

## Env vars (Vercel)

Add all of these to the cwa_takeover Vercel project:

```env
# Auth header Vercel Cron sends on every invocation.
CRON_SECRET=<long random string — e.g. `openssl rand -hex 32`>

# Supabase service-role key — required because the cron isn't
# running as an anon user against an acceptance token. It needs
# to read offers across the table.
SUPABASE_URL=<takeover supabase url>
SUPABASE_SERVICE_ROLE=<service role key>

# Already set for the offer-letter send route:
RESEND_API_KEY=<resend key>
VITE_TAKEOVER_SITE_URL=<e.g. https://takeover.codewithali.com>

# Optional tuning:
REMINDER_DELAY_DAYS=2        # default 2
REMINDER_MAX_PER_RUN=25      # safety cap on sends per cron tick
```

⚠️ **`SUPABASE_SERVICE_ROLE` is powerful.** It bypasses RLS. Only
expose it to the cron route, never ship it in a client bundle.

## Auth — why the service-role key

The regular anon flow used by the accept page works by presenting
the unguessable `acceptance_token` and letting RLS match it. That
model breaks for the cron — the cron doesn't know any single
candidate's token; it needs to enumerate offers across all
candidates. Two options:

1. **Service-role key** (chosen). Bypasses RLS for the cron
   lifecycle only. Simplest, matches common Supabase cron
   patterns.
2. **Stored procedure with SECURITY DEFINER**. Create a DB
   function owned by a privileged role that the anon client can
   call. More plumbing for the same outcome.

The cron route is the only place the service-role key lives; the
`CRON_SECRET` on the `Authorization` header is what prevents
random GET requests from reaching it.

## Running the migration

```sql
-- migrations/offer_letters_reminder.sql
-- Adds reminder_sent_at column + partial index.
```

Safe to re-run (all `if not exists`).

## Testing locally

```bash
# Simulate the cron locally:
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/offer-reminders
```

Returns JSON:

```json
{
  "status": "ok",
  "scanned": 3,
  "sent": 2,
  "cutoff": "2026-04-19T15:00:00.000Z",
  "errors": [
    { "id": "abc…", "message": "Resend rejected: invalid recipient" }
  ]
}
```

- `scanned` — rows that matched the staleness window (before
  expiry filtering).
- `sent` — reminders successfully delivered + stamped.
- `errors` — per-offer failures; the row is left un-stamped so
  the next run retries.

## Testing in production

Vercel shows cron invocations in the project's **Logs → Cron Jobs**
tab. Each invocation logs the JSON response body, so you can see
scanned/sent counts and any per-row errors.

To trigger an ad-hoc run without waiting for 15:00 UTC, hit the
endpoint directly with a valid `CRON_SECRET` bearer token. There's
no risk of double-sending — once `reminder_sent_at` is stamped,
the row never qualifies again.

## What the nudge email looks like

Same brand glow as the offer email, but:

- No PDF re-attachment (candidates still have the original)
- Explicit "we haven't heard back" framing
- Humanized "we sent this 2 days ago" phrasing
- Big Review & Respond button + plain-URL fallback panel
- Pulled from `emails/offer-reminder.tsx`

## If you want to disable reminders for a specific candidate

Either:

```sql
-- Pre-stamp so the cron skips them.
update offer_letters
  set reminder_sent_at = now()
  where id = '<offer_id>';
```

Or set their `offer_expires_at` in the past to take them out of
the pool entirely.

## Rolling it back

Delete `vercel.json`'s `crons` entry and redeploy. The route still
exists (harmless) but won't fire on a schedule. The DB column can
stay — it's tiny and no other code writes to it.
