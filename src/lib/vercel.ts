/**
 * lib/vercel.ts — minimal browser-side Vercel REST API client.
 *
 * Vercel's REST API accepts CORS calls from browsers with a Bearer
 * Authorization header, so we hit it directly from the Tauri
 * webview — same architecture as Airtable / Linear / GitHub.
 *
 * Tokens are created at vercel.com/account/tokens. They can be
 * scoped to a team or full-access for the user; we don't gate
 * scope at the connector layer, but `vercel_list_projects` will
 * return only what the token can see.
 *
 * All helpers throw on non-2xx with Vercel's error message lifted
 * into the thrown Error so the connector dialog can surface it.
 */

const BASE_URL = "https://api.vercel.com";

interface VercelError {
  error?: { code?: string; message?: string };
}

async function vercelFetch<T>(
  token: string,
  path: string,
  query?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = `Vercel ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as VercelError;
      if (body?.error?.message) msg = `Vercel: ${body.error.message}`;
    } catch {
      // body wasn't json, keep the status line
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ────────────────────────────────────────────────
// Response shapes
// ────────────────────────────────────────────────

export interface VercelUser {
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string;
  };
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  link?: { type: string; repo: string };
  targets?: { production?: { id: string; alias?: string[] } };
}

interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination?: { next?: string };
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state:
    | "BUILDING"
    | "ERROR"
    | "INITIALIZING"
    | "QUEUED"
    | "READY"
    | "CANCELED";
  readyState?: string;
  created: number;
  /** ms timestamp when the build started (set when Vercel kicks
   *  off the actual build process — sometimes after `created`). */
  buildingAt?: number;
  /** ms timestamp when the deployment became live. Subtracting
   *  buildingAt from this yields the build duration. */
  ready?: number;
  target: "production" | "preview" | null;
  /** Inspector / dashboard URL on Vercel. */
  inspectorUrl?: string;
  /** Aliases that point to this deployment (the prod alias is
   *  here when target === "production"). */
  aliasAssigned?: number | null;
  /** Vercel sets `meta` from the git provider — commit message,
   *  branch, sha, author. The keys are namespaced by provider
   *  (githubCommitMessage, gitlabCommitMessage, etc). We only type
   *  the GitHub case since it's the common one; cast for others. */
  meta?: {
    githubCommitMessage?: string;
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitAuthorName?: string;
    [k: string]: unknown;
  };
  creator?: { uid: string; username?: string; email?: string };
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
  pagination?: { next?: string };
}

// ────────────────────────────────────────────────
// Public helpers
// ────────────────────────────────────────────────

/** /v2/user — smoke test the token. */
export async function vercelMe(token: string): Promise<VercelUser["user"]> {
  const data = await vercelFetch<VercelUser>(token, "/v2/user");
  return data.user;
}

/** Projects, newest-updated first. */
export async function vercelListProjects(
  token: string,
  opts: { limit?: number } = {},
): Promise<VercelProject[]> {
  const data = await vercelFetch<VercelProjectsResponse>(
    token,
    "/v9/projects",
    { limit: opts.limit ?? 20 },
  );
  return data.projects;
}

/** Recent deployments (across all projects unless filtered). */
export async function vercelListDeployments(
  token: string,
  opts: { limit?: number; projectId?: string; state?: VercelDeployment["state"] } = {},
): Promise<VercelDeployment[]> {
  const query: Record<string, string | number> = {
    limit: opts.limit ?? 25,
  };
  if (opts.projectId) query.projectId = opts.projectId;
  if (opts.state) query.state = opts.state;
  const data = await vercelFetch<VercelDeploymentsResponse>(
    token,
    "/v6/deployments",
    query,
  );
  return data.deployments;
}

/** Smoke test for the connect dialog. */
export async function vercelPing(token: string): Promise<{
  name: string;
  username: string;
  email: string;
}> {
  const u = await vercelMe(token);
  return {
    name: u.name ?? u.username,
    username: u.username,
    email: u.email,
  };
}
