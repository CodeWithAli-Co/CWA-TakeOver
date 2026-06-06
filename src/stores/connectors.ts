/**
 * stores/connectors.ts -- TanStack hooks for the `connectors` table.
 *
 * Backs the Settings -> Connectors page and any Axon action that
 * needs to know what external services are wired up.
 *
 * v2 architecture: every read/write routes through the takeover-B2B
 * server proxies (/api/connectors/list, /get, /mutate). The server
 * resolves the tenant from user_supa_id and uses service-role to
 * bypass RLS.
 *
 * Why we switched away from direct master-DB reads:
 *
 *   The v1 store scoped queries by Stronghold's company_name. That
 *   meant any time the local cache was empty -- new machine,
 *   reinstall, after the 7-day Stronghold invalidation fires --
 *   queries fell back to .is("company", null) and silently returned
 *   zero rows. Gmail was the lone survivor because it routed through
 *   a server proxy that keyed off user_supa_id.
 *
 *   v2 follows that same pattern for every connector. The desktop's
 *   Stronghold state is no longer the source of truth for visibility,
 *   only a cache. rehydrateCompanyBinding (called from fetchActiveUser)
 *   still keeps Stronghold populated so other surfaces that read it
 *   directly stay correct, but connectors no longer depend on it.
 *
 * Public function signatures are stable so every caller -- the
 * catalog, summaries, Slack/Linear/Cal.com/Vercel libs, Axon actions
 * -- keeps working without modification.
 *
 * Security note: credentials are stored in JSONB plaintext for the
 * MVP. RLS gates table access. Migrate to Supabase Vault before
 * production exposure.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { takeOversupabase } from "@/MyComponents/supabase";
import { getActiveCompanyLabel } from "@/stores/query";
import { useCompanyFilter } from "@/stores/store";

// Tenant-aware cache invalidation:
//   All connector queries live under the top-level ["connectors"]
//   prefix. Mutations invalidate the prefix, which sweeps every
//   key under it. Cheap, correct, no per-tenant threading.

export type ConnectorStatus = "connected" | "error" | "disconnected";

export interface Connector {
  id: number;
  kind: string;
  company: string | null;
  credentials: Record<string, any>;
  display_name: string | null;
  status: ConnectorStatus;
  last_error: string | null;
  connected_at: string;
  last_synced_at: string | null;
  created_by: string | null;
}

/**
 * Resolve the current Supabase user's user_supa_id. Used as the
 * scope handle for every proxy call. We read directly from
 * supabase.auth.getUser() rather than depending on ActiveUser to
 * avoid a circular import (ActiveUser already imports from this
 * store transitively in some call paths).
 */
async function getViewerSupaId(): Promise<string | null> {
  try {
    const { data } = await takeOversupabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function siteBase(): string {
  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    throw new Error(
      "VITE_TAKEOVER_SITE_URL not set -- connectors proxy unavailable",
    );
  }
  return String(base);
}

/**
 * Resolve the active company toggle as a server-side scope hint.
 *
 * Multi-company founders (a user who owns both CodeWithAli and
 * SimplicityFunds in takeover_companies) need to pick which tenant's
 * connector catalog they see. The desktop already has a global
 * company toggle (useCompanyFilter); we just forward its current
 * value as `company_hint` on every proxy call.
 *
 * The server verifies membership before honoring the hint, so a
 * stale or spoofed value can never expose another tenant's
 * connectors -- if the hint doesn't check out the server falls back
 * to its default founder_email resolution.
 *
 * Returns "CodeWithAli" or "simplicity" (the same labels every other
 * company-scoped table uses). null when something is genuinely off.
 */
function getCompanyHint(): string | null {
  try {
    return getActiveCompanyLabel();
  } catch {
    return null;
  }
}

async function callProxy<T>(
  path: "list" | "get" | "mutate",
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${siteBase()}/api/connectors/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TakeOver-App": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `connectors ${path} failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** List all connectors for the current tenant. Server resolves the
 *  tenant from the viewer's user_supa_id, biased by the active
 *  company toggle (company_hint) so multi-company founders see the
 *  right tenant's catalog. The query key includes the active toggle
 *  so TanStack re-fetches the moment the user flips it -- no manual
 *  invalidation needed on company switch. */
export function useConnectors() {
  const activeCompany = useCompanyFilter((s) => s.activeCompany);
  return useQuery({
    queryKey: ["connectors", "tenant-scoped", activeCompany] as const,
    queryFn: async () => {
      const userSupaId = await getViewerSupaId();
      if (!userSupaId) return [] as Connector[];
      const json = await callProxy<{ connectors: Connector[] }>("list", {
        user_supa_id: userSupaId,
        company_hint: getCompanyHint(),
      });
      return json.connectors ?? [];
    },
    staleTime: 30_000,
  });
}

export interface UpsertConnectorArgs {
  kind: string;
  credentials: Record<string, any>;
  display_name?: string | null;
  /** Pre-v2 callers could pass `company` explicitly. The server now
   *  resolves it from user_supa_id, so this is ignored. Kept on the
   *  type so older call sites compile without edits. */
  company?: string | null;
  /** Optional createdBy stamp for audit. */
  createdBy?: string | null;
}

/** Insert or update credentials for a given `kind`. */
export function useUpsertConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpsertConnectorArgs) => {
      const userSupaId = await getViewerSupaId();
      if (!userSupaId) {
        throw new Error(
          "Not signed in -- can't save connector without a user identity.",
        );
      }
      const json = await callProxy<{ connector: Connector }>("mutate", {
        user_supa_id: userSupaId,
        company_hint: getCompanyHint(),
        action: "upsert",
        kind: args.kind,
        credentials: args.credentials,
        display_name: args.display_name ?? null,
        created_by: args.createdBy ?? null,
      });
      return json.connector;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors"] }),
  });
}

/** Delete a connector row (disconnect). */
export function useDeleteConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const userSupaId = await getViewerSupaId();
      if (!userSupaId) {
        throw new Error("Not signed in -- can't disconnect.");
      }
      await callProxy<{ connector: null }>("mutate", {
        user_supa_id: userSupaId,
        company_hint: getCompanyHint(),
        action: "delete",
        id,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors"] }),
  });
}

/** Stamp the last-synced timestamp and optional error after a
 *  fetch. Used by Axon actions to mark health. */
export function useMarkConnectorSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: number;
      ok: boolean;
      error?: string | null;
    }) => {
      const userSupaId = await getViewerSupaId();
      if (!userSupaId) {
        throw new Error("Not signed in -- can't mark sync.");
      }
      await callProxy<{ connector: Connector | null }>("mutate", {
        user_supa_id: userSupaId,
        company_hint: getCompanyHint(),
        action: "mark_sync",
        id: args.id,
        ok: args.ok,
        last_error: args.error ?? null,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors"] }),
  });
}

/** Imperative read -- fetch one connector by kind. Used by Axon
 *  actions that run outside React. Returns null if not connected.
 *
 *  The optional `company` arg from v1 is kept on the signature for
 *  backwards compat with existing call sites but is now ignored;
 *  the server resolves the tenant from the viewer + company_hint. */
export async function fetchConnectorByKind(
  kind: string,
  _company?: string | null,
): Promise<Connector | null> {
  const userSupaId = await getViewerSupaId();
  if (!userSupaId) return null;
  try {
    const json = await callProxy<{ connector: Connector | null }>("get", {
      user_supa_id: userSupaId,
      company_hint: getCompanyHint(),
      kind,
    });
    return json.connector ?? null;
  } catch {
    return null;
  }
}
