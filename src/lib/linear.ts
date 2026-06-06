/**
 * lib/linear.ts — minimal browser-side Linear API client.
 *
 * Linear's API is GraphQL. Their Personal Access Tokens
 * (lin_api_…) accept the Authorization header from the browser
 * and the API supports CORS, so we can hit it directly from the
 * Tauri webview — no proxy hop required, same shape as Airtable.
 *
 * Auth: `Authorization: <pat>` header (note: no "Bearer" prefix,
 * unlike most APIs — Linear is unusual here).
 *
 * Single endpoint: POST https://api.linear.app/graphql with a
 * { query, variables } JSON body. We wrap that in a tiny helper
 * and type the responses we care about.
 *
 * All exported functions throw on auth failure / GraphQL errors,
 * with Linear's error message lifted into the thrown Error so
 * the connector dialog can surface useful diagnostics.
 */

const ENDPOINT = "https://api.linear.app/graphql";

interface GraphQLError {
  message: string;
  extensions?: Record<string, unknown>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

async function linearFetch<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Linear quirk: no "Bearer" prefix on PATs. Sending
      // "Bearer <pat>" would actually fail auth.
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Linear ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(`Linear: ${body.errors[0]!.message}`);
  }
  if (!body.data) {
    throw new Error("Linear returned no data");
  }
  return body.data;
}

// ────────────────────────────────────────────────
// Response shapes — only the fields we render
// ────────────────────────────────────────────────

export interface LinearViewer {
  id: string;
  name: string;
  email: string;
  organization: { id: string; name: string; urlKey: string };
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; type: string; color: string };
  priority: number;
  priorityLabel: string;
  assignee: { id: string; name: string } | null;
  team: { id: string; key: string; name: string };
  dueDate: string | null;
  url: string;
  updatedAt: string;
}

export interface LinearCycle {
  id: string;
  name: string | null;
  number: number;
  startsAt: string;
  endsAt: string;
  progress: number;
  team: { id: string; key: string; name: string };
}

// ────────────────────────────────────────────────
// Public helpers — one per endpoint we care about
// ────────────────────────────────────────────────

/** viewer.me — smoke test the token. Returns the authenticated
 *  user + their organization, which the connect dialog uses to
 *  show "Connected to <org> as <name>". */
export async function linearMe(token: string): Promise<LinearViewer> {
  const data = await linearFetch<{ viewer: LinearViewer }>(
    token,
    `query Me {
      viewer {
        id
        name
        email
        organization { id name urlKey }
      }
    }`,
  );
  return data.viewer;
}

/** Recent issues across the workspace. Default 25 — enough for a
 *  pulse view without paginating. Filter to "not done" by default
 *  so AXON's default "what's on the team's plate" question reads
 *  the right slice. */
export async function linearListIssues(
  token: string,
  opts: { limit?: number; includeCompleted?: boolean } = {},
): Promise<LinearIssue[]> {
  const limit = opts.limit ?? 25;
  // Linear's state.type values: triage, backlog, unstarted,
  // started, completed, canceled. We exclude completed/canceled
  // by default — those rarely matter for "what's active".
  const filter = opts.includeCompleted
    ? "{}"
    : `{ state: { type: { nin: ["completed", "canceled"] } } }`;
  const data = await linearFetch<{ issues: { nodes: LinearIssue[] } }>(
    token,
    `query Issues($limit: Int!) {
      issues(first: $limit, filter: ${filter}, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          state { name type color }
          priority
          priorityLabel
          assignee { id name }
          team { id key name }
          dueDate
          url
          updatedAt
        }
      }
    }`,
    { limit },
  );
  return data.issues.nodes;
}

/** Current cycles across all teams — useful for "what sprint are
 *  we in" briefings. Filters to active cycles by default. */
export async function linearListCycles(
  token: string,
  opts: { limit?: number } = {},
): Promise<LinearCycle[]> {
  const data = await linearFetch<{ cycles: { nodes: LinearCycle[] } }>(
    token,
    `query Cycles($limit: Int!) {
      cycles(
        first: $limit
        filter: { endsAt: { gt: "${new Date().toISOString()}" } }
      ) {
        nodes {
          id
          name
          number
          startsAt
          endsAt
          progress
          team { id key name }
        }
      }
    }`,
    { limit: opts.limit ?? 10 },
  );
  return data.cycles.nodes;
}

/** Create an issue in a team. Used by AXON's
 *  linear_create_issue action so the operator can dictate issues
 *  by voice. */
export async function linearCreateIssue(
  token: string,
  args: { teamId: string; title: string; description?: string; priority?: number },
): Promise<{ id: string; identifier: string; url: string }> {
  const data = await linearFetch<{
    issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
  }>(
    token,
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }`,
    {
      input: {
        teamId: args.teamId,
        title: args.title,
        description: args.description,
        priority: args.priority,
      },
    },
  );
  if (!data.issueCreate.success) {
    throw new Error("Linear: issue create returned success=false");
  }
  return data.issueCreate.issue;
}

/** Smoke test — confirms the PAT is live and surfaces the user
 *  + org. Used by the connect modal to validate before save. */
export async function linearPing(token: string): Promise<{
  name: string;
  email: string;
  org: string;
}> {
  const viewer = await linearMe(token);
  return {
    name: viewer.name,
    email: viewer.email,
    org: viewer.organization.name,
  };
}
