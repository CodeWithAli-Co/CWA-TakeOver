// ───────────────────────────────────────────────────────────────────
// Connector actions — let Axon see what external SaaS the team has
// wired up, and pull data from connectors that actually work in the
// browser today (Airtable).
//
// Three actions registered:
//
//   · list_connectors        — what's connected, what's not.
//   · airtable_list_tables   — schema of every table in the base.
//   · airtable_list_records  — sample records from one table.
//
// The Airtable actions hit the REST API directly via the helpers
// in `src/lib/airtable.ts`. Airtable's CORS allows browser calls
// with a PAT, so no Edge Function is needed.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchConnectorByKind,
  type Connector,
} from "@/stores/connectors";
import {
  airtableListRecords,
  airtableListTables,
} from "@/lib/airtable";
import {
  githubListIssues,
  githubListPRs,
  githubListRepos,
  type GitHubRepo,
} from "@/lib/github";
import {
  notionQueryDatabase,
  notionSearch,
  notionTitleOf,
  type NotionPage,
} from "@/lib/notion";
import supabase from "@/MyComponents/supabase";

// ─── list_connectors ───────────────────────────────────────────────

export const listConnectorsAction: AxonAction<
  Record<string, never>,
  {
    count: number;
    connected: { kind: string; display_name: string | null; last_synced_at: string | null }[];
  }
> = {
  name: "list_connectors",
  description:
    "List every connector the team has wired up. Returns the kind (e.g. 'airtable', 'stripe'), display name, and last sync time for each. Use this BEFORE other connector actions to confirm a kind is actually connected.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const { data, error } = await supabase
      .from("connectors")
      .select("kind, display_name, last_synced_at, status")
      .eq("status", "connected")
      .order("connected_at", { ascending: false });
    if (error) {
      return {
        summary: `Failed to list connectors: ${error.message}`,
        data: { count: 0, connected: [] },
      };
    }
    const rows = (data as any[]) ?? [];
    const connected = rows.map((r) => ({
      kind: r.kind,
      display_name: r.display_name,
      last_synced_at: r.last_synced_at,
    }));

    ctx.logActivity({
      actionName: "list_connectors",
      params: {},
      summary: `Listed ${connected.length} connector(s)`,
    });

    const summary =
      connected.length === 0
        ? "No connectors are wired up yet. Go to Settings → Connectors."
        : `Connected: ${connected.map((c) => c.kind).join(", ")}.`;

    return { summary, data: { count: connected.length, connected } };
  },
};

// ─── airtable_list_tables ──────────────────────────────────────────

interface AirtableCreds {
  pat?: string;
  base_id?: string;
}

function readAirtableCreds(
  connector: Connector | null,
): { pat: string; baseId: string } | { error: string } {
  if (!connector) {
    return {
      error:
        "Airtable is not connected. Open Settings → Connectors and add it first.",
    };
  }
  const creds = (connector.credentials ?? {}) as AirtableCreds;
  if (!creds.pat || !creds.base_id) {
    return {
      error: "Airtable credentials are incomplete (missing pat or base_id).",
    };
  }
  return { pat: creds.pat, baseId: creds.base_id };
}

export const airtableListTablesAction: AxonAction<
  Record<string, never>,
  { count: number; tables: { id: string; name: string; fieldCount: number }[] }
> = {
  name: "airtable_list_tables",
  description:
    "List every table in the connected Airtable base, with table id, name, and field count. Call this before airtable_list_records to find the table id.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const connector = await fetchConnectorByKind("airtable");
    const creds = readAirtableCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, tables: [] } };
    }
    try {
      const res = await airtableListTables(creds.pat, creds.baseId);
      const summary = `Airtable base has ${res.tables.length} table(s).`;
      ctx.logActivity({
        actionName: "airtable_list_tables",
        params: {},
        summary,
      });
      return {
        summary,
        data: {
          count: res.tables.length,
          tables: res.tables.map((t) => ({
            id: t.id,
            name: t.name,
            fieldCount: t.fields.length,
          })),
        },
      };
    } catch (e: any) {
      return {
        summary: `Airtable error: ${e?.message ?? "unknown"}`,
        data: { count: 0, tables: [] },
      };
    }
  },
};

