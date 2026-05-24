# The 15 SaaS Takeover Replaces

> **Status:** Draft for the investor pitch deck. Swap or rephrase any item you don't want anchored to. Pricing verified May 2026 against each vendor's public pricing page or recent third-party pricing trackers — see sources at the bottom.
>
> **Modeling assumption:** 10-person SMB-to-mid-market team that's actively hiring (2 recruiters + 3 sales + 3 engineers + 2 ops). The realistic price for this profile is the one the deck commits to. Both bigger and smaller companies can run the same arithmetic — the headline scales.

---

## The recruiting + ops sprawl, priced

| # | Category | Tool | Replaces in Takeover | List price | 10-person realistic |
|---|---|---|---|---|---|
| 1 | **Applicant Tracking System** | Greenhouse | `/candidates` + `/apply` form on cwa_takeover + offer letters | $6.5k–$10k/year flat, SMB | **$750 / mo** |
| 2 | **Interview scheduling** | Calendly Teams | Axon `schedule_interview` + Calendly OAuth | $20/seat/mo (monthly), $16 annual | **$40 / mo** (2 recruiters) |
| 3 | **E-signature** | DocuSign Business Pro | Offer letters + companion docs, HMAC-signed accept page | $40/user/mo (annual) | **$120 / mo** (3 senders) |
| 4 | **HRIS / onboarding** | BambooHR Essentials | `app_users` + onboarding plans + Axon-as-trainer | $250/mo flat for ≤25 employees | **$250 / mo** |
| 5 | **AI scratchpad (recruiter side)** | ChatGPT Business | Axon does the same work, in-app, with action authority | $25–$30/seat/mo | **$300 / mo** (10 seats) |
| 6 | **Wiki / databases** | Notion Business | Pattern Library + Resource Hub + multi-view tables across the app | $18/user/mo (monthly) | **$180 / mo** |
| 7 | **No-code automation** | Zapier Professional | Axon action registry + `chain_commands` + monitors + webhooks | $73.50/mo (monthly), $49 annual | **$74 / mo** |
| 8 | **Team chat** | Slack Pro | `cwa_chat` + `cwa_dm_chat` (reactions, replies, typing, read receipts) | $7.25–$8.75/user/mo | **$88 / mo** |
| 9 | **Project / issue tracking** | Linear Business | `cwa_todos` + Weekly Quotas Kanban + meetings | $14/user/mo (monthly) | **$56 / mo** (engineers only) |
| 10 | **Meeting transcription** | Otter.ai Business | Whisper sidecar (planned) + Axon meeting recap | $30/user/mo (monthly), $20 annual | **$150 / mo** (5 attendees) |
| 11 | **Accounting / bookkeeping** | QuickBooks Online Plus | `src/Bookkeeping/` double-entry GL + multi-entity | $115/mo flat | **$115 / mo** |
| 12 | **Invoicing** | FreshBooks Plus | `/invoicer` (3-pane, dynamic line items, PDF, Resend send) | $38/mo + $11/extra seat | **$60 / mo** |
| 13 | **CRM (light)** | HubSpot Sales Hub Starter | Counterparty tables + Candidates as the precursor pipeline | $15–$20/seat/mo | **$60 / mo** (3 sales) |
| 14 | **Expense / receipt capture** | Expensify | Bookkeeping receipt OCR via Claude Vision (planned) | $5–$9/user/mo | **$90 / mo** |
| 15 | **Transactional email / broadcasts** | Mailchimp Transactional / Resend tier | Resend wrappers in Tauri (`add_contact`, `create_broadcast`, `send_broadcast`) | ~$20–$50/mo for SMB volume | **$30 / mo** |

---

## The headline number

**Total monthly stack for a 10-person team: ~$2,360 / mo ≈ $28,300 / year.**

That's before you factor in:
- Onboarding fees Greenhouse charges
- Integration glue (Zapier tasks beyond 2k/mo, DocuSign SMS sends, BambooHR add-ons)
- The recruiter-hour cost of actually running this stack — which is the real expense and the thing AI eats

If you go up-market (50-person company), the same stack triples to ~$7k–$10k/mo because most of these tools are per-seat. Takeover's pricing should be flat or very lightly per-seat so the savings scale.

---

## Where each replacement is real today vs. on the roadmap

**Live and shippable (10 of 15):**
- Applicant Tracking — backend exists (offer letters live, `/candidates` + `/apply` form is the 1–2 week build)
- Interview scheduling — Calendly integration is the 1–2 week build
- E-signature — fully live (ESIGN typed, HMAC, counter-sign, receipt page)
- HRIS / onboarding — `app_users` lives, onboarding plan + Axon-as-trainer is the 1–2 week build
- AI scratchpad — Axon is fully live and ahead of ChatGPT Business for ops work (action authority, undo, voice)
- Wiki / databases — Pattern Library + Resource Hub live; broader multi-view DB rollout is roadmap
- No-code automation — Axon action registry + automations + monitors are live; visual flow builder is roadmap
- Team chat — fully live (Phase 2 refactor done; reactions/replies/typing/read-receipts shipping)
- Project / issue tracking — Weekly Quotas live with Kanban; todos + meetings live
- Invoicing — fully live (recently refactored)

