# Sales CRM — Architectural Proposal

**Module name:** `/sales`
**Status:** Pre-implementation, design phase
**Why:** Takeover's positioning is "replaces 15 SaaS tools." HubSpot is on that list. Integrating with it undercuts the pitch; replacing it makes Takeover the destination instead of a complement.

**Scope decisions (from user, ratified):**
1. Full first cut — deals + contacts + companies + activities + notes (~12–14 days)
2. **Unified contacts table** — Stripe customers and CRM prospects share one table, lifecycle status field tracks where they are. Single source of truth.
3. Top-level **`/sales`** route — first-class module next to `/financial`, `/operations`, `/workspace`

---

## What we're replacing in HubSpot

| HubSpot feature | Takeover equivalent (this module) |
|---|---|
| Contacts | `crm_contacts` — unified with Stripe customers |
| Companies | `crm_companies` |
| Deals + pipeline | `crm_deals` + kanban view |
| Activities (call, email, note, meeting) | `crm_activities` timeline |
| Lifecycle stages | `crm_contacts.lifecycle_stage` column |
| Lead source attribution | `crm_contacts.source` + `crm_deals.source` |
| Deal forecasting | Pipeline weighted by `probability * amount_cents` |
| Owner assignment | `*.owner_supa_id` everywhere |
| Sales reporting | Aggregations in landing dashboard |

Out of scope for first cut (later, possibly as separate modules): email campaigns, sequences, lead scoring algorithm, public web forms, helpdesk tickets, calling/SMS, marketing attribution beyond `source`.

---

## Data model

Five tables. Naming follows the existing `cwa_*` / `crm_*` convention seen in `cwa_todos`, `cwa_meetings`, etc.

### `crm_contacts`

The unified contacts table. One row per person, whether they're a cold lead, a paying customer, or a churned one.

```sql
create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,                          -- normalized, unique per workspace
  phone text,
  title text,                          -- "Head of Eng", "Founder", etc.
  company_id uuid references crm_companies(id) on delete set null,
  owner_supa_id uuid references app_users(supa_id),
  lifecycle_stage text not null default 'lead',
    -- enum-ish: lead, mql, sql, opportunity, customer, churned
  source text,                         -- 'waitlist', 'website', 'referral', 'demo', 'inbound', ...
  score smallint default 0,            -- 0–100, computed later when scoring lands
  tags text[] default '{}',
  stripe_customer_id text,             -- set when they convert; FK-by-string to Stripe
  first_touched_at timestamptz default now(),
  last_contacted_at timestamptz,
  next_step_at timestamptz,            -- "ping them on this date"
  notes_md text,                       -- markdown notes pinned to the contact
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on crm_contacts (lifecycle_stage);
create index on crm_contacts (owner_supa_id);
create index on crm_contacts (company_id);
create index on crm_contacts (email);
create unique index on crm_contacts (lower(email)) where email is not null;
```

### `crm_companies`

```sql
create table crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,                         -- 'acme.com', used for auto-attribution
  industry text,
  size_employees smallint,
  arr_estimate_cents bigint,
  website text,
  linkedin_url text,
  owner_supa_id uuid references app_users(supa_id),
  notes_md text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index on crm_companies (lower(domain)) where domain is not null;
```

### `crm_deals`

```sql
create table crm_deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_id uuid references crm_contacts(id) on delete set null,
  company_id uuid references crm_companies(id) on delete set null,
  owner_supa_id uuid references app_users(supa_id),
  stage text not null default 'interested',
    -- enum-ish: interested, demo, proposal, negotiation, won, lost
  amount_cents bigint not null default 0,
  currency text not null default 'usd',
  probability smallint default 50,     -- 0–100, used for weighted forecast
  source text,
  close_date_expected date,
  close_date_actual date,
  lost_reason text,
  position numeric,                    -- for kanban row ordering within a stage
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on crm_deals (stage);
create index on crm_deals (owner_supa_id);
create index on crm_deals (contact_id);
create index on crm_deals (company_id);
```

### `crm_activities`

The unified timeline. Replaces "log a call", "log an email", "left a note" as one table with a `type`.

```sql
create table crm_activities (
  id uuid primary key default gen_random_uuid(),
  type text not null,
    -- enum-ish: call, email, meeting, note, task, demo, sms
  title text,
  body_md text,
  contact_id uuid references crm_contacts(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  actor_supa_id uuid references app_users(supa_id),
  happened_at timestamptz default now(),
  duration_minutes smallint,
  outcome text,                        -- "no answer", "left voicemail", "moved to demo"
  meeting_id uuid references cwa_meetings(id) on delete set null,
    -- bridge so logged meetings show up in both /sales and /schedule
  created_at timestamptz default now()
);

create index on crm_activities (contact_id, happened_at desc);
create index on crm_activities (deal_id, happened_at desc);
create index on crm_activities (company_id, happened_at desc);
create index on crm_activities (actor_supa_id, happened_at desc);
```

