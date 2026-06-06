// ───────────────────────────────────────────────────────────────────
// Linear actions — read team issues and current cycles, optionally
// create issues by voice.
//
// Three actions registered:
//
//   · linear_list_issues   — what's on the team's plate right now
//   · linear_list_cycles   — active sprints across all teams
//   · linear_create_issue  — voice-driven issue creation
//
// All hit api.linear.app/graphql directly — CORS is friendly with
// Personal API Keys, so no proxy hop required. Per-tenant safe:
// fetchConnectorByKind auto-resolves the active company from
// Stronghold.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchConnectorByKind,
  type Connector,
} from "@/stores/connectors";
import {
  linearCreateIssue,
  linearListCycles,
  linearListIssues,
} from "@/lib/linear";

interface LinearCreds {
  token?: string;
}

function readLinearCreds(
  connector: Connector | null,
): { token: string } | { error: string } {
  if (!connector) {
    return {
      error:
        "Linear is not connected. Open Settings → Connectors and add it first.",
    };
  }
  const creds = (connector.credentials ?? {}) as LinearCreds;
  const token = (creds.token ?? "").trim();
  if (!token) {
    return { error: "Linear credentials are incomplete (missing token)." };
  }
  return { token };
}

// ─── linear_list_issues ──────────────────────────────────────────

export const linearListIssuesAction: AxonAction<
  { limit?: number; include_completed?: boolean },
  {
    count: number;
    issues: {
      identifier: string;
      title: string;
      state: string;
      priority: string;
      assignee: string | null;
      team: string;
      due: string | null;
      url: string;
    }[];
  }
> = {
  name: "linear_list_issues",
  description:
    "List active Linear issues across the workspace, newest first. Excludes completed and canceled by default. Use this to answer 'what's the team working on?' or 'what's on my plate in Linear?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max issues to return (default 25)." },
      include_completed: {
        type: "boolean",
        description: "Include completed/canceled issues. Default false.",
      },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("linear");
    const creds = readLinearCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, issues: [] } };
    }
    const raw = await linearListIssues(creds.token, {
      limit: input.limit ?? 25,
      includeCompleted: input.include_completed ?? false,
    });
    const issues = raw.map((i) => ({
      identifier: i.identifier,
      title: i.title,
      state: i.state.name,
      priority: i.priorityLabel,
      assignee: i.assignee?.name ?? null,
      team: i.team.key,
      due: i.dueDate,
      url: i.url,
    }));
    ctx.logActivity({
      actionName: "linear_list_issues",
      params: { limit: input.limit, include_completed: input.include_completed },
      summary: `Listed ${issues.length} Linear issue(s)`,
    });
    return {
      summary: `Found ${issues.length} active Linear issue(s).`,
      data: { count: issues.length, issues },
    };
  },
};

// ─── linear_list_cycles ──────────────────────────────────────────

export const linearListCyclesAction: AxonAction<
  { limit?: number },
  {
    count: number;
    cycles: {
      team: string;
      number: number;
      name: string | null;
      starts: string;
      ends: string;
      progress: number;
    }[];
  }
> = {
  name: "linear_list_cycles",
  description:
    "List active Linear cycles (sprints) across all teams. Returns the cycle number, dates, and completion progress. Use this to answer 'what sprint are we in?' or 'how's the current cycle going?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max cycles (default 10)." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("linear");
    const creds = readLinearCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, cycles: [] } };
    }
    const raw = await linearListCycles(creds.token, { limit: input.limit ?? 10 });
    const cycles = raw.map((c) => ({
      team: c.team.key,
      number: c.number,
      name: c.name,
      starts: c.startsAt,
      ends: c.endsAt,
      progress: c.progress,
    }));
    ctx.logActivity({
      actionName: "linear_list_cycles",
      params: { limit: input.limit },
      summary: `Listed ${cycles.length} Linear cycle(s)`,
    });
    return {
      summary: `${cycles.length} active Linear cycle(s).`,
      data: { count: cycles.length, cycles },
    };
  },
};

// ─── linear_create_issue ─────────────────────────────────────────

export const linearCreateIssueAction: AxonAction<
  { team_id: string; title: string; description?: string; priority?: number },
  { identifier: string; url: string }
> = {
  name: "linear_create_issue",
  description:
    "Create a Linear issue. Requires a team_id (lookup via linear_list_issues — the `team` field on any issue is the team key, but team_id is the GraphQL id you'll see in API responses). Mutating — AXON should confirm title with the operator before sending.",
  input_schema: {
    type: "object",
    properties: {
      team_id: { type: "string", description: "Linear team id (GraphQL id, NOT the key)." },
      title: { type: "string", description: "Issue title." },
      description: { type: "string", description: "Markdown body. Optional." },
      priority: {
        type: "number",
        description: "0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low.",
      },
    },
    required: ["team_id", "title"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (input, ctx) => {
    if (!input?.team_id || !input?.title?.trim()) {
      throw new Error("linear_create_issue needs team_id + title.");
    }
    const connector = await fetchConnectorByKind("linear");
    const creds = readLinearCreds(connector);
    if ("error" in creds) throw new Error(creds.error);
    const r = await linearCreateIssue(creds.token, {
      teamId: input.team_id,
      title: input.title,
      description: input.description,
      priority: input.priority,
    });
    ctx.logActivity({
      actionName: "linear_create_issue",
      params: { team_id: input.team_id, title: input.title },
      summary: `Created Linear issue ${r.identifier}`,
    });
    return {
      summary: `Created ${r.identifier}.`,
      data: { identifier: r.identifier, url: r.url },
    };
  },
};

export function registerLinearActions() {
  registerAction(linearListIssuesAction);
  registerAction(linearListCyclesAction);
  registerAction(linearCreateIssueAction);
}
