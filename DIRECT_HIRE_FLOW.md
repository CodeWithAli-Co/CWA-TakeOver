# Direct Hire Flow — Backend Reference

## What this feature is

A fast-track onboarding path that lets an operator (CEO / COO / CFO / Admin) bring someone straight into Takeover without going through the candidate → offer letter pipeline. Use case: internal referrals, known hires, anyone we already trust.

A direct hire was **never** a candidate in the application sense — they don't have a resume, a `why_role`, or a `fit_score`. So we keep them out of the `candidates` table entirely and just stamp the `app_users` row with how they got in.

---

## End-to-end flow

```
[CWA-Manager dashboard]                [takeover server]              [Supabase]
       │
   1. Operator clicks
      "+ Direct Hire"
       │
   2. Fills form:
      name, email, role, company
       │
   3. inviteUserViaTakeover() ─────►  /api/auth/invite-user ─────►   auth.admin.inviteUserByEmail()
       │                              (HMAC-signed)                       │
       │                                     │                            │
       │◄──── { userId, actionLink } ◄───────┘                            │
       │                                                                  │
   4. supabase.from("employee").insert({                                  │
        username, role, company, email,                                   │
        supa_id: <auth UUID>,                                             │
        hire_source: "direct_referral",                                   │
        referred_by: <operator supa_id>                                   │
      })  ──────────────────────────────────────────────────────────►     │
       │                                                                  │
   5. ensureOnboardingFor(authUserId)                                     │
        → insert onboarding_instances (offer_letter_id = NULL)            │
        → copy template items into onboarding_items                       │
       │                                                                  │
   6. Show success state with                                             │
      Copy button + invite link                                           │
       │                                                                  │
   7. Supabase sends the                                              ◄───┤
      set-password email automatically
```

---

## What lives where

### CWA-Manager (desktop client)

| File | Purpose |
|---|---|
| `src/MyComponents/Hiring/DirectHireDialog.tsx` | The dialog UI + orchestration. Two states: form → success. |
| `src/MyComponents/Hiring/HiringDashboard.tsx` | Button gate (C-level only). Opens the dialog. |
| `src/MyComponents/OfferLetters/inviteUserViaTakeover.ts` | HMAC-signed POST to the takeover server's invite endpoint. Now also surfaces `actionLink`. |
| `src/MyComponents/Onboarding/ensureOnboarding.ts` | Reused as-is. Idempotent template selection + instance + items insert. Already supports `offer_letter_id = NULL`. |
| `migrations/direct_hire.sql` | Adds `hire_source` and `referred_by` columns to `app_users`. |

### Takeover server (Next.js, separate deployment)

| Path | Purpose | Status |
|---|---|---|
| `/api/auth/invite-user` | Verifies HMAC, calls `supabase.auth.admin.inviteUserByEmail()`, returns `{ userId, email }`. | **Needs the change below.** |

---

## The schema change

`migrations/direct_hire.sql` is idempotent and safe to re-run. It adds two columns to `app_users`:

```sql
hire_source text  DEFAULT 'application'  CHECK IN ('application', 'direct_referral')
referred_by uuid  -- soft reference to app_users.supa_id (no FK; see below)
```

**Why no FK on `referred_by`** — `app_users.supa_id` isn't UNIQUE on every install (some rows have NULL or duplicates from data import). Postgres won't accept a FK pointing at a non-UNIQUE column. The client validates the referrer's `supa_id` before insert. If you ever add a UNIQUE constraint to `supa_id`, you can layer the FK back on.

**Why on `app_users` instead of a new column on `candidates` or a new table** — a direct hire was never a candidate in the application sense. They have no resume, no `why_role`, no `fit_score`. Adding them to `candidates` means half-empty rows that pollute the Hiring dashboard. A column on `app_users` keeps the origin trackable without bending the candidates pipeline shape.

---

## The one backend change you need to make

Right now `/api/auth/invite-user` returns:

```json
{ "userId": "uuid", "email": "..." }
```

We want it to **also** return the action link from Supabase so the desktop UI can show a copy-able URL alongside the auto-sent email:

```json
{ "userId": "uuid", "email": "...", "action_link": "https://..." }
```

### Implementation

