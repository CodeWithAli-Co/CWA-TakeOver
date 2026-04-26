# Bookkeeping Module — Architectural Plan

> **Status:** Architecture draft. Folder skeleton + types in place.
> No engine code yet.
> **Scope:** Multi-entity (CodeWithAli + Simplicity + future), full
> double-entry GL, sources = Stripe + Plaid, internal-only audience.

---

## 1. Why a real bookkeeping module instead of a fancier dashboard

You already have:

- **Invoicer** — issues invoices to clients, tracks status.
- **BillingSubscription** store — handles subscription state on the SaaS side.
- **s-finance-ops** route + Simplicity metrics — read-side analytics.

What you DON'T have:

- A **single source of truth** that ties revenue, expenses, cash, AR, AP,
  taxes, owner draws, and FX into a balanced ledger.
- A **trial balance** that proves the books are in balance at any point.
- **Real reports** an accountant or the IRS would accept (P&L, Balance
  Sheet, Cashflow Statement).
- **Multi-entity separation** — right now CodeWithAli money and
  Simplicity money are commingled in your head. They need to be
  separate sets of books that can also consolidate.
- **Bank reconciliation** — proving the cash on your bank statements
  equals the cash in your books.

The Bookkeeping module is the foundation everything else sits on. It
turns the existing dashboards from "vibes" into auditable financial
truth.

---

## 2. Core data model (double-entry, multi-entity)

The whole module rests on four core tables. Everything else is an
accessory.

### Entity

A separate set of books. CodeWithAli LLC and Simplicity Funds Inc are
two Entities. Each has its own chart of accounts, its own period
close, its own base currency.

```
Entity {
  id            UUID
  name          string                    // "CodeWithAli LLC"
  slug          string                    // "cwa"
  legal_form    "LLC" | "C-Corp" | "S-Corp" | "Sole Prop" | "Partnership"
  base_currency "USD" | "CAD" | ...       // reporting currency
  fiscal_year_start  MM-DD                // "01-01" for calendar
  tax_jurisdiction   "US-FED" | "US-CA" | "CA-ON" | ...
  tax_id        string?                   // EIN / BN
  created_at    timestamp
  archived_at   timestamp?
}
```

### GLAccount (Chart of Accounts)

One row per ledger account, scoped to a single entity. Tree-structured
so reports can roll up.

```
GLAccount {
  id              UUID
  entity_id       UUID                    // scoped per entity
  code            string                  // "1000", "4100", etc.
  name            string                  // "Cash - Chase Business Checking"
  type            "asset" | "liability" | "equity" | "income" | "expense"
  subtype         enum  // see below
  normal_balance  "debit" | "credit"      // derived from type
  parent_id       UUID?                   // tree structure
  is_postable     bool                    // false for category-only nodes
  is_archived     bool                    // hide from new entries
  external_link   { type: "plaid_account" | "stripe_account", id }?
}
```

Subtypes (matters for reports):

- **asset**: cash, AR, inventory, prepaid, fixed_asset, accumulated_depreciation
- **liability**: AP, credit_card, accrued, sales_tax_payable, loan_payable
- **equity**: contributed_capital, owner_draw, retained_earnings
- **income**: service_revenue, subscription_revenue, other_income
- **expense**: cogs, operating, marketing, software, professional, travel,
  meals, depreciation, tax, interest

### JournalEntry + JournalLine

The atom of accounting. Every economic event is one JournalEntry made
of two or more JournalLines. **Sum of debits MUST equal sum of credits**
across the lines, in the entity's base currency. This is enforced
at write time.

