import { TakeOverStronghold } from "@/stores/stronghold";
import { createClient } from "@supabase/supabase-js";

const stronghold = new TakeOverStronghold();
await stronghold.init();

const supabaseUrl = import.meta.env.VITE_DB_URL;
const getTKSupabaseKey = async () => {
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

const getCompSupabaseCreds = async () => {
  const companyName = await stronghold.getRecord("company_name");
  const { data, error } = await takeOversupabase
    .from("takeover_companies")
    .select("companydb_url,companydb_key")
    .eq("company_name", companyName)
    .single()
    .overrideTypes<{ companydb_url: string; companydb_key: string }>();

  if (!data || error) {
    console.error("No company credentials found; ", error.message);
    // Default to TakeOver's database URL and pseudo public key ( key that is created just for this - with no access to data )
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
export const companySupabase = createClient(compDB_URL ?? "", compDB_KEY ?? "");
