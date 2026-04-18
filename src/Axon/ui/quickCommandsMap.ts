// ───────────────────────────────────────────────────────────────────
// Contextual quick-commands per route.
// The panel's chip strip shows these for the current page.
// ───────────────────────────────────────────────────────────────────

export interface QuickSet {
  /** Common regardless of company. */
  common: string[];
  /** CWA context. */
  cwa?: string[];
  /** Simplicity context. */
  simplicity?: string[];
}

// Keyed by normalized pathname (no trailing slash). Fallback = GLOBAL.
export const QUICK_COMMANDS: Record<string, QuickSet> = {
  "/": {
    common: ["Brief me", "What's overdue?", "What's on my plate this week?"],
    cwa: ["Open finance", "Switch to Simplicity"],
    simplicity: ["Open analytics", "Switch to CodeWithAli"],
  },
  "/task": {
    common: [
      "Mark the first one done",
      "Show me what's overdue",
      "Create a task: review Q2 roadmap, due Friday",
    ],
  },
  "/schedule": {
    common: [
      "What meetings are this week?",
      "Schedule a meeting tomorrow at 3pm",
      "Cancel the next one",
    ],
  },
  "/financialDashboard": {
    common: [
      "What's the biggest expense?",
      "Show revenue this month",
      "Any anomalies?",
    ],
  },
  "/employee": {
    common: ["How many employees?", "List interns", "Who's new this month?"],
  },
  "/invoicer": {
    common: ["Draft an invoice", "Show last 5 invoices"],
  },
  "/broadcast": {
    common: ["Draft an announcement", "Show last broadcast"],
  },
  "/chat": {
    common: ["Summarize recent messages", "Any unread DMs?"],
  },
  "/s-users": {
    common: [
      "How many active users?",
      "Who signed up today?",
      "Find users with beta access",
    ],
  },
  "/s-analytics": {
    common: ["Top metrics this week", "Where did growth slow?"],
  },
  "/s-finance-ops": {
    common: ["Show MRR", "Cash flow this month"],
  },
  "/settings": {
    common: ["Toggle auto-greet", "Change wake word"],
  },
  "/budgetary": {
    common: ["Show savings rate", "Recent transactions"],
  },
};

export const GLOBAL_QUICK_COMMANDS: QuickSet = {
  common: ["Brief me", "What's on screen?", "Run morning routine"],
  cwa: ["Switch to Simplicity"],
  simplicity: ["Switch to CodeWithAli"],
};

export function quicksFor(
  path: string,
  company: "all" | "codeWithAli" | "simplicityFunds"
): string[] {
  const p = path.replace(/\/+$/, "") || "/";
  const set = QUICK_COMMANDS[p] ?? GLOBAL_QUICK_COMMANDS;
  const extra =
    company === "simplicityFunds" ? set.simplicity ?? [] : set.cwa ?? [];
  return [...set.common, ...extra];
}
