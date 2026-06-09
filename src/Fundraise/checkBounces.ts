/**
 * checkBounces.ts — client wrapper for the takeover-B2B
 * /api/gmail/bounces route.
 *
 * Called from the BatchOutreachModal "Done" state (and any other
 * place that wants to check "did anything bounce?" without forcing
 * the operator to babysit their inbox).
 *
 * Soft-failure mode: every error path returns an empty result with
 * a message. The UI surfaces it but doesn't break the operator's
 * flow -- bounces are a nice-to-have, not a critical path.
 */

import { companySupabase } from "@/MyComponents/supabase";

export interface BounceRecord {
  /** Recipient address that bounced (lowercase). */
  failed_email: string;
  bounce_message_id: string;
  bounce_time_iso: string;
  /** First ~200 chars of the bounce body -- useful for debug, the
   *  UI generally hides this behind a "details" toggle. */
  reason_snippet: string;
}

export interface CheckBouncesInput {
  /** How far back to look. Should match the start time of the batch
   *  send -- anything earlier could be from a previous round. */
  sinceIso: string;
  /** Per-tenant routing. Pass the active company filter value. */
  company_name?: string;
  /** Optional cap. Default 20. */
  limit?: number;
}

export interface CheckBouncesResult {
  bounces: BounceRecord[];
  error?: string;
}

export async function checkBounces(
  inp: CheckBouncesInput,
): Promise<CheckBouncesResult> {
  // Resolve who's asking -- the server uses this to load the right
  // Gmail tokens. Without an auth session we have nothing to query,
  // so bail early with a soft error.
  const { data: sessionRes } = await companySupabase.auth.getSession();
  const supaId = sessionRes.session?.user.id;
  if (!supaId) {
    return {
      bounces: [],
      error: "No active session — can't check bounces.",
    };
  }

  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    return {
      bounces: [],
      error: "VITE_TAKEOVER_SITE_URL not configured.",
    };
  }

  try {
    const res = await fetch(`${base}/api/gmail/bounces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
      body: JSON.stringify({
        user_supa_id: supaId,
        company_name: inp.company_name,
        since_iso: inp.sinceIso,
        limit: inp.limit ?? 20,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let parsed: { error?: string } = {};
      try {
        parsed = JSON.parse(detail);
      } catch {
        /* noop */
      }
      return {
        bounces: [],
        error:
          parsed.error ?? `gmail-bounces failed: ${res.status} ${detail.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as {
      ok?: boolean;
      bounces?: BounceRecord[];
    };

    return { bounces: json.bounces ?? [] };
  } catch (err) {
    return {
      bounces: [],
      error:
        err instanceof Error ? err.message : "Network error reaching bounces.",
    };
  }
}

/** Filter a list of bounce records down to ones whose failed_email
 *  appears in the candidateEmails set. Useful for the batch modal --
 *  we don't care about bounces from unrelated sends. */
export function filterBouncesByCandidates(
  bounces: BounceRecord[],
  candidateEmails: Iterable<string>,
): BounceRecord[] {
  const norm = new Set(
    Array.from(candidateEmails).map((e) => e.trim().toLowerCase()),
  );
  return bounces.filter((b) => norm.has(b.failed_email));
}
