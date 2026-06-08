/**
 * discoverPartnerEmail.ts — Axon-driven email lookup for a single
 * VC partner.
 *
 * Used by the Fundraise module's "Find with Axon" button as a
 * higher-confidence pass before falling back to pattern guessing.
 *
 * What it does:
 *   - Asks Claude to web-search for the partner's verifiable email
 *     across firm About pages, podcast transcripts, conference
 *     speaker bios, Crunchbase, Substack reply-to fields, X bios,
 *     newsletter footers, etc.
 *   - Returns { email, source_url } when Claude finds a strong
 *     signal, or { email: null } when nothing verifiable shows up.
 *
 * What it explicitly does NOT do:
 *   - Invent emails. The prompt is hard-coded against fabrication.
 *     A null result here means "nothing found, fall back to
 *     patterns" — which is exactly what the caller wants.
 *
 * Why it's not in the takeover-B2B proxy:
 *   - The desktop already calls Anthropic directly (same pattern
 *     used by discoverInvestors). Going through the proxy would
 *     add a round-trip and need the proxy to hold ANTHROPIC_API_KEY,
 *     which it doesn't today.
 *
 * Cost note: one Claude call with ~2 web searches. ~$0.02-0.05 per
 * lookup. Worth it for a verified email vs. burning 3-5 cold sends
 * on pattern guesses.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../Axon/config";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

export interface DiscoveredPartnerEmail {
  /** The verified email, or null if nothing strong was found. */
  email: string | null;
  /** Where Claude found it — for the verified-badge tooltip. */
  source_url: string | null;
  /** Short label like "Conviction Partners team page" or
   *  "Acquired podcast guest bio" — shown in the UI as the source
   *  pill. */
  source_label: string | null;
  /** Claude's own confidence, 0-100. We map to UI confidence
   *  separately (verified emails are pinned at 95 regardless). */
  confidence: number;
  /** Optional human-readable note when no email was found — surfaces
   *  in DevTools logging, never user-facing. */
  note?: string;
}

export interface DiscoverPartnerEmailInput {
  partner_name: string;
  firm_name: string;
  /** Bare domain like "conviction.com" — gives Claude a strong
   *  signal about which domain the email should be on. */
  firm_domain: string;
}

// ─────────────────────────────────────────────────────────────────
// System prompt — hard rules against fabrication.
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "You are Axon, helping an early-stage founder find verified email addresses for VC partners they want to cold-email.",
  "",
  "Your job: given a partner's name + their firm's name + the firm's domain, use web_search to find a verifiable email address for that partner. Then call the submit_email tool with the result.",
  "",
  "Workflow:",
  "1. Use web_search to look for the partner's email. Try multiple angles:",
  "   - Search '<partner name> <firm name> email'",
  "   - Search '<partner name> contact' to find personal site / Substack / newsletter signatures",
  "   - Search the firm's About / Team / Contact page",
  "   - Search podcast or conference appearances — speaker bios often include emails",
  "   - Search Crunchbase, AngelList, Signal profiles",
  "   - Search X/Twitter bios, sometimes emails live there for accessible GPs",
  "2. You have up to 3 searches. Don't waste them on repeats.",
  "3. When you have a verified result (OR decided there isn't one), call submit_email.",
  "",
  "Hard rules:",
  "- NEVER fabricate an email. If you cannot find a real, sourced email, return { email: null, note: '<why>' }. A null result is the correct answer — the caller has a pattern-based fallback for that case.",
  "- The email must be on the firm's domain (or a strongly-affiliated personal domain — e.g. some solo GPs use a personal site). If you find 'partner@gmail.com' that's almost certainly wrong; return null.",
  "- The source_url must be a real URL you actually saw in search results, not a guess.",
  "- The source_label must describe what the page is, not where you searched. Good: 'Conviction Partners team page'. Bad: 'web_search result 1'.",
  "- Confidence guidance: 90+ for a clear bio with the email inline; 70-89 for indirect signal (e.g. firm-wide contact pattern shown elsewhere); below 70 — return null instead.",
  "- If the partner appears to have left the firm or doesn't seem real, return null with a note.",
].join("\n");

