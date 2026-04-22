/**
 * draftOffer.ts — Ask Claude to generate an offer-letter body from
 * the structured form inputs. Returns plain text the preview can
 * render as-is. Pairs with the legal-disclaimer banner on screen —
 * this is a first draft, not an executed contract.
 *
 * Uses the same "anthropic-dangerous-direct-browser-access" header
 * the Axon brain already uses for desktop-app calls.
 */

import { sanitizeLegalDraft } from "./draftCompanion";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

export interface OfferInput {
  /** Brand the letter is issued under — drives PDF letterhead styling. */
  brand?: "codeWithAli" | "simplicity";
  // Employer
  employerLegalName: string;
  employerAddress?: string;
  employerState?: string;
  employerSignerName?: string;
  employerSignerTitle?: string;
  // Candidate
  candidateName: string;
  candidateAddress?: string;
  // Position
  positionTitle: string;
  roleSummary?: string;
  reportsTo?: string;
  workLocation?: string;
  workArrangement?: "remote" | "hybrid" | "onsite";
  // Classification
  employmentType:
    | "w2_full_time"
    | "w2_part_time"
    | "1099_contractor"
    | "intern";
  exemptStatus?: "exempt" | "non_exempt";
  // Compensation
  compMode: "salary" | "hourly" | "commission_only" | "base_plus_commission";
  baseSalaryUsd?: number | null;
  hourlyRateUsd?: number | null;
  commissionRatePercent?: number | null;
  commissionBasis?:
    | "gross_revenue"
    | "net_revenue"
    | "collected_revenue"
    | "gross_profit";
  commissionNotes?: string;
  /** When true, rate/basis/notes are marked "to be determined" and
   *  the generated letter includes an addendum-to-follow clause. */
  commissionTbd?: boolean;
  paySchedule?: "weekly" | "biweekly" | "semimonthly" | "monthly";
  // Terms
  benefits?: string[];
  ptoDaysPerYear?: number | null;
  startDate?: string; // ISO yyyy-mm-dd
  offerExpiresAt?: string;
  contingencies?: string[];
  additionalTerms?: string;
}

const SYSTEM_PROMPT = `You are drafting a US employment offer letter for a small LLC. Your output is a first draft that the founder will have an attorney review before sending.

Requirements — include ALL of these, in this order, in the letter body:

1. Date line (today's date — infer from context).
2. Addressed to the candidate by full name + optional address.
3. Opening sentence: the employer is pleased to extend an offer for the stated position.
4. Position: title, reports-to (if given), work arrangement (remote/hybrid/onsite), location.
5. Classification paragraph: W-2 employee (full/part-time) or 1099 independent contractor. If W-2, state exempt/non-exempt and briefly what that means for overtime (non-exempt qualifies for OT, exempt does not). If 1099, explicitly state that the candidate is a contractor, controls their own means and methods, and is responsible for their own taxes.
6. Start date.
7. Compensation section tailored to comp_mode:
   - salary: annual base, paid per the given schedule.
   - hourly: hourly rate, paid per schedule, overtime per law if non-exempt.
   - commission_only: a clear, specific commission structure — rate, basis (gross/net/collected revenue or gross profit), when earned, when paid, what happens if the employee leaves before a customer pays. For W-2 commission-only, include a sentence that the company will ensure total compensation meets or exceeds the applicable state minimum wage averaged over each pay period. For 1099 commission-only, state there is no minimum guarantee.
   - base_plus_commission: both, with the commission rules above.
   - If commission_tbd is TRUE: DO NOT invent a rate or basis. Instead write: "The specific commission structure — rate, basis, and payment timing — will be finalized in a written addendum to this letter, signed by both parties, before the employee's first paid commission period. Both parties acknowledge that until this addendum is executed, no commission-based compensation is owed." Include this exact sentiment paraphrased. For W-2 TBD comp_mode=commission_only, also state that base minimum-wage protection remains in effect during the interim.
8. Benefits (only the ones listed). If none, say "This position does not currently include company-sponsored benefits."
9. PTO (if provided).
10. Contingencies (I-9 employment eligibility, background check if listed, references).
11. At-will employment clause — EXACT phrasing for W-2: "Your employment with {employer} is at-will, meaning either you or the Company may terminate the employment relationship at any time, with or without cause, and with or without notice." (Skip for 1099 — instead say the agreement can be terminated per its terms by either party.) Montana residents: soften to "subject to Montana's Wrongful Discharge from Employment Act."
12. Confidentiality + IP: one line saying the candidate will be asked to sign a separate Confidentiality and Invention Assignment Agreement as a condition of employment.
13. Offer expiration: "This offer expires on {offerExpiresAt}."
14. Closing: a warm closing paragraph inviting the candidate to review and respond. Mention that the offer is signed electronically — both the employer and candidate will sign online.

CRITICAL OUTPUT RULES:
- Do NOT include any signature block, signature lines, "Name:", "Title:", "Date:", or blank underscore lines at the bottom of the letter. The PDF template renders the employer's typed signature and the candidate's signature line separately, and a second set of signature lines in the prose would be duplicated in the final artifact.
- Do NOT use runs of underscores or escaped underscores anywhere.
- End the letter with the closing paragraph (item 14) and the standard sign-off (e.g., "Warm regards," followed by the employer's name and title). Nothing after that.

Tone: warm but formal. Short paragraphs. No markdown. No emoji. No headings — the letter reads as continuous prose with paragraph breaks. Do NOT include legal advice disclaimers in the letter body (those live in the UI around it, not inside the letter itself). Do NOT invent benefits or terms not provided.

Output ONLY the letter text. No preamble, no commentary.`;

function humanMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function humanDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildUserMessage(input: OfferInput): string {
  const lines: string[] = [];
  lines.push(`Today's date: ${humanDate(new Date().toISOString())}`);
  lines.push("");
  lines.push("EMPLOYER:");
  lines.push(`  Legal name: ${input.employerLegalName}`);
  if (input.employerAddress) lines.push(`  Address: ${input.employerAddress}`);
  if (input.employerState) lines.push(`  State of operation: ${input.employerState}`);
  if (input.employerSignerName) lines.push(`  Authorized signer: ${input.employerSignerName}${input.employerSignerTitle ? `, ${input.employerSignerTitle}` : ""}`);
  lines.push("");
  lines.push("CANDIDATE:");
  lines.push(`  Name: ${input.candidateName}`);
  if (input.candidateAddress) lines.push(`  Address: ${input.candidateAddress}`);
  lines.push("");
  lines.push("POSITION:");
  lines.push(`  Title: ${input.positionTitle}`);
  if (input.roleSummary) lines.push(`  Summary: ${input.roleSummary}`);
  if (input.reportsTo) lines.push(`  Reports to: ${input.reportsTo}`);
  if (input.workArrangement) lines.push(`  Work arrangement: ${input.workArrangement}`);
  if (input.workLocation) lines.push(`  Location: ${input.workLocation}`);
  lines.push("");
  lines.push("CLASSIFICATION:");
  lines.push(`  Employment type: ${input.employmentType}`);
  if (input.exemptStatus) lines.push(`  FLSA status: ${input.exemptStatus}`);
  lines.push("");
  lines.push("COMPENSATION:");
  lines.push(`  Mode: ${input.compMode}`);
  if (input.baseSalaryUsd) lines.push(`  Annual base: ${humanMoney(input.baseSalaryUsd)}`);
  if (input.hourlyRateUsd) lines.push(`  Hourly rate: ${humanMoney(input.hourlyRateUsd)} / hour`);
  if (input.commissionTbd) {
    lines.push(`  Commission rate: TO BE DETERMINED in a signed addendum before first paid commission period.`);
    lines.push(`  commission_tbd: true`);
  } else {
    if (input.commissionRatePercent != null)
      lines.push(`  Commission rate: ${input.commissionRatePercent}%`);
    if (input.commissionBasis)
      lines.push(`  Commission basis: ${input.commissionBasis.replace(/_/g, " ")}`);
    if (input.commissionNotes) lines.push(`  Commission notes: ${input.commissionNotes}`);
  }
  if (input.paySchedule) lines.push(`  Pay schedule: ${input.paySchedule}`);
  lines.push("");
  lines.push("TERMS:");
  if (input.startDate) lines.push(`  Start date: ${humanDate(input.startDate)}`);
  if (input.offerExpiresAt) lines.push(`  Offer expires: ${humanDate(input.offerExpiresAt)}`);
  lines.push(`  Benefits: ${(input.benefits ?? []).join(", ") || "none"}`);
  if (input.ptoDaysPerYear != null)
    lines.push(`  PTO: ${input.ptoDaysPerYear} days/year`);
  lines.push(`  Contingencies: ${(input.contingencies ?? []).join(", ") || "none"}`);
  if (input.additionalTerms) lines.push(`  Additional terms: ${input.additionalTerms}`);
  lines.push("");
  lines.push(
    "Draft the offer letter body per the instructions. Output ONLY the letter prose.",
  );
  return lines.join("\n");
}

export async function draftOfferLetter(
  input: OfferInput,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Missing VITE_ANTHROPIC_API_KEY. Add it to .env.local to enable AI drafting.",
    };
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input) }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `API ${res.status}: ${txt.slice(0, 200)}` };
    }
    const j = await res.json();
    const block = Array.isArray(j?.content)
      ? j.content.find((b: any) => b?.type === "text")
      : null;
    const rawText = (block?.text || "").trim();
    if (!rawText) return { ok: false, error: "Empty response from Claude." };
    // Defense-in-depth: strip any signature/exhibit/underscore
    // artifacts if Claude regresses to boilerplate. The PDF template
    // owns the actual signature rendering.
    return { ok: true, text: sanitizeLegalDraft(rawText) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
