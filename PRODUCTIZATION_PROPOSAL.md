# Productization Proposal — CWA-Manager → Multi-Tenant SaaS

> Goal: turn the current single-tenant internal tool into a product other companies can sign up for, pick the modules they want, and onboard their team in under 15 minutes.

> Constraints chosen up front:
> - **Distribution:** Tauri desktop installer (Windows / macOS / Linux)
> - **GTM:** SMB self-serve signup
> - **Pricing:** Per-seat subscriptions with modules unlocked by tier
> - **Isolation:** Database-per-tenant

This document is the *plan*, not the code. It's intentionally focused on the architectural decisions that are expensive to undo, plus the phased rollout that gets us from here to live.

---

## Reality check on database-per-tenant

Picking DB-per-tenant for a self-serve SMB product is bold. You should know what you signed up for:

**Pros**
- Bulletproof data isolation — no chance of a query leaking another customer's data.
- Easy "give me my data" exports — `pg_dump` and ship it.
- A runaway query from one tenant can't take down others.
- Strong compliance story (SOC2 / HIPAA-friendly).

**Cons**
- **Operating cost scales linearly.** Each Supabase project on the Pro plan is ~$25/mo before customers pay you anything. 100 customers = $2,500/mo floor. We need a free-tier on a shared cluster (see "Tier-aware tenancy" below) to avoid bleeding money.
- **Schema migrations are an automation problem.** Every release we ship has to run against N customer databases. We'll need a migration runner that knows the catalog of tenants.
- **No cross-tenant features without a control plane.** Things like analytics, referrals, a global marketplace — anything that compares tenants — requires data outside the tenant DB.
- **Authentication gets layered.** Each Supabase project has its own `auth.users`. The user logs into the control plane first, then the desktop app gets a per-tenant token.

**My recommendation: keep the choice but split tiers.**

- **Free / Starter tier:** Shared Postgres database, row-level `org_id` isolation with RLS. Cheap to operate. Sandboxed but real.
- **Pro / Enterprise tier:** Dedicated Supabase project per tenant. Real isolation, real backups, real compliance.

This way you can offer a free tier without going bankrupt, and the upgrade path to dedicated isolation is a real product feature (not just more storage). The desktop app doesn't care — the connection metadata it fetches from the control plane just points at a different host.

If you'd rather stay strictly DB-per-tenant for everyone, we can — just understand the floor cost.

---

## The new architecture, end to end

```
┌────────────────────────────────────────────────────────────────────┐
│                           Customer's desktop                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CWA-Manager (Tauri)                                          │  │
│  │    1. First launch → asks for org slug (acme.codewithali.app) │  │
│  │    2. Sends slug to control plane                             │  │
│  │    3. Receives { supabase_url, anon_key, enabled_modules }    │  │
│  │    4. Connects to THAT tenant's DB                            │  │
│  │    5. Cached locally; refreshed on token expiry               │  │
│  └────────────────┬────────────────────┬─────────────────────────┘  │
└───────────────────┼────────────────────┼────────────────────────────┘
                    │                    │
                    │ control plane RPC  │ tenant DB (Supabase)
                    │ (login, billing,   │ (data, files, edge fns)
                    │  org config)       │
                    ▼                    ▼
┌──────────────────────────────────┐  ┌─────────────────────────────┐
│  CONTROL PLANE (Next.js, web)   │  │  TENANT DBs                  │
│   app.codewithali.com            │  │   acme.supabase.co           │
│                                  │  │   beta.supabase.co           │
│   - Public signup                │  │   gamma.supabase.co          │
│   - Org creation                 │  │   …                          │
│   - Stripe billing               │  │                              │
│   - User → org mapping           │  │   (or shared cluster for     │
│   - Module entitlements          │  │    free tier, schema-per-org │
│   - Provisioning service         │  │    or row-level org_id)      │
│   - Migration runner             │  │                              │
│   - Admin console (for you)      │  │                              │
└──────────────────────────────────┘  └─────────────────────────────┘
```

### Control plane is the new top-level component

It's a separate web app (Next.js or Hono, your call) that lives at something like `app.codewithali.com`. It owns:

