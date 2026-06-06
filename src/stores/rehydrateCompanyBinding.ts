/**
 * stores/rehydrateCompanyBinding.ts
 *
 * Auto-rehydrates Stronghold's company_name (plus companydb creds)
 * whenever the cache is empty -- on a new machine, after a reinstall,
 * after the 7-day Stronghold cache invalidation fires, or after the
 * user is bumped through onboarding.
 *
 * Without this, every connector-store call falls back to
 * .is("company", null) and silently returns zero rows even though
 * the user's connectors are sitting in the master DB. Gmail is the
 * lone survivor because it routes through a server proxy that keys
 * off user_supa_id only -- this helper extends that exact pattern to
 * the Stronghold cache itself.
 *
 * Idempotent. Cheap when Stronghold is already populated (early-out
 * after one local read). Safe to call from any post-login lifecycle
 * point -- multiple concurrent calls dedup behind one in-flight
 * promise.
 *
 * Usage:
 *   await rehydrateCompanyBinding(userSupaId);
 *
 * Returns the resolved company_name (or null for unbound installs).
 */

import { getStronghold } from "@/stores/stronghold";

interface ResolvedTenant {
  company_name: string | null;
  companydb_url: string | null;
  companydb_key: string | null;
  source: string;
}

// Per-session dedup: avoid hammering resolve-tenant if multiple call
// sites fire on the same launch. Keyed by user_supa_id so a user
// switch within the same session re-resolves cleanly.
const inFlight = new Map<string, Promise<string | null>>();

export async function rehydrateCompanyBinding(
  userSupaId: string | undefined | null,
): Promise<string | null> {
  if (!userSupaId) return null;

  const cached = inFlight.get(userSupaId);
  if (cached) return cached;

  const promise = (async () => {
    try {
      // Early-out: Stronghold already knows. We trust the local
      // value rather than re-resolving on every call.
      const sh = await getStronghold();
      const existing = await sh.getRecord("company_name");
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }

      // Ask the server who this user belongs to.
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        console.warn(
          "[rehydrate-binding] VITE_TAKEOVER_SITE_URL not set; skipping",
        );
        return null;
      }

      const res = await fetch(`${base}/api/connectors/resolve-tenant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({ user_supa_id: userSupaId }),
      });

      if (!res.ok) {
        console.warn(
          "[rehydrate-binding] resolve-tenant returned",
          res.status,
        );
        return null;
      }
      const json = (await res.json()) as ResolvedTenant;
      if (!json.company_name) {
        // Genuinely unbound (dev install, mid-onboarding). Not an
        // error -- the caller treats it as null.
        return null;
      }

      // Write all three records together so the cache is consistent
      // and last_synced gets stamped once. companydb_url/key may be
      // null on master-only installs -- only write the ones we got.
      const records: { key: string; value: string }[] = [
        { key: "company_name", value: json.company_name },
      ];
      if (json.companydb_url) {
        records.push({ key: "companydb_url", value: json.companydb_url });
      }
      if (json.companydb_key) {
        records.push({ key: "companydb_key", value: json.companydb_key });
      }
      await sh.insertManyRecords(records);

      console.log(
        "[rehydrate-binding] restored company_name from server:",
        json.company_name,
        `(source: ${json.source})`,
      );
      return json.company_name;
    } catch (err) {
      console.error("[rehydrate-binding] failed:", err);
      return null;
    } finally {
      // Drop the in-flight entry on next tick so a subsequent
      // rebind (e.g. after onboarding) can re-run cleanly.
      setTimeout(() => inFlight.delete(userSupaId!), 0);
    }
  })();

  inFlight.set(userSupaId, promise);
  return promise;
}
