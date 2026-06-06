// ───────────────────────────────────────────────────────────────────
// Vercel actions — list projects, recent deployments, and surface
// failed deploys so AXON can answer "what shipped to prod this week?".
//
// Three actions registered:
//
//   · vercel_list_projects     — every project the token can see
//   · vercel_list_deployments  — newest-first, optional state filter
//   · vercel_recent_errors     — last N failed deployments only
//
// All hit api.vercel.com directly — Bearer-token CORS works fine
// from the browser.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchConnectorByKind,
  type Connector,
} from "@/stores/connectors";
import {
  vercelListDeployments,
  vercelListProjects,
} from "@/lib/vercel";

interface VercelCreds {
  token?: string;
}

function readVercelCreds(
  connector: Connector | null,
): { token: string } | { error: string } {
  if (!connector) {
    return {
      error: "Vercel is not connected. Open Settings → Connectors and add it first.",
    };
  }
  const creds = (connector.credentials ?? {}) as VercelCreds;
  const token = (creds.token ?? "").trim();
  if (!token) return { error: "Vercel credentials are incomplete." };
  return { token };
}

// ─── vercel_list_projects ────────────────────────────────────────

export const vercelListProjectsAction: AxonAction<
  { limit?: number },
  {
    count: number;
    projects: {
      id: string;
      name: string;
      framework: string | null;
      repo: string | null;
      updated_at: string;
    }[];
  }
> = {
  name: "vercel_list_projects",
  description:
    "List Vercel projects the connected token can see, newest-updated first. Use this to answer 'what projects do we have on Vercel?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max projects (default 20)." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("vercel");
    const creds = readVercelCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, projects: [] } };
    }
    const raw = await vercelListProjects(creds.token, { limit: input.limit ?? 20 });
    const projects = raw.map((p) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      repo: p.link?.repo ?? null,
      updated_at: new Date(p.updatedAt).toISOString(),
    }));
    ctx.logActivity({
      actionName: "vercel_list_projects",
      params: { limit: input.limit },
      summary: `Listed ${projects.length} Vercel project(s)`,
    });
    return {
      summary: `${projects.length} Vercel project(s).`,
      data: { count: projects.length, projects },
    };
  },
};

// ─── vercel_list_deployments ─────────────────────────────────────

export const vercelListDeploymentsAction: AxonAction<
  { limit?: number; project_id?: string; production_only?: boolean },
  {
    count: number;
    deployments: {
      uid: string;
      project: string;
      url: string;
      state: string;
      target: string | null;
      created: string;
    }[];
  }
> = {
  name: "vercel_list_deployments",
  description:
    "List recent Vercel deployments, newest first. Optionally filter by project_id or set production_only=true. Use this for 'what shipped today?' or 'how's the build?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max deployments (default 25)." },
      project_id: { type: "string", description: "Filter to one project." },
      production_only: {
        type: "boolean",
        description: "Only return production deploys. Default false.",
      },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("vercel");
    const creds = readVercelCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, deployments: [] } };
    }
    let raw = await vercelListDeployments(creds.token, {
      limit: input.limit ?? 25,
      projectId: input.project_id,
    });
    if (input.production_only) {
      raw = raw.filter((d) => d.target === "production");
    }
    const deployments = raw.map((d) => ({
      uid: d.uid,
      project: d.name,
      url: d.url,
      state: d.state,
      target: d.target,
      created: new Date(d.created).toISOString(),
    }));
    ctx.logActivity({
      actionName: "vercel_list_deployments",
      params: { limit: input.limit, project_id: input.project_id },
      summary: `Listed ${deployments.length} Vercel deploy(s)`,
    });
    return {
      summary: `${deployments.length} recent deploy(s).`,
      data: { count: deployments.length, deployments },
    };
  },
};

// ─── vercel_recent_errors ────────────────────────────────────────

export const vercelRecentErrorsAction: AxonAction<
  { limit?: number },
  {
    count: number;
    failures: {
      project: string;
      url: string;
      target: string | null;
      created: string;
    }[];
  }
> = {
  name: "vercel_recent_errors",
  description:
    "List recent failed Vercel deployments (state=ERROR). Use this to answer 'did anything break?' or 'are we red?' without scanning the full deploy list.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max failures (default 10)." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("vercel");
    const creds = readVercelCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, failures: [] } };
    }
    const raw = await vercelListDeployments(creds.token, {
      limit: input.limit ?? 10,
      state: "ERROR",
    });
    const failures = raw.map((d) => ({
      project: d.name,
      url: d.url,
      target: d.target,
      created: new Date(d.created).toISOString(),
    }));
    ctx.logActivity({
      actionName: "vercel_recent_errors",
      params: { limit: input.limit },
      summary: `${failures.length} failed deploy(s)`,
    });
    return {
      summary:
        failures.length === 0
          ? "No recent Vercel deploy failures."
          : `${failures.length} recent deploy failure(s).`,
      data: { count: failures.length, failures },
    };
  },
};

export function registerVercelActions() {
  registerAction(vercelListProjectsAction);
  registerAction(vercelListDeploymentsAction);
  registerAction(vercelRecentErrorsAction);
}
