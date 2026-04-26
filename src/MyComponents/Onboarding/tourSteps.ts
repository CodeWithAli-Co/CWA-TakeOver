// ───────────────────────────────────────────────────────────────────
// Tour stops — role-aware.
//
// Each stop:
//   • route — where the router goes before the card renders.
//   • title / body — short copy the operator reads.
//   • hint — optional one-liner suggestion of what to try.
//   • selector — optional element to spotlight; omit for centered intro.
//
// `getTourStopsForRole(role)` returns the right list. Admins / execs
// see the financial + bookkeeping stack; rank-and-file employees see
// chat / tasks / quotas / their daily working pages.
// ───────────────────────────────────────────────────────────────────

import type { TourStop } from "./tourStore";

// Common closer used by every role — the meta-pitch for Axon + replay.
const AXON_AND_DONE: TourStop[] = [
  {
    id: "axon",
    route: "/",
    title: "Meet Axon — your in-app copilot",
    body:
      "The orb in the bottom-right is Axon. Drag him anywhere, click " +
      "to open the command panel, or just say 'Hey Axon' to talk. He " +
      "can write code, summarize what's on screen, run reports, walk " +
      "you through any page, and answer questions about the app.",
    hint: "Try: 'Axon, what does this page do?'",
    placement: "center",
  },
  {
    id: "done",
    route: "/",
    title: "That's the whole app.",
    body:
      "You can replay this tour any time from the Onboarding page → " +
      "'Take a tour' button. Welcome aboard.",
    hint: "Hit Finish to dive in.",
    placement: "center",
  },
];

// Welcome stop reused across every role — same copy regardless.
function welcomeStop(roleLabel: string): TourStop {
  return {
    id: "welcome",
    route: "/",
    title: `Welcome${roleLabel ? `, ${roleLabel}` : ""} — quick lay of the land.`,
    body:
      "We'll walk through the pages you'll use the most. Each stop is " +
      "a sentence or two — no quizzes, no busywork. You can skip any " +
      "time and replay this from the Onboarding page.",
    hint: "Click Next to start the tour.",
    placement: "center",
  };
}

// ── Executive / admin tour ──────────────────────────────────────────
// Admin, CEO, COO, CFO — anyone running the business should know
// where the financial + reporting + people surfaces live.
const EXECUTIVE_STOPS: TourStop[] = [
  welcomeStop(""),
  {
    id: "dashboard",
    route: "/financialDashboard",
    title: "Finance Dashboard — the daily glance",
    body:
      "Top of the dashboard surfaces your KPIs: cash on hand, MTD " +
      "revenue, burn rate, runway. The cashflow chart underneath is " +
      "interactive — hover the bars to see exact day amounts.",
    hint: "This is where most of your team will land first thing in the morning.",
    placement: "center",
  },
  {
    id: "transactions",
    route: "/financialDashboard/transactions",
    title: "Transactions — every dollar that moved",
    body:
      "All bank + Stripe activity in one ledger. The wallet at the top " +
      "shows each connected institution with its current balance and a " +
      "logo. Click any row to see the full transaction detail.",
    hint: "Use the search bar to find a specific charge by description or amount.",
    placement: "center",
  },
  {
    id: "reports",
    route: "/reports",
    title: "Reports — your inbox of insights",
    body:
      "Generated reports drop here automatically (P&L, cashflow, period " +
      "close summaries). Treat it like an inbox: scan the left list, " +
      "click to open on the right, archive when done.",
    hint: "Filter by company, period, or report type from the search bar.",
    placement: "center",
  },
  {
    id: "bookkeeping",
    route: "/bookkeeping",
    title: "Bookkeeping — the source of truth",
    body:
      "Multi-entity ledger with full double-entry GL. Pick an entity " +
      "at the top, jump between Journal, Period Close, Reconciliation, " +
      "and Import Inbox using the tabs. Stripe + Plaid imports land " +
      "in Inbox for you to confirm before posting.",
    hint: "Period Close walks you through an 8-step checklist for a clean month.",
    placement: "center",
  },
  {
    id: "onboarding-admin",
    route: "/onboarding",
    title: "Onboarding — for every new hire",
    body:
      "Templates define the task list a new hire sees on day one. " +
      "Instances are live runs of those templates assigned to specific " +
      "people. Use the Templates tab to author or tweak the playbook " +
      "and 'Provision onboarding' to spawn one manually.",
    hint: "Auto-provisioning fires on first sign-in — manual provisioning is the fallback.",
    placement: "center",
  },
  ...AXON_AND_DONE,
];

