// ───────────────────────────────────────────────────────────────────
// Navigation actions — route the operator around the app.
// Routes are pulled from the generated routeTree at registration time
// so this stays in sync as the app grows.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

/** Map of friendly phrases → route paths. */
const ROUTE_ALIASES: Record<string, string> = {
  home: "/",
  dashboard: "/",
  tasks: "/task",
  task: "/task",
  todos: "/task",
  todo: "/task",
  schedule: "/schedule",
  calendar: "/schedule",
  meetings: "/schedule",
  employees: "/employee",
  employee: "/employee",
  "team members": "/employee",
  finance: "/financialDashboard",
  "financial dashboard": "/financialDashboard",
  revenue: "/financialDashboard",
  budgetary: "/budgetary",
  invoicer: "/invoicer",
  invoices: "/invoicer",
  "cold email": "/coldEmail",
  broadcast: "/broadcast",
  "broadcasts": "/broadcast",
  chat: "/chat",
  details: "/details",
  quota: "/quota",
  "time tracking": "/timetracking",
  settings: "/settings",
  personal: "/personal",
  bio: "/bio",
  "training plan": "/trainingplan",
  "mod logs": "/mod_logs",
  "moderation logs": "/mod_logs",
  bot: "/bot",
  arabic: "/arabic",
  "contract generator": "/contractGenerator",
  contracts: "/contractGenerator",

  // Simplicity surfaces
  users: "/s-users",
  "simplicity users": "/s-users",
  "s users": "/s-users",
  analytics: "/s-analytics",
  "simplicity analytics": "/s-analytics",
  "finance ops": "/s-finance-ops",
  "simplicity finance": "/s-finance-ops",
  overrides: "/s-overrides",
  "dev console": "/s-dev-console",
  "simplicity broadcast": "/s-broadcast",
};

const KNOWN_ROUTES = Array.from(new Set(Object.values(ROUTE_ALIASES)));

export const navigateAction: AxonAction<{ destination: string }, { path: string }> = {
  name: "navigate",
  description:
    "Navigate the app to a named destination. Accepts a friendly name (e.g. 'finance dashboard', 'tasks', 'simplicity analytics') or a route path (e.g. '/task', '/s-users'). Use this for any 'take me to', 'open', 'go to', or 'show me the ... page' request.",
  input_schema: {
    type: "object",
    properties: {
      destination: {
        type: "string",
        description:
          "The destination — a friendly label or a literal route path. Examples: 'finance dashboard', 'tasks', '/s-users'.",
      },
    },
    required: ["destination"],
  },
  handler: async ({ destination }, ctx) => {
    const normalized = destination.toLowerCase().trim();

    // Literal route wins.
    if (normalized.startsWith("/")) {
      ctx.navigate(normalized);
      ctx.logActivity({
        actionName: "navigate",
        params: { destination },
        summary: `Navigated to ${normalized}`,
      });
      return { summary: `Navigated to ${normalized}.`, data: { path: normalized } };
    }

    // Alias lookup.
    const direct = ROUTE_ALIASES[normalized];
    if (direct) {
      ctx.navigate(direct);
      ctx.logActivity({
        actionName: "navigate",
        params: { destination },
        summary: `Navigated to ${direct}`,
      });
      return { summary: `Opened ${normalized}.`, data: { path: direct } };
    }

    // Substring fallback.
    const match = Object.entries(ROUTE_ALIASES).find(
      ([alias]) => normalized.includes(alias) || alias.includes(normalized)
    );
    if (match) {
      ctx.navigate(match[1]);
      ctx.logActivity({
        actionName: "navigate",
        params: { destination },
        summary: `Navigated to ${match[1]}`,
      });
      return { summary: `Opened ${match[0]}.`, data: { path: match[1] } };
    }

    return {
      summary: `I could not find a route matching "${destination}". Known destinations: ${KNOWN_ROUTES.slice(
        0,
        12
      ).join(", ")}…`,
    };
  },
};

export const goBackAction: AxonAction<Record<string, never>, { went: boolean }> = {
  name: "go_back",
  description: "Navigate back in the app's history. Use when the operator says 'go back' or 'previous page'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    // TanStack Router memory history — use window.history as adapter.
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      ctx.logActivity({
        actionName: "go_back",
        params: {},
        summary: "Navigated back",
      });
      return { summary: "Back.", data: { went: true } };
    }
    return { summary: "Nowhere to go back to.", data: { went: false } };
  },
};

export function registerNavigationActions() {
  registerAction(navigateAction);
  registerAction(goBackAction);
}