1. **Public signup + login.** The desktop app can't be the entry point — there's no shared identity yet at first launch. The user signs up on the web, creates their org, *then* downloads the desktop app and pastes their org slug.
2. **Org catalog.** Single source of truth for which tenants exist, where their DB lives, what plan they're on, what modules they've enabled.
3. **Billing.** Stripe Customer + Subscription per org. Webhook updates `organizations.plan` + `enabled_modules` when subscriptions change.
4. **Provisioning service.** When a new org signs up, this triggers: create Supabase project (via management API) → run baseline migrations → seed default templates → return URL + anon key.
5. **Migration runner.** Holds the catalog of all tenant DBs. When you push a new migration, it queues a run against every tenant. Tracks per-tenant migration state so retries are safe.
6. **Admin console.** Internal-only UI for you to see every org, suspend bad actors, manually provision enterprise accounts, troubleshoot.

### Desktop app changes

The current single-tenant assumption (one `supabase.ts` with hard-coded URL/anon key) becomes:

```ts
// Was: hardcoded
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Becomes: lazy, per-tenant
const { url, anonKey } = await fetchTenantConfig(orgSlug, userJWT);
const supabase = createClient(url, anonKey);
```

The `supabase` import we use everywhere becomes a *function* that returns the current tenant's client. We cache it after first resolution; on token expiry we refresh via the control plane.

This is the single biggest internal refactor — every file that does `import supabase from "@/MyComponents/supabase"` will need to be reviewed. The good news: most call sites don't care, they just use the client. The bad news: every Edge Function, every storage URL, every realtime subscription needs the per-tenant client.

---

## Module activation system

A module is a self-contained feature surface — a route, a sidebar group, a set of DB tables, and a permission scope. The current modules (rough cut):

| Module | Routes | Tables (in tenant DB) | Default tier |
|---|---|---|---|
| Core | `/`, settings, profile | `app_users` | All tiers |
| Tasks | `/task` | `cwa_todos` | Starter |
| Chat | `/chat` | chat tables | Starter |
| Schedule | `/timesheet` | `cwa_shifts`, `cwa_meetings` | Starter |
| Workspace | `/workspace` | `cwa_docs`, `cwa_sheets`, comments, versions | Pro |
| Hiring | `/hiring`, `/offers`, `/onboarding` | `candidates`, `offer_letters`, `onboarding_*` | Pro |
| Projects | `/projects` | `cwa_projects*` | Pro |
| Code | `/code` | `cwa_repos`, PRs, etc. | Pro |
| Reports | `/reports` | `cwa_reports` | Pro |
| Finance | `/financialDashboard`, `/invoicer`, `/bookkeeping` | finance tables | Pro |
| Strategy | `/strategy` | `team_pulse`, `growth_tracks` | Enterprise |
| Funding | `/funding` | `cwa_funding_*` | Enterprise |
| Axon | global panel | `axon_*` | Enterprise |

Each module declares its identity in a registry:

```ts
// src/modules/registry.ts
export const MODULES = {
  tasks: {
    id: "tasks",
    name: "Tasks",
    routes: ["/task"],
    sidebarKeys: ["operations.tasks"],
    requiredTier: "starter",
    dependencies: [],
  },
  workspace: {
    id: "workspace",
    name: "Workspace",
    routes: ["/workspace"],
    sidebarKeys: ["operations.workspace"],
    requiredTier: "pro",
    dependencies: ["tasks"], // can't have workspace without tasks
  },
  // …
} as const;
```

The control plane stores `organizations.enabled_modules` as a `text[]` of module IDs. The desktop app:

1. Fetches enabled modules at startup (already part of tenant config response).
2. Wraps the router: any route whose module is disabled returns a "this module isn't enabled for your plan" page.
3. Filters the sidebar nav (we already have a `filterNavByCompany` helper — same pattern, swap `company` for `enabledModules`).

When a customer upgrades their plan, Stripe webhook → control plane updates `enabled_modules` → desktop app picks up on next session start (or via realtime subscription if we want it instant).

---

## Setup wizard — the 15-minute promise

Goal: from "I just signed up" to "my team is using it" in under 15 minutes.

Flow:

1. **Sign up** (web, control plane)
   - Email + password (or Google OAuth)
   - Org name + slug (`acme` → `acme.codewithali.app`)
   - Stripe checkout for chosen tier (or free tier skip)