```
JournalEntry {
  id            UUID
  entity_id     UUID
  date          DATE                      // the economic date, not now()
  memo          string
  status        "draft" | "posted" | "reversed"
  source        "manual" | "stripe" | "plaid" | "invoicer" | "depreciation"
  source_ref    string?                   // e.g. Stripe charge id
  created_by    user_id
  created_at    timestamp
  posted_at     timestamp?
  reversed_by   journal_entry_id?
}

JournalLine {
  id            UUID
  entry_id      UUID
  account_id    UUID                      // GLAccount
  debit         decimal(18,4)             // exactly one of debit / credit
  credit        decimal(18,4)             // is non-zero
  currency      ISO4217                   // transaction currency
  fx_rate       decimal(18,8)             // → entity base currency
  base_debit    decimal(18,4)             // post-FX, what's used for TB
  base_credit   decimal(18,4)
  memo          string?
  counterparty_id UUID?                   // customer or vendor
}
```

**Invariants enforced by `engine/ledger.ts`:**

1. `SUM(base_debit) == SUM(base_credit)` per JournalEntry.
2. Every line has exactly one of `debit > 0` or `credit > 0`.
3. `account_id` belongs to the same entity as `entry.entity_id`.
4. `account.is_postable === true`.
5. If the period containing `date` is locked, refuse the post.
6. Posted entries are immutable. Corrections happen via reversing
   entries (`reversed_by`), never UPDATE.

### Period

A bookkeeping period (month, quarter, year). When closed, no more
posts allowed inside the period.

```
Period {
  id              UUID
  entity_id       UUID
  start           DATE
  end             DATE
  status          "open" | "soft_closed" | "locked"
  closed_by       user_id?
  closed_at       timestamp?
  closing_entry   journal_entry_id?       // the YTD net income → RE move
}
```

---

## 3. The accessory tables

```
Counterparty {                            // Customer / Vendor
  id, entity_id, name, type ∈ {customer, vendor, both},
  email, address, payment_terms, default_account_id, tax_id?
}

ImportedTransaction {                     // raw events from Stripe/Plaid
  id, entity_id, source, source_id, posted_at, amount, currency,
  description, raw_payload jsonb,
  status ∈ {pending, matched, journaled, excluded},
  matched_journal_entry_id?, account_link_id?   // → GLAccount
}

ReconciliationRule {                      // smart auto-categorization
  id, entity_id, priority,
  match { description_regex?, amount_min?, amount_max?, source? },
  action { account_id, counterparty_id?, memo_template? },
  enabled, hit_count
}

TaxRate {
  id, entity_id, jurisdiction, name, rate, type,
  applies_to_account_id?
}

Document {                                // receipts, invoices PDF, etc
  id, entity_id, type, file_url, ocr_text?,
  journal_entry_id?, uploaded_by, created_at
}

AuditLog {                                // every mutation, ever
  id, entity_id, actor, action, target_table, target_id,
  before jsonb, after jsonb, at timestamp
}
```

---

## 4. Source connectors (Stripe + Plaid → JEs)

This is where most apps cheat — they show you Stripe data and call it
done. We're going to do it RIGHT: Stripe events become real journal
entries.

### Stripe → Journal Entries

**A subscription invoice is paid:**
```
Date: invoice.paid event timestamp
Memo: "Stripe — INV-1234 (Acme Corp, monthly subscription)"
Lines:
  Dr  Stripe Pending Balance        $100.00
       Cr  Subscription Revenue            $100.00
  Dr  Stripe Fees                     $3.20
       Cr  Stripe Pending Balance           $3.20
```

So Stripe Pending shows your true balance INSIDE Stripe, and Stripe
Fees is a real expense category.

**A Stripe payout hits your bank:**
```
Memo: "Stripe payout to Chase Business Checking"
Lines:
  Dr  Cash - Chase Business Checking $96.80
       Cr  Stripe Pending Balance          $96.80
```

After the payout posts, Stripe Pending should be near-zero (modulo
in-flight charges). If it's not, you have an unreconciled item.

**A refund:**
```
Lines:
  Dr  Subscription Revenue (contra)   $100.00
       Cr  Stripe Pending Balance           $100.00
```

### Plaid → ImportedTransaction → JE

Plaid pulls every transaction on every bank/credit card. Each one
arrives as an `ImportedTransaction` with status `pending`. Then:

