/**
 * draftInvestorEmail.ts — Axon-authored cold email + LinkedIn DM
 * drafting for the Fundraise module.
 *
 * One-shot, non-streaming wrapper around the Anthropic API. Takes
 * the operator's fundraise settings + the investor profile + the
 * partner being contacted, and returns a tailored 4-5 sentence
 * outreach with a SPECIFIC hook (their thesis fragment or a
 * portfolio company), one-line value prop, a soft ask, and a
 * sign-off.
 *
 * Why a separate file (not under Axon/actions/): the Axon actions
 * registry is for voice/Cmd+K invocations. This draft action is
 * invoked from the UI (a "Draft email" button in the InvestorDrawer
 * Partners tab), so it lives next to the rest of the Fundraise
 * module surface.
 *
 * Phase 3 will add a "reply via voice → Axon paraphrases" action
 * that DOES live under Axon/actions, but that's a different shape.
 *
 * Variance: the four `angle` values steer the rhetorical shape
 * (thesis / portfolio / warm intro / generic). The temperature is
 * 0.9 — high enough that regenerate produces different copy but low
 * enough to stay grounded in the input facts.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../Axon/config";
import type { FundraiseSettings } from "@/stores/fundraiseSettings";
import type {
  InvestorDetail,
} from "@/stores/investors";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export type DraftChannel = "email" | "linkedin";

/** The rhetorical angle the operator picks (or that the engine
 *  auto-picks based on what data is available on the investor). */
export type DraftAngle =
  | "thesis"     // open by quoting their thesis back to them
  | "portfolio"  // open by referencing a portfolio company
  | "warm_intro" // we mention a mutual or referrer
  | "generic";   // pitch-led; used when investor profile is thin

export interface DraftInvestorEmailInput {
  /** Loaded investor (with company + partners + activities). */
  investor: InvestorDetail;
  /** The specific partner being contacted (must be one of
   *  investor.partners). For investors with no partner attached yet
   *  the UI should disable the Draft button. */
  partnerId: string;
  /** Operator's saved pitch + signature + defaults. */
  settings: FundraiseSettings | null;
  /** Channel + angle. */
  channel: DraftChannel;
  angle?: DraftAngle;
  /** Optional warm-intro context: "Met at YC office hours via Jane Doe" */
  warmIntroNote?: string;
}

export interface DraftInvestorEmailResult {
  /** Always present for email; empty string for linkedin. */
  subject: string;
  /** The drafted body. Plain text, no markdown except line breaks. */
  body: string;
  /** Which hook the draft opens with — surfaced in the UI sidebar
   *  so the operator can sanity-check ("did Axon actually use my
   *  pitch?" or "is the portfolio reference current?"). */
  hookUsed: string;
  /** The angle Axon actually used (may differ from requested if the
   *  requested angle had no data — e.g. "thesis" with no thesis_md). */
  angle: DraftAngle;
  channel: DraftChannel;
  /** Soft error — UI shows this without crashing. */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "You are Axon, drafting a cold outreach for a pre-seed founder to a venture investor or angel.",
  "",
  "Hard rules:",
  "- 4 to 6 sentences total. No filler. No corporate hedge words.",
  "- Open with a SPECIFIC hook tied to the angle you were given — not a generic compliment.",
  "- One sentence of value prop drawn from the operator's pitch. Quantified if numbers are in the pitch.",
  "- A soft ask: 15 minutes to chat, with the call link if provided.",
  "- Sign off with the operator's signature exactly as supplied. Do not invent signature lines.",
  "- Plain text only. No markdown bold, no bullet points, no emojis.",
  "- Never use the phrases \"I hope this finds you well\", \"reaching out\", \"quick chat\", \"circle back\", \"touch base\", or \"synergy\".",
  "",
  "Voice:",
  "- Founder-to-investor: confident, specific, respectful of their time.",
  "- Sound like a human who did their homework, not a templater.",
  "- Different framings each regenerate — vary openers, sentence rhythm, the verb you use to ask.",
  "",
  "Output format — RETURN ONLY a JSON object with EXACTLY these fields, no preamble, no code fence:",
  '{"subject": "...", "body": "...", "hook_used": "...one sentence describing the hook angle in your own words..."}',
  "",
  "For LinkedIn channel: leave subject empty. Body must be <= 300 characters (LinkedIn's invite limit).",
  "For email channel: subject is a single line, no more than 60 characters, no exclamation marks.",
].join("\n");

// ─────────────────────────────────────────────────────────────────
// Angle resolver — picks the best available angle based on data.
// If the caller specified an angle but we don't have data for it,
// fall back to the next-most-relevant one. We never silently send
// "generic" when the operator explicitly picked "thesis".
// ─────────────────────────────────────────────────────────────────

function resolveAngle(
  inp: DraftInvestorEmailInput,
): { angle: DraftAngle; reason: string } {
  const requested = inp.angle ?? "thesis";
  // InvestorDetail extends InvestorProfile, so thesis_md / portfolio_md
  // live on the top-level object, not under a .profile key.
  const hasThesis = !!inp.investor.thesis_md?.trim();
  const hasPortfolio = !!inp.investor.portfolio_md?.trim();
  const hasWarm = !!inp.warmIntroNote?.trim();

  switch (requested) {
    case "warm_intro":
      if (hasWarm) return { angle: "warm_intro", reason: "warm note provided" };
      // fall through
    case "thesis":
      if (hasThesis) return { angle: "thesis", reason: "thesis present" };
      if (hasPortfolio)
        return { angle: "portfolio", reason: "no thesis, falling back to portfolio" };
      return { angle: "generic", reason: "no thesis or portfolio data" };
    case "portfolio":
      if (hasPortfolio) return { angle: "portfolio", reason: "portfolio present" };
      if (hasThesis)
        return { angle: "thesis", reason: "no portfolio, falling back to thesis" };
      return { angle: "generic", reason: "no portfolio or thesis data" };
    case "generic":
    default:
      return { angle: "generic", reason: "explicitly generic" };
  }
}

