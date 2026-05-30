/**
 * lib/airtable.ts — minimal browser-side Airtable client.
 *
 * Airtable's REST API supports CORS for Personal Access Tokens,
 * so we can call it straight from the Tauri webview with no
 * Edge Function in between. That makes Airtable the cleanest
 * "easy tier" connector to wire end-to-end.
 *
 * Auth: Bearer <pat> header.
 *
 * Endpoints used:
 *   · GET /meta/bases/{baseId}/tables  → schema of every table
 *   · GET /{baseId}/{tableIdOrName}    → records in one table
 *
 * Both functions throw on non-2xx, with the Airtable error
 * message lifted into the thrown Error. Caller decides whether
 * to surface to the user or mark the connector as `error`.
 */

const BASE_URL = "https://api.airtable.com/v0";

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: { id: string; name: string; type: string }[];
}

export interface AirtableTablesResponse {
  tables: AirtableTable[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecordsResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function airtableFetch<T>(
  pat: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    // Airtable returns { error: { type, message } } on failure.
    let msg = `Airtable ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) msg = `Airtable: ${body.error.message}`;
    } catch {
      // ignore body parse errors — keep the status line
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Fetch the schema for every table in the base. */
export async function airtableListTables(
  pat: string,
  baseId: string,
): Promise<AirtableTablesResponse> {
  return airtableFetch<AirtableTablesResponse>(
    pat,
    `/meta/bases/${baseId}/tables`,
  );
}

/** Fetch up to `maxRecords` rows from one table. Default 20 — the
 *  goal here is "give Axon a sample", not "ETL the whole base". */
export async function airtableListRecords(
  pat: string,
  baseId: string,
  tableIdOrName: string,
  maxRecords = 20,
): Promise<AirtableRecordsResponse> {
  return airtableFetch<AirtableRecordsResponse>(
    pat,
    `/${baseId}/${encodeURIComponent(tableIdOrName)}`,
    { maxRecords: String(maxRecords) },
  );
}

/** Smoke test — confirms the PAT can read the base schema. Used
 *  by the connect modal to validate credentials before saving. */
export async function airtablePing(
  pat: string,
  baseId: string,
): Promise<{ tableCount: number; firstTable: string | null }> {
  const res = await airtableListTables(pat, baseId);
  return {
    tableCount: res.tables.length,
    firstTable: res.tables[0]?.name ?? null,
  };
}
