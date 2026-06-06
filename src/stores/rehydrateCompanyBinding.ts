/**
 * stores/rehydrateCompanyBinding.ts
 *
 * Keeps Stronghold's company_name (plus companydb creds) aligned
 * with the user's active company toggle. Used to seed Stronghold
 * on fresh installs / new machines / after the 7-day cache
 * invalidation, AND to self-heal when the cache disagrees with the
 * toggle (which happens to multi-company founders on first sign-in
 * after a reinstall -- the resolver picks one tenant arbitrarily,
 * then the operator flips the toggle and expects the cache to
 * follow).
 *
 * v2 (today):
 *   - sends company_hint from getActiveCompanyLabel() so the server
 *     can pick the right tenant for users who own multiple
 *     takeover_companies rows.
 *   - drops the "early-out if Stronghold has any value" check.
 *     Instead, only early-out when the cached value MATCHES the
 *     hint or when there's no hint to compare against. A stale
 *     cache now self-heals on the next ActiveUser load.
 *
 * Idempotent. Cheap when the cache already matches (one local read
 * + one cheap string compare). Per-session dedup keyed by
 * user_supa_id + hint so concurrent calls collapse to one fetch.
 *
 * Returns the resolved company_name (or null for unbound installs).
 */

import { getStronghold } from "@/stores/stronghold";
import { getActiveCompanyLabel } from "@/stores/query";

interface ResolvedTenant {
  company_name: string | null;
  companydb_url: string | null;
  companydb_key: string | null;
  source: string;
}

// Per-session dedup map. Key includes the hint so a toggle flip
// invalidates the dedup and re-resolves cleanly.
const inFlight = new Map<string, Promise<string | null>>();

function activeHint(): string | null {
  try {
    return getActiveCompanyLabel();
  } catch {
    return null;
  }
}

export async function rehydrateCompanyBinding(
  userSupaId: string | undefined | null,
): Promise<string | null> {
  if (!userSupaId) return null;

  const hint = activeHint();
  const dedupKey = `${userSupaId}::${hint ?? ""}`;
  const cached = inFlight.get(dedupKey);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const sh = await getStronghold();
      const existing = (await sh.getRecord("company_name"))?.trim() || null;

      // Early-out cases:
      //   - Cache already matches the active hint -> nothing to do.
      //   - No hint AND cache has a value -> caller doesn't care
      //     which tenant; trust whatever is there. (Pre-toggle code
      //     paths.)
      if (existing && (existing === hint || !hint)) {
        return existing;
      }

      // Otherwise ask the server. Send the hint so multi-company
      // founders land on the right tenant.
      const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
      if (!base) {
        console.warn(
          "[rehydrate-binding] VITE_TAKEOVER_SITE_URL not set; skipping",
        );
        return existing;
      }

      const res = await fetch(`${base}/api/connectors/resolve-tenant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "TakeOver-App": "true",
        },
        body: JSON.stringify({
          user_supa_id: userSupaId,
          company_hint: hint,
        }),
      });

      if (!res.ok) {
        console.warn(
          "[rehydrate-binding] resolve-tenant returned",
          res.status,
        );
        return existing;
      }
      const json = (await res.json()) as ResolvedTenant;
      if (!json.company_name) {
        // Genuinely unbound (dev install, mid-onboarding). Don't
        // touch the cache.
        return existing;
      }

      // If the server's answer matches what's already cached, skip
      // the write -- saves the disk hit and avoids stamping
      // last_synced unnecessarily.
      if (json.company_name === existing) {
        return existing;
      }

      // Write all three records together so the cache is consistent.
      // companydb_url/key may be null on master-only installs --
      // only write the keys we got back.
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

      if (existing && existing !== json.company_name) {
        console.log(
          "[rehydrate-binding] corrected stale binding:",
          existing,
          "->",
          json.company_name,
          `(source: ${json.source}, hint: ${hint ?? "none"})`,
        );
      } else {
        console.log(
          "[rehydrate-binding] seeded company_name:",
          json.company_name,
          `(source: ${json.source})`,
        );
      }
      return json.company_name;
    } catch (err) {
      console.error("[rehydrate-binding] failed:", err);
      return null;
    } finally {
      setTimeout(() => inFlight.delete(dedupKey), 0);
    }
  })();

  inFlight.set(dedupKey, promise);
  return promise;
}
