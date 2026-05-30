/**
 * lib/notion.ts — minimal browser-side Notion API client.
 *
 * Notion's REST API sends CORS headers, so we can call it from
 * the Tauri webview. Auth is the integration secret in the
 * `Authorization: Bearer …` header, plus the required
 * `Notion-Version` pin.
 *
 * Quirk to know: the integration only sees pages it's been
 * explicitly shared with. The user has to ••• on a page →
 * Connections → add the integration. This is enforced by Notion;
 * there's nothing we can do client-side.
 *
 * Endpoints used:
 *   · GET  /users/me            — verify token
 *   · POST /search              — fuzzy search pages + databases
 *   · POST /databases/{id}/query — rows of one database
 */

const BASE_URL = "https://api.notion.com/v1";
// Pin to the most recent stable version (released 2022-06-28).
// Bump explicitly when Notion publishes a new one we want to opt
// into; don't auto-track because semantics can change.
const NOTION_VERSION = "2022-06-28";

export interface NotionUser {
  object: "user";
  id: string;
  name: string | null;
  avatar_url: string | null;
  type: "person" | "bot";
}

export interface NotionPage {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  properties: Record<string, unknown>;
  parent: { type: string; [k: string]: unknown };
}

export interface NotionDatabase {
  object: "database";
  id: string;
  created_time: string;
  last_edited_time: string;
  title: { plain_text: string }[];
  description: { plain_text: string }[];
  url: string;
  properties: Record<string, { id: string; name: string; type: string }>;
}

export interface NotionSearchResult {
  object: "list";
  results: (NotionPage | NotionDatabase)[];
  next_cursor: string | null;
  has_more: boolean;
}

async function notionFetch<T>(
  token: string,
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Notion ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = `Notion: ${body.message}`;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Verify the integration token + return the bot user. */
export async function notionMe(token: string): Promise<NotionUser> {
  return notionFetch<NotionUser>(token, "/users/me");
}

/** Search pages + databases shared with the integration. Pass
 *  `query` to fuzzy-match titles, or empty string for "list
 *  everything". `filter` restricts to one object type. */
export async function notionSearch(
  token: string,
  opts?: {
    query?: string;
    filterObject?: "page" | "database";
    pageSize?: number;
  },
): Promise<NotionSearchResult> {
  return notionFetch<NotionSearchResult>(token, "/search", {
    method: "POST",
    body: {
      query: opts?.query ?? "",
      ...(opts?.filterObject && {
        filter: { value: opts.filterObject, property: "object" },
      }),
      page_size: Math.min(opts?.pageSize ?? 30, 100),
    },
  });
}

/** Query rows in a database. Returns up to `pageSize` records
 *  matching the optional filter. Default 30. */
export async function notionQueryDatabase(
  token: string,
  databaseId: string,
  opts?: { pageSize?: number; filter?: unknown; sorts?: unknown[] },
): Promise<{
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}> {
  return notionFetch(token, `/databases/${databaseId}/query`, {
    method: "POST",
    body: {
      page_size: Math.min(opts?.pageSize ?? 30, 100),
      ...(opts?.filter && { filter: opts.filter }),
      ...(opts?.sorts && { sorts: opts.sorts }),
    },
  });
}

/** Helper: pluck a human-readable title out of a Notion page or
 *  database. Notion stores titles as rich-text arrays, which is
 *  annoying. */
export function notionTitleOf(item: NotionPage | NotionDatabase): string {
  if (item.object === "database") {
    return item.title.map((t) => t.plain_text).join("") || "(Untitled)";
  }
  // Pages: title lives in properties under whatever key is type='title'.
  for (const v of Object.values(item.properties)) {
    const p = v as { type?: string; title?: { plain_text: string }[] };
    if (p?.type === "title" && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text).join("") || "(Untitled)";
    }
  }
  return "(Untitled)";
}
