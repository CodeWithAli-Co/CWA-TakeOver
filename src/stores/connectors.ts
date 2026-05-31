/**
 * stores/connectors.ts — TanStack hooks for the `connectors` table.
 *
 * Backs the Settings → Connectors page and any Axon action that
 * needs to know what external services are wired up. Three hooks:
 *
 *   · useConnectors()       — list every connector for the workspace.
 *   · useUpsertConnector()  — save or update creds for a `kind`.
 *   · useDeleteConnector()  — disconnect (deletes the row).
 *
 * Plus a typed `Connector` interface and `getConnector(kind)` which
 * Axon actions use to grab credentials by kind synchronously off
 * the cache (after the list query has resolved).
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

const CONNECTORS_TABLE = "connectors";
const CONNECTORS_KEY = ["connectors"] as const;

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

/** List all connectors visible to the current session. */
export function useConnectors() {
  return useQuery({
    queryKey: CONNECTORS_KEY,
    queryFn: async () => {
      const { data, error } = await takeOversupabase
  .from(CONNECTORS_TABLE)
        .select("*")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Connector[];
    },
    staleTime: 30_000,
  });
}

export interface UpsertConnectorArgs {
  kind: string;
  credentials: Record<string, any>;
  display_name?: string | null;
  company?: string | null;
  /** Optional createdBy stamp for audit. */
  createdBy?: string | null;
}

/** Insert or update credentials for a given `kind`. Conflict
 *  resolution uses the partial unique index on (kind, company). */
export function useUpsertConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpsertConnectorArgs) => {
      // Find existing row for this (kind, company) to drive update
      // vs insert. We can't rely on the partial unique index +
      // upsert because PostgREST's `on_conflict` doesn't support
      // index predicates.
      const company = args.company ?? null;
      const existingQ = takeOversupabase
        .from(CONNECTORS_TABLE)
        .select("id")
        .eq("kind", args.kind);
      const { data: existingRows, error: findErr } = company
        ? await existingQ.eq("company", company)
        : await existingQ.is("company", null);
      if (findErr) throw findErr;
      const existingId: number | undefined = (existingRows as any[])?.[0]?.id;

      // The dialog only calls upsert after verifyConnector has
      // ok'd the credentials, so we stamp last_synced_at = now()
      // here. That gives the catalog tile a "last verified" line
      // without an extra round-trip.
      const now = new Date().toISOString();
      const payload = {
        kind: args.kind,
        company,
        credentials: args.credentials,
        display_name: args.display_name ?? null,
        status: "connected" as ConnectorStatus,
        last_error: null as string | null,
        connected_at: now,
        last_synced_at: now,
        created_by: args.createdBy ?? null,
      };

      if (existingId !== undefined) {
        const { data, error } = await takeOversupabase
    .from(CONNECTORS_TABLE)
          .update(payload)
          .eq("id", existingId)
          .select()
          .single();
        if (error) throw error;
        return data as Connector;
      } else {
        const { data, error } = await takeOversupabase
    .from(CONNECTORS_TABLE)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as Connector;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTORS_KEY }),
  });
}

/** Delete a connector row (disconnect). */
export function useDeleteConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await takeOversupabase
  .from(CONNECTORS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTORS_KEY }),
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
      const patch = args.ok
        ? {
            last_synced_at: new Date().toISOString(),
            status: "connected" as ConnectorStatus,
            last_error: null,
          }
        : {
            last_synced_at: new Date().toISOString(),
            status: "error" as ConnectorStatus,
            last_error: args.error ?? "Unknown sync error.",
          };
      const { error } = await takeOversupabase
  .from(CONNECTORS_TABLE)
        .update(patch)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTORS_KEY }),
  });
}

/** Imperative read — fetch one connector by kind from Supabase.
 *  Used by Axon actions that run outside React. Returns null if
 *  not connected. */
export async function fetchConnectorByKind(
  kind: string,
  company?: string | null,
): Promise<Connector | null> {
  const q = takeOversupabase
    .from(CONNECTORS_TABLE)
    .select("*")
    .eq("kind", kind)
    .eq("status", "connected")
    .limit(1);
  const { data, error } = company
    ? await q.eq("company", company)
    : await q.is("company", null);
  if (error) return null;
  return ((data as Connector[] | null) ?? [])[0] ?? null;
}