// ── Standard employee tour ──────────────────────────────────────────
// Member, Intern — the basics: chat, tasks, quotas, settings.
const EMPLOYEE_STOPS: TourStop[] = [
  welcomeStop(""),
  {
    id: "home",
    route: "/",
    title: "Home — your daily landing pad",
    body:
      "Everything you need to start your day lives one click away from " +
      "Home. Recent chats, active tasks, and your weekly quota progress " +
      "all surface here.",
    hint: "Bookmark this — it's the page you'll open most.",
    placement: "center",
  },
  {
    id: "chat",
    route: "/chat",
    title: "Chat — talk to anyone, fast",
    body:
      "Direct messages and team channels live here. Threads stay " +
      "scoped — replies don't drown the main channel. Use the @ menu " +
      "to mention someone and they'll get a notification.",
    hint: "Hit Cmd+K from anywhere to search every message.",
    placement: "center",
  },
  {
    id: "task",
    route: "/task",
    title: "Tasks — your to-do list",
    body:
      "Everything assigned to you, plus tasks you're tracking for " +
      "others. Drag to reorder, click to expand, check off when done. " +
      "Anything overdue floats to the top with a red flag.",
    hint: "Press 'n' to quickly add a new task without leaving your keyboard.",
    placement: "center",
  },
  {
    id: "quota",
    route: "/quota",
    title: "Weekly Quotas — your output, at a glance",
    body:
      "Your weekly quota tracks the deliverables you committed to for " +
      "the sprint. Green means on pace, amber means behind, red means " +
      "you're going to miss it. Update progress as you ship.",
    hint: "Sync these with your manager during your weekly 1:1.",
    placement: "center",
  },
  {
    id: "settings",
    route: "/settings",
    title: "Settings — make it yours",
    body:
      "Profile, notifications, theme, keyboard shortcuts. Tweak it once " +
      "and you're done. The notification settings let you mute channels " +
      "you don't need pings from.",
    hint: "Try dark mode if you haven't yet — most of us never go back.",
    placement: "center",
  },
  ...AXON_AND_DONE,
];

// ── Project Manager tour ────────────────────────────────────────────
// PMs need everything employees see + admin permissions + scheduling.
const PROJECT_MANAGER_STOPS: TourStop[] = [
  welcomeStop("PM"),
  {
    id: "home",
    route: "/",
    title: "Home — your daily landing pad",
    body:
      "Quick view of your team's pulse: active tasks, blockers, and " +
      "anyone whose quota is slipping. Start the day here.",
    placement: "center",
  },
  {
    id: "task",
    route: "/task",
    title: "Tasks — assign, track, ship",
    body:
      "Your team's task board. Drag to reorder priorities, assign to " +
      "anyone on your team, comment on cards to leave context. Overdue " +
      "items float to the top with a red flag.",
    hint: "Hit 'n' to quickly add a new task and assign it on the spot.",
    placement: "center",
  },
  {
    id: "schedule",
    route: "/schedule",
    title: "Schedule — who's doing what, when",
    body:
      "Calendar of your team's commitments — sprints, releases, OOO. " +
      "Drag to move events, click an empty slot to create one.",
    placement: "center",
  },
  {
    id: "quota",
    route: "/quota",
    title: "Weekly Quotas — team output",
    body:
      "Roll-up of every report's weekly deliverables. Green / amber / " +
      "red tells you where to focus your 1:1s this week.",
    placement: "center",
  },
  {
    id: "chat",
    route: "/chat",
    title: "Chat — keep the team unblocked",
    body:
      "DMs and team channels. Threads keep replies scoped so the main " +
      "channel doesn't get drowned. Use @ mentions to ping individuals.",
    placement: "center",
  },
  ...AXON_AND_DONE,
];

