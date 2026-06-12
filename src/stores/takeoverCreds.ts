/**
 * takeoverCreds.ts — single source for the TakeOver bootstrap creds
 * served by ${VITE_TAKEOVER_SITE_URL}/api/takeover_creds.
 *
 * That one endpoint returns BOTH the Stronghold vault password and
 * the master Supabase anon key. Previously stronghold.ts and
 * supabase.ts each fetched it independently — two identical network
 * round-trips on the critical boot path, run serially, blocking first
 * paint. This memoizes the response so it's fetched exactly once and
 * shared by every caller (concurrent callers await the same promise).
 */
export interface TakeOverCreds {
  vault_password?: string;
  supabase_key?: string;
  [k: string]: unknown;
}

let _credsPromise: Promise<TakeOverCreds> | null = null;

export function getTakeOverCreds(): Promise<TakeOverCreds> {
  if (_credsPromise) return _credsPromise;
  _credsPromise = (async () => {
    const res = await fetch(
      `${import.meta.env.VITE_TAKEOVER_SITE_URL}/api/takeover_creds`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", "TakeOver-App": "true" },
      },
    );
    if (!res.ok) {
      // Don't cache a failed fetch — let the next caller retry.
      _credsPromise = null;
      throw new Error(`[takeover-creds] fetch failed: ${res.status}`);
    }
    return (await res.json()) as TakeOverCreds;
  })();
  return _credsPromise;
}