2. **Provisioning** (~30s)
   - Spinner: "We're setting up your workspace…"
   - Behind the scenes: create Supabase project (or schema), run migrations, seed templates, create the admin's `app_users` row in the new DB.

3. **Module picker** (in-app, first launch of desktop)
   - "Pick the features you want enabled" — checkboxes for each module within your tier
   - Smart defaults: everything in the tier is on by default, user can disable
   - "You can change these anytime in Settings"

4. **Invite your team**
   - Bulk paste emails, comma or newline separated
   - Role selector per person (mirrors current role list)
   - Send button → triggers Supabase admin invites (the same `inviteUserViaTakeover` plumbing we just built for Direct Hire)
   - Skip option for solo founders

5. **Pick onboarding template**
   - "What does your new-hire onboarding look like?"
   - Pre-built templates: Engineering / Sales / Generic startup
   - Or "I'll set this up later"

6. **Done** — drop them into the dashboard. Inline tooltips on first cards.

The wizard is reusable: if they skip steps 3-5, the dashboard shows a "Finish setup" card until they do. Don't block them on day 1.

---

## Phased rollout — what to build, in what order

Each phase ends in something testable. Total: ~14-20 weeks for a one-engineer effort, faster with more.

### Phase 0 — Foundation decisions (1 week)
- Decide free-tier strategy (shared DB vs free Supabase project)
- Pick control-plane stack (recommend Next.js — you already have Vercel-shaped infrastructure on takeover-B2B)
- Lock the module registry shape