`supabase.auth.admin.inviteUserByEmail()` already returns the action link in its response data. Just pass it through:

```ts
// inside /api/auth/invite-user
const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${SITE_URL}/auth/set-password`,
  data: { candidate_name: candidateName },
});

if (error) {
  // existing error handling — 409 for "already registered" etc.
  return NextResponse.json({ error: error.message }, { status: 400 });
}

return NextResponse.json({
  userId: data.user?.id,
  email: data.user?.email,
  action_link: data.properties?.action_link,  // ← NEW: pass through
});
```

The desktop client already reads both `action_link` (snake_case) and `actionLink` (camelCase), so either works. If you don't ship this change, the desktop UI still works — it just shows "invite email sent" without the copy-link feature.

### Optional: generate the link without sending the email

If you want operators to be able to share a link without Supabase auto-emailing the candidate (some use cases — e.g., they want to deliver via Slack only), use `generateLink` instead of `inviteUserByEmail`:

```ts
const { data, error } = await supabase.auth.admin.generateLink({
  type: 'invite',
  email,
  options: { redirectTo: `${SITE_URL}/auth/set-password` },
});
// data.properties.action_link is the link, no email auto-sent
```

We're not asking for this right now — current spec is "both email + copy link" — but it's worth knowing the toggle exists.

---

## How the client handles failure modes

Schema variance across installs is real (different `app_users` column sets in different DBs). The dialog handles it with a progressive-strip retry:

1. **Attempt 1** — full payload with `hire_source`, `referred_by`, `company`.
2. **Attempt 2** — strip `hire_source` + `referred_by` (covers "migration not run yet").
3. **Attempt 3** — also strip `company` (covers installs where `app_users.company` doesn't exist; matches what the offer-letter convert flow does).

If all three fail, the auth user has already been created (because the invite ran first) but the `app_users` row hasn't. The operator gets an error message telling them to retry once the schema is fixed. The orphan auth user can be cleaned up manually or via a periodic janitor.

---

## Onboarding hand-off

After `app_users` insert succeeds, the client calls `ensureOnboardingFor(authUserId)`:

- Looks for an active `onboarding_instances` row for the user — if one exists, no-op.
- Otherwise selects an `onboarding_templates` row (matched by brand + employment type, with fallback to brand-only, then any active template, then a built-in default if the table is empty).
- Inserts a fresh `onboarding_instances` row with `offer_letter_id = NULL` (this is what's different from the application flow) and `employee_user_id = <auth UUID>`.
- Copies the template's `item_list` JSON into concrete `onboarding_items` rows.

The same function runs on first sign-in for any user, so even if the dialog's onboarding step fails, the user is self-healing — they'll get an onboarding instance the moment they log in.

---

## Audit / reporting queries

Tracking who came in how:

```sql
-- How many hires by source, per month
select date_trunc('month', created_at) as month,
       hire_source,
       count(*)
  from app_users
 group by 1, 2
 order by 1 desc;

-- Who has @someone referred?
select referred.username, referred.email, referred.created_at
  from app_users referred
  join app_users referrer on referrer.supa_id = referred.referred_by
 where referrer.username = '<your username>';

-- All direct hires waiting on first sign-in
select au.username, au.email, au.created_at
  from app_users au
  left join auth.users u on u.id = au.supa_id
 where au.hire_source = 'direct_referral'
   and u.last_sign_in_at is null;
```

---

## RLS / permission notes

The dialog only sends `referred_by` for the *current operator's* supa_id (read from `ActiveUser()`). The client can't spoof another user as referrer because the value comes from their own session.

If you add a new RLS policy that restricts `app_users` writes — make sure C-level roles can still insert rows where `hire_source = 'direct_referral'` AND `referred_by = auth.uid()`. The existing offer-letter convert flow already inserts rows, so whatever policy currently allows that will allow this too.

---

## TL;DR for the backender

1. **One change you own**: make `/api/auth/invite-user` return `action_link` from the Supabase admin response. ~3 line edit.
2. **Schema migration**: run `migrations/direct_hire.sql` against Supabase. Idempotent.
3. **Nothing else**: the rest is client-side. The flow uses `inviteUserByEmail` (which you already wire up) and writes directly to `app_users` + onboarding tables from the desktop client over the standard Supabase REST API.
