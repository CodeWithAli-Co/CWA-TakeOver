/**
 * connectorSummary.ts — per-kind "what's in there" fetcher + hook.
 *
 * For each connected service, returns a one-line summary that
 * surfaces on the Settings catalog tile and the Operations
 * dashboard strip. Examples:
 *   · GitHub   — "14 repos · active 2h ago"
 *   · Airtable — "5 tables"
 *   · Notion   — "12 pages, 3 dbs"
 *
 * The hook (`useConnectorSummary`) is TanStack-cached and
 * deduped by connector id — multiple components hitting the
 * same connector share one network call. `staleTime` is 60s so
 * the tile refreshes when you reopen the page but doesn't
 * pound the providers.
 */

import { useQuery } from "@tanstack/react-query";
import type { Connector } from "@/stores/connectors";
import { airtableListTables } from "@/lib/airtable";
import { githubRepoSummary } from "@/lib/github";
import { notionSearch } from "@/lib/notion";

export interface ConnectorSummary {
  ok: boolean;
  /** Short headline shown on the catalog tile / mini card. */
  text: string;
  /** Optional second line for richer renders. */
  detail?: string;
  /** Error message if ok = false. */
  error?: string;
  /** Structured extras a richer panel can pull from. */
  extra?: Record<string, unknown>;
}

async function fetchConnectorSummary(
  connector: Connector,
): Promise<ConnectorSummary> {
  const creds = (connector.credentials ?? {}) as Record<string, unknown>;
  try {
    switch (connector.kind) {
      case "github":
        return await summarizeGithub(creds);
      case "airtable":
        return await summarizeAirtable(creds);
      case "notion":
        return await summarizeNotion(creds);
      default:
        // OpenAI / Stripe / SendGrid / Resend / OAuth-stubs etc.
        // Credentials saved but no live summary available client-
        // side. Show a quiet "connected" state.
        return { ok: true, text: "Credentials saved" };
    }
  } catch (e: any) {
    return {
      ok: false,
      text: "Connection failed",
      error: e?.message ?? "Unknown error",
    };
  }
}

// ─── Per-kind summarizers ─────────────────────────────────────

async function summarizeGithub(
  creds: Record<string, unknown>,
): Promise<ConnectorSummary> {
  const token = String(creds.token ?? "").trim();
  if (!token)
    return { ok: false, text: "No token saved", error: "Missing token" };
  // One request, exact count: per_page=1 + sort=pushed gives us
  // both the most-recently-pushed repo (in the body) and the
  // total repo count (parsed from the Link header).
  const { totalCount, mostRecent } = await githubRepoSummary(token);
  const ago = mostRecent ? relativeAgo(mostRecent.updated_at) : null;
  return {
    ok: true,
    text:
      totalCount === 0
        ? "No repos accessible"
        : `${totalCount} repo${totalCount === 1 ? "" : "s"}${ago ? ` · active ${ago}` : ""}`,
    detail: mostRecent ? `Most recent: ${mostRecent.full_name}` : undefined,
    extra: {
      repoCount: totalCount,
      mostRecent: mostRecent?.full_name,
      mostRecentAt: mostRecent?.updated_at,
    },
  };
}

async function summarizeAirtable(
  creds: Record<string, unknown>,
): Promise<ConnectorSummary> {
  const pat = String(creds.pat ?? "").trim();
  const baseId = String(creds.base_id ?? "").trim();
  if (!pat || !baseId) {
    return {
      ok: false,
      text: "Missing credentials",
      error: "PAT or base id missing",
    };
  }
  const res = await airtableListTables(pat, baseId);
  return {
    ok: true,
    text:
      res.tables.length === 0
        ? "No tables in base"
        : `${res.tables.length} table${res.tables.length === 1 ? "" : "s"}`,
    detail: res.tables[0] ? `First: "${res.tables[0].name}"` : undefined,
    extra: { tableCount: res.tables.length },
  };
}

async function summarizeNotion(
  creds: Record<string, unknown>,
): Promise<ConnectorSummary> {
  const token = String(creds.token ?? "").trim();
  if (!token)
    return { ok: false, text: "No token saved", error: "Missing token" };
  const res = await notionSearch(token, { pageSize: 100 });
  let pages = 0;
  let dbs = 0;
  for (const r of res.results) {
    if (r.object === "page") pages++;
    else if (r.object === "database") dbs++;
  }
  const total = pages + dbs;
  return {
    ok: true,
    text:
      total === 0
        ? "No pages shared yet"
        : `${pages} page${pages === 1 ? "" : "s"} · ${dbs} db${dbs === 1 ? "" : "s"}`,
    extra: { pageCount: pages, dbCount: dbs },
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function relativeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useConnectorSummary(connector: Connector | null) {
  return useQuery({
    // queryKey includes both id and kind so that disconnect →
    // reconnect (with different creds) gets a fresh fetch.
    queryKey: ["connectorSummary", connector?.id, connector?.kind],
    queryFn: () => fetchConnectorSummary(connector!),
    enabled: !!connector,
    staleTime: 60_000,
    retry: 1,
    // Don't refetch on focus — providers have rate limits and the
    // user re-opening the tab shouldn't trigger another round of
    // calls.
    refetchOnWindowFocus: false,
  });
}
