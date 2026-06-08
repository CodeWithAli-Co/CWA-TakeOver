/**
 * discoverInvestors.ts — Axon-driven investor research.
 *
 * The operator types a free-text "vibe" describing what kind of
 * investor they're looking for ("pre-seed AI infra investors who
 * do dev tools, NY/SF"). Axon calls Claude with the web_search
 * tool enabled, finds 8-15 matching firms, and returns a
 * structured list including thesis text, recent portfolio
 * companies, and at least one partner per firm.
 *
 * This is the unstubbing of the "Find with Axon" CTA on the
 * FundraisePage header that's been disabled since Phase 1.
 *
 * Design rules baked into the system prompt:
 *   · Use web_search -- don't rely on training data alone. VC
 *     personnel + thesis text both change fast.
 *   · NEVER invent email addresses. If a partner's email isn't
 *     found verifiably, return email: null and let the operator
 *     enrich manually.
 *   · Only include firms that ACTIVELY write at the operator's
 *     stage range -- A16Z's main fund isn't pre-seed even though
 *     they have a16z Speedrun. Match the stage carefully.
 *   · Ground the output in the operator's saved pitch so the
 *     results are actually relevant ("agent-native software" gets
 *     different firms than "consumer hardware").
 *
 * Cost note: each call uses ~3-5 web searches + one large Claude
 * completion. ~$0.10-0.30 per discover. Acceptable for a few
 * searches per week.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../Axon/config";
import type { FundraiseSettings } from "@/stores/fundraiseSettings";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** A partner found by the discover action. Email is null if Axon
 *  couldn't verify it -- the modal warns the operator to confirm
 *  before sending anything. */
export interface DiscoveredPartner {
  name: string;
  title: string | null;
  email: string | null;
  linkedin: string | null;
}

/** One firm candidate. Everything except firm_name is best-effort
 *  and may be null. */
export interface DiscoveredInvestor {
  firm_name: string;
  website: string | null;
  hq: string | null;
  twitter: string | null;
  thesis: string | null;
  /** Plain-text list of recent portfolio companies, one per line. */
  portfolio: string | null;
  /** Stage focus tags ("pre_seed", "seed", "series_a"). Used to
   *  populate investor_profiles.stage_focus. */
  stage_focus: string[];
  partners: DiscoveredPartner[];
  /** Axon's confidence that this firm matches the operator's vibe,
   *  0-100. Surfaced in the review UI so operators can sort. */
  match_score: number;
  /** One-line explanation of why this firm matched. Surfaced in
   *  the review UI under the firm name. */
  match_reason: string;
}

export interface DiscoverInvestorsInput {
  /** The operator's free-text query. Required. */
  vibe: string;
  /** Operator's saved pitch + cadence -- used to ground the
   *  results in the founder's specifics. Optional but the output
   *  is much better with it. */
  settings: FundraiseSettings | null;
  /** Soft cap on returned firms. Default 12. */
  maxFirms?: number;
}

export interface DiscoverInvestorsResult {
  investors: DiscoveredInvestor[];
  /** Soft error -- UI shows this without crashing. */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "You are Axon, an investor-research assistant for an early-stage founder building their outreach list.",
  "",
  "Your job: given a free-text description of the kind of investor the founder wants to reach, find 8-15 matching firms and return them via the submit_investors tool.",
  "",
  "Workflow:",
  "1. Use the web_search tool to research current firms matching the operator's criteria. Search liberally -- you have up to 5 searches.",
  "2. Once you have enough information, call the submit_investors tool with the structured payload. DO NOT write the result as text; the system only reads it from the tool call.",
  "",
  "Hard rules:",
  "- USE web_search. VC personnel, fund cycles, and thesis text change quickly. Training data alone produces stale or wrong information.",
  "- For each firm, verify (a) the firm is still active and writing checks, (b) they invest at the operator's stage range, (c) the partner you list is currently at the firm.",
  "- NEVER invent partner email addresses. If you cannot find a verified email through web search (firm website, About page, Crunchbase profile, Twitter bio, conference page, etc.), return email: null. A missing email is fine; a wrong email is a disaster.",
  "- Match the operator's STAGE carefully. A pre-seed founder doesn't want Series B firms, even prestigious ones. Read the founder's pitch to infer their actual stage.",
  "- For each firm, find 1-2 partners who specifically do investments at the founder's stage (not the firm's senior partners who only do later rounds).",
  "- Aim for 8-15 firms per call. If the operator's vibe is very narrow and you only find 3-4 strong matches, return those rather than padding with weak matches.",
  "- match_score: 0-100. 80+ = strong fit. 50-79 = decent fit. <50 = leave it out.",
  "- match_reason: ONE sentence in your own voice. Examples: \"Led the seed in Cresta and Decagon, exact thesis fit\" or \"Solo GP doing pre-seed AI infra; recently invested in Modal.\"",
  "- thesis: 1-2 sentences in plain prose summarizing what the firm cares about. Pull from their site / Twitter bios / public statements.",
  "- portfolio: 3-8 recent notable companies, one per line, just names (no descriptions).",
  "- stage_focus: array of canonical tags from this set ONLY: [\"pre_seed\", \"seed\", \"series_a\", \"series_b\", \"angel\"]. Pick the ones that actually apply.",
  "",
  "If you cannot find any matches at all, still call submit_investors with an empty array: {\"investors\": []}.",
].join("\n");

