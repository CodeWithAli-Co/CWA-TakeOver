/**
 * Simplicity Supabase Client — separate from the main CWA Supabase instance.
 * Used to query Simplicity's database (users, expenses, budgets, transactions, etc.)
 * All URLs and keys come from env vars — never hardcoded.
 */
import { createClient } from "@supabase/supabase-js";

const SIMPLICITY_URL = import.meta.env.VITE_SIMPLICITY_SUPABASE_URL;
const SIMPLICITY_KEY = import.meta.env.VITE_SIMPLICITY_SUPABASE_KEY;

if (!SIMPLICITY_URL || !SIMPLICITY_KEY) {
  console.warn(
    "[Simplicity] Missing VITE_SIMPLICITY_SUPABASE_URL or VITE_SIMPLICITY_SUPABASE_KEY"
  );
}

export const simplicitySupabase = createClient(
  SIMPLICITY_URL || "",
  SIMPLICITY_KEY || ""
);
