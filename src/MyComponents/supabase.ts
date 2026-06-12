/**
 * supabase.ts — dual-client Supabase setup for the multi-tenant
 * desktop app.
 *
 *   companySupabase — the central master DB. Holds the
 *     `takeover_companies` registry (one row per customer,
 *     containing the per-tenant `companydb_url` / `companydb_key`).
 *     URL comes from `VITE_DB_URL`; the anon key is fetched at
 *     startup from `${VITE_TAKEOVER_SITE_URL}/api/takeover_creds`
 *     so we don't ship it in the binary.
 *
 *   companySupabase — the per-tenant DB for whichever company
 *     this install is bound to. Bound-company name is read from
 *     Stronghold (set during InitialOnboarding); the tenant URL
 *     and key come out of the takeover_companies row for that
 *     company. If Stronghold is empty (fresh install), falls
 *     back to the master URL + VITE_TAKEOVER_PSEUDO_KEY.
 *
 * Both clients are created via top-level await — every import
 * of this module blocks until network + vault are ready. That's
 * intentional: nothing else in the app should run before the
 * tenant binding is known.
 */

import { createClient } from "@supabase/supabase-js";
import { getStronghold } from "@/stores/stronghold";
import { getTakeOverCreds } from "@/stores/takeoverCreds";

// Initialize the shared stronghold instance exactly once.
// Subsequent callers anywhere in the app use getStronghold()
// and get this same instance back.
const stronghold = await getStronghold();

// ── Master TakeOver client ────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_DB_URL;

const getTKSupabaseKey = async (): Promise<string> => {
  // Shared, memoized fetch — Stronghold already pulled this same
  // /api/takeover_creds response for the vault password, so this is a
  // cache hit (no second network round-trip on boot).
  const result = await getTakeOverCreds();
  return result.supabase_key as string;
};

const supabaseKey = await getTKSupabaseKey();
// Each Supabase client gets its OWN storage key for its auth
// session. Without this both clients fight over the default
// `sb-<project>-auth-token` localStorage entry and one will
// occasionally clobber the other's session mid-init, which is
// almost certainly why the sidebar shows "Unknown / Member"
// intermittently. The console warning "Multiple GoTrueClient
// instances detected" is GoTrue telling us this is happening.
export const takeOverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: "sb-takeover-master-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Per-tenant company client ─────────────────────────────────

const getCompSupabaseCreds = async (for_login: boolean = false): Promise<{
  url: string;
  key: string;
}> => {
  const companyName = await stronghold.getRecord("company_name");
  if (import.meta.env.DEV) {
    console.log("[supabase]: Company Supabase belongs to: ", companyName);
  }

  // For login logic, `company_name` is required to ensure login session belongs to correct supabase info
  if (for_login && !companyName) {
    throw Error("Company Name isnt found in Stronghold");
  }

  // Fresh install — Stronghold has no bound company yet. Fall
  // back to the master URL with a deliberately-locked-down
  // pseudo key. RLS on the master DB has to make sure this key
  // can't see anything sensitive.
  if (!companyName) {
    return {
      url: supabaseUrl,
      key: import.meta.env.VITE_TAKEOVER_PSEUDO_KEY,
    };
  }

  // *Retrieve from cache first ( stronghold ), if not then fetch from DB
  const db_url = await stronghold.getRecord("companydb_url");
  const db_key = await stronghold.getRecord("companydb_key");

  if (db_url && db_key) {
    console.log(
      "[supabase]: Retrieved Comapny DB creds from Cache ( stronghold )",
    );
    return {
      url: db_url,
      key: db_key,
    };
  }

  const { data, error } = await takeOverSupabase
    .from("takeover_companies")
    .select("companydb_url,companydb_key")
    .eq("company_name", companyName)
    .single()
    .overrideTypes<{ companydb_url: string; companydb_key: string }>();

  if (!data || error) {
    console.error(
      "[supabase] no company credentials found for",
      companyName,
      "-",
      error?.message,
    );
    return {
      url: supabaseUrl,
      key: import.meta.env.VITE_TAKEOVER_PSEUDO_KEY,
    };
  }

  return {
    url: data.companydb_url,
    key: data.companydb_key,
  };
};

/**Creating a separate client meant for the `login` page */
export const _login_getCompanySupabase = async () => {
  const { url: compDB_URL, key: compDB_KEY } = await getCompSupabaseCreds(true);
  return createClient(compDB_URL, compDB_KEY, {
    auth: {
      // *Storage key must be the same as normal `companySupabase` client
      storageKey: "sb-takeover-tenant-auth",
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};

// Separate storage key so this client doesn't fight the master
// client over the same localStorage entry. The per-tenant client
// uses an anon / pseudo key and typically doesn't need an auth
// session at all, but we still give it its own slot to silence
// the multi-instance warning and prevent any cross-contamination.
const { url: compDB_URL, key: compDB_KEY } = await getCompSupabaseCreds();
export const companySupabase = createClient(compDB_URL, compDB_KEY, {
  auth: {
    storageKey: "sb-takeover-tenant-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});