// ── Account Manager tour ────────────────────────────────────────────
// AMs need client-facing surfaces + the standard employee stack.
const ACCOUNT_MANAGER_STOPS: TourStop[] = [
  welcomeStop("AM"),
  {
    id: "home",
    route: "/",
    title: "Home — your daily landing pad",
    body:
      "Active accounts, recent client touches, scheduled check-ins. " +
      "Start your day from here.",
    placement: "center",
  },
  {
    id: "chat",
    route: "/chat",
    title: "Chat — internal coordination",
    body:
      "Talk to your team without losing context. Use threads to keep " +
      "deal-specific conversations tidy.",
    placement: "center",
  },
  {
    id: "task",
    route: "/task",
    title: "Tasks — what's on your plate",
    body:
      "Your active client work. Filter by account, due date, or " +
      "status. Drag to reorder priority.",
    placement: "center",
  },
  {
    id: "schedule",
    route: "/schedule",
    title: "Schedule — client check-ins + internal commitments",
    body:
      "Calendar of every client call, internal sync, and OOO. Drag " +
      "to reschedule, click an empty slot to add a new event.",
    placement: "center",
  },
  {
    id: "quota",
    route: "/quota",
    title: "Weekly Quotas — your output",
    body:
      "Your weekly deliverables to clients + internal targets. Green / " +
      "amber / red tells you where to push.",
    placement: "center",
  },
  ...AXON_AND_DONE,
];

// ── Marketing tour ──────────────────────────────────────────────────
// Marketing folks live in cold-email, broadcast, and the chat.
const MARKETING_STOPS: TourStop[] = [
  welcomeStop(""),
  {
    id: "home",
    route: "/",
    title: "Home — daily marketing dashboard",
    body:
      "Active campaigns, scheduled broadcasts, recent engagement. " +
      "Start every morning here to see what shipped overnight.",
    placement: "center",
  },
  {
    id: "task",
    route: "/task",
    title: "Tasks — your campaign queue",
    body:
      "Everything you're working on plus anything assigned to you by " +
      "the team. Drag to reorder, click to expand for details.",
    placement: "center",
  },
  {
    id: "quota",
    route: "/quota",
    title: "Weekly Quotas — output targets",
    body:
      "Posts shipped, emails sent, content drafted — your weekly goals " +
      "tracked here. Update progress as you ship.",
    placement: "center",
  },
  {
    id: "chat",
    route: "/chat",
    title: "Chat — coordinate with the team",
    body:
      "Internal chat for fast decisions. Use threads for campaign " +
      "reviews so the main channel doesn't get drowned.",
    placement: "center",
  },
  ...AXON_AND_DONE,
];

// ── Role detection — keep this lenient. The user's role string
// might come in a few flavors depending on where it's read. We
// normalize aggressively. ────────────────────────────────────────────

export type TourRole =
  | "executive"
  | "manager"
  | "account"
  | "marketing"
  | "employee";

export function classifyRoleForTour(role: string | null | undefined): TourRole {
  const r = (role ?? "").toLowerCase();
  if (
    r === "admin" ||
    r === "ceo" ||
    r === "coo" ||
    r === "cfo" ||
    r === "owner" ||
    r === "founder"
  ) {
    return "executive";
  }
  if (r.includes("project") || r === "pm" || r === "projectmanager") {
    return "manager";
  }
  if (r.includes("account") || r === "am" || r === "accountmanager" || r === "accmanager") {
    return "account";
  }
  if (r.includes("marketing")) {
    return "marketing";
  }
  // Member, Intern, SecurityEngineer, anything else → employee.
  return "employee";
}

export function getTourStopsForRole(role: string | null | undefined): TourStop[] {
  switch (classifyRoleForTour(role)) {
    case "executive":
      return EXECUTIVE_STOPS;
    case "manager":
      return PROJECT_MANAGER_STOPS;
    case "account":
      return ACCOUNT_MANAGER_STOPS;
    case "marketing":
      return MARKETING_STOPS;
    case "employee":
    default:
      return EMPLOYEE_STOPS;
  }
}

// Backward-compatible default — kept so older imports don't break.
// Defaults to the executive stack (matches the old behavior since
// only admins were testing it).
export const DEFAULT_TOUR_STOPS = EXECUTIVE_STOPS;