// ─────────────────────────────────────────────────────────────────
// Tool schema — single structured-output tool.
// ─────────────────────────────────────────────────────────────────

const SUBMIT_EMAIL_TOOL = {
  name: "submit_email",
  description:
    "Submit the verified email lookup result. Call this once you've finished web research.",
  input_schema: {
    type: "object",
    properties: {
      email: {
        type: ["string", "null"],
        description:
          "The verified email. NULL if no verifiable email found — never fabricate.",
      },
      source_url: {
        type: ["string", "null"],
        description:
          "URL of the page where the email was confirmed. NULL when email is null.",
      },
      source_label: {
        type: ["string", "null"],
        description:
          "Short label for the source, e.g. 'Conviction team page' or 'Acquired podcast guest bio'.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description:
          "Your confidence in the result, 0-100. Return null email when confidence would be <70.",
      },
      note: {
        type: ["string", "null"],
        description:
          "Optional one-line explanation, mostly useful when email is null.",
      },
    },
    required: ["email", "confidence"],
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────────

export async function discoverPartnerEmail(
  inp: DiscoverPartnerEmailInput,
): Promise<DiscoveredPartnerEmail> {
  // Guard rails — caller should already have validated, but a
  // missing API key would otherwise show up as an opaque 401.
  if (!ANTHROPIC_API_KEY) {
    return {
      email: null,
      source_url: null,
      source_label: null,
      confidence: 0,
      note: "VITE_ANTHROPIC_API_KEY not configured.",
    };
  }
  if (!inp.partner_name?.trim() || !inp.firm_domain?.trim()) {
    return {
      email: null,
      source_url: null,
      source_label: null,
      confidence: 0,
      note: "Missing partner_name or firm_domain.",
    };
  }

  const userPrompt = [
    "Find the verified email for this partner:",
    `  Name: ${inp.partner_name}`,
    `  Firm: ${inp.firm_name || "(unknown firm name)"}`,
    `  Domain: ${inp.firm_domain}`,
    "",
    "Use web_search up to 3 times. Then call submit_email with the result. Return null email if you can't find a verified one — never invent.",
  ].join("\n");

  const body = {
    model: CLAUDE_MODEL,
    // Headroom for Claude's web_search tool_result blocks (each
    // search returns ~500-1500 tokens of snippets that get folded
    // into the model's context window AND counted against max_tokens
    // since they're emitted as response content). 4000 covers 3
    // searches + final submit_email comfortably.
    max_tokens: 4000,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
      SUBMIT_EMAIL_TOOL,
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
        email: null,
        source_url: null,
        source_label: null,
        confidence: 0,
        note: `Axon API error: ${err.slice(0, 200)}`,
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

    // Pull the submit_email tool_use block.
    const submit = json.content.find(
      (b: any) => b.type === "tool_use" && b.name === "submit_email",
    ) as { input?: any } | undefined;

    if (!submit?.input) {
      return {
        email: null,
        source_url: null,
        source_label: null,
        confidence: 0,
        note: "Axon didn't return a structured result.",
      };
    }

    const parsed = submit.input as {
      email?: string | null;
      source_url?: string | null;
      source_label?: string | null;
      confidence?: number;
      note?: string | null;
    };

    // Defensive checks — even with the schema, paranoia about
    // hallucinated emails. Reject obvious nonsense.
    let email = parsed.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      email = null;
    }
    // Reject if email is on a generic free-mail domain — almost
    // certainly fabricated, the partner doesn't use gmail for VC work.
    if (
      email &&
      /@(gmail|hotmail|yahoo|outlook|icloud|protonmail)\./i.test(email)
    ) {
      email = null;
    }

    return {
      email,
      source_url: parsed.source_url?.trim() || null,
      source_label: parsed.source_label?.trim() || null,
      confidence: Math.max(0, Math.min(100, parsed.confidence ?? 0)),
      note: parsed.note?.trim() || undefined,
    };
  } catch (err) {
    return {
      email: null,
      source_url: null,
      source_label: null,
      confidence: 0,
      note: err instanceof Error ? err.message : "Network error.",
    };
  }
}
