/**
 * salesAi.ts — small Claude wrappers for the sales surface.
 *
 * Two callable helpers:
 *   · summarizeDeal()  — read activity timeline + deal fields,
 *                        return a 1-paragraph status the rep can
 *                        skim to remember where they left off.
 *   · draftDealEmail() — given deal context + rep intent, draft a
 *                        subject + body the rep can paste / send.
 *
 * Both reuse the existing Axon Anthropic plumbing (env-loaded key,
 * 429-backoff fetch wrapper, sonnet model). Single-shot, non-stream
 * calls — the responses are short enough that streaming doesn't
 * pay off, and the UX is cleaner when the result lands all at once.
 *
 * Returning errors instead of throwing lets the caller render an
 * inline error state inside the drawer without try/catch noise.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "@/Axon/config";
import { anthropicFetch } from "@/Axon/engine/anthropicFetch";
import {
  formatCrmAmount,
  type CrmDeal,
  type CrmContact,
  type CrmCompany,
  type CrmActivity,
} from "@/stores/crm";

// ────────────────────────────────────────────────
// Shared serializer — turns the full deal context into a stable
// prose blob both prompts consume. Keeping this in one place means
// both callers see the same facts in the same order.
// ────────────────────────────────────────────────
function buildDealContext(input: {
  deal: CrmDeal;
  activities: CrmActivity[];
  contact: CrmContact | null;
  company: CrmCompany | null;
}): string {
  const { deal, activities, contact, company } = input;
  const lines: string[] = [];

  lines.push(`Deal: ${deal.name}`);
  lines.push(`Stage: ${deal.stage}`);
  lines.push(`Amount: ${formatCrmAmount(deal.amount_cents, deal.currency)}`);
  if (deal.probability != null) lines.push(`Probability: ${deal.probability}%`);
  if (deal.source) lines.push(`Source: ${deal.source}`);
  if (deal.close_date_expected) lines.push(`Expected close: ${deal.close_date_expected}`);
  if (deal.lost_reason) lines.push(`Lost reason: ${deal.lost_reason}`);

  if (company) {
    lines.push("");
    lines.push(`Company: ${company.name}`);
    if (company.industry) lines.push(`  Industry: ${company.industry}`);
    if (company.size_employees) lines.push(`  Size: ~${company.size_employees} employees`);
    if (company.domain) lines.push(`  Domain: ${company.domain}`);
  }

  if (contact) {
    lines.push("");
    lines.push(`Primary contact: ${contact.name ?? contact.email ?? "—"}`);
    if (contact.title) lines.push(`  Title: ${contact.title}`);
    if (contact.email) lines.push(`  Email: ${contact.email}`);
    lines.push(`  Lifecycle: ${contact.lifecycle_stage}`);
  }

  if (activities.length === 0) {
    lines.push("");
    lines.push("Activity history: none yet.");
  } else {
    lines.push("");
    lines.push("Activity history (most recent first):");
    // Cap at 30 events so we don't blow up the prompt; the most
    // recent activity carries the most signal anyway.
    for (const a of activities.slice(0, 30)) {
      const when = new Date(a.happened_at).toISOString().slice(0, 10);
      const title = a.title ?? a.type;
      const outcome = a.outcome ? ` [${a.outcome}]` : "";
      const body = a.body_md ? ` — ${a.body_md.replace(/\s+/g, " ").slice(0, 200)}` : "";
      lines.push(`  ${when} · ${a.type}: ${title}${outcome}${body}`);
    }
  }

  return lines.join("\n");
}

// ────────────────────────────────────────────────
// summarizeDeal — one-paragraph status of where the deal is at.
// Used by the "Summarize" button in DealDetailDrawer.
// ────────────────────────────────────────────────
const SUMMARY_SYSTEM = `You are a sales analyst summarizing a CRM deal for the rep who owns it. Read the structured deal context and write a single short paragraph (3-5 sentences, plain prose, no markdown, no headers, no bullet points) that captures:
  - where the deal is in the pipeline and how it got there
  - the most recent material activity / what's currently in motion
  - any obvious risk or blocker (silence, objections, missing decision-maker)
  - what the rep should do next

Be specific. Reference activity titles and outcomes when they're useful. Don't invent facts that aren't in the context. If the deal is brand-new or has no activity, say so plainly in one sentence.`;

export interface SummarizeDealResult {
  ok: boolean;
  summary?: string;
  error?: string;
}

export async function summarizeDeal(input: {
  deal: CrmDeal;
  activities: CrmActivity[];
  contact: CrmContact | null;
  company: CrmCompany | null;
}): Promise<SummarizeDealResult> {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: "Anthropic API key not configured." };
  }
  try {
    const res = await anthropicFetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: SUMMARY_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Here is the deal:\n\n${buildDealContext(input)}\n\nWrite the summary now.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Claude error ${res.status}` };
    }
    const json = await res.json();
    const text = (json?.content?.[0]?.text ?? "").trim();
    if (!text) return { ok: false, error: "Empty response from Claude." };
    return { ok: true, summary: text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ────────────────────────────────────────────────
// draftDealEmail — given deal context + rep intent, produce a
// subject line + body the rep can copy or send. Used by the
// "Draft email" button + modal.
// ────────────────────────────────────────────────
const EMAIL_SYSTEM = `You are drafting a sales email on behalf of an account executive. You will be given the full deal context plus a short note from the rep describing what they want the email to do. Write a complete email — subject + body — that the rep could send with minimal editing.

Style:
  - direct, warm, professional. Match how a senior AE writes — concise, never effusive.
  - first-person from the rep's perspective.
  - reference 1-2 concrete details from the activity history when they help land the point (a previous call, a specific objection, a promised follow-up). Do not invent facts.
  - no buzzwords, no "I hope this email finds you well", no "circling back".
  - end with a clear, specific next step (a question, a calendar suggestion, an attached doc).
  - sign-off uses the literal placeholder "[Your name]" — the rep will replace.

Output format — exactly this, no extra commentary:
SUBJECT: <one line>
BODY:
<the email body, as multiple paragraphs separated by blank lines>`;

export interface DraftEmailResult {
  ok: boolean;
  subject?: string;
  body?: string;
  error?: string;
}

/** Parses the strict SUBJECT/BODY block emitted by the email
 *  prompt. Defensive — falls back to "the whole thing as body" if
 *  the SUBJECT line is missing, rather than failing outright. */
