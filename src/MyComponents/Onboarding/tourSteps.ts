// ───────────────────────────────────────────────────────────────────
// Default tour stops for the post-onboarding walkthrough.
//
// Each stop:
//   • route — where the router goes before the card renders.
//   • title / body — short copy the operator reads.
//   • hint — optional one-liner suggestion of what to try.
//   • selector — optional element to spotlight; omit for centered intro.
//
// Routes were inferred from src/routes/*.lazy.tsx (financialDashboard,
// reports, bookkeeping, onboarding, chat). If a route doesn't exist
// for a role, the tour overlay will simply land on the closest match
// the router resolves and the operator can click "Next".
// ───────────────────────────────────────────────────────────────────

import type { TourStop } from "./tourStore";

export const DEFAULT_TOUR_STOPS: TourStop[] = [
  {
    id: "welcome",
    route: "/onboarding",
    title: "You're in. Here's the quick lay of the land.",
    body:
      "We'll walk through the five pages you'll spend the most time on. " +
      "Each stop is a sentence or two — no quizzes, no busywork. You can " +
      "skip any time and replay this from the Onboarding page.",
    hint: "Click Next to start the tour.",
    placement: "center",
  },
  {
    id: "dashboard",
    route: "/financialDashboard",
    title: "Dashboard — the daily glance",
    body:
      "Top of the dashboard surfaces your KPIs: cash on hand, MTD revenue, " +
      "burn rate, runway. The cashflow chart underneath is interactive — " +
      "hover the bars to see exact day amounts.",
    hint: "This is where most of your team will land first thing in the morning.",
    placement: "center",
  },
  {
    id: "transactions",
    route: "/financialDashboard/transactions",
    title: "Transactions — every dollar that moved",
    body:
      "All bank + Stripe activity in one ledger. The sidebar at the top " +
      "shows each connected institution with its current balance and a " +
      "logo. Click any row to see the full transaction detail and tag it.",
    hint: "Use the search bar to find a specific charge by description or amount.",
    placement: "center",
  },
  {
    id: "reports",
    route: "/reports",
    title: "Reports — your inbox of insights",
    body:
      "Generated reports drop here automatically (P&L, cashflow, period " +
      "close summaries). Treat it like an inbox: scan the left list, click " +
      "to open on the right, archive when done.",
    hint: "Hit the search bar at the top to filter by company, period, or report type.",
    placement: "center",
  },
  {
    id: "bookkeeping",
    route: "/bookkeeping",
    title: "Bookkeeping — the source of truth",
    body:
      "Multi-entity ledger with full double-entry GL. Pick an entity at " +
      "the top, jump between Journal, Period Close, Reconciliation, and " +
      "Import Inbox using the tabs. Stripe + Plaid imports land in Inbox " +
      "for you to confirm before posting.",
    hint: "Period Close walks you through an 8-step checklist when you close a month.",
    placement: "center",
  },
  {
    id: "onboarding",
    route: "/onboarding",
    title: "Onboarding — for every new hire",
    body:
      "This is the page you're on now. Templates define the task list a " +
      "new hire sees on their first day. Instances are live runs of those " +
      "templates assigned to specific people. As an admin, the Templates " +
      "tab lets you author or tweak the playbook.",
    hint: "Click 'Provision' to spawn an onboarding for a hire who didn't get auto-provisioned.",
    placement: "center",
  },
  {
    id: "axon",
    route: "/financialDashboard",
    title: "Meet Axon — your in-app copilot",
    body:
      "The orb in the bottom-right is Axon. Drag him anywhere, click to " +
      "open the command panel, or just say 'Hey Axon' to talk. He can " +
      "build pages, write reports, run period close, summarize anything " +
      "on screen, and walk through codebases. If you ever feel stuck, " +
      "ask him.",
    hint: "Try: 'Axon, summarize this dashboard for me.'",
    placement: "center",
  },
  {
    id: "done",
    route: "/financialDashboard",
    title: "That's the whole app.",
    body:
      "You can replay this tour any time from the Onboarding page → " +
      "'Take a tour' button. Welcome aboard.",
    hint: "Hit Finish to dive in.",
    placement: "center",
  },
];
