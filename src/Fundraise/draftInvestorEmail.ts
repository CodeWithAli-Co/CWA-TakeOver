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

/** Phase 4: cold vs follow-up. Follow-ups have a different rhetorical
 *  shape (shorter, references prior outreach, escalates slightly with
 *  each nudge) so we steer the LLM with a different system prompt. */
export type DraftMode = "cold" | "followup_1" | "followup_2" | "followup_3";

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
  /** Phase 4. Cold = full pitch with hook + value prop. Follow-up
   *  modes shorten the draft and reference prior outreach. If not
   *  passed, defaults to "cold". The DraftEmailModal infers this
   *  from the investor's followup_count for the operator. */
  mode?: DraftMode;
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
  /** Phase 4: the mode this draft was produced under. Returned so
   *  the UI can label the modal "cold" vs "follow-up #N". */
  mode: DraftMode;
  /** Soft error — UI shows this without crashing. */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────

/** Cold-email system prompt -- used for the initial outreach.
 *
 *  Single-style outreach. No angle conditioning. Every draft must:
 *    1. Name the company from pitch_md (Takeover-like name)
 *    2. Briefly describe what the runtime (AXON-like) actually does
 *    3. Include one credibility marker from pitch_md
 *    4. Include the website URL on its own line
 *    5. Include the call link (calendly) on its own line
 *    6. Append the signature verbatim
 *
 *  Variance comes from sentence rhythm + opener verb + how the
 *  product is framed, NOT from picking different hooks per call.
 */
const SYSTEM_PROMPT = [
  "You are Axon, drafting a cold outreach from a founder to a venture investor.",
  "",
  "POSITIONING:",
  "The founder is sharing what they're building with someone who'd find it interesting. Not pitching, not begging, not flattering. Sly, confident, slightly aloof. The investor should feel trusted with information, not sold to.",
  "",
  "MANDATORY CONTENT -- every draft MUST include all of these:",
  "1. The company name (pull it from the operator's pitch text; the first proper noun is usually it). NEVER write 'no pitch deck yet' or 'no company name locked down' -- if the pitch text is empty, write 'Skipping the pitch -- pitch text not configured. Add it in Fundraise Settings before regenerating.' and stop.",
  "2. A one-sentence taste of what the product / runtime actually does. Specific verbs (takes action, executes, runs, handles) -- not vague ones (helps, assists, enables).",
  "2b. CRITICAL — LAND THE ARCHITECTURAL INSIGHT. Don't just list the domains the runtime touches (bookkeeping / hiring / ops / etc.) as if you're naming features. Name WHY this shape is different from the alternatives the investor already sees. If the pitch text describes an integration layer (e.g. 'pulls every SaaS into one workspace'), say that. If it describes a voice agent that trains on the operator's own data, say that. If it describes execution-without-leaving-the-app (no context switching), say that. Pick the strongest 1-2 of those architectural facts and put them in para 1 alongside the verb taste. A list of verbs without the insight reads like a feature spec; the insight is what makes a VC lean in.",
  "3. ONE credibility marker pulled from the pitch -- a number, a paying-customer count, a traction signal, or the self-funding story if mentioned. Whichever lands hardest.",
  "4. The website URL on its own line (pull from the signature -- it's usually there).",
  "5. The call link on its own line (a calendly URL, also usually in the signature). The body's ask should reference 'a quick look' or 'walk through it live' so the link reads as the natural next step.",
  "6. The operator's signature verbatim at the end.",
  "",
  "STRUCTURE (target ~5 sentences, hard cap 7):",
  "Para 1 (2-3 sentences): company name + what it does + the credibility marker. Tight prose, no setup.",
  "Para 2 (1 sentence): optional implicit thread to the investor's thesis or one portfolio company if their thesis/portfolio is available. Phrasing like 'sits in the same lane as [portfolio co]' or 'feels adjacent to your bet on X'. SKIP this paragraph entirely if the investor has no thesis/portfolio text on file -- don't manufacture a reference.",
  "Para 3 (the ask, 1 sentence): a soft action like 'Want a quick look?' or 'Worth 15 min?' or 'Happy to walk you through it live.'",
  "",
  "Then on separate lines:",
  "[website URL]",
  "[call link URL]",
  "",
  "Then the signature verbatim.",
  "",
  "HARD NO LIST:",
  "- Flattery of any kind ('your early bet on X tells me...', 'your work has been remarkable')",
  "- Explaining the investor to themselves",
  "- The phrases: 'I hope this finds you well', 'reaching out', 'circle back', 'touch base', 'synergy', 'would you be open to', 'happy to chat', \"if it's of interest\", 'constructing', 'transformative', 'cutting-edge', 'game-changing'",
  "- (Note: \"I'd love\", \"I'd value\", and 'I'm a pre-seed founder' are now ALLOWED -- the warm voice needs them. Use them sparingly and only when genuine.)",
  "- Adverbs like 'deeply', 'truly', 'extremely', 'incredibly'",
  "- Multiple portfolio references in one sentence",
  "- Multiple metrics piled together",
  "- Markdown, bullets, bold, or emojis",
  "- Saying you have 'no pitch' or 'no name' -- if the pitch is empty, follow rule 1's escape hatch",
  "",
  "GOOD example (insight-led, for a hypothetical company Takeover, sending to Amplify partner Lenny Pruss):",
  "Hi Lenny,",
  "",
  "I'm Ali, the founder of Takeover. We're a pre-seed team building an AI SaaS integrator — one workspace that pulls every tool a company already pays for (Stripe, Gmail, HubSpot, Notion, GitHub, etc.) into a single UI, and adds Axon: a voice agent that trains on that data and runs workflows across all those tools without the operator ever leaving Takeover. 47 production action categories live; we've been running it on our profitable sister co CodeWithAli for three years, no outside capital yet.",
  "",
  "Sits in the same lane as your bet on Modal — infra-first execution, not a chat wrapper.",
  "",
  "Your thesis on infrastructure-first dev tools is exactly the kind of operator we want at the table. Worth 15 min?",
  "",
  "https://takeover.systems",
  "https://calendly.com/takeoverbusiness/takeover-meeting",
  "",
  "— Ali Alibrahimi",
  "Founder, Takeover",
  "",
  "BAD example (NEVER write this):",
  "Building something early-stage in developer infrastructure -- no pitch deck yet, just a working system and a handful of engineers using it daily. Sits in the same lane as Modal. Worth 15 min?",
  "WHY it fails: no company name, no description of the product, says 'no pitch yet' (gives up instead of using the pitch text), no website, no calendly. Reads like the founder is hiding what they're building.",
  "",
  "SUBJECT LINE rules:",
  "- A single fragment, lowercase OK.",
  "- Should hint at the company + what it is. Examples: 'takeover -- agent runtime', 'agent runtime for ops teams', 'takeover / native-desktop AI runtime'",
  "- NEVER 'Exploring synergies', 'Reaching out', 'Connecting on...', 'Quick intro', 'Following up'",
  "- 60 characters or less, no exclamation marks.",
  "",
  "VARIANCE: each regenerate should produce visibly different prose. Vary opener verb (Building / Working on / Shipping), which credibility marker leads, the ask phrasing. Do not produce variations of the same sentence.",
  "",
  "Output format — RETURN ONLY a JSON object with EXACTLY these fields, no preamble, no code fence:",
  '{"subject": "...", "body": "...", "hook_used": "...one sentence describing what you led with..."}',
  "",
  "For LinkedIn channel: leave subject empty. Body must be <= 300 characters (LinkedIn's invite limit). Same voice rules apply -- you'll have to compress, but still name the company and include the calendly.",
].join("\n");