/** JSON Schema for the submit_investors tool. Claude must call this
 *  tool with a payload matching this shape to deliver results back
 *  to us -- way more reliable than asking for JSON in a text block,
 *  especially when web_search is in the mix and Claude's response
 *  ends up being a mix of tool_use + tool_result + narration. */
const SUBMIT_INVESTORS_TOOL = {
  name: "submit_investors",
  description:
    "Submit the list of matching investor firms after your research is complete.",
  input_schema: {
    type: "object",
    properties: {
      investors: {
        type: "array",
        description: "The matching investor firms, 8-15 ideally.",
        items: {
          type: "object",
          properties: {
            firm_name: { type: "string" },
            website: { type: ["string", "null"] },
            hq: { type: ["string", "null"] },
            twitter: { type: ["string", "null"] },
            thesis: { type: ["string", "null"] },
            portfolio: {
              type: ["string", "null"],
              description: "Recent portfolio companies, one per line.",
            },
            stage_focus: {
              type: "array",
              items: {
                type: "string",
                enum: ["pre_seed", "seed", "series_a", "series_b", "angel"],
              },
            },
            partners: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  title: { type: ["string", "null"] },
                  email: {
                    type: ["string", "null"],
                    description:
                      "Set to null if not verifiable. NEVER invent.",
                  },
                  linkedin: { type: ["string", "null"] },
                },
                required: ["name"],
              },
            },
            match_score: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            match_reason: { type: "string" },
          },
          required: [
            "firm_name",
            "partners",
            "match_score",
            "match_reason",
            "stage_focus",
          ],
        },
      },
    },
    required: ["investors"],
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// User prompt builder
// ─────────────────────────────────────────────────────────────────

