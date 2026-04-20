/**
 * draftCompanion.ts — Claude-backed drafter for the contracts that
 * travel alongside an offer letter:
 *
 *   · ica                  — Independent Contractor Agreement (1099)
 *   · employment_agreement — full W-2 Employment Agreement
 *   · nda                  — Confidentiality (Non-Disclosure) Agreement
 *   · ip_assignment        — Invention Assignment / Work-for-Hire
 *
 * Each has its own system prompt with the legal must-haves for US
 * contracts. The user-message body reuses OfferInput since the offer
 * letter has most of what these need.
 */

import type { OfferInput } from "./draftOffer";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

export type CompanionDocType =
  | "ica"
  | "employment_agreement"
  | "nda"
  | "ip_assignment";

// ── System prompts, one per doc ─────────────────────────────────────

const PROMPT_ICA = `You are drafting a US INDEPENDENT CONTRACTOR AGREEMENT for a small LLC. Output plain-prose legal text with numbered section headers (1., 2., etc.) — NOT markdown. This is a first draft the founder will have an attorney review before sending.

Required sections in this order:

1. Parties — identify the Company (employer legal name) and the Contractor (candidate) with addresses.
2. Services — describe the work the Contractor will perform. Reference the attached offer letter or job description.
3. Term — start date; the Agreement continues until terminated per Section 10.
4. Compensation — for commission-only: state the commission rate, basis, payment timing, and when earned. For TBD: state that compensation will be finalized in a written addendum signed by both parties before any commission period. Contractor invoices the Company on the agreed pay schedule.
5. Independent Contractor Status — explicit declaration that Contractor is NOT an employee, partner, or agent; is responsible for all federal + state + local taxes; provides own tools and sets own hours; and is free to perform services for others. Include a sentence that neither party will hold out the other as anything other than independent contracting parties.
6. Confidential Information — Contractor will receive confidential info and agrees to keep it confidential during and after the engagement. Define Confidential Information broadly. Standard carve-outs: publicly known, independently developed, required by law.
7. Intellectual Property — all Work Product created by Contractor in the performance of Services is "work made for hire" under US copyright law and, to the extent not, is hereby assigned to the Company. Contractor waives moral rights to the extent permitted. Contractor represents prior inventions are listed in Exhibit A (or none if blank).
8. Non-Solicitation — during the Term and for 12 months after, Contractor will not solicit the Company's employees or customers for a competing purpose. (Keep mild — non-competes are unenforceable in California and under federal scrutiny.)
9. Representations + Warranties — each party has authority to enter; Contractor will perform in a professional manner; work will not infringe third-party IP; no prior obligations conflict.
10. Termination — either party may terminate with 14 days written notice. Company may terminate immediately for material breach. Surviving sections: 5 Confidentiality, 6 IP, 7 Non-Solicitation, 10 Indemnification, 12 General.
11. Indemnification — Contractor indemnifies Company against claims arising from Contractor's negligence, willful misconduct, or breach. Mutual for the Company in its own capacity.
12. General Provisions — governing law = State (from employer_state); entire agreement; amendments in writing; severability; assignment requires written consent; counterparts.
13. Signatures — Company by {employer_signer_name}, {employer_signer_title}; Contractor by {candidate_name}. Date lines.

Tone: formal. No markdown, no headings beyond the numbered sections. Paragraph breaks between sections. Do not invent obligations not implied by the inputs. Output ONLY the agreement text.`;

