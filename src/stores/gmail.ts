/**
 * stores/gmail.ts — TanStack Query hooks for the Gmail connection.
 *
 * The desktop never talks to Google directly — every Gmail-side
 * call goes through takeover-B2B proxy routes
 * (/api/gmail/oauth-start, /api/gmail/send, /api/gmail/sync). The
 * one piece of state the desktop owns directly is reading the
 * per-tenant gmail_connections row, since RLS lets the user see
 * (and delete) their own row.
 *
 * Connection flow from this side:
 *   1. useStartGmailConnect().mutate() — POSTs to /api/gmail/
 *      oauth-start with the operator's identity, opens the
 *      returned authorize_url in the OS default browser.
 *   2. While the operator is over in the browser auth flow,
 *      useGmailConnection() polls every 3s (in addition to the
 *      realtime subscription set up by useGmailRealtime()) so a
 *      flaky realtime channel doesn't strand the UI.
 *   3. Once the takeover-B2B callback writes the row, both the
 *      poll and the realtime channel see it. UI flips.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { getCompanySupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { getStronghold } from "@/stores/stronghold";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export interface GmailConnection {
  id: string;
  user_supa_id: string;
  email: string;
  expires_at: string;
  scopes: string[];
  connected_at: string;
  last_sync_at: string | null;
  // Note: access_token and refresh_token columns exist on the
  // row but are encrypted blobs the desktop never decrypts. We
  // don't select them here — keeps them out of the desktop's
  // memory entirely.
}

// ────────────────────────────────────────────────
// Query keys
// ────────────────────────────────────────────────

export const gmailKeys = {
  all:        ["gmail"] as const,
  connection: (userSupaId: string) =>
                ["gmail", "connection", userSupaId] as const,
};

// ────────────────────────────────────────────────
// useGmailConnection — current user's Gmail connection (null if
// not connected). Polls every 3s while in "connecting" state so
// realtime hiccups don't strand the UI.
// ────────────────────────────────────────────────

export function useGmailConnection(opts: {
  /** When true, refetch every 3s. Caller flips this on after
   *  clicking Connect and off once the connection lands. */
  isPolling?: boolean;
} = {}) {
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useQuery<GmailConnection | null>({
    queryKey: userSupaId
      ? gmailKeys.connection(userSupaId)
      : ["gmail", "connection", "anon"],
    enabled: !!userSupaId,
    refetchInterval: opts.isPolling ? 3_000 : false,
    queryFn: async () => {
      if (!userSupaId) return null;
      const client = await getCompanySupabase();
      const { data, error } = await client
        .from("gmail_connections")
        .select(
          "id, user_supa_id, email, expires_at, scopes, connected_at, last_sync_at",
        )
        .eq("user_supa_id", userSupaId)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[gmail] connection fetch error:", error.message);
        // PostgREST 406 / row-not-found returns error.code = PGRST116.
        // Treat as "not connected" rather than failing the query.
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return (data as GmailConnection) ?? null;
    },
  });
}

// ────────────────────────────────────────────────
// useStartGmailConnect — kicks off the OAuth flow.
//
// Pulls user_supa_id + company_name from active user + Stronghold,
// POSTs to /api/gmail/oauth-start, then opens the returned
// authorize_url in the OS default browser. Caller is responsible
// for flipping useGmailConnection's `isPolling` on for the polling
// fallback.
// ────────────────────────────────────────────────

export function useStartGmailConnect() {
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useMutation({
    mutationFn: async (): Promise<{ authorize_url: string }> => {
      if (!userSupaId) {
        throw new Error("Not signed in — can't start Gmail connect.");
      }

      // The tenant company_name lives in Stronghold (set during
      // install-binding). When it's missing — dev installs that
      // skip InitialOnboarding, fresh installs before binding —
      // we send empty string. The takeover-B2B callback falls
      // back to the MASTER Supabase in that case, same place the
      // CRM tables currently live until task #465 moves them
      // per-tenant.
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";

      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        throw new Error(
          "VITE_TAKEOVER_SITE_URL not configured — set in .env.local.",
        );
      }

      const res = await fetch(`${base}/api/gmail/oauth-start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({
          user_supa_id: userSupaId,
          company_name: companyName,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `oauth-start failed: ${res.status} ${detail.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as { authorize_url?: string };
      if (!json.authorize_url) {
        throw new Error("oauth-start didn't return an authorize_url");
      }

      // Open in the OS default browser. Tauri's plugin-shell does
      // this with proper sandboxing — passing the URL through
      // window.open inside the webview would open a new webview
      // window, not the user's actual browser, which is the wrong
      // UX for OAuth (the user needs to be in their normal browser
      // where they're already signed into Google).
      await openExternal(json.authorize_url);

      return { authorize_url: json.authorize_url };
    },
  });
}

// ────────────────────────────────────────────────
// useDisconnectGmail — deletes the user's gmail_connections row.
// Uses the user's session via companySupabase; RLS allows the
// authenticated role to delete their own rows.
// ────────────────────────────────────────────────

export function useDisconnectGmail() {
  const qc = useQueryClient();
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!userSupaId) throw new Error("Not signed in.");
      const client = await getCompanySupabase();
      const { error } = await client
        .from("gmail_connections")
        .delete()
        .eq("id", connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userSupaId) {
        qc.invalidateQueries({
          queryKey: gmailKeys.connection(userSupaId),
        });
      }
    },
  });
}

// ────────────────────────────────────────────────
// useGmailRealtime — subscribe to INSERT / DELETE events on the
// user's own gmail_connections row(s). Mount once in the same tree
// that renders the Gmail connection UI; pairs with the polling
// fallback inside useGmailConnection.
// ────────────────────────────────────────────────

export function useGmailRealtime(): void {
  const qc = useQueryClient();
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  useEffect(() => {
    if (!userSupaId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const client = await getCompanySupabase();
      if (cancelled) return;
      // The realtime channel needs the client returned from
      // getCompanySupabase. Note: we use it here for both the
      // channel subscription AND the gmail_connections queries
      // above — same tenant client either way.
      const channel = client
        .channel(`gmail-connections-${userSupaId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "gmail_connections",
            filter: `user_supa_id=eq.${userSupaId}`,
          },
          () => {
            qc.invalidateQueries({
              queryKey: gmailKeys.connection(userSupaId),
            });
          },
        )
        .subscribe();
      unsubscribe = () => { channel.unsubscribe(); };
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [userSupaId, qc]);
}
