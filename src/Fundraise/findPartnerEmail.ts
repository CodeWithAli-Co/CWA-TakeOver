/**
 * findPartnerEmail.ts — client-side helper for the takeover-B2B
 * /api/email/find-partner endpoint, plus an Anthropic web_search
 * verification pass via discoverPartnerEmail.
 *
 * Used by the InvestorDrawer's Partner row when the operator hits
 * "Find email with Axon" on a partner without an address.
 *
 * Two-path lookup, run in PARALLEL:
 *   1. Pattern guesses (takeover-B2B route) — generates first@,
 *      first.last@, etc. with VC-tuned confidence + MX check.
 *   2. Web-search confirmation (Anthropic) — Axon hunts firm About
 *      pages, podcast bios, etc. for a verifiable email. Returns
 *      null when nothing strong is found.
 *
 * Merged result: verified candidate (if any) at the top with
 * confidence pinned to 95 + source URL; pattern candidates below.
 * De-duped: a pattern that matches the verified email is dropped.
 *
 * Soft failure modes (always returns a result, never throws):
 *   · Network timeout         -> error string, empty candidates
 *   · Bad domain              -> error string, empty candidates
 *   · Server-down             -> error string, empty candidates
 *   · Web-search failure      -> silent; pattern path still runs
 * The UI degrades to "type the email manually" in all cases.
 */

import type { CrmContact } from "@/stores/crm";
import { discoverPartnerEmail } from "./discoverPartnerEmail";

export interface EmailCandidate {
  /** Full email address to try. */
  email: string;
  /** Pattern name -- 'first', 'first.last', 'flast', 'firstlast',
   *  'first_last' -- OR 'web' for an Axon-confirmed result. Surfaced
   *  in the UI as a small tag. */
  pattern: string;
  /** 0-100. For pattern candidates this is "how common this pattern
   *  is at VC firms". For web-confirmed candidates we pin to 95 so
   *  they always sort to the top. */
  confidence: number;
  /** Where the candidate came from. 'pattern' = generated client-
   *  side from VC naming conventions. 'web' = Axon-confirmed via
   *  web_search. */
  source?: "pattern" | "web";
  /** When source === 'web', the URL of the page Axon found the
   *  email on -- surfaced as a tooltip on the verified badge. */
  source_url?: string;
  /** When source === 'web', a short label like 'Conviction team
   *  page' so the operator can see at a glance where the
   *  confirmation came from without hovering. */
  source_label?: string;
}

export interface FindPartnerEmailResult {
  candidates: EmailCandidate[];
  /** False = the firm's domain has no MX records, so none of the
   *  candidates will work. UI shows a banner in this case. */
  domain_has_mx: boolean;
  /** Soft error -- UI shows this without crashing. */
  error?: string;
}

export interface FindPartnerEmailInput {
  /** Either a full name ("Lenny Pruss") or first name only. The
   *  server splits it into first/last tokens. */
  partner_name: string;
  /** Firm's domain. Endpoint strips http:// / https:// / www. for
   *  the caller, but caller can pass the bare domain to skip that. */
  firm_domain: string;
  /** Firm name -- helps Axon's web_search disambiguate. Optional
   *  but recommended for the verified-lookup path. */
  firm_name?: string;
}

/** Find candidate emails for a partner. Runs the pattern proxy and
 *  Anthropic web_search in PARALLEL, then merges the results so the
 *  verified candidate (if any) lands at the top. */
export async function findPartnerEmail(
  inp: FindPartnerEmailInput,
): Promise<FindPartnerEmailResult> {
  if (!inp.partner_name?.trim()) {
    return {
      candidates: [],
      domain_has_mx: false,
      error: "Partner name is empty.",
    };
  }
  if (!inp.firm_domain?.trim()) {
    return {
      candidates: [],
      domain_has_mx: false,
      error:
        "No firm domain on file. Add a website to the firm before searching.",
    };
  }

  const base = import.meta.env.VITE_TAKEOVER_SITE_URL;
  if (!base) {
    return {
      candidates: [],
      domain_has_mx: false,
      error: "VITE_TAKEOVER_SITE_URL not configured.",
    };
  }

  // Split "Lenny Pruss" -> first_name + last_name client-side too.
  // The server can do this itself, but doing it here lets single-
  // name inputs work cleanly and saves a round-trip on bad data.
  const tokens = inp.partner_name
    .trim()
    .split(/\s+/)
    .filter((t) => !/^(jr\.?|sr\.?|ii|iii|iv|md|phd)$/i.test(t));
  const first_name = tokens[0] ?? inp.partner_name;
  const last_name = tokens.length > 1 ? tokens[tokens.length - 1] : undefined;

  // Run both paths in parallel. Total wall time becomes max(both)
  // instead of sum. Claude's web_search is the slower of the two
  // (5-15s) so we want it running while DNS resolves.
  const patternsPromise = fetchPatternCandidates(
    base,
    first_name,
    last_name,
    inp.firm_domain,
  );
  const verifiedPromise = discoverPartnerEmail({
    partner_name: inp.partner_name,
    firm_name: inp.firm_name ?? "",
    firm_domain: inp.firm_domain,
  }).catch(() => null);

  const [patternsRes, verified] = await Promise.all([
    patternsPromise,
    verifiedPromise,
  ]);

  // Merge: verified candidate (if present) ALWAYS sorts first with
  // confidence pinned to 95. De-dupe pattern candidates that exactly
  // match the verified address (case-insensitive) -- those mean Axon
  // confirmed a pattern we'd have guessed anyway, no need to show
  // twice.
  const merged: EmailCandidate[] = [];
  if (verified?.email) {
    merged.push({
      email: verified.email,
      pattern: "web",
      confidence: 95,
      source: "web",
      source_url: verified.source_url ?? undefined,
      source_label: verified.source_label ?? undefined,
    });
  }
  for (const c of patternsRes.candidates) {
    if (
      verified?.email &&
      c.email.toLowerCase() === verified.email.toLowerCase()
    ) {
      continue;
    }
    merged.push({ ...c, source: "pattern" });
  }

  return {
    candidates: merged,
    domain_has_mx: patternsRes.domain_has_mx,
    error: patternsRes.error,
  };
}

// ─────────────────────────────────────────────────────────────────
// Pattern fetcher -- factored out so the verified path can run in
// parallel without nesting the try/catch.
// ─────────────────────────────────────────────────────────────────
async function fetchPatternCandidates(
  base: string,
  first_name: string,
  last_name: string | undefined,
  domain: string,
): Promise<FindPartnerEmailResult> {
  try {
    const res = await fetch(`${base}/api/email/find-partner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
      body: JSON.stringify({ first_name, last_name, domain }),
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
        candidates: [],
        domain_has_mx: false,
        error:
          parsed.error ??
          `find-partner failed: ${res.status} ${detail.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      domain_has_mx?: boolean;
      candidates?: EmailCandidate[];
    };
    return {
      candidates: json.candidates ?? [],
      domain_has_mx: !!json.domain_has_mx,
    };
  } catch (err) {
    return {
      candidates: [],
      domain_has_mx: false,
      error:
        err instanceof Error ? err.message : "Network error reaching server.",
    };
  }
}

/** Convenience helper -- if you have a CrmContact + the firm's
 *  company row, extracts the right inputs for findPartnerEmail. */
export function findEmailForContact(
  contact: Pick<CrmContact, "name">,
  domain: string | null,
  firm_name?: string,
): Promise<FindPartnerEmailResult> {
  return findPartnerEmail({
    partner_name: contact.name ?? "",
    firm_domain: domain ?? "",
    firm_name,
  });
}
