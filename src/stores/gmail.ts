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
  /** Opt-in inbound sync. When false, /api/gmail/sync no-ops for
   *  this row — Gmail content is never read. Default false. */
  sync_enabled?: boolean;
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

      // Read via the takeover-B2B proxy, NOT directly from Supabase.
      // Two reasons:
      //   1. RLS gates SELECT on `user_supa_id = auth.uid()`. If
      //      app_users.supa_id ever drifts from auth.users.id, the
      //      desktop sees 0 rows. The proxy uses the service-role
      //      key and bypasses RLS.
      //   2. The desktop is prone to "Multiple GoTrueClient instances"
      //      races where one client ends up logged-out. The proxy
      //      runs on the server with its own clean Supabase client.
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        throw new Error(
          "VITE_TAKEOVER_SITE_URL not configured — set in .env.local.",
        );
      }
      const url = new URL(`${base}/api/gmail/connection`);
      url.searchParams.set("user_supa_id", userSupaId);
      if (companyName) url.searchParams.set("company_name", companyName);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "TakeOver-App": "true" },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `gmail/connection failed: ${res.status} ${detail.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        connection: GmailConnection | null;
      };
      return json.connection ?? null;
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
// useSendEmail — send an email through the operator's connected
// Gmail. Server handles token decrypt + refresh + Gmail API call +
// optional activity log. Desktop just hands over the message.
// ────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  /** Optional — if present, server logs an outbound email activity
   *  on this deal (and contact if provided). */
  deal_id?: string;
  contact_id?: string;
  /** Optional — when replying to an inbound email, pass the
   *  original's thread_id so Gmail threads the reply correctly. */
  thread_id?: string;
  /** Optional — verified "Send mail as" alias to send from. When
   *  unset, From: is the connected account's primary address. */
  from_alias?: string;
  from_display_name?: string;
}

export interface SendEmailResult {
  ok: true;
  gmail_id: string;
  thread_id: string;
}

export function useSendEmail() {
  const qc = useQueryClient();
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useMutation({
    mutationFn: async (input: SendEmailInput): Promise<SendEmailResult> => {
      if (!userSupaId) throw new Error("Not signed in.");

      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        throw new Error(
          "VITE_TAKEOVER_SITE_URL not configured — set in .env.local.",
        );
      }

      const res = await fetch(`${base}/api/gmail/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({
          user_supa_id: userSupaId,
          company_name: companyName,
          to: input.to,
          subject: input.subject,
          body: input.body,
          deal_id: input.deal_id,
          contact_id: input.contact_id,
          thread_id: input.thread_id,
          from_alias: input.from_alias,
          from_display_name: input.from_display_name,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(detail); } catch { /* noop */ }
        throw new Error(
          parsed.error ?? `gmail/send failed: ${res.status} ${detail.slice(0, 200)}`,
        );
      }
      return (await res.json()) as SendEmailResult;
    },
    onSuccess: (_data, input) => {
      // If the send logged an activity, refresh the deal's activity
      // timeline so the new row appears immediately.
      if (input.deal_id) {
        qc.invalidateQueries({ queryKey: ["crm", "activities", input.deal_id] });
        qc.invalidateQueries({ queryKey: ["crm", "deal", input.deal_id] });
      }
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
      // Through the mutate proxy for the same RLS reason as
      // useToggleGmailSync — gmail_connections has no DELETE
      // policy for the auth.uid mismatch case, so a direct delete
      // from the desktop silently no-ops.
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) throw new Error("VITE_TAKEOVER_SITE_URL not configured.");
      const res = await fetch(`${base}/api/gmail/mutate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({
          action: "disconnect",
          user_supa_id: userSupaId,
          company_name: companyName,
          connection_id: connectionId,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(detail); } catch { /* noop */ }
        throw new Error(parsed.error ?? `disconnect failed: ${res.status}`);
      }
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
// useToggleGmailSync — flip sync_enabled on/off. Writes directly
// to gmail_connections (the user's auth session has UPDATE allowed
// on their own row by RLS). Invalidates connection query so the
// toggle's checked state stays in sync with the DB.
// ────────────────────────────────────────────────

export function useToggleGmailSync() {
  const qc = useQueryClient();
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useMutation({
    mutationFn: async (args: { connectionId: string; enabled: boolean }) => {
      if (!userSupaId) throw new Error("Not signed in.");
      // Through the mutate proxy — RLS on gmail_connections has no
      // UPDATE policy, so a direct desktop write silently affects
      // 0 rows. Service-role on the server bypasses RLS, and the
      // WHERE clause double-checks user_supa_id so we can never
      // touch a different user's row.
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) throw new Error("VITE_TAKEOVER_SITE_URL not configured.");
      const res = await fetch(`${base}/api/gmail/mutate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({
          action: "set_sync_enabled",
          user_supa_id: userSupaId,
          company_name: companyName,
          connection_id: args.connectionId,
          enabled: args.enabled,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(detail); } catch { /* noop */ }
        throw new Error(parsed.error ?? `set_sync_enabled failed: ${res.status}`);
      }
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
// useSyncInbox — trigger a one-shot sync run. Server short-circuits
// if sync_enabled is false (returns { synced: 0, skipped: "disabled" }).
// Safe to call repeatedly — dedup is server-side.
// ────────────────────────────────────────────────

export interface SyncInboxResult {
  ok: true;
  synced: number;
  skipped?: "disabled" | "no-contacts";
}

export function useSyncInbox() {
  const qc = useQueryClient();
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useMutation({
    mutationFn: async (): Promise<SyncInboxResult> => {
      if (!userSupaId) throw new Error("Not signed in.");
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        throw new Error("VITE_TAKEOVER_SITE_URL not configured.");
      }
      const res = await fetch(`${base}/api/gmail/sync`, {
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
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(detail); } catch { /* noop */ }
        throw new Error(
          parsed.error ?? `gmail/sync failed: ${res.status} ${detail.slice(0, 200)}`,
        );
      }
      return (await res.json()) as SyncInboxResult;
    },
    onSuccess: (data) => {
      // If anything synced, invalidate CRM activity queries so the
      // new inbound rows appear in deal + contact timelines.
      if (data.synced > 0) {
        qc.invalidateQueries({ queryKey: ["crm", "activities"] });
      }
      // Always invalidate connection so last_sync_at refreshes.
      if (userSupaId) {
        qc.invalidateQueries({
          queryKey: gmailKeys.connection(userSupaId),
        });
      }
    },
  });
}