function buildUserPrompt(inp: DiscoverInvestorsInput): string {
  const lines: string[] = [];
  lines.push("─── OPERATOR CONTEXT ───");
  if (inp.settings?.founder_name) {
    lines.push(`Founder: ${inp.settings.founder_name}`);
  }
  if (inp.settings?.pitch_md?.trim()) {
    lines.push("Pitch:");
    lines.push(inp.settings.pitch_md.trim());
  } else {
    lines.push(
      "Pitch: (not provided -- infer stage from the operator's vibe below)",
    );
  }
  if (inp.settings?.one_pager_md?.trim()) {
    lines.push("One-pager (for stage + check-size signal):");
    lines.push(inp.settings.one_pager_md.trim());
  }
  lines.push("");

  lines.push("─── OPERATOR'S CRITERIA ───");
  lines.push(inp.vibe.trim());
  lines.push("");

  lines.push(
    `Find ${inp.maxFirms ?? 12} matching firms. Use web search liberally. Return the JSON object only.`,
  );

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────────

export async function discoverInvestors(
  inp: DiscoverInvestorsInput,
): Promise<DiscoverInvestorsResult> {
  if (!inp.vibe?.trim()) {
    return {
      investors: [],
      error: "Tell Axon what kind of investor you're looking for.",
    };
  }

  const userPrompt = buildUserPrompt(inp);

  const body = {
    model: CLAUDE_MODEL,
    // Discovery payloads are LARGE -- 8-15 firms with thesis +
    // portfolio + partners + tool-use overhead. Give Claude
    // plenty of room so we don't truncate mid-firm.
    max_tokens: 8000,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    // Two tools:
    //   1. web_search -- Anthropic's native tool for current info.
    //      Cap at 5 uses per call.
    //   2. submit_investors -- our custom tool with a JSON schema
    //      Claude must conform to. This is how we get reliable
    //      structured output. Without it, Claude often returns
    //      JSON wrapped in narration/code-fences that breaks naive
    //      parsing.
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
      SUBMIT_INVESTORS_TOOL,
    ],
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
      return {
        investors: [],
        error: `Axon API error: ${err.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as {
      stop_reason?: string;
      content: Array<
        | { type: "text"; text?: string }
        | { type: "tool_use"; name?: string; input?: any }
        | { type: string; [k: string]: any }
      >;
    };

    // Preferred path: pull the structured payload from the
    // submit_investors tool_use block. Claude is required by the
    // tool schema to put the result here.
    const submit = json.content.find(
      (b: any) => b.type === "tool_use" && b.name === "submit_investors",
    ) as { input?: { investors?: any[] } } | undefined;

    let parsed: { investors?: any[] } | null = submit?.input ?? null;

    // Fallback path: if Claude returned JSON in text (rare, but
    // possible if tool-use was rejected or the model decided to
    // narrate instead), try the old parser. This keeps the
    // happy-path fast and the fallback safe.
    if (!parsed) {
      const finalText = json.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text ?? "")
        .join("")
        .trim();
      parsed = parseDiscoverJson(finalText);

      // If parsing still fails, log everything we got back so the
      // operator can grab the console output and we can debug
      // without guessing. Keeping this as a console.error (not
      // throw) so the modal still shows the friendly error.
      if (!parsed) {
        // eslint-disable-next-line no-console
        console.error(
          "[discoverInvestors] Failed to parse Anthropic response.",
          { stop_reason: json.stop_reason, content: json.content },
        );
        return {
          investors: [],
          error:
            "Axon returned malformed results. Try rephrasing your search or try again. (Check the browser console for diagnostic info.)",
        };
      }
    }

    // Filter + normalize. Drop anything below match_score 50 since
    // those are low-confidence matches that just waste the
    // operator's time.
    const investors = (parsed.investors ?? [])
      .filter((i: any) => i && i.firm_name && (i.match_score ?? 0) >= 50)
      .map(normalizeCandidate)
      .sort((a: DiscoveredInvestor, b: DiscoveredInvestor) =>
        b.match_score - a.match_score,
      );

    return { investors };
  } catch (err) {
    return {
      investors: [],
      error:
        err instanceof Error ? err.message : "Network error reaching Axon.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function parseDiscoverJson(
  raw: string,
): { investors?: any[] } | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Tighten + sanity-check a single candidate. Defaults nullable
 *  fields, clamps match_score, dedupes partners. */
function normalizeCandidate(c: any): DiscoveredInvestor {
  const stageFocus = Array.isArray(c.stage_focus)
    ? c.stage_focus.filter(
        (s: any) =>
          typeof s === "string" &&
          ["pre_seed", "seed", "series_a", "series_b", "angel"].includes(s),
      )
    : [];

  const rawPartners = Array.isArray(c.partners) ? c.partners : [];
  const partners: DiscoveredPartner[] = rawPartners
    .filter((p: any) => p && p.name)
    .map((p: any) => ({
      name: String(p.name).trim(),
      title: p.title ? String(p.title).trim() : null,
      // Email validation: must look like an email AND not be a generic
      // catch-all like "info@" or "hello@" which Axon sometimes returns
      // when it didn't actually find a real address.
      email: isLikelyRealEmail(p.email) ? String(p.email).trim() : null,
      linkedin: p.linkedin ? String(p.linkedin).trim() : null,
    }))
    .slice(0, 3); // cap at 3 partners per firm

  return {
    firm_name: String(c.firm_name).trim(),
    website: c.website ? String(c.website).trim() : null,
    hq: c.hq ? String(c.hq).trim() : null,
    twitter: c.twitter ? String(c.twitter).trim() : null,
    thesis: c.thesis ? String(c.thesis).trim() : null,
    portfolio: c.portfolio ? String(c.portfolio).trim() : null,
    stage_focus: stageFocus,
    partners,
    match_score: Math.max(0, Math.min(100, Number(c.match_score) || 0)),
    match_reason: c.match_reason ? String(c.match_reason).trim() : "",
  };
}

/** Defensive: reject generic / suspicious email patterns even if
 *  Axon returned them. Better to leave email blank than to send to
 *  info@ or a hallucinated address. */
function isLikelyRealEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  if (!e) return false;
  // Basic shape check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  // Reject generic mailboxes -- if Axon couldn't find a real
  // partner address it sometimes falls back to these.
  const localPart = e.split("@")[0]!;
  const genericMailboxes = [
    "info",
    "hello",
    "contact",
    "team",
    "press",
    "support",
    "admin",
    "noreply",
    "no-reply",
    "office",
  ];
  if (genericMailboxes.includes(localPart)) return false;
  return true;
}