// ─── airtable_list_records ─────────────────────────────────────────

export const airtableListRecordsAction: AxonAction<
  { table: string; maxRecords?: number },
  { count: number; records: unknown[] }
> = {
  name: "airtable_list_records",
  description:
    "Pull a sample of records from one Airtable table. Pass the table id (from airtable_list_tables) or the table NAME if you know it. Default returns up to 20 rows; cap is 100. Use small samples — this is for Axon to summarize, not to ETL the base.",
  input_schema: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Airtable table id (tbl…) or table name.",
      },
      maxRecords: {
        type: "number",
        description: "Optional row cap, 1–100. Default 20.",
      },
    },
    required: ["table"],
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("airtable");
    const creds = readAirtableCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, records: [] } };
    }
    const cap = Math.max(1, Math.min(input.maxRecords ?? 20, 100));
    try {
      const res = await airtableListRecords(
        creds.pat,
        creds.baseId,
        input.table,
        cap,
      );
      const summary = `Pulled ${res.records.length} record(s) from "${input.table}".`;
      ctx.logActivity({
        actionName: "airtable_list_records",
        params: input as Record<string, unknown>,
        summary,
      });
      // Flatten records into a readable shape — Axon doesn't need
      // createdTime metadata, just id + fields.
      const flat = res.records.map((r) => ({
        id: r.id,
        fields: r.fields,
      }));
      return { summary, data: { count: flat.length, records: flat } };
    } catch (e: any) {
      return {
        summary: `Airtable error: ${e?.message ?? "unknown"}`,
        data: { count: 0, records: [] },
      };
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// GitHub actions
// ═════════════════════════════════════════════════════════════════

interface GitHubCreds {
  token?: string;
  default_owner?: string;
}

function readGitHubCreds(
  connector: Connector | null,
): { token: string; defaultOwner: string | null } | { error: string } {
  if (!connector) {
    return {
      error:
        "GitHub is not connected. Open Settings → Connectors and add a fine-grained PAT.",
    };
  }
  const creds = (connector.credentials ?? {}) as GitHubCreds;
  if (!creds.token) return { error: "GitHub PAT is missing." };
  return {
    token: creds.token,
    defaultOwner: creds.default_owner?.trim() || null,
  };
}

export const githubListReposAction: AxonAction<
  { sort?: "pushed" | "updated" | "created"; limit?: number },
  {
    count: number;
    repos: Pick<
      GitHubRepo,
      "full_name" | "description" | "open_issues_count" | "updated_at" | "language" | "private"
    >[];
  }
> = {
  name: "github_list_repos",
  description:
    "List GitHub repositories the connected PAT can see. Sorted by most recent push by default. Returns a compact summary per repo (full_name, language, open issues, last update).",
  input_schema: {
    type: "object",
    properties: {
      sort: { type: "string", enum: ["pushed", "updated", "created"] },
      limit: { type: "number", description: "1–50. Default 20." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("github");
    const creds = readGitHubCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, repos: [] } };
    }
    try {
      const repos = await githubListRepos(creds.token, {
        sort: input.sort ?? "pushed",
        perPage: Math.max(1, Math.min(input.limit ?? 20, 50)),
      });
      const compact = repos.map((r) => ({
        full_name: r.full_name,
        description: r.description,
        open_issues_count: r.open_issues_count,
        updated_at: r.updated_at,
        language: r.language,
        private: r.private,
      }));
      const summary = `${repos.length} repo(s). Top: ${
        repos
          .slice(0, 3)
          .map((r) => r.full_name)
          .join(", ") || "—"
      }.`;
      ctx.logActivity({
        actionName: "github_list_repos",
        params: input as Record<string, unknown>,
        summary,
      });
      return { summary, data: { count: repos.length, repos: compact } };
    } catch (e: any) {
      return {
        summary: `GitHub error: ${e?.message ?? "unknown"}`,
        data: { count: 0, repos: [] },
      };
    }
  },
};

export const githubListPRsAction: AxonAction<
  { owner?: string; repo: string; state?: "open" | "closed" | "all" },
  { count: number; prs: unknown[] }
