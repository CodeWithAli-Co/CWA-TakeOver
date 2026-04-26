# Bookkeeping

Multi-entity, double-entry general ledger for TakeOver. Internal-only.

**Start here:** [PLAN.md](./PLAN.md) — full architectural plan +
"what makes it excel" wishlist.

## Structure

```
Bookkeeping/
├── PLAN.md, README.md
├── types/             — Entity, GLAccount, JournalEntry, JournalLine,
│                        Counterparty, ImportedTransaction, Reports.
├── data/              — seedChartOfAccounts (per legal form),
│                        seedEntities (CWA Sole Prop + Simplicity LLC),
│                        seedReconciliationRules (default categorization).
├── engine/
│   ├── validation.ts  — pure invariants (D=C, postable, period locks).
│   ├── ledger.ts      — postEntry / reverseEntry, LedgerStore interface.
│   ├── reconciliation.ts — match imported tx to JE / rule / pending.
│   └── reports.ts     — pure trial balance, P&L, balance sheet, AR aging.
├── sources/
│   ├── stripe/        — pure transforms (charge/payout/refund → JE),
│   │                    client stub (gated on creds).
│   └── plaid/         — pure transform (tx → ImportedTransaction),
│                        client stub.
├── stores/            — Zustand-backed ledger, counterparty, period,
│                        importedTx, reconciliationRules, activeEntity.
├── ui/                — BookkeepingRoot, JournalEntryEditor (live D=C),
│                        JournalEntryList, CounterpartyManager,
│                        PeriodManager, ImportInbox, SourcesPanel,
│                        ReportsPanel + reports/{TrialBalance, P&L, BS}.
├── routes/            — placeholder for nested sub-routes (the real
│                        /bookkeeping route lives in src/routes/).
└── utils/             — format, periods, coaCodes.
```

## Status

| Phase | Status |
|---|---|
| 1 — Foundation (types, seed CoA, ledger engine, route shell) | **Done** |
| 1b — JE editor, JE list, counterparties, periods | **Done** |
| 2 — Source transforms (Stripe + Plaid) + reconciliation engine + Import Inbox + Sources panel | **Done (transforms ready, clients gated on creds)** |
| 3 — Reports engine (TB, P&L, BS, AR aging) + UI | **Done (basic UI; cashflow statement still pending)** |
| 4 — Full reconciliation (bank ↔ GL match view, AR ↔ payments matcher) + period close checklist | Pending |
| 5 — Excel/Accurate/Amazing features (receipt OCR, anomalies, SaaS rev rec, FX revaluation, Axon voice) | Pending |
| 6 — Polish, dashboard widgets, exports (QBO IIF, 1099-NEC, Schedule C) | Pending |

## What works right now (no creds needed)

- Switch entities (CodeWithAli ↔ SimplicityFunds), persisted.
- View seeded chart of accounts per entity (Sole Prop vs LLC equity differs correctly).
- Post journal entries via the UI editor — live debits=credits validation, post button disabled until balanced.
- Browse posted entries, drill into lines.
- Add customers + vendors per entity.
- Create + lock fiscal periods (locked periods refuse new posts).
- Run Trial Balance, P&L, Balance Sheet — year-to-date, with auto-derived Current Year Earnings on the BS.

## What's stubbed but ready

- Stripe + Plaid transformers are pure functions, fully testable.
- Reconciliation engine matches imported tx against existing JEs and rules.
- ImportInbox UI handles approve / exclude per row.
- Source clients gate on credentials — paste them in and import begins.

## Next when credentials land

1. Drop Stripe restricted API key + per-entity Stripe Account IDs.
2. Reuse simplicity_web Plaid linkage or set up a fresh per-entity item.
3. Wire `resolveStripeClient` and `resolvePlaidClient` to read from the
   credentials store; importCharges / syncTransactions then flow into
   the Inbox automatically.
