/**
 * supabase.ts — dual-client Supabase setup for the multi-tenant
 * desktop app.
 *
 *   takeOversupabase — the central master DB. Holds the
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

// Initialize the shared stronghold instance exactly once.
// Subsequent callers anywhere in the app use getStronghold()
// and get this same instance back.
const stronghold = await getStronghold();

// ── Master TakeOver client ────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_DB_URL;

const getTKSupabaseKey = async (): Promise<string> => {
  const res = await fetch(
    `${import.meta.env.VITE_TAKEOVER_SITE_URL}/api/takeover_creds`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
    },
  );
  const result = await res.json();
  return result.supabase_key;
};

const supabaseKey = await getTKSupabaseKey();
export const takeOversupabase = createClient(supabaseUrl, supabaseKey);

// ── Per-tenant company client ─────────────────────────────────

const getCompSupabaseCreds = async (): Promise<{
  url: string;
  key: string;
}> => {
  const companyName = await stronghold.getRecord("company_name");

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

  const { data, error } = await takeOversupabase
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

const { url: compDB_URL, key: compDB_KEY } = await getCompSupabaseCreds();
export const companySupabase = createClient(
  compDB_URL ?? "",
  compDB_KEY ?? "",
);