/** Follow-up system prompt -- used for nudges after a cold email.
 *  Shorter, references prior outreach, escalates slightly per nudge
 *  but never gets pushy. The {nudgeNumber} placeholder is filled in
 *  per call so the same template covers 1st/2nd/3rd follow-ups. */
const FOLLOWUP_SYSTEM_PROMPT = [
  "You are Axon, drafting a brief follow-up email from a pre-seed founder to a venture investor or angel.",
  "",
  "This is FOLLOW-UP #{nudgeNumber} of at most 3. You are NOT writing a cold pitch -- the prior outreach already covered the elevator pitch + value prop.",
  "",
  "Hard rules:",
  "- 2 to 3 sentences total. No filler. Brevity is respect for their time.",
  "- Reference the prior outreach naturally (\"following up on my note from {N} days ago\", \"wanted to bump this up\", etc.). Vary the phrasing across regenerates.",
  "- Add ONE new piece of useful information if the prior outreach + thesis support it: a metric update, a portfolio company you re-read, a relevant news item. If nothing new to add, keep it to the bump alone.",
  "- The soft ask is the same as before: 15 min to chat with the call link if provided. Don't repeat the pitch.",
  "- Sign off with the operator's signature exactly as supplied.",
  "- Plain text only. No markdown bold, no bullet points, no emojis.",
  "- Never use the phrases \"I hope this finds you well\", \"reaching out\", \"quick chat\", \"circle back\", \"touch base\", \"synergy\", or \"just checking in\".",
  "",
  "Tone calibration by nudge number:",
  "- #1 (3 days after cold): conversational, low-pressure. \"Wanted to bump this up in case it got buried.\"",
  "- #2 (7 days after #1): slightly more direct, but still warm. \"Following up once more -- happy to send the deck if it's easier than the pitch.\"",
  "- #3 (14 days after #2): final, graceful. \"Last note from me. If now's not the right time, no worries -- I'll stop pestering.\"",
  "",
  "Output format -- RETURN ONLY a JSON object with EXACTLY these fields, no preamble, no code fence:",
  '{"subject": "Re: ...", "body": "...", "hook_used": "...one sentence describing why this nudge in your own words..."}',
  "",
  "For email: subject should be \"Re: \" + the original subject if known, otherwise a short follow-up subject. No exclamation marks.",
  "For LinkedIn: leave subject empty. Body <= 300 chars.",
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
  const { investor, settings, channel, warmIntroNote, mode = "cold" } = inp;
  const partner = investor.partners.find((p) => p.id === inp.partnerId);
  // InvestorDetail extends InvestorListEntry extends InvestorProfile,
  // so all profile fields (thesis_md, portfolio_md, stage_focus, etc.)
  // are flat on `investor`. We alias to `prof` for readability.
  const prof = investor;
  const lines: string[] = [];

  lines.push(`Channel: ${channel}`);
  lines.push(`Angle: ${angle}`);
  lines.push(`Mode: ${mode}`);
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

  // ── Prior outreach (follow-up mode only) ──
  // The follow-up system prompt needs to know what was already
  // said so it doesn't repeat itself. Pull the last few outbound
  // emails from the activity log.
  if (mode !== "cold") {
    const priorEmails = investor.activities
      .filter((a) => a.type === "email")
      .slice(0, 4); // most-recent first
    if (priorEmails.length > 0) {
      lines.push("─── PRIOR OUTREACH (most recent first) ───");
      for (const a of priorEmails) {
        const direction =
          (a.metadata as any)?.direction === "inbound" ? "FROM THEM" : "FROM US";
        const date = new Date(a.happened_at ?? a.created_at)
          .toISOString()
          .slice(0, 10);
        lines.push(`[${date}, ${direction}] ${a.title ?? "(no subject)"}`);
        if (a.body_md) {
          lines.push(a.body_md.slice(0, 400));
        }
        lines.push("");
      }
      // Days since last outbound, for the natural "following up
      // on my note from N days ago" phrasing.
      const lastOutbound = priorEmails.find(
        (a) => (a.metadata as any)?.direction !== "inbound",
      );
      if (lastOutbound) {
        const days = Math.max(
          1,
          Math.floor(
            (Date.now() -
              new Date(
                lastOutbound.happened_at ?? lastOutbound.created_at,
              ).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        );
        lines.push(`Days since last outbound email: ${days}`);
        lines.push("");
      }
    }
  }

  // ── Final instruction ──
  if (channel === "linkedin") {
    lines.push(
      mode === "cold"
        ? "Draft a LinkedIn connection-request message. Body MUST be <= 300 characters. Leave subject empty."
        : "Draft a brief LinkedIn follow-up message. Body MUST be <= 300 characters. Leave subject empty.",
    );
  } else if (mode === "cold") {
    lines.push("Draft the cold email now. Return the JSON object only.");
  } else {
    lines.push("Draft the follow-up email now. Return the JSON object only.");
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
  const mode: DraftMode = inp.mode ?? "cold";

  // Pick the right system prompt for cold vs follow-up. Follow-ups
  // use a different rhetorical shape (shorter, references prior
  // outreach, escalating tone). The {nudgeNumber} placeholder is
  // filled in here so the same template covers #1, #2, #3.
  const nudgeNumber =
    mode === "followup_1"
      ? 1
      : mode === "followup_2"
        ? 2
        : mode === "followup_3"
          ? 3
          : 0;
  const systemPrompt =
    mode === "cold"
      ? SYSTEM_PROMPT
      : FOLLOWUP_SYSTEM_PROMPT.replace("{nudgeNumber}", String(nudgeNumber));

  const body = {
    model: CLAUDE_MODEL,
    // Follow-ups are shorter; smaller budget keeps responses tight.
    max_tokens: mode === "cold" ? 700 : 400,
    temperature: 0.9,
    system: systemPrompt,
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
      return emptyResult(angle, inp.channel, `Axon API error: ${err.slice(0, 180)}`, mode);
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
      mode,
    };
  } catch (err) {
    return emptyResult(
      angle,
      inp.channel,
      err instanceof Error ? err.message : "Network error reaching Axon.",
      mode,
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
  mode: DraftMode = "cold",
): DraftInvestorEmailResult {
  return { subject: "", body: "", hookUsed: "", angle, channel, mode, error };
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