### `crm_pipeline_stages` *(optional, ship later)*

For users who want to customize their pipeline beyond the default 6 stages. Not in MVP.

---

## Stripe ↔ CRM unified-table strategy

Decision was unified, so the sync rules are:

**On contact convert (deal won):**
- Mark `lifecycle_stage = 'customer'`
- If no `stripe_customer_id`, create the Stripe customer via existing `/api/stripe` proxy pattern (`POST /api/stripe/customer-create` — new route) and write the returned id back to `stripe_customer_id`
- The existing financial dashboard then picks them up automatically, since the customers endpoint already returns Stripe-side data

**On Stripe webhook events** *(future — needs `/api/stripe/webhook` route, not part of this 14-day plan):*
- `customer.created` from outside Takeover → upsert into `crm_contacts` by email, set `lifecycle_stage = 'customer'`, mint `stripe_customer_id`
- `customer.deleted` → `lifecycle_stage = 'churned'`
- `customer.subscription.deleted` → `lifecycle_stage = 'churned'`

**Backfill (one-time, on first connect):**
- For every Stripe customer returned by `/api/stripe/customers`, upsert into `crm_contacts` by email. If the row already exists (matched an existing contact), just set `stripe_customer_id` and `lifecycle_stage = 'customer'`. If not, create it.
- Run as a manual button on `/sales/settings` for now ("Import Stripe customers"). Cron later.

**What this avoids:** drift. The financial dashboard's Customers tab and the CRM's Contacts list show the same people, never out of sync.

---

## UX shape

### Routes

```
/sales                    Landing dashboard (bento, like /financial overview)
/sales/pipeline           Kanban — deals grouped by stage, drag-to-move
/sales/contacts           Contact list + filter + drawer detail
/sales/contacts/:id       Full contact page (deep link)
/sales/companies          Company list + drawer detail
/sales/companies/:id      Full company page
/sales/deals/:id          Full deal page (or use drawer from kanban)
/sales/activities         Global activity feed (rare; mostly per-entity)
/sales/settings           Stripe sync button, default pipeline stages, etc.
```

Sidebar entry: **Sales** (icon: TrendingUp or similar from lucide), positioned between Finance and Operations.

### Landing dashboard (`/sales`)

Same editorial bento language as financial. Tiles:

- **Pipeline value** (col-2 KPI) — sum of `amount_cents * probability/100` across open deals
- **Won this month** (col-2 KPI, emerald) — `count` and `total $` where `stage = 'won' AND close_date_actual >= start of month`
- **Lost this month** (col-2 KPI, amber-quiet) — same as won, for `lost`
- **New leads this week** (col-2 KPI) — `count` where `lifecycle_stage = 'lead' AND first_touched_at >= 7d ago`
- **Avg deal size** (col-2 KPI) — across won deals last 90d
- **Avg sales cycle** (col-2 KPI) — days from `first_touched_at` → `close_date_actual` across won

- **Pipeline by stage** (col-8 × 2 rows) — horizontal bar chart, one bar per stage, length = total `amount_cents` in that stage
- **Top deals** (col-4) — list, top 5 open deals by `amount_cents`
- **Recent activity** (col-12) — last 10 logged activities across all entities, with serif title

### Pipeline kanban (`/sales/pipeline`)

- 6 columns: Interested · Demo · Proposal · Negotiation · Won · Lost
- Each column header shows total `amount_cents` for that stage in mono, count chip in muted
- Deal cards: title (serif-light), company name (mono small), amount (mono, prominent), owner avatar, days-in-stage indicator
- Drag-drop between columns updates `stage` and resets `updated_at`
- Cards have a hover state showing next-step date if set
- Click a card → opens deal drawer (right slide-in, same pattern as `TaskDetailDrawer`)
- Header: filter chips (Owner: All / Me / specific person; Source: All / Inbound / Outbound)
- Reuse dnd-kit already installed for Tasks

### Contact list (`/sales/contacts`)

Same editorial pattern as the financial dashboard's Customers tab:
- Header: eyebrow + Newsreader serif title "Contacts"
- Filter tabs: All · Leads · Opportunities · Customers · Churned (with counts, emerald underline)
- Search input (right-aligned)
- List rows: name (semibold), email (mono small), company name, lifecycle pill, owner avatar, last-contacted timestamp
- Clicking a row opens a right-slide drawer with the full contact + activity timeline + notes

### Activity composer

Modal triggered from:
- Contact / company / deal detail drawer ("Log activity" button)
- Cmd+K palette ("/log call", "/log note")
- Right-click on a deal card

Fields: type (call/email/meeting/note), title, body (markdown), happened_at (default now), duration, outcome. Attaches to whichever entity context it was opened from.

---

## Editorial design tokens (reuse from financial)

Drop straight in. Same `tile`, `eyebrow`, `serifTitle`, `monoNum` constants as `OverviewTab` / `CustomersTab` / `ReportsTab` / `ModelerBentoView`. Same Newsreader serif import.