// ────────────────────────────────────────────────
// useGmailAliases — list of verified "Send mail as" addresses the
// operator has set up in Gmail. Powers the From: picker in the
// compose + draft modals so the operator can send AS a professional
// alias (sales@yourco.com) instead of their personal Gmail.
//
// Setup is one-time and done in Gmail itself: Settings → Accounts
// → "Send mail as" → Add → verify the link Gmail emails. After
// that, this hook surfaces the alias and the send route accepts it.
// ────────────────────────────────────────────────

export interface GmailAlias {
  email: string;
  display_name: string;
  is_default: boolean;
  is_primary: boolean;
}

export const gmailAliasKeys = {
  all: (userSupaId: string) => ["gmail", "aliases", userSupaId] as const,
};

export function useGmailAliases() {
  const { data: meRows } = ActiveUser();
  const userSupaId: string | undefined = (meRows?.[0] as any)?.supa_id;

  return useQuery<GmailAlias[]>({
    queryKey: userSupaId
      ? gmailAliasKeys.all(userSupaId)
      : ["gmail", "aliases", "anon"],
    enabled: !!userSupaId,
    // Aliases change rarely (only when the user adds/verifies a
    // new one in Gmail). 5-min stale window keeps the picker
    // snappy without going stale across sessions.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GmailAlias[]> => {
      if (!userSupaId) return [];
      const stronghold = await getStronghold();
      const companyName = (await stronghold.getRecord("company_name")) ?? "";
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) throw new Error("VITE_TAKEOVER_SITE_URL not configured.");
      const res = await fetch(`${base}/api/gmail/aliases`, {
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
        let parsed: { error?: string } = {};
        try { parsed = JSON.parse(detail); } catch { /* noop */ }
        throw new Error(parsed.error ?? `aliases failed: ${res.status}`);
      }
      const json = (await res.json()) as { aliases?: GmailAlias[] };
      return json.aliases ?? [];
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
