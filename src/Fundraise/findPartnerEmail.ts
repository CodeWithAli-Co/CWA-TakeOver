/**
 * findPartnerEmail.ts — client-side helper for the takeover-B2B
 * /api/email/find-partner endpoint.
 *
 * Used by the InvestorDrawer's Partner row when the operator hits
 * "Find email with Axon" on a partner without an address.
 *
 * The endpoint generates pattern-based email candidates (first@,
 * first.last@, flast@, etc.) ranked by how often the pattern is
 * actually used at VC firms, plus an MX check on the domain. It
 * does NOT do real SMTP verification (Vercel blocks outbound
 * port 25), so the UI surfaces the candidates with confidence
 * scores and the operator picks one. If they get a bounce, they
 * try the next.
 *
 * Soft failure modes (always returns a result, never throws):
 *   · Network timeout         -> error string, empty candidates
 *   · Bad domain              -> error string, empty candidates
 *   · Server-down             -> error string, empty candidates
 * The UI degrades to "type the email manually" in all cases.
 */

import type { CrmContact } from "@/stores/crm";

export interface EmailCandidate {
  /** Full email address to try. */
  email: string;
  /** Pattern name -- 'first', 'first.last', 'flast', 'firstlast',
   *  'first_last'. Surfaced in the UI as a small tag. */
  pattern: string;
  /** 0-100. NOT a verification score -- just how common this
   *  pattern is at VC firms. Top candidate is the operator's
   *  best first try. */
  confidence: number;
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
}

/** Find candidate emails for a partner. Uses the takeover-B2B
 *  proxy because (a) it keeps the API surface consistent with the
 *  rest of the Gmail / Stripe / Connectors proxies, and (b) the
 *  DNS lookup needs a server-side runtime. */
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

  try {
    // Split "Lenny Pruss" -> first_name + last_name client-side
    // too. The server can do this itself, but doing it here lets
    // single-name inputs work cleanly and saves a round-trip on
    // bad data.
    const tokens = inp.partner_name
      .trim()
      .split(/\s+/)
      .filter((t) => !/^(jr\.?|sr\.?|ii|iii|iv|md|phd)$/i.test(t));
    const first_name = tokens[0] ?? inp.partner_name;
    const last_name = tokens.length > 1 ? tokens[tokens.length - 1] : undefined;

    const res = await fetch(`${base}/api/email/find-partner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
      body: JSON.stringify({
        first_name,
        last_name,
        domain: inp.firm_domain,
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
): Promise<FindPartnerEmailResult> {
  return findPartnerEmail({
    partner_name: contact.name ?? "",
    firm_domain: domain ?? "",
  });
}