1. **Auto-match against existing JEs.** If the GL already has a JE
   that posts to the same bank account on the same day for the same
   amount (e.g. an Invoicer payment recorded earlier), mark
   `matched`. Done.

2. **Apply ReconciliationRules.** "Description matches `^STRIPE`" →
   create a JE that moves Stripe Pending → Cash. "Amount = $1200 on
   the 1st of the month" → post Rent expense.

3. **Otherwise, sit in the inbox** (`ImportInbox.tsx`) for a human
   to categorize. Categorizing it stores a NEW
   ReconciliationRule so the next similar tx auto-categorizes.

### What about cash you receive that isn't on Stripe or Plaid?

Manual JEs. Voice-command via Axon: *"Record paid $1200 cash for rent
from owner contribution"* generates the JE preview and you confirm.

---

## 5. Reports

Real reports, not vanity. Each is a function over the journal lines,
filtered by entity + period.

| Report | What it answers | How it's computed |
|---|---|---|
| **Trial Balance** | Are debits = credits? | SUM(base_debit) and SUM(base_credit) per account, ensure totals match |
| **P&L** | How much did we make? | All `income` - all `expense` accounts over the period |
| **Balance Sheet** | What do we own / owe? | All `asset` = `liability` + `equity` as of a point in time |
| **Cashflow Statement (Indirect)** | Where did the cash go? | Net Income + non-cash adjustments + working-capital changes |
| **AR Aging** | Who owes us, how late? | Open AR by counterparty, bucketed 0-30 / 30-60 / 60-90 / 90+ |
| **AP Aging** | Who do we owe, how late? | Mirror of AR |
| **Sales Tax Liability** | What do we owe to the state? | Sum of `Sales Tax Payable` minus payments |
| **MRR / ARR Waterfall** | Subscription health | Computed from `subscription_revenue` JE source-tagged Stripe |
| **Multi-entity Consolidated P&L** | CWA + Simplicity together | UNION across entities with intercompany elimination |

Comparative periods (this month vs last month, YoY), drill-down from
any number to the underlying journal entries.

---

## 6. UI surfaces

The module mounts at `/bookkeeping/<entity>/...` with these tabs:

```
┌─ Dashboard            ─ Cash, MRR, runway, AR aging, anomalies
├─ General Ledger       ─ Tree view of CoA, click any account → its
│                         journal lines
├─ Journal Entries      ─ Filterable list, drill to lines, voice-add
├─ Import Inbox         ─ Plaid + Stripe items awaiting categorization
├─ Reconciliation       ─ Bank ↔ GL match view, AR ↔ payments matcher
├─ Reports              ─ TB, P&L, BS, Cashflow, AR/AP aging, exports
├─ Sources              ─ Connect Stripe / Plaid, view import runs
└─ Settings             ─ Entity switcher, CoA editor, period locks,
                         reconciliation rules, tax rates
```

The header has an **EntitySwitcher** that scopes everything below.

---

## 7. What makes this excel and accurate and amazing

A list, in priority order, of the things that move this from
"yet-another-bookkeeping-app" to **the bookkeeping app you wish
existed**.

### 7.1 Two-way reconciliation as the centerpiece, not a chore

Most apps treat reconciliation like a quarterly cleanup. We make it
the home screen. Every Plaid bank account has a **Reconciliation
Status** indicator that's visible from the dashboard. If your Chase
balance from Plaid disagrees with your `Cash - Chase` GL account by
even a penny, a red dot appears. Click it → see exactly which
transactions are unmatched, on which side. Fix them in one click.

### 7.2 Live debits-equals-credits validation

The Journal Entry editor shows the running totals as you type. Below
the lines: `Debits $100.00 / Credits $100.00 ✓` or `Debits $100.00 /
Credits $97.00 ✗ — entry won't post`. Save is disabled until balanced.
Catches mistakes the moment they happen.

### 7.3 Smart categorization that learns

When a Plaid tx arrives matching no existing rule, you categorize it
manually. The system asks: *"Make a rule for 'STRIPE PAYOUT' going
forward?"* — yes. From that day on, every Stripe payout auto-posts.
Over six months, your Import Inbox should be near-empty most days.