### Phase 1 — Control plane v1 (3-4 weeks)
- Next.js app on `app.codewithali.com`
- Tables: `organizations`, `org_members`, `subscriptions`, `module_grants`
- Public signup + login (Supabase Auth on the control plane's own DB)
- Stripe checkout integration
- Admin console (basic — list orgs, see status)

### Phase 2 — Provisioning service (2-3 weeks)
- Worker that calls Supabase management API to create a project per org
- Baseline migration bundle (combined SQL from current `migrations/`)
- Tracks per-org provisioning state (queued / running / done / failed)
- For the free tier: alternative path that creates a schema in a shared cluster instead

### Phase 3 — Desktop app multi-tenant refactor (3-4 weeks) **← biggest risk**
- Replace `supabase.ts` singleton with a per-tenant client factory
- First-launch flow: prompt for org slug + email + password → fetch tenant config from control plane → cache locally
- Token refresh through control plane
- Audit every Edge Function call (each tenant has its own functions deployment)
- Audit every storage URL (each tenant has its own bucket prefixes)

### Phase 4 — Module system (2 weeks)
- Build `src/modules/registry.ts`
- Route guard wrapper
- Sidebar nav filter (extend `filterNavByCompany` pattern)
- Settings page → Modules section with toggles

### Phase 5 — Migration runner (1-2 weeks)
- CLI tool: `pnpm migrate --tenant=all` or `--tenant=acme`
- Holds a manifest of tenants from the control plane
- Runs each migration file once per tenant, idempotent
- Tracks state in a `_migrations` table per tenant DB
- Surfaces failures back to control plane admin console

### Phase 6 — Setup wizard (2 weeks)
- Multi-step React flow on the control plane web app
- Hands off to desktop after step 2 (provisioning complete)
- In-app step 3+ in the desktop app on first launch
- Default templates seeded per module

### Phase 7 — Migrate existing data (1 week)
- Treat `codewithali` and `simplicityFunds` as the first two tenants
- Stand up their dedicated Supabase projects
- Move data over (`pg_dump` + restore, or scripted)
- Cut over the desktop app to fetch tenant config like everyone else
- The current company-toggle UI becomes obsolete — each company is just an org now

### Phase 8 — Polish + launch (2-3 weeks)
- Trial-expired UX
- Billing portal embed
- Customer-facing docs site (probably already on takeover-B2B)
- Marketing pages
- Status page

---

## Existing-data migration plan

This is the trickiest non-obvious step. Right now your DB has:
- A `company` column on tables that switches between CodeWithAli and Simplicity
- Some tables not company-scoped at all
- Real users authenticated against the single Supabase project

The migration:

1. **Pre-cutover** — Build the new world (Phases 1-7) alongside the existing app. The current desktop app keeps working unchanged.

2. **Cutover** — On a chosen date:
   - Create org "CodeWithAli" in the control plane
   - Create org "Simplicity Funds" in the control plane
   - Provision two new Supabase projects for them
   - Split your current data: rows with `company='CodeWithAli'` (or NULL) → CodeWithAli project, rows with `company='simplicity'` → Simplicity project
   - For each user, decide their primary org (default to whichever has the most of their data)
   - Migrate `auth.users` → invite them to the new project on first login (or use Supabase admin to copy auth rows)
   - Ship a desktop update that requires the new tenant-aware flow

3. **Post-cutover** — old Supabase project goes read-only for 30 days as a safety net, then archived.

This is genuinely the riskiest step. Plan for a maintenance window and have a rollback path.

---

## What to build *first* (this week / next week)

Don't try to do all of this at once. Highest leverage right now:

1. **Build the module registry** in CWA-Manager (it works fine in single-tenant mode — every module is just "always on"). This puts the structure in place so when multi-tenancy lands, the routes are already keyed.

2. **Audit every direct `import supabase` site** and produce a count. You need to know the surface area of the multi-tenant refactor before estimating Phase 3 accurately.

3. **Write a "what is a module" spec** — for each current feature: what tables does it own? What routes? What permissions? Which tier? This becomes the registry seed and the tier pricing page.

4. **Decide free-tier strategy** (shared DB vs no free tier). Affects whether Phase 2 has one or two provisioning paths.

I can do all four of these as the next batch. They're independent enough to parallelize.

---

## Costs and risks worth naming

**Operating cost.** At Supabase Pro pricing ($25/mo project), 100 customers on dedicated DBs costs $2,500/mo before storage, bandwidth, or compute upgrades. At 1,000 customers, you're at $25K/mo just on infrastructure. Plan pricing accordingly.

**Migration runner reliability.** If you push a migration and it half-runs across 200 tenants — you have 200 different DB states. Migrations have to be idempotent, atomic, and reversible. This is real engineering, not a script.

**Desktop update mechanism.** Once tenants are paying customers, an auto-update that bricks 5% of installs is a churn event. Need solid update telemetry, staged rollouts, easy rollback.

**Supabase project creation latency.** Supabase project provisioning takes 30-60 seconds. The signup wizard needs to handle that gracefully (spinner, optimistic UI, fallback to "we'll email you when ready" for failures).

**Compliance creep.** The moment you take credit cards from companies, you're in scope for PCI (handled by Stripe). The moment you store employee PII for other companies' employees, you're in scope for GDPR (you become a data processor). Plan a DPA template and a data export endpoint early.

**Edge Function isolation.** Each Supabase project has its own Edge Function deployment. We currently use Edge Functions for X, Y, Z (need to audit). Each one needs to be deployed to every tenant — folded into the migration runner.

---

## Decisions still open

These I can't decide without your input, but they're not blocking for Phase 0-1:

1. **Free tier or paid only?** (Affects whether shared-DB tier exists)
2. **Control plane domain** — `app.codewithali.com`? Subdomain of takeover.systems? Something new?
3. **Tier names + module mapping** — I sketched Starter/Pro/Enterprise above; you may want different names and different module/tier boundaries
4. **Trial length** — 14 days, 30 days, none?
5. **Self-serve org slug claims** — first-come-first-serve, or claim verification (email domain matches)?

---

## TL;DR

- **The control plane is the new core.** It's a Next.js web app that owns signup, billing, the org catalog, provisioning, and the migration runner.
- **The desktop app becomes tenant-aware** — on first launch it fetches connection details from the control plane and connects to *that org's* dedicated DB.
- **Modules are a first-class concept** — registry-driven, tier-gated, toggleable per org.
- **Setup wizard targets <15 minutes** from signup to "team using it" — provisioning happens in the background.
- **~14-20 weeks of work** for one engineer, phased so each milestone is shippable.
- **Real money on the line** — DB-per-tenant on Pro pricing means a free tier needs to be on shared infra or there's no free tier.

The riskiest single piece is the desktop app refactor (Phase 3). Everything else has a clean fallback or rollback. Phase 3 is "every single component needs to be aware that `supabase` is no longer a singleton." We should scope that with eyes open.