> = {
  name: "github_list_prs",
  description:
    "List pull requests for one GitHub repo. Provide `owner` and `repo` (or just `repo` if a default_owner is configured). State filter: open (default), closed, all.",
  input_schema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Org or user. Falls back to connector default." },
      repo: { type: "string", description: "Repo name without owner prefix." },
      state: { type: "string", enum: ["open", "closed", "all"] },
    },
    required: ["repo"],
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("github");
    const creds = readGitHubCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, prs: [] } };
    }
    const owner = input.owner ?? creds.defaultOwner;
    if (!owner) {
      return {
        summary:
          "GitHub: no owner specified and no default_owner is configured on the connector.",
        data: { count: 0, prs: [] },
      };
    }
    try {
      const prs = await githubListPRs(creds.token, owner, input.repo, {
        state: input.state ?? "open",
      });
      const summary = `${prs.length} ${input.state ?? "open"} PR(s) in ${owner}/${input.repo}.`;
      ctx.logActivity({
        actionName: "github_list_prs",
        params: input as Record<string, unknown>,
        summary,
      });
      return {
        summary,
        data: {
          count: prs.length,
          prs: prs.map((p) => ({
            number: p.number,
            title: p.title,
            state: p.state,
            draft: p.draft,
            user: p.user.login,
            head: p.head.ref,
            base: p.base.ref,
            updated_at: p.updated_at,
            url: p.html_url,
          })),
        },
      };
    } catch (e: any) {
      return {
        summary: `GitHub error: ${e?.message ?? "unknown"}`,
        data: { count: 0, prs: [] },
      };
    }
  },
};

export const githubListIssuesAction: AxonAction<
  { owner?: string; repo: string; state?: "open" | "closed" | "all" },
  { count: number; issues: unknown[] }
> = {
  name: "github_list_issues",
  description:
    "List issues (NOT PRs) for one GitHub repo. Same `owner` + `repo` shape as github_list_prs. PRs are filtered out — use github_list_prs for those.",
  input_schema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      state: { type: "string", enum: ["open", "closed", "all"] },
    },
    required: ["repo"],
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("github");
    const creds = readGitHubCreds(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, issues: [] } };
    }
    const owner = input.owner ?? creds.defaultOwner;
    if (!owner) {
      return {
        summary: "GitHub: no owner specified and no default_owner configured.",
        data: { count: 0, issues: [] },
      };
    }
    try {
      const issues = await githubListIssues(
        creds.token,
        owner,
        input.repo,
        { state: input.state ?? "open" },
      );
      const summary = `${issues.length} ${input.state ?? "open"} issue(s) in ${owner}/${input.repo}.`;
      ctx.logActivity({
        actionName: "github_list_issues",
        params: input as Record<string, unknown>,
        summary,
      });
      return {
        summary,
        data: {
          count: issues.length,
          issues: issues.map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            user: i.user.login,
            labels: i.labels.map((l) => l.name),
            updated_at: i.updated_at,
            url: i.html_url,
          })),
        },
      };
    } catch (e: any) {
      return {
        summary: `GitHub error: ${e?.message ?? "unknown"}`,
        data: { count: 0, issues: [] },
      };
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// Notion actions
// ═════════════════════════════════════════════════════════════════

interface NotionCreds {
  token?: string;
}

function readNotionToken(
  connector: Connector | null,
): { token: string } | { error: string } {
  if (!connector) {
    return {
      error:
        "Notion is not connected. Open Settings → Connectors and paste an integration token.",
    };
  }
  const creds = (connector.credentials ?? {}) as NotionCreds;
  if (!creds.token) return { error: "Notion token is missing." };
  return { token: creds.token };
}

export const notionSearchAction: AxonAction<
  { query?: string; type?: "page" | "database"; limit?: number },
  { count: number; results: unknown[] }
> = {
  name: "notion_search",
  description:
    "Fuzzy-search Notion pages + databases shared with the connected integration. Optional `type` filter (page or database). Returns title, id, last edit time, and URL for each hit. ONLY returns content the integration has been explicitly granted access to.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional fuzzy match against titles." },
      type: {
        type: "string",
        enum: ["page", "database"],
        description: "Restrict results to one object kind.",
      },
      limit: { type: "number", description: "1–100. Default 30." },
    },
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("notion");
    const creds = readNotionToken(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, results: [] } };
    }
    try {
      const res = await notionSearch(creds.token, {
        query: input.query,
        filterObject: input.type,
        pageSize: Math.max(1, Math.min(input.limit ?? 30, 100)),
      });
      const compact = res.results.map((r) => ({
        id: r.id,
        kind: r.object,
        title: notionTitleOf(r),
        last_edited_time: (r as NotionPage).last_edited_time,
        url: (r as { url?: string }).url ?? null,
      }));
      const summary = input.query
        ? `${compact.length} hit(s) for "${input.query}".`
        : `${compact.length} item(s) shared with the integration.`;
      ctx.logActivity({
        actionName: "notion_search",
        params: input as Record<string, unknown>,
        summary,
      });
      return { summary, data: { count: compact.length, results: compact } };
    } catch (e: any) {
      return {
        summary: `Notion error: ${e?.message ?? "unknown"}`,
        data: { count: 0, results: [] },
      };
    }
  },
};