function parseEmailResponse(raw: string): { subject: string; body: string } {
  const text = raw.trim();
  const m = text.match(/^SUBJECT:\s*(.+?)\s*\n+BODY:\s*\n([\s\S]+)$/i);
  if (m) return { subject: m[1].trim(), body: m[2].trim() };
  // Fallbacks
  const subjMatch = text.match(/^SUBJECT:\s*(.+)$/im);
  const subject = subjMatch ? subjMatch[1].trim() : "";
  const body = subject
    ? text.replace(/^SUBJECT:.*$/im, "").replace(/^BODY:\s*$/im, "").trim()
    : text;
  return { subject, body };
}

export async function draftDealEmail(input: {
  deal: CrmDeal;
  activities: CrmActivity[];
  contact: CrmContact | null;
  company: CrmCompany | null;
  /** What the rep wants the email to do. */
  intent: string;
}): Promise<DraftEmailResult> {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: "Anthropic API key not configured." };
  }
  if (!input.intent.trim()) {
    return { ok: false, error: "Tell me what you want the email to do." };
  }
  try {
    const res = await anthropicFetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 900,
        system: EMAIL_SYSTEM,
        messages: [
          {
            role: "user",
            content:
              `Deal context:\n\n${buildDealContext(input)}\n\n` +
              `Rep's intent for this email:\n${input.intent.trim()}\n\n` +
              `Draft the email now.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Claude error ${res.status}` };
    }
    const json = await res.json();
    const text = (json?.content?.[0]?.text ?? "").trim();
    if (!text) return { ok: false, error: "Empty response from Claude." };
    const { subject, body } = parseEmailResponse(text);
    return { ok: true, subject, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