### 7.4 Period close with a guided checklist

Closing a month right requires ~8 steps that bookkeepers always
forget. We bake them into a workflow:

1. ☐ Reconcile every bank + credit card to its Plaid balance
2. ☐ Categorize all pending ImportedTransactions
3. ☐ Confirm AR aging balances tie to GL Accounts Receivable
4. ☐ Post depreciation for the month (auto-suggested)
5. ☐ Post payroll accruals (if applicable)
6. ☐ Run the Trial Balance — check debits = credits
7. ☐ Review P&L for anomalies (>30% MoM swings flagged)
8. ☐ Lock the period (creates the closing JE if year-end)

Each checkbox can't be ticked unless the underlying check passes.

### 7.5 Audit trail you'd hand to the IRS

Every mutation hits `AuditLog` with `before` / `after` JSON snapshots.
You can answer "who edited this entry on March 4 and what did it look
like before?" instantly. Posted entries are immutable; corrections
happen via reversing entries with a `reversed_by` link, so the audit
trail shows the full history including the correction.

### 7.6 Multi-entity consolidation with intercompany elimination

When CodeWithAli pays Simplicity for a service, that's TWO entries —
one in each entity's books. The consolidated view automatically
eliminates the intercompany pair so the rolled-up numbers don't
double-count. Entity-level reports still show them (because to CWA,
that money really did leave; to Simplicity, that money really did
arrive).

### 7.7 SaaS revenue recognition done right

A Stripe subscription that bills $1200/year on Jan 1 does NOT mean
you earned $1200 in January. We auto-defer:

```
Jan 1:
  Dr Cash                      $1200
       Cr Deferred Revenue            $1200
Jan 31:
  Dr Deferred Revenue          $100
       Cr Subscription Revenue        $100
... (repeat each month)
```

The deferral schedule is auto-generated from the Stripe subscription
period. P&L now shows the right monthly revenue, balance sheet shows
the deferred liability.

### 7.8 Currency-aware end-to-end

Every line stores both transaction currency and base-currency amounts
with the FX rate used. End-of-period revaluation of foreign-currency
balances posts a real `Unrealized FX Gain/Loss` JE. Reports always
display in the entity's base currency, with optional secondary column
showing the original currency.

### 7.9 Receipt OCR via Claude Vision

Drop a PDF or photo of a receipt onto the Import Inbox. Claude Vision
extracts vendor, amount, date, line items, tax. The system proposes a
JE pre-filled with everything correct (probably). You eyeball it,
confirm. The receipt PDF gets attached to the JE so an IRS auditor
clicking the entry sees the receipt.

### 7.10 Anomaly detection on every report

The dashboard surfaces things like:

- *"This month's Software & Tools is 240% higher than the trailing
  90-day median. Top contributors: Cursor (\$200/mo new), Linear
  (\$50/mo new)."*
- *"AR for Acme Corp aged into the 90+ bucket. Last invoice INV-1234
  for \$5000 issued Feb 12, due Mar 14."*
- *"Stripe payout deposit of \$24,180 on Apr 22 expected; actual
  \$23,975. \$205 unaccounted."*

Anomalies aren't a separate report — they're proactive notices on the
dashboard.

### 7.11 Tax-prep export, year-end ready

One click at year-end produces:

- A signed PDF Trial Balance, P&L, and Balance Sheet.
- A QuickBooks Online IIF export so your CPA can import the year if
  they prefer working in QBO.
- A 1099-NEC vendor summary (for vendors paid >\$600 in the year).
- A categorized expense report grouped per IRS Schedule C line.

### 7.12 Voice control via Axon

Since Axon already lives in the app, every bookkeeping action gets a
voice surface:

- *"Axon, post a journal entry: paid \$45 office supplies from chase,
  staples, today."* → JE preview + confirm.
- *"What's our cash position?"* → "\$48,200 across 3 accounts."
- *"Show me Cursor expenses for the year."* → opens filtered ledger.
- *"Close March."* → triggers the period-close checklist.