export const notionListDatabasesAction: AxonAction<
  Record<string, never>,
  { count: number; databases: unknown[] }
> = {
  name: "notion_list_databases",
  description:
    "List every Notion database the integration can see. Returns id + title + property schema. Use this before notion_query_database to find the right database id.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const connector = await fetchConnectorByKind("notion");
    const creds = readNotionToken(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, databases: [] } };
    }
    try {
      const res = await notionSearch(creds.token, {
        filterObject: "database",
        pageSize: 100,
      });
      const dbs = res.results.map((r) => ({
        id: r.id,
        title: notionTitleOf(r),
        properties: Object.keys((r as any).properties ?? {}),
      }));
      const summary = `Integration can see ${dbs.length} database(s).`;
      ctx.logActivity({
        actionName: "notion_list_databases",
        params: {},
        summary,
      });
      return { summary, data: { count: dbs.length, databases: dbs } };
    } catch (e: any) {
      return {
        summary: `Notion error: ${e?.message ?? "unknown"}`,
        data: { count: 0, databases: [] },
      };
    }
  },
};

export const notionQueryDatabaseAction: AxonAction<
  { database_id: string; limit?: number },
  { count: number; rows: unknown[] }
> = {
  name: "notion_query_database",
  description:
    "Pull rows from one Notion database. Use notion_list_databases first to find the database id. Default 30 rows, cap 100. Returns each row's id, title (from the title-typed property), last edit time, and URL.",
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Notion database id (32-char uuid)." },
      limit: { type: "number", description: "1–100. Default 30." },
    },
    required: ["database_id"],
  },
  handler: async (input, ctx) => {
    const connector = await fetchConnectorByKind("notion");
    const creds = readNotionToken(connector);
    if ("error" in creds) {
      return { summary: creds.error, data: { count: 0, rows: [] } };
    }
    try {
      const res = await notionQueryDatabase(creds.token, input.database_id, {
        pageSize: Math.max(1, Math.min(input.limit ?? 30, 100)),
      });
      const rows = res.results.map((p) => ({
        id: p.id,
        title: notionTitleOf(p),
        last_edited_time: p.last_edited_time,
        url: p.url,
      }));
      const summary = `Pulled ${rows.length} row(s) from database.`;
      ctx.logActivity({
        actionName: "notion_query_database",
        params: input as Record<string, unknown>,
        summary,
      });
      return { summary, data: { count: rows.length, rows } };
    } catch (e: any) {
      return {
        summary: `Notion error: ${e?.message ?? "unknown"}`,
        data: { count: 0, rows: [] },
      };
    }
  },
};

// ─── Registration ──────────────────────────────────────────────────

export function registerConnectorActions() {
  registerAction(listConnectorsAction);
  registerAction(airtableListTablesAction);
  registerAction(airtableListRecordsAction);
  registerAction(githubListReposAction);
  registerAction(githubListPRsAction);
  registerAction(githubListIssuesAction);
  registerAction(notionSearchAction);
  registerAction(notionListDatabasesAction);
  registerAction(notionQueryDatabaseAction);
}