const PROMPT_EMPLOYMENT = `You are drafting a US EMPLOYMENT AGREEMENT for a W-2 employee of a small LLC. Output plain-prose legal text with numbered section headers (1., 2., etc.) — NOT markdown. First draft; founder will have an attorney review.

Required sections in this order:

1. Parties — Company + Employee identified with legal names + addresses.
2. Position + Duties — title, reporting structure, scope of duties, work arrangement (remote/hybrid/onsite), primary location.
3. At-Will Employment — EXACT language: "Employee's employment with the Company is at-will, meaning either Employee or the Company may terminate the employment relationship at any time, with or without cause, and with or without notice." If employer_state = MT, soften per Montana's Wrongful Discharge from Employment Act.
4. Compensation — base salary OR hourly rate with schedule. If commission component, describe per the offer-letter terms or reference an addendum. FLSA exempt vs non-exempt status stated explicitly; if non-exempt, mention overtime eligibility.
5. Benefits — list only what's in the benefits array. If empty, state the role does not currently include company-sponsored benefits.
6. Confidentiality — standard mutual non-disclosure obligation, survives termination.
7. Intellectual Property Assignment — all work product created within the scope of employment is assigned to the Company; prior inventions listed in Exhibit A if any.
8. Non-Solicitation — 12 months post-termination, no soliciting of Company employees or material customers for a competing venture. No non-compete (state-dependent; safer to omit).
9. Background Check + I-9 — offer is contingent on I-9 employment eligibility verification and (if listed) a background check.
10. Termination — at-will applies; on termination Employee returns all Company property, final wages paid per applicable state law, survival of Sections 6, 7, 8.
11. General Provisions — governing law, entire agreement, amendments in writing, severability, assignment, counterparts.
12. Signatures — Company authorized signer + Employee. Date lines.

Tone: formal. Paragraph breaks between sections. Do not invent benefits or clauses. Output ONLY the agreement text.`;

const PROMPT_NDA = `You are drafting a MUTUAL NON-DISCLOSURE AGREEMENT (NDA) for a small LLC engaging a new hire. Output plain-prose legal text with numbered section headers. First draft; attorney review required.

Required sections:

1. Parties — Company + Individual identified.
2. Purpose — evaluating and engaging in an employment or contracting relationship.
3. Definition of Confidential Information — broad: technical, business, financial, customer, product info disclosed in any form. Include "Company Information" and "Personal Information of Others" categories. Mark whether marked "confidential" or obviously sensitive.
4. Obligations — recipient must (a) hold in confidence, (b) use only for the Purpose, (c) limit access to people with need-to-know bound by similar obligations, (d) protect with at least reasonable care.
5. Exclusions — info that is publicly known, independently developed, rightfully received from a third party, or required to be disclosed by law (with notice).
6. Term — confidentiality obligations survive for 3 years after termination of the relationship; trade secrets protected indefinitely per applicable law.
7. Return of Materials — on request or termination, recipient returns or destroys all Confidential Information.
8. Remedies — money damages may be inadequate; each party entitled to seek injunctive relief.
9. No License — disclosure does not grant any license or ownership.
10. General Provisions — governing law, entire agreement re confidentiality, amendments in writing, severability, counterparts.
11. Signatures — both parties.

Tone: formal. Output ONLY the agreement text.`;

const PROMPT_IP_ASSIGNMENT = `You are drafting an INVENTION ASSIGNMENT AGREEMENT (also called Proprietary Information and Inventions Agreement, PIIA) for a small LLC. Output plain-prose legal text with numbered section headers. First draft; attorney review required.

Required sections:

1. Parties — Company + Individual.
2. Recitals — Individual is being engaged; Company is relying on Individual assigning rights to Work Product.
3. Definitions — "Work Product" means all inventions, discoveries, designs, software, content, improvements, trade secrets, trademarks, and other intellectual property created in connection with the engagement.
4. Assignment — Individual assigns to Company all right, title, and interest in Work Product. To the extent such Work is not "work made for hire" under US copyright law, Individual hereby assigns it. Individual waives moral rights to the extent permitted.
5. Prior Inventions — Individual represents that prior inventions owned by Individual and excluded from assignment are listed in Exhibit A. If Exhibit A is blank, Individual represents there are none. (In California, reference Labor Code §2870 — inventions developed entirely on Individual's own time without Company resources and unrelated to Company's business are NOT assignable.)
6. Cooperation — Individual will sign any further papers reasonably necessary to perfect the assignment, including patent applications, at Company's expense.
7. Third-Party Rights — Individual represents Work Product does not infringe third-party IP and discloses any third-party components used.
8. Confidentiality — reaffirms confidentiality of Work Product and Company information.
9. Term + Survival — the assignment is perpetual; confidentiality survives termination.
10. General Provisions — governing law, entire agreement re IP, severability, counterparts.
11. Signatures — both parties.

Tone: formal. Output ONLY the agreement text.`;

function systemFor(docType: CompanionDocType): string {
  switch (docType) {
    case "ica":
      return PROMPT_ICA;
    case "employment_agreement":
      return PROMPT_EMPLOYMENT;
    case "nda":
      return PROMPT_NDA;
    case "ip_assignment":
      return PROMPT_IP_ASSIGNMENT;
  }
}

