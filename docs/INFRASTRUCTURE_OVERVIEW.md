# TakeOver — Complete Infrastructure & AXON Reference

> **Last updated:** 2026-06-06 · Friday
> **Last commit:** `feat(admin): dedicated Linear operations dashboard at /linear` (2026-06-05)
> **Velocity in last 7 days:** 59 commits
> **Routes (lazy):** 58 · **AXON actions registered:** 204 · **MyComponents .tsx files:** 310

This is the document Hanif (or any new contributor) reads on day one to understand what TakeOver actually is, how the pieces fit together, what's already shipped, and what's still on the runway. It is meant to be both a tour and a reference — read it top-to-bottom the first time, then come back to whatever section answers your current question.

---

## 0 · TL;DR

TakeOver is **the operator brain for founders running multiple companies**. It consolidates fifteen-plus SaaS products into one desktop app, sits on top of every connected tool, and gives the operator a single voice-driven interface — **AXON** — that knows their entire business.

The system is a **three-tier architecture**: a Tauri desktop app (`CWA-TakeOver`), a Next.js proxy/marketing site (`Takeover_B2B`), and two Supabase database layers (one central registry + one per-tenant project per customer company). The connector layer follows a deliberate split: some connectors go **browser-direct** (Airtable, Linear, Vercel, Cal.com, GitHub, Notion), others **route through the takeover-B2B proxy** (Gmail, Stripe, Slack) when CORS, OAuth callbacks, or token security require it.

AXON is the agent on top — currently **204 registered actions**, voice (ElevenLabs), persistent per-operator memory, background monitors (runway alarm, investor stale, prod-failure, etc.), and an emerging "buddy system" that proactively notices gaps and surfaces them before the operator does.

---