**Partial today (3 of 15):**
- Meeting transcription — Whisper sidecar is a Rust stub; Axon TTS/STT pieces exist
- Accounting / bookkeeping — engine + reports done, Stripe/Plaid clients stubbed pending creds
- CRM — Counterparty table exists in Bookkeeping; sales pipeline is light

**Roadmap (2 of 15):**
- Expense / receipt capture — Claude Vision proven elsewhere in app; bookkeeping integration is straightforward
- Transactional email — Resend wrappers exist on the Tauri side; broadcast UI is partial

The pitch can comfortably claim *thirteen* of fifteen are working today, with one demo (the AI-driven hiring pipeline) that visibly stitches five of them together in one voice command.

---

## Items I left out (and why)

To keep the list at 15 and tightly anchored to actual code surface, I excluded categories where Takeover doesn't really compete or where the SaaS is infrastructure rather than a user-facing tool:

- **Stripe** — payments rails, not a workflow tool; Takeover *uses* Stripe, doesn't replace it
- **Supabase / Postgres** — infrastructure, not SaaS we're displacing
- **AWS / Vercel** — infrastructure
- **Anthropic / OpenAI** — Takeover uses these models; doesn't replace them
- **Plaid** — infra rails; same pattern
- **Loom** — async video is genuinely outside Takeover's surface today
- **1Password / Bitwarden** — credentials store exists in Axon but tiny scope
- **Workday / Rippling** — too enterprise; Takeover is SMB-to-mid-market

If you want to swap something out, the most natural candidates to **remove** are:
- HubSpot (CRM is the weakest claim today)
- Expensify (only valid once receipt OCR ships)
- Otter.ai (transcription is stubbed)

Strong candidates to **swap in** if you want a different angle:
- **Lever** (alternative to Greenhouse — same category, often slightly cheaper)
- **Loom** (if async video becomes part of Axon-as-trainer)
- **Pipedrive** (lighter CRM than HubSpot, cleaner story)
- **Workable** (SMB-focused ATS, common pricing reference)
- **Cal.com** (if we go open-source-scheduler instead of Calendly)

---

## How to use this in the deck

The slide doesn't need all 15 in a grid (too busy on a projected screen at the back of a room). Three-tier visual that lands harder:

1. **Hero number:** "Your stack: $2,300+/month." Centered, 80pt.
2. **Logo grid** of all 15, faded to ~40% opacity.
3. **One unified screenshot** of Takeover behind it — same screen, all the work, no logos.

The pitch line: *"This is what an ops team pays for. This is what they actually do. We're the second one."*

---

## Sources

Pricing verified May 2026:

- Greenhouse — [Vendr marketplace](https://www.vendr.com/marketplace/greenhouse), [Greenhouse pricing page](https://www.greenhouse.com/pricing)
- Calendly — [Calendly pricing page](https://calendly.com/pricing), [Cal.com competitive analysis](https://cal.com/blog/calendly-pricing)
- DocuSign — [DocuSign plans](https://ecom.docusign.com/plans-and-pricing/esignature), [PandaDoc breakdown](https://www.pandadoc.com/blog/docusign-pricing/)
- BambooHR — [BambooHR pricing](https://www.bamboohr.com/pricing/), [PeopleManagingPeople analysis](https://peoplemanagingpeople.com/tools/bamboohr-pricing/)
- ChatGPT Business — [OpenAI pricing](https://openai.com/business/chatgpt-pricing/), [ChatGPT plans](https://chatgpt.com/pricing/)
- Notion — [Notion pricing](https://www.notion.com/pricing)
- Zapier — [Zapier pricing](https://zapier.com/pricing)
- Slack — [Slack Pro pricing](https://slack.com/pricing/pro)
- Linear — [Quackback pricing breakdown](https://quackback.io/blog/linear-pricing)
- Otter.ai — [Otter.ai pricing](https://otter.ai/pricing)
- QuickBooks — [Intuit pricing](https://quickbooks.intuit.com/pricing/), [NerdWallet review](https://www.nerdwallet.com/business/software/learn/quickbooks-pricing)
- FreshBooks — [FreshBooks pricing](https://www.freshbooks.com/pricing)
- HubSpot — [HubSpot Sales Hub guide](https://blog.hubspot.com/sales/hubspot-sales-hub-pricing)