export const DOC_META: Record<
  CompanionDocType,
  { title: string; short: string; blurb: string }
> = {
  ica: {
    title: "Independent Contractor Agreement",
    short: "ICA",
    blurb:
      "Full contract for 1099 engagements. Pairs with the offer letter for commission-based contractors.",
  },
  employment_agreement: {
    title: "Employment Agreement",
    short: "Employment",
    blurb:
      "Full W-2 employment contract with at-will, IP assignment, and non-solicit.",
  },
  nda: {
    title: "Confidentiality (NDA) Agreement",
    short: "NDA",
    blurb:
      "Mutual non-disclosure. Required before sharing sensitive info with candidates or new hires.",
  },
  ip_assignment: {
    title: "Invention Assignment Agreement",
    short: "IP Assignment",
    blurb:
      "Assigns all work product to the Company. Standard part of every hire packet.",
  },
};

function buildUserMessage(input: OfferInput, docType: CompanionDocType): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines: string[] = [];
  lines.push(`Today: ${today}`);
  lines.push(`Document type: ${docType}`);
  lines.push("");
  lines.push("COMPANY:");
  lines.push(`  Legal name: ${input.employerLegalName}`);
  if (input.employerAddress) lines.push(`  Address: ${input.employerAddress}`);
  if (input.employerState) lines.push(`  State: ${input.employerState}`);
  if (input.employerSignerName)
    lines.push(`  Authorized signer: ${input.employerSignerName}${input.employerSignerTitle ? `, ${input.employerSignerTitle}` : ""}`);
  lines.push("");
  lines.push("INDIVIDUAL:");
  lines.push(`  Name: ${input.candidateName}`);
  if (input.candidateAddress) lines.push(`  Address: ${input.candidateAddress}`);
  lines.push("");
  lines.push("POSITION / ENGAGEMENT:");
  lines.push(`  Title: ${input.positionTitle}`);
  if (input.roleSummary) lines.push(`  Summary: ${input.roleSummary}`);
  if (input.workArrangement) lines.push(`  Arrangement: ${input.workArrangement}`);
  if (input.workLocation) lines.push(`  Location: ${input.workLocation}`);
  lines.push(`  Classification: ${input.employmentType}`);
  if (input.exemptStatus) lines.push(`  FLSA: ${input.exemptStatus}`);
  lines.push("");
  if (docType === "ica" || docType === "employment_agreement") {
    lines.push("COMPENSATION:");
    lines.push(`  Mode: ${input.compMode}`);
    if (input.baseSalaryUsd) lines.push(`  Base: $${input.baseSalaryUsd}/year`);
    if (input.hourlyRateUsd) lines.push(`  Hourly: $${input.hourlyRateUsd}/hr`);
    if (input.commissionTbd) {
      lines.push(`  Commission: TBD — written addendum before first paid period`);
    } else if (input.commissionRatePercent != null) {
      lines.push(`  Commission: ${input.commissionRatePercent}% on ${input.commissionBasis?.replace(/_/g, " ")}`);
      if (input.commissionNotes) lines.push(`  Notes: ${input.commissionNotes}`);
    }
    if (input.paySchedule) lines.push(`  Pay schedule: ${input.paySchedule}`);
    lines.push(`  Benefits: ${(input.benefits ?? []).join(", ") || "none"}`);
    if (input.ptoDaysPerYear != null) lines.push(`  PTO: ${input.ptoDaysPerYear} days/year`);
    lines.push(`  Start date: ${input.startDate || "TBD"}`);
    lines.push("");
  }
  if (input.additionalTerms) {
    lines.push("ADDITIONAL TERMS:");
    lines.push(input.additionalTerms);
    lines.push("");
  }
  lines.push(
    `Draft the ${docType} per the instructions above. Output ONLY the agreement text — no preamble, no commentary.`,
  );
  return lines.join("\n");
}

export async function draftCompanion(
  input: OfferInput,
  docType: CompanionDocType,
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
        max_tokens: 4000,
        system: systemFor(docType),
        messages: [{ role: "user", content: buildUserMessage(input, docType) }],
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
    const text = (block?.text || "").trim();
    if (!text) return { ok: false, error: "Empty response from Claude." };
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