## 1 · The Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│         CWA-TakeOver  (Tauri desktop · React 19 · TypeScript)           │
│         ─────────────────────────────────────────────────────           │
│         · 58 routes, 310 component files, lazy-loaded                  │
│         · TanStack Router (file-based)                                 │
│         · Zustand stores + persist middleware                          │
│         · React Query for every data read                              │
│         · Stronghold (Tauri plugin) for the encrypted vault            │
│         · ElevenLabs voice (AXON narration)                            │
│         · Y.Doc + TipTap (live-collab Workspace docs)                  │
│         · WebRTC Huddle (drop-in voice/video)                          │
│                                                                         │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │
       HTTPS to    │   Browser-direct           Browser-direct
       takeover-   │   to slack.com via         to api.linear.app etc
       systems     │   proxy (some calls)
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   takeover-B2B  (Next.js 15 App Router · Vercel · www.takeover.systems) │
│   ──────────────────────────────────────────────────────────────────    │
│                                                                          │
│   Acts as both the public marketing site (/pricing, /product, /axon,    │
│   /about) AND the server proxy for connectors where the desktop can't   │
│   call directly:                                                         │
│                                                                          │
│     app/api/gmail/*        — OAuth flow + send + sync + activities      │
│     app/api/stripe/*       — verify + snapshot + customers + payouts    │
│                              + balance + recent + subscriptions + ...   │
│     app/api/slack/proxy    — generic Slack Web API forwarder            │
│     app/api/takeover_creds — master Supabase anon key fetch             │
│     app/api/waitlist       — marketing-site signup                      │
│     app/api/applications   — hire-with-us form                          │
│     app/api/initialize_*   — onboarding seeds                           │
│                                                                          │
│   Uses lib/supabaseAdmin (service-role) + lib/tenantResolver to         │
│   bridge between central and per-tenant Supabase projects on writes.    │
│                                                                          │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │
                   │ service-role writes / publishable reads
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│              SUPABASE LAYER — two-tier multi-tenant model                │
│              ───────────────────────────────────────────                 │
│                                                                          │
│  ┌──────────────────────┐         ┌──────────────────────────────────┐  │
│  │  Central TakeOver    │         │  Per-Tenant Supabase Projects    │  │
│  │  (one project)       │         │  (one project per customer)      │  │
│  │  ──────────────────  │         │  ──────────────────────────────  │  │
│  │                      │         │                                  │  │
│  │  takeover_companies  │ ←─────  │  cwa_chat / cwa_dm_chat          │  │
│  │  app_users           │         │  cwa_todos                       │  │
│  │  connectors          │         │  cwa_meetings                    │  │
│  │  capital_rounds      │         │  cwa_invoices                    │  │
│  │  capital_checks      │         │  cwa_chat_channels               │  │
│  │  capital_allocations │         │  cwa_project_activity            │  │
│  │  capital_actuals     │         │  code_activity                   │  │
│  │  capital_scenarios   │         │  team_activity                   │  │
│  │  cwa_projects        │         │  gmail_connections               │  │
│  │  cwa_todos*          │         │  (per-tenant workspace data)     │  │
│  │  graduation_plan     │         │                                  │  │
│  │  (and more)          │         │  *Note: cwa_todos exists on      │  │
│  │                      │         │   both central + per-tenant —    │  │
│  │                      │         │   the per-tenant copy is the     │  │
│  │                      │         │   authoritative one for SaaS    │  │
│  │                      │         │   customers.                     │  │
│  └──────────────────────┘         └──────────────────────────────────┘  │
│                                                                          │
│  Tenancy resolution chain:                                               │
│    Stronghold.company_name  →  takeover_companies.{companydb_url,        │
│       _companydb_secret_key}  →  per-tenant client                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2 · Repo Map

| Repo | Role | URL/Path | Stack |
|---|---|---|---|
| **CWA-TakeOver** | Tauri desktop app — the product itself | `~/Desktop/Dev/CWA-TakeOver` | Tauri 2 · React 19 · TS · Vite · Bun |
| **Takeover_B2B** | Marketing site + server-side proxy | `~/Desktop/Dev/Takeover_B2B` · `www.takeover.systems` | Next.js 15 App Router · TS · Tailwind · Vercel |

The desktop calls the B2B repo over HTTPS only when CORS or token security forces the hop. Everything else stays browser-direct.

---

## 3 · Data Infrastructure (Detailed)

### 3.1 — The Two-Tier Tenant Model

TakeOver is sold to other companies. Each customer company gets:
- A row in `takeover_companies` (central registry).
- A dedicated Supabase project provisioned for them (the **tenant project**).
- Their employees in `app_users` (central — for cross-company login + role resolution).
- Their business data in their tenant project (chat, tasks, meetings, invoices, etc.).

This separation means: **founder data stays in their own DB; only cross-cutting identity + connector configs live centrally.**

### 3.2 — Central `takeover_companies` (Tenant Registry)

The single most important table in the entire system. Every server-side route ultimately resolves a request through this row:

| Column | What it is |
|---|---|
| `company_name` | Display + lookup key (`codewithali`, `simplicityFunds`) |
| `companydb_url` | The tenant's Supabase project URL |
| `companydb_key` | The tenant's *publishable* (anon) key — subject to RLS |
| `_companydb_secret_key` | The tenant's *service-role* key — **bypasses RLS** |
| `display_name`, `logo_url`, etc. | UI metadata |
| feature flags | (proposed — see §10) |

**The Gmail bug we just fixed** taught us a critical lesson: when `lib/tenantResolver.ts` was selecting only `companydb_key`, every server-side write to tenant tables silently failed RLS. The fix preferred `_companydb_secret_key` for writes; the publishable key only works for reads.

### 3.3 — Central Tables

| Table | Purpose | Owns RLS? |
|---|---|---|
| `takeover_companies` | tenant registry | yes — service-role only |
| `app_users` | identity, role, supa_id, avatar, etc. | yes — role-gated |
| `connectors` | per-tenant connector configs, scoped by `company` column | yes |
| `capital_rounds`, `capital_checks`, `capital_check_touchpoints`, `capital_allocations`, `capital_line_items`, `capital_actuals`, `capital_scenarios` | Capital Plan module (gated to CEO/COO/CFO server-side via `is_finance_role()`) | yes |
| `cwa_projects` | the projects index, references projects in tenant data | yes |
| `graduation_plan_*` | personal life module | yes |

### 3.4 — Per-Tenant Tables

| Table | Purpose |
|---|---|
| `cwa_chat` | company-wide #channel messages |
| `cwa_dm_chat` | DMs + group DMs |
| `cwa_chat_channels` | channel metadata |
| `cwa_todos` | native TakeOver tasks |
| `cwa_meetings` | native meetings |
| `cwa_invoices` | invoice ledger |
| `cwa_project_activity` | project event log (kind, payload, actor) |
| `code_activity` | code module activity |
| `team_activity` | onboarding/HR activity |
| `gmail_connections` | per-user Gmail OAuth tokens |
| various workspace/doc tables | Workspace module (Y.Doc fragments + tabs) |

### 3.5 — How Tenancy Resolution Actually Happens

```
┌────────────┐    ┌─────────────────────────┐    ┌──────────────────────┐
│ Stronghold │ →  │ "codewithali"            │ →  │ takeover_companies   │
│ (encrypted │    │ company_name             │    │ SELECT companydb_url,│
│ vault on   │    └─────────────────────────┘    │   _companydb_secret_ │
│ disk)      │                                   │   key WHERE          │
└────────────┘                                   │   company_name = ... │
                                                  └──────────────────────┘
                                                            ↓
                                          ┌─────────────────────────────────┐
                                          │ createClient(url, serviceKey)   │
                                          │ → bound to that tenant's        │
                                          │   Supabase project              │
                                          └─────────────────────────────────┘
```

**On the desktop:** `getCompanySupabase()` in `src/MyComponents/supabase.ts` (caches the tenant client per session).

**On the server (takeover-B2B):** `getTenantSupabase(companyName)` in `lib/tenantResolver.ts` (now uses the service-role key after the recent fix).

---

## 4 · AXON Architecture

AXON is the agent that lives in the desktop app. He's accessible by **voice** (Orb in the bottom-right), **typed input**, and **internal monitor triggers** that fire alerts without the operator asking.

### 4.1 — Action Registry — 204 Registered Actions

Actions are typed AxonAction<TInput, TResult> objects with a JSON-schema input, a handler, and metadata (`mutating`, `requiresConfirmation`, `allowedRoles`). They're registered on AXON init via `registerAllActions()`. Here's the breakdown:

| Category | File | Action count | Notes |
|---|---|---|---|
| Navigation + DOM | `navigation.ts`, `dom.ts` | 7 | route jumps, scroll-to, click-by-label |
| Tasks | `tasks.ts` | 6 | create, update, list, assign, complete, delete |
| Projects | `projects.ts` | 6 | similar verbs on cwa_projects |
| Shifts (HR) | `shifts.ts` | 9 | clock_in/out, request_coverage, claim_open_shift |
| Recruiting | `recruiting.ts` | 7 | resume parsing, hiring pipeline |
| Onboarding | `onboarding.ts` | 6 | new-hire flow |
| Code module | `code.ts` | 12 | the most-actioned category |
| CRM | `crm.ts` | 7 | deals, contacts, pipeline summarize |
| Workspace (docs) | `workspace.ts` (in repo, not above) | 8 | create/append/replace/fill-placeholder docs |
| Slack | `slack.ts` | 6 | list, post, recent, pulse, resolve, schedule |
| Linear | `linear.ts` | 4 | issues, cycles, create |
| Vercel | `vercel.ts` | 3 | projects, deployments, errors |
| Cal.com | `calcom.ts` | 5 | meetings, today, types, slots |
| Unified Meetings | `unified_meetings.ts` | 2 | provider-neutral today + upcoming |
| Unified Finance | `unified_finance.ts` | 5 | balance, recent_tx, burn, runway, history |
| Capital Plan | `capital_plan.ts` | 3 | briefing, advise, log |
| Connector meta | `connectors.ts` | 10 | list connectors, Airtable read, GitHub read, Notion read |
| Memory + Trust | `memory.ts`, `trust.ts` | 8 | persistent operator memory + permissions |
| Personality + Sleep | `sleep.ts`, `theme.ts` | 6 | force_sleep, wake_up, set_theme |
| AXON-itself meta | `help.ts`, `agent.ts`, `ensemble.ts` | 6 | inspect, describe, swap voice |
| ...and many more across `chat`, `call`, `journal`, `announcements`, `automations`, `outbound`, `ingest`, `routines`, `briefing`, `cwa_registry`, `data`, `meetings`, `voice`, `voiceauth`, `credentials`, `company`, `ceo_powers`, `undo` | 80+ | the operating-system layer |

**Total: 204** registered actions across 40 files.

### 4.2 — Monitors (Background Watchers)

Monitors are scheduled checks that run in the background and feed observations into AXON's voice pipeline with topic-based dedupe. Current monitors in `src/Axon/engine/monitors.ts`:

| Monitor | Interval | Fires when |
|---|---|---|
| `overdue-tasks` | 5 min | Open tasks past deadline. Once-per-session, then once-per-6h reminder if same count holds. |
| `stale-meetings` | 30 min | Past meetings (2-5d ago) with no follow-up task whose title overlaps. |
| `revenue-swing` | 60 min | Weekly invoice income changes by ≥25% from prior week. |
| `new-signups` | 60s | New `app_users` rows appear since last poll. |
| `runway-alarm` | 15 min | Cash / monthly burn < 90 days. Adds "you'll be empty before close" line if next round closes after runway end. Once per session. |
| `investor-stale` | 60 min | A `capital_checks` row in an active status with `last_touch_at` > 14 days. Lists top 3 names. Once per 6h, with signature-based dedupe. |
| `round-behind` | 60 min | A round within 14d of close but < 60% committed. Once per round. |
| `vercel-prod-failure` | 2 min | Vercel production deploy enters ERROR state in last hour. Speaks via AXON AND posts to `#engineering` Slack if Slack connector has a `default_channel`. Dedupes by deployment uid. |

Monitors are the "buddy chasing gaps" half of the JARVIS pitch. The pattern is reusable — every future risk we want AXON to watch becomes one more entry in this array.

### 4.3 — Voice + Memory Layers

- **Voice:** ElevenLabs (`VITE_ELEVENLABS_API_KEY` is loaded at boot). v3 voice path is active.
- **Speech-to-text:** Web Speech API (currently broken with `service-not-allowed` on macOS — task #67 pending).
- **Memory:** persisted to localStorage per operator + Stronghold for sensitive bits. Topics include decisions made, items deferred, preferences set, patterns detected.
- **Personality composer:** a prompt-stitching layer that builds AXON's spoken voice from a config — currently at 4631 chars, target <2400 (task #70).

### 4.4 — The Decision Loop

When an operator says or types something to AXON:

```
              ┌──────────────────────────────────────────┐
              │     OPERATOR INPUT                       │
              │     (voice transcript or typed text)     │
              └──────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │  Model layer (LLM, currently external API) │
        │  receives:                                 │
        │   · operator input                         │
        │   · full personality prompt                │
        │   · 204 action tool schemas                │
        │   · recent conversation turns              │
        │   · relevant memory snippets               │
        └─────────────────────────────────────────────┘
                              │
                              ▼
          Returns: text response + 0-N tool calls
                              │
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  For each tool call:                                     │
   │   · resolve action by name in registry                  │
   │   · check mutating / requiresConfirmation               │
   │   · if requires confirm → ask "should I do X?" first   │
   │   · run handler(input, ctx)                              │
   │   · log via ctx.logActivity                              │
   │   · speak via ctx.speak (if needed)                      │
   └──────────────────────────────────────────────────────────┘
                              │
                              ▼
              Final text → spoken via ElevenLabs
              Action results → activity log + UI updates
```

---

## 5 · Connectors — Complete Status Matrix

### 5.1 — Status Legend

- 🟢 **Fully wired** — real lib + verify + AXON actions + admin surface (where applicable)
- 🟡 **Schema only** — appears in connector catalog + has credential dialog, but no live API calls, no AXON actions
- 🔵 **Registered in unified registry** — defined in `lib/unified/types.ts` DATA_SOURCES, no schema yet, will plug in when needed
- ⚫ **Not yet planned**

### 5.2 — The Matrix

| Connector | Status | Catalog tier | Has lib? | Verify? | AXON actions | Visible surface | Notes |
|---|---|---|---|---|---|---|---|
| **OpenAI** | 🟢 | Easy | — (key only) | ✅ /v1/models | — | Tile only | Used by AXON itself for model calls |
| **SendGrid** | 🟡 | Easy | — | format-only | — | Tile only | Server-side send not wired |
| **Resend** | 🟡 | Easy | — | format-only | — | Tile only | Server-side send not wired |
| **Stripe** | 🟢 | Easy | `lib/stripe.ts` | ✅ /account via proxy | 0 direct + via unified_finance | Tile + Financial Dashboard | Lots of helpers: snapshot, balance, payouts, customers, recent, failed |
| **Airtable** | 🟢 | Easy | `lib/airtable.ts` | ✅ | 2 (tables, records) | Tile only | Browser-direct |
| **GitHub** | 🟢 | Medium | `lib/github.ts` | ✅ /user | 3 (repos, prs, issues) | Tile only | PAT, browser-direct |
| **Slack** | 🟢 | Medium | `lib/slack.ts` | ✅ auth.test via proxy | 6 (list, post, recent, pulse, resolve, etc.) | Tile + SlackPulsePanel on /operations + SlackInChat (sidebar section in Chat) | Via takeover-B2B proxy `/api/slack/proxy`. Custom XOAuth2 (bot token) for now; per-user xoxp tracked as post-demo task #87 |
| **Linear** | 🟢 | Medium | `lib/linear.ts` | ✅ viewer.me | 4 (issues, cycles, create) | Tile + **dedicated `/linear` admin dashboard** | PAT, browser-direct |
| **Vercel** | 🟢 | Easy | `lib/vercel.ts` | ✅ /v2/user | 3 + 1 prod-failure monitor | Tile + **dedicated `/vercel` admin dashboard** | Bearer token, browser-direct |
| **Cal.com** | 🟢 | Easy | `lib/calcom.ts` | ✅ /me | 4 (today, upcoming, types, available_slots) | Tile + MeetingsPanel on /operations | API key, browser-direct |
| **Gmail** | 🟢 | Medium | `stores/gmail.ts` (proxy hooks) | via callback | (via Inbox + Compose modals) | Tile + Inbox page + Compose modal | OAuth flow via takeover-B2B `/api/gmail/oauth-start` |
| **Notion** | 🟢 | Medium | `lib/notion.ts` | ✅ /users/me | 3 (search, list_dbs, query_db) | Tile only | Browser-direct |
| **HubSpot** | 🟡 | Hard | — | OAuth stub | — | Tile only | Real CRM signal high-value, hasn't been built |
| **Asana** | 🟡 | Medium | — | OAuth stub | — | Tile only | |
| **Calendly** | 🟡 | Hard | — | OAuth stub | — | Tile only | Cal.com effectively replaces in our story |
| **Google Docs** | 🟡 | Hard | — | OAuth stub | — | Tile only | |
| **Mailchimp** | 🟡 | Hard | — | OAuth stub | — | Tile only | |
| **Plaid** | 🟡 | Hard | — | OAuth stub | — | Tile only | Regulated linking, hardest to build |
| **Mercury** | 🔵 | (not in catalog yet) | — | — | — | — | Stub adapter in `lib/unified/finance.ts` ready to fill in |
| **Brex** | 🔵 | (not in catalog yet) | — | — | — | — | Stub adapter ready |
| **Ramp** | 🔵 | (not in catalog yet) | — | — | — | — | Stub adapter ready |
| **Toast** | 🔵 | (not in catalog yet) | — | — | — | — | Stub adapter ready (POS, restaurant operators) |
| **QBO** | 🔵 | (not in catalog yet) | — | — | — | — | Stub adapter ready |
| **Google Calendar** | 🔵 | (not in catalog yet) | — | — | — | — | Slot in `useUnifiedMeetings` is open |
| **Discord** | 🔵 | (not in catalog yet) | — | — | — | — | Slack pattern reuses cleanly |
| **Jira** | 🔵 | (not in catalog yet) | — | — | — | — | Future Linear-alternative |
| **PostHog/Mixpanel/Amplitude** | 🔵 | (not in catalog yet) | — | — | — | — | Analytics domain not built |

### 5.3 — Headline Counts

- **🟢 Fully wired:** 11 connectors (OpenAI · Stripe · Airtable · GitHub · Slack · Linear · Vercel · Cal.com · Gmail · Notion · OpenAI)
- **🟡 Schema-only stubs:** 6 connectors (HubSpot · Asana · Calendly · Google Docs · Mailchimp · Plaid · SendGrid · Resend with format-only verify)
- **🔵 Registered, not yet schema:** 9 connectors (Mercury · Brex · Ramp · Toast · QBO · Google Calendar · Discord · Jira · PostHog)

---

## 6 · Connector Architecture Patterns

There are two valid ways a connector talks to its provider. Picking the right one is mostly about CORS, OAuth callbacks, and whether the operator's token can be safely held client-side.

### 6.1 — Pattern A: Browser-Direct (`lib/<provider>.ts`)

```
   ┌────────────────┐     HTTPS, op's token in     ┌──────────────────┐
   │  Tauri desktop │ ──── header/query/body  ───► │  provider's API  │
   │  lib/<x>.ts    │                              │  (CORS-friendly) │
   └────────────────┘ ◄───   JSON response  ────── └──────────────────┘
```

**Used by:** Airtable, GitHub, Notion, Linear, Vercel, Cal.com.

**Pros:** lowest latency, simplest code, no server work, no rate-limit concentration on our infra.

**Cons:** token lives in the Tauri webview's memory; CORS quirks (Slack famously rejected our `Authorization` header in preflight — that's why Slack went the other path).

### 6.2 — Pattern B: Server Proxy via takeover-B2B

```
   ┌────────────────┐     HTTPS with our header   ┌────────────────────┐
   │  Tauri desktop │ ─── (TakeOver-App: true) ──►│  takeover-B2B      │
   │  lib/<x>.ts    │     {method, params,        │  /api/<x>/proxy    │
   │                │      company_name}          │  or specific route │
   └────────────────┘                              └─────────┬──────────┘
                                                             │
                                                             │ resolves token
                                                             │ via tenant or
                                                             │ central DB
                                                             ▼
                                                   ┌────────────────────┐
                                                   │  provider's API    │
                                                   │  (using server-    │
                                                   │   side token)      │
                                                   └────────────────────┘
```

**Used by:** Slack, Gmail (read + write + OAuth), Stripe (verify + most reads).

**Pros:** tokens never leave the server; CORS is a server concern; webhooks become possible (provider → takeover-B2B → user); rate limits centralized.

**Cons:** extra hop, more code on the server side.

**The decision rule:** if the provider accepts a bring-your-own token from the browser via CORS-safe means, go direct. Otherwise route through the proxy. New connectors should default to Pattern B if there's any doubt — it's the more flexible long-term choice.

---

## 7 · The Unified Data Source Pattern (Meta-Architecture)

This is the most important architectural concept we've shipped. It's what lets TakeOver scale to 100+ connectors without making 100 bespoke pages.

### 7.1 — The Principle

TakeOver doesn't have a "Cal.com page" or a "Stripe page." It has a **Meetings** page and a **Finance** page (and someday Tasks · Docs · CRM · Chat · Email · Code · Deploy · Analytics). Each page renders data from whichever providers the operator connected, with a `<SourceBadge>` per row showing where each piece came from.

### 7.2 — The Three Pieces Per Domain

For each unified domain (meetings, finance, tasks, etc.):

```
┌────────────────────────────────┐
│  lib/unified/<domain>.ts       │
│  ─────────────────────────     │
│  · Unified<X> type             │
│  · Per-provider adapters       │
│      from<Provider>(raw) =>    │
│      Unified<X>[]              │
│  · useUnified<X>() hook        │
│  · fetchUnified<X>() for       │
│    AXON                         │
└─────────────┬──────────────────┘
              │
              ▼
┌────────────────────────────────┐
│  MyComponents/<X>/<X>Panel.tsx │
│  ─────────────────────────     │
│  · Renders Unified<X>[]        │
│  · <SourceBadge> per row       │
│  · Per-provider filter chips   │
│  · Auto-hides when no          │
│    providers connected         │
└─────────────┬──────────────────┘
              │
              ▼
┌────────────────────────────────┐
│  Axon/actions/unified_<x>.ts   │
│  ─────────────────────────     │
│  · Provider-neutral verbs:     │
│    <x>_today                    │
│    <x>_upcoming                 │
│    <x>_balance, etc.            │
│  · Reads from fetchUnified<X>  │
│  · Returns by_source breakdown │
└────────────────────────────────┘
```

### 7.3 — Current Status

| Domain | UnifiedType | Adapters live | Adapters stubbed | UI panel | AXON verbs |
|---|---|---|---|---|---|
| **Meetings** | `UnifiedMeeting` | Cal.com | Google Calendar · Calendly · TakeOver Huddle | `MeetingsPanel` on /operations | `meetings_today`, `meetings_upcoming` |
| **Finance** | `UnifiedTransaction` + `UnifiedBalance` + `UnifiedRevenue` | Stripe | Mercury · Plaid · Brex · Toast · Ramp · QBO | `FinancePanel` on /operations | `finance_balance`, `finance_recent_transactions`, `finance_burn`, `finance_runway` |
| **Tasks** | not yet defined | — | Linear · Asana · Jira · TakeOver cwa_todos | `TasksSection` on /operations (currently native-only) | `tasks_*` (native only) |
| **Docs** | not yet defined | — | Notion · Google Docs · TakeOver Workspace | none yet | partial via workspace actions |
| **CRM** | not yet defined | — | HubSpot · Salesforce · TakeOver CRM | native CRM page | `list_deals`, `create_deal`, etc (native) |
| **Chat** | not yet defined | — | Slack · Discord · Teams · TakeOver Chat | SlackInChat in TakeOver Chat shell | `slack_*` actions |
| **Email** | not yet defined | — | Gmail · Outlook | Inbox page (Gmail only) | (via Inbox UI) |
| **Code** | not yet defined | — | GitHub · GitLab · Bitbucket | none yet | `github_*` (native verbs) |
| **Deploy** | not yet defined | — | Vercel · Netlify · Fly · Render | dedicated `/vercel` admin | `vercel_*` |
| **Analytics** | not yet defined | — | PostHog · Mixpanel · Amplitude | none yet | none |

### 7.4 — DATA_SOURCES Registry

`lib/unified/types.ts` exports `DATA_SOURCES: Record<string, DataSourceMeta>` with 24 providers across 10 domains pre-registered. Adding a connector to the unified system is one line in this file. The badge color, the filter chip, the cross-surface attribution — all come from there automatically.

---

## 8 · AXON Capabilities + JARVIS Roadmap

### 8.1 — What AXON Already Does (today)

- **204 actions** spanning every TakeOver module
- **Voice in (Speech API) + voice out (ElevenLabs)**, plus typed input
- **Per-operator persistent memory** (decisions, preferences, deferred items)
- **8 background monitors** with topic-based dedupe
- **Confirmation gates** (`requiresConfirmation`) on every mutating action
- **Activity log** with full audit trail
- **Safe mode** default — won't arbitrarily edit existing content without explicit OK
- **Multi-company context switching** — knows which company the operator is acting on
- **Workspace doc co-authoring** (Y.Doc + TipTap, AXON can append/replace/fill placeholders)
- **Capital Plan advisor** (deterministic baseline shipped, model-backed upgrade task #64 pending)
- **Slack post-on-behalf** (mutating, confirmed)
- **Linear issue creation by voice** (mutating, confirmed)
- **Cross-provider intelligence** via unified-domain actions (meetings_today merges Cal.com + future Google + future Calendly)

### 8.2 — The JARVIS Roadmap (Phased)

```
Phase 1 — VOICE + ACTIONS + MEMORY                         ✅ SHIPPED
─────────────────────────────────────────
You talk, AXON acts, AXON remembers.

Phase 2 — PROACTIVE OBSERVATION                            🟡 PARTIAL
─────────────────────────────────────────
AXON notices gaps before you ask:
  · Background monitors (8 shipped) ✅
  · Vercel deploy insights card ✅
  · Linear bottleneck/regression detection ✅
  · runway-alarm + investor-stale + round-behind ✅
  
NEXT in Phase 2:
  · Cross-data correlation (e.g. "Slack quiet AND cal.com
    empty THIS WEEK → team unblocking issue?")
  · Daily/weekly digest delivered by voice on demand
  · Anomaly detection on revenue + churn signals
  · Investor-pitch-prep workflow (#68)

Phase 3 — MULTI-STEP WORKFLOWS                             ⚫ NEXT
─────────────────────────────────────────
AXON chains actions without re-prompting:
  · "Hey AXON, prep Tuesday with Sarah" →
      [pull cal.com booking]
      [pull CRM deal context]
      [draft brief]
      [save to Workspace doc]
  · Chain confirmations: one OK for the whole chain
  · Resume after errors

Phase 4 — AUTONOMOUS LOOPS (LOW-RISK ONLY)                 ⚫ FUTURE
─────────────────────────────────────────
AXON runs scheduled actions without you in the loop:
  · "Send Friday team digest" runs every Friday 4pm
  · "Sync Mercury to capital_actuals" runs nightly
  · "Reply to Calendly bookings with welcome email"
  · Auto-categorize inbound Stripe customers into CRM
  · Auto-log Linear comments → cwa_project_activity
  
SAFEGUARDS:
  · Hard cap on $ amount per autonomous decision
  · Audit log on every autonomous run
  · Operator can revoke any autonomous flow with one click

Phase 5 — PREDICTIVE RECOMMENDATIONS                       ⚫ VISION
─────────────────────────────────────────
AXON sees patterns the operator can't:
  · "Based on last quarter's hiring curve, you should
    post the next role in 11 days, not when you remember"
  · "Your runway plus the seed close puts the next round
    target at $1.2M, not $2M as currently drafted"
  · "Three of your top customers churned 14 days after
    a CSAT drop — check Acme, score dropped yesterday"

Phase 6 — CROSS-TENANT INTELLIGENCE (W/ CONSENT)          ⚫ LONG-TERM
─────────────────────────────────────────
Privacy-preserving learning across customers:
  · "Operators like you who connect Mercury also connect
    Brex within 2 weeks — want to do it now?"
  · Industry-specific monitor templates (SaaS, restaurant,
    services, agency)
  · Anonymized benchmark insights ("your burn is 14%
    higher than the median SaaS at your stage")
```

### 8.3 — Current AXON Bugs / Pending

| Issue | Task | Severity |
|---|---|---|
| Voice STT: `service-not-allowed` on macOS | #67 | High — blocks voice demo |
| Personality composer 4631 chars (target <2400) | #70 | Low — works but bloated |
| capital_advise still deterministic, not model-backed | #64 | Med — works but limited |

---

## 9 · Per-Tenant Variant Versioning (Proposal)

> **NEW concept** — Ali raised this and we need to design for it before we onboard a second paying tenant.

### 9.1 — The Problem

TakeOver will be sold to many companies. Each will want:
- Different feature subsets enabled (e.g. Acme doesn't need Recruiting)
- Different update cadence (some want bleeding-edge, some want LTS)
- Different theme/branding overlays
- Custom modules or hidden modules
- Their own pace of migration when we change a schema

If we ship one monolith binary, we can't satisfy all of those.

### 9.2 — The Proposed Model — Git-Inspired, TakeOver-Style

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  RELEASES (central, owned by us)                                 │
│  ───────────────────────────────                                 │
│  Like git tags — every notable point in TakeOver history.        │
│                                                                  │
│  Examples:                                                       │
│    v1.4.2  · 2026-06-04 · "Slack+ Linear + Vercel"             │
│    v1.5.0  · 2026-06-06 · "Unified Finance + Capital tie-in"   │
│    v1.5.1  · 2026-06-07 · "Linear admin dashboard"              │
│                                                                  │
│  Each release has:                                               │
│    · semantic version                                            │
│    · changelog                                                   │
│    · migration scripts (forward + backward)                     │
│    · feature flag defaults                                       │
│    · supported feature flags                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  TENANT VARIANTS (per company)                                   │
│  ─────────────────────────────                                   │
│  Like git branches — each tenant tracks one release + their own  │
│  per-tenant overrides (features on/off, theme, modules).         │
│                                                                  │
│  takeover_companies row gains:                                   │
│    · current_release   ('v1.5.0')                                │
│    · target_release    ('v1.5.0' or 'v1.6.0-beta')              │
│    · update_channel    ('stable' | 'beta' | 'alpha' | 'pinned') │
│    · feature_flags     JSONB                                     │
│    · disabled_modules  TEXT[]                                    │
│    · theme_overrides   JSONB                                     │
│    · branding          JSONB (logo, name, colors)               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  TENANT UPDATE WORKFLOW                                          │
│  ──────────────────────                                          │
│                                                                  │
│   release v1.6.0 ships  →  Tenant on 'stable' channel auto-      │
│                            queues update                         │
│                                                                  │
│   In the desktop:                                                │
│     · "Update available" banner shown to admin                   │
│     · Click → preview changelog + breaking changes               │
│     · Confirm → run migration scripts on tenant DB               │
│     · Schema version stamp updated                               │
│     · Rollback button available for 7 days                       │
│                                                                  │
│   For 'pinned' tenants:                                          │
│     · We tell them about the release but don't push              │
│     · They pull it manually when ready                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.3 — Suggested Tables (Central)

```sql
-- One row per cut release of TakeOver
CREATE TABLE takeover_releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version         text NOT NULL UNIQUE,              -- 'v1.5.0'
  channel         text NOT NULL,                     -- 'stable' | 'beta' | ...
  released_at     timestamptz NOT NULL DEFAULT now(),
  changelog_md    text,
  required_flags  text[],   -- feature flags this release introduces
  removed_flags   text[],   -- flags this release retires
  migration_up    text,     -- SQL/JS script (or a reference to one)
  migration_down  text,
  metadata        jsonb
);

-- Per-tenant runtime state — extends takeover_companies
ALTER TABLE takeover_companies ADD COLUMN current_release text REFERENCES takeover_releases(version);
ALTER TABLE takeover_companies ADD COLUMN target_release  text REFERENCES takeover_releases(version);
ALTER TABLE takeover_companies ADD COLUMN update_channel  text DEFAULT 'stable';
ALTER TABLE takeover_companies ADD COLUMN feature_flags   jsonb DEFAULT '{}';
ALTER TABLE takeover_companies ADD COLUMN disabled_modules text[] DEFAULT '{}';
ALTER TABLE takeover_companies ADD COLUMN theme_overrides jsonb DEFAULT '{}';
ALTER TABLE takeover_companies ADD COLUMN branding        jsonb DEFAULT '{}';

-- Per-tenant audit of every applied release
CREATE TABLE takeover_tenant_release_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  from_version text,
  to_version   text NOT NULL,
  applied_at   timestamptz NOT NULL DEFAULT now(),
  applied_by   text,  -- supa_id of the admin who clicked update
  rollback_of  uuid REFERENCES takeover_tenant_release_history(id)
);
```

### 9.4 — Runtime Resolution

The desktop reads on boot:

```ts
const { current_release, feature_flags, disabled_modules, theme_overrides, branding }
  = await fetchTenantConfig(company_name);

// Make available app-wide via Zustand or React context
useTenantConfigStore.setState({ release, flags, disabledModules, theme, branding });
```

Components conditionally render:

```tsx
{useFeature('vercel_admin_dashboard') && <Link to="/vercel">…</Link>}
{!isModuleDisabled('recruiting') && <RecruitingSidebarItem />}
```

This pattern is one-shot to ship and pays for itself the day we onboard tenant #2.

---

## 10 · What's Broken / Pending (Snapshot)

Top items from the task tracker, severity-ordered:

| # | Area | Issue | Severity |
|---|---|---|---|
| #67 | AXON | Voice STT broken on macOS (`service-not-allowed`) | High |
| #87 | Slack | Per-user xoxp OAuth for "post as me" (vs bot) | Med — post-demo |
| #90 | PM UI | Cmd+K palette + cycle view + triage (Phase 2 Linear-inspired) | Med — post-demo |
| #64 | AXON | `capital_advise` still rule-based, not model-backed | Med |
| #68 | AXON | Investor pitch-prep workflow | Med |
| #69 | Compliance | SOC 2 Type II tracker surface | Med |
| #74 | Tasks | Page layout simplification (more Linear-feel pass) | Low |
| #72 | Capital Plan | UI polish second pass | Low |
| #70 | AXON | Personality composer trim (4631 → < 2400 chars) | Low |
| — | Gmail | RLS bug fixed in `tenantResolver.ts` — pending Hanif deploy | (resolved code-side) |

---

## 11 · What Hanif Needs to Know — Reorientation Checklist

If you're Hanif coming back after a few months, here's the order of operations:

1. **Pull both repos.** `CWA-TakeOver` (desktop) and `Takeover_B2B` (Next.js).
2. **Check the recent commits.** Last 7 days: 59 commits. Read the commit log to get the gist; major moves were Slack via proxy, Linear + Vercel + Cal.com connectors, unified meetings + finance domains, Capital Plan live-cash integration, Vercel + Linear admin dashboards, AXON insights cards.
3. **Run `bun install` in both repos.** The Vercel side has new deps from your work (Supabase JS, etc).
4. **Review the Gmail RLS bug fix.** See `lib/tenantResolver.ts` — we now select `_companydb_secret_key` and fall back to `companydb_key` with a server-log warning. Read §3.2 above to understand why.
5. **Look at `lib/unified/types.ts` in CWA-TakeOver.** This is the registry of every data source the unified pattern recognizes. New connectors slot in here first.
6. **Look at `Axon/engine/monitors.ts`.** This is the buddy-system implementation. Pattern is reusable for any future risk you want AXON to watch.
7. **Skim `app/api/slack/proxy/route.ts`** in Takeover_B2B. It's the template for any future connector that needs a server hop.
8. **Open `/vercel` and `/linear` in the desktop** to see what the admin-dashboard pattern looks like. Both are mirror-images structurally.
9. **Read this doc's §9 (Per-Tenant Variant Versioning) carefully** — that's new architectural work that needs design input before we sign tenant #2.

---

## 12 · One-Page Reference Card

```
THREE-TIER ARCHITECTURE
  Desktop (Tauri/React) ─→ B2B Proxy (Next.js) ─→ Supabase
                                                  ├ Central
                                                  └ Per-tenant

REPOS
  CWA-TakeOver         ~/Desktop/Dev/CWA-TakeOver
  Takeover_B2B         ~/Desktop/Dev/Takeover_B2B  (www.takeover.systems)

TENANT RESOLUTION
  Stronghold.company_name
    → SELECT * FROM takeover_companies WHERE company_name=...
    → createClient(companydb_url, _companydb_secret_key)

CONNECTOR PATTERNS
  Pattern A (browser-direct): Airtable, GitHub, Notion, Linear, Vercel, Cal.com
  Pattern B (B2B proxy):      Gmail, Stripe, Slack

UNIFIED DOMAINS (current)
  Meetings  →  Cal.com  +  [Google · Calendly stubs]
  Finance   →  Stripe   +  [Mercury · Plaid · Brex · Toast stubs]
  Tasks · Docs · CRM · Chat · Code · Deploy · Analytics — to come

AXON SURFACE AREA
  204 actions · 8 monitors · voice + memory · 6 admin pages
  (operations · capital plan · vercel · linear · funding · graduation)

KEY SUPPORTING DOCS
  docs/CHAT_AUDIT.md              Chat module vs Slack-replacement gap analysis
  docs/SLACK_PROXY_SPEC.md        Slack proxy contract + Next.js handler
  docs/INFRASTRUCTURE_OVERVIEW.md This file
```

---

*End of reference. If anything in here is wrong, fix it — this doc is meant to be a living source of truth, not a snapshot. Update the version + date in the header on substantive changes.*