New shared piece needed: `LifecyclePill` component — analogous to `StatusPill` but mapping `lifecycle_stage` → variant:

| Stage | Variant |
|---|---|
| lead | zinc (muted) |
| mql | blue |
| sql | blue (brighter) |
| opportunity | amber-quiet |
| customer | emerald (with pulsing dot) |
| churned | zinc + strikethrough |

Place it next to `StatusPill` in a shared `lib/crmPills.tsx` so both modules can import.

---

## AXON action surface

The AI layer Takeover already has. Native CRM means native AXON. Actions to register (file pattern: `MyComponents/Axon/actions/crm/*.ts`):

| Action | Purpose | Slot in conversation |
|---|---|---|
| `list_deals` | "Show me open deals over $5k" | Replies with filtered list, links to /sales |
| `create_deal` | "Add a deal for Acme, $10k, demo stage" | Inserts crm_deals row, returns id + drawer link |
| `move_deal` | "Move the Acme deal to negotiation" | Updates `stage` |
| `find_contact` | "Find Bob from Acme" | Looks up by name + company |
| `create_contact` | "Add Bob Jones, CTO at Acme, bob@acme.com" | Inserts crm_contacts row |
| `log_activity` | "Log a call with Bob, no answer" | Inserts crm_activities row |
| `pipeline_summary` | "What's my pipeline look like?" | Returns weighted forecast, count by stage |
| `next_steps` | "Who do I need to follow up with this week?" | Returns contacts with next_step_at in next 7d |
| `convert_to_customer` | "Bob signed, mark him a customer" | Sets lifecycle_stage, creates Stripe customer via proxy |

Register all in the existing AXON actions registry. Voice triggers come for free since we route through the same engine.

---

## Cmd+K palette verbs

Following the Tasks / Meetings pattern:

| Verb | Effect |
|---|---|
| `/deal` or `/d` | Open create-deal modal |
| `/contact` or `/c` | Open create-contact modal |
| `/log` | Open activity composer (asks for context) |
| `/pipeline` | Navigate to /sales/pipeline |
| `/sales` | Navigate to /sales |

---

## 14-day shipping plan

Each numbered item is a single shippable task (~1 day or less). Numbers correspond to the task tracker.

| Day | Task |
|---|---|
| 1 | Schema migrations: 4 tables + RLS + indexes |
| 2 | Types in `stores/crm.ts` + Supabase query hooks (`useContacts`, `useDeals`, `useCompanies`, `useActivities`) |
| 3 | `/sales` route shell + sidebar nav entry + LifecyclePill component |
| 4 | Sales landing dashboard (6 KPI tiles + pipeline-by-stage bar) |
| 5 | Pipeline kanban — column shells + deal cards (no DnD yet) |
| 6 | Pipeline kanban — drag-drop wiring + stage update |
| 7 | Deal detail drawer (form + activity timeline section) |
| 8 | Contact list page + drawer |
| 9 | Company list page + drawer + auto-attribution from email domain |
| 10 | Activity composer modal + Cmd+K verbs |
| 11 | Stripe sync: backfill button + `/api/stripe/customer-create` proxy route |
| 12 | AXON actions: list_deals, create_deal, move_deal, find_contact, log_activity |
| 13 | Sales landing dashboard — wire pipeline + recent activity + top deals |
| 14 | Verification: typecheck, RLS smoke tests, demo data fixture, polish |

If days 7–9 run long (drawer + list views are where polish creeps in), days 11–13 are the buffer zone.

---

## Open questions (not blocking — surface later)

1. **Permissions model:** is sales data visible to everyone, or scoped to owners + C-level? Pulls from existing `app_users.role` so RLS is straightforward, but need to decide before day 1 schema.
2. **Multi-currency deals:** the schema supports it (`currency` column on deals). But aggregations in the landing dashboard need a conversion strategy. Defer: only show USD-denominated rolls for v1.
3. **Email integration:** logging an email manually is fine for v1. Auto-logging from a connected mailbox (Gmail/Outlook) is the natural v2.
4. **Custom fields:** HubSpot's flexibility comes from custom properties. We're shipping fixed columns first. If users push back, add a `properties jsonb` column + a field-builder UI.
5. **Web-to-CRM form:** waitlist form on the marketing site already captures emails. Need a one-line change in the waitlist route to also insert into `crm_contacts` with `source = 'waitlist'`.

---

## Decision log

- **2026-06-04 — Replace vs. integrate HubSpot:** chose replace. Reasoning: positioning consistency, no recurring dependency on a competitor's product.
- **2026-06-04 — Unified contacts table:** chose unified over separate or linked. Single source of truth wins over architectural purity for a small team.
- **2026-06-04 — Top-level /sales route:** chose new top-level route (not nested under /financial). Sales is a first-class business function and the pitch deck calls it out separately.

---

*Once this proposal is approved, execution proceeds to Day 1 (schema migrations).*