Axon's tools call into the Bookkeeping engine via a new
`bookkeeping_action` registered alongside `generate_file`.

### 7.13 Reports are always `as of` a point in time

Run last quarter's Balance Sheet today, get the same numbers you
would have gotten at end-of-quarter — even if entries got
backdated since. Period locks make this trustworthy. Without locks,
the Balance Sheet would shift every time someone edits an old entry.

### 7.14 Fast — local-first, sync via Supabase

The whole module runs against a Zustand store that mirrors a
Supabase Postgres schema 1:1. Read paths hit local first; writes
optimistically update local then sync. Reports compute over the
local store, so changing the period filter is instant — no waiting
for a server roundtrip per click.

### 7.15 Voice-checkable tax accuracy

A `taxAuditCheck` engine pass that runs whenever you open Reports.
It looks for common tax-prep mistakes:

- Personal expenses categorized as Business
- Meals at 100% deduction (they should be 50%)
- Capital expenses incorrectly expensed instead of depreciated
- Missing 1099s for vendors paid >\$600
- Sales tax collected but not remitted

Each finding has an explanation + fix-it button.

---

## 8. Build phasing

Listed because "huge complex system" suggests the user wants the full
arc, not a 1-week MVP. Here's how I'd phase it:

### Phase 1 — Foundation (week 1)

- ✅ Folder skeleton + this PLAN.md
- ✅ Types: Entity, GLAccount, JournalEntry, JournalLine, Period
- Seed CoAs per legal_form
- `engine/ledger.ts` — post / validate / reverse
- `engine/validation.ts` — invariants
- Bookkeeping route + minimal UI shell with Entity switcher

### Phase 2 — Sources (week 2)

- Stripe connector: invoices, charges, payouts, refunds → JEs
- Plaid connector: transactions → ImportedTransaction inbox
- Reconciliation rules engine
- Import Inbox UI

### Phase 3 — Reports (week 3)

- Trial Balance
- P&L (period + comparative)
- Balance Sheet
- Cashflow Statement (Indirect)
- AR / AP Aging
- Multi-entity consolidation

### Phase 4 — Reconciliation + Period Close (week 4)

- Bank reconciliation view
- Period close checklist
- Closing JE / Retained Earnings rollover
- Audit log queries

### Phase 5 — The Amazing Features (weeks 5-6)

- Receipt OCR via Claude Vision
- Anomaly detection
- Tax-prep exports
- SaaS revenue recognition automation
- Currency revaluation
- Axon voice integration

### Phase 6 — Polish

- Dashboard widgets
- Anomaly + AR collection notifications
- 1099-NEC export
- QBO export
- Performance pass (large-ledger virtualization)

---

## 9. Schema location

All tables live in your existing Supabase project under a new schema
`bookkeeping`. Migration will be checked in as a single SQL file at
`src/Bookkeeping/data/schema.sql`. RLS policies scope every row by
`entity_id` AND user membership in the entity (you and your team),
so the audience-internal-only requirement is enforced at the DB
boundary.

---

## 10. Out of scope (deliberately)

- Payroll (use Gusto / Rippling, import their payroll-summary JE
  monthly)
- Inventory (you don't sell physical goods)
- Multi-language / multi-region UI (English / USD / CAD only for now)
- A built-in tax filer (export to TurboTax / send to CPA)
- A full CRM (Counterparty is just enough; use Pipedrive etc for sales)

---

## 11. What I need from you to proceed

When you're ready for Phase 1 implementation:

1. **List your entities** — for each one: legal name, slug, legal
   form, fiscal year start, base currency, tax jurisdiction.
2. **List your bank / credit card accounts** per entity (so the
   default CoA seeds the right `Cash - <Bank>` accounts).
3. **Stripe account IDs** per entity.
4. **Plaid items already linked** — we can reuse the existing Plaid
   integration in CWAComponents/.

Until then, the types + seed CoA in this folder are enough to design
against. Nothing wires to live data yet.