// ─────────────────────────────────────────────────────────────────
// Build the user-side prompt body — packs every input the LLM
// needs into a single structured text block.
// ─────────────────────────────────────────────────────────────────

function buildUserPrompt(
  inp: DraftInvestorEmailInput,
  angle: DraftAngle,
): string {
  const { investor, settings, channel, warmIntroNote } = inp;
  const partner = investor.partners.find((p) => p.id === inp.partnerId);
  // InvestorDetail extends InvestorListEntry extends InvestorProfile,
  // so all profile fields (thesis_md, portfolio_md, stage_focus, etc.)
  // are flat on `investor`. We alias to `prof` for readability.
  const prof = investor;
  const lines: string[] = [];

  lines.push(`Channel: ${channel}`);
  lines.push(`Angle: ${angle}`);
  lines.push("");

  // ── Operator context ──
  lines.push("─── OPERATOR (the sender) ───");
  lines.push(`Name: ${settings?.founder_name || "(not set)"}`);
  if (settings?.pitch_md?.trim()) {
    lines.push("Elevator pitch:");
    lines.push(settings.pitch_md.trim());
  } else {
    lines.push(
      "Elevator pitch: (operator hasn't saved one — use a generic 'pre-seed founder' framing)",
    );
  }
  if (settings?.one_pager_md?.trim()) {
    lines.push("One-pager context (use sparingly, only if relevant to angle):");
    lines.push(settings.one_pager_md.trim());
  }
  if (settings?.default_call_link?.trim()) {
    lines.push(`Soft-ask CTA link: ${settings.default_call_link.trim()}`);
  }
  if (settings?.founder_email_signature_md?.trim()) {
    lines.push("Signature (append verbatim at end of body):");
    lines.push(settings.founder_email_signature_md.trim());
  }
  lines.push("");

  // ── Investor + partner ──
  lines.push("─── RECIPIENT ───");
  lines.push(`Partner: ${partner?.name?.trim() || "(unknown — address by firm)"}`);
  if (partner?.title) lines.push(`Title: ${partner.title}`);
  if (partner?.email) lines.push(`Email on file: ${partner.email}`);
  lines.push(`Firm: ${investor.company.name}`);
  if (prof?.hq_location) lines.push(`HQ: ${prof.hq_location}`);
  if (prof?.stage_focus && prof.stage_focus.length > 0) {
    lines.push(`Stage focus: ${prof.stage_focus.join(", ")}`);
  }
  if (prof?.thesis_md?.trim()) {
    lines.push("Thesis (operator's notes on what the firm cares about):");
    lines.push(prof.thesis_md.trim());
  }
  if (prof?.portfolio_md?.trim()) {
    lines.push("Portfolio notes:");
    lines.push(prof.portfolio_md.trim());
  }
  if (warmIntroNote?.trim()) {
    lines.push(`Warm-intro context: ${warmIntroNote.trim()}`);
  }
  lines.push("");

  // ── Final instruction ──
  if (channel === "linkedin") {
    lines.push(
      "Draft a LinkedIn connection-request message. Body MUST be <= 300 characters. Leave subject empty.",
    );
  } else {
    lines.push("Draft the cold email now. Return the JSON object only.");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Main entry — calls Anthropic, parses JSON, returns result.
// ─────────────────────────────────────────────────────────────────

export async function draftInvestorEmail(
  inp: DraftInvestorEmailInput,
): Promise<DraftInvestorEmailResult> {
  const { angle } = resolveAngle(inp);
  const userPrompt = buildUserPrompt(inp, angle);

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 700,
    temperature: 0.9,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: userPrompt }],
      },
    ],
  };

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return emptyResult(angle, inp.channel, `Axon API error: ${err.slice(0, 180)}`);
    }

    const json = (await res.json()) as {
      content: { type: string; text?: string }[];
    };
    const raw = json.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    // Parse the JSON response. The system prompt asks for raw JSON
    // but Claude occasionally wraps it in a ```json fence -- handle
    // both cases.
    const parsed = parseDraftJson(raw);
    if (!parsed) {
      return emptyResult(
        angle,
        inp.channel,
        "Axon returned malformed draft — try regenerating.",
      );
    }

    return {
      subject: inp.channel === "linkedin" ? "" : (parsed.subject ?? "").trim(),
      body: (parsed.body ?? "").trim(),
      hookUsed: (parsed.hook_used ?? "").trim() || `(${angle} angle)`,
      angle,
      channel: inp.channel,
    };
  } catch (err) {
    return emptyResult(
      angle,
      inp.channel,
      err instanceof Error ? err.message : "Network error reaching Axon.",
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function emptyResult(
  angle: DraftAngle,
  channel: DraftChannel,
  error: string,
): DraftInvestorEmailResult {
  return { subject: "", body: "", hookUsed: "", angle, channel, error };
}

function parseDraftJson(
  raw: string,
): { subject?: string; body?: string; hook_used?: string } | null {
  // Strip ```json fences if present.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Find the first { and last } -- be tolerant of stray preamble.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}
