/**
 * findRecruiterEmail.ts — Claude web_search to find a verifiable recruiter /
 * talent / careers email for a specific role+company. Mirrors the Fundraise
 * discoverPartnerEmail pattern: never invents — returns null with a note when
 * nothing is verifiable, so the UI degrades to "type it manually".
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export interface RecruiterEmailResult {
  email: string | null;
  name?: string | null;
  title?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  note?: string;
  error?: string;
}
export interface FindRecruiterEmailInput { company: string; title: string }

const SYSTEM_PROMPT = [
  "You find a verifiable contact email a candidate can use to apply to a specific role.",
  "",
  "Workflow:",
  "1. Use web_search (up to 4 searches) to find an email. Try, in priority order:",
  "   a) a specific recruiter / talent / hiring-manager email for the company (LinkedIn, team page, posts),",
  "   b) the company's general careers/recruiting inbox (careers@, jobs@, recruiting@, talent@) IF confirmed on their own site,",
  "   c) otherwise nothing.",
  "2. Then call submit_email with the result.",
  "",
  "Hard rules:",
  "- NEVER fabricate or pattern-guess an email. If you can't find a real, sourced address, return { email: null, note: '<why / where to look>' }. Null is the correct answer.",
  "- source_label describes the page ('Acme careers page', 'Recruiter's LinkedIn'), not the search.",
  "- Prefer a named recruiter when verifiable; a confirmed careers inbox is an acceptable fallback.",
].join("\n");

const SUBMIT_TOOL = {
  name: "submit_email",
  description: "Submit the verified email (or null).",
  input_schema: {
    type: "object",
    properties: {
      email: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      title: { type: ["string", "null"] },
      source_label: { type: ["string", "null"] },
      source_url: { type: ["string", "null"] },
      note: { type: ["string", "null"] },
    },
    required: ["email"],
  },
} as const;

export async function findRecruiterEmail(inp: FindRecruiterEmailInput): Promise<RecruiterEmailResult> {
  if (!ANTHROPIC_API_KEY) return { email: null, error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY." };
  const userPrompt = `Find an email to apply for "${inp.title}" at "${inp.company}". Use web_search, then call submit_email. Return null if nothing verifiable.`;
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 2500, temperature: 0.2,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }, SUBMIT_TOOL],
        messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      }),
    });
    if (!res.ok) return { email: null, error: `Anthropic ${res.status}` };
    const json = (await res.json()) as { content: any[] };
    const t = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_email") as { input?: any } | undefined;
    const o = t?.input;
    if (!o) return { email: null, note: "No result returned. Try the company site or LinkedIn." };
    const email = typeof o.email === "string" && o.email.includes("@") ? o.email.trim() : null;
    return { email, name: o.name ?? null, title: o.title ?? null, source_label: o.source_label ?? null, source_url: o.source_url ?? null, note: o.note ?? undefined };
  } catch (e: any) {
    return { email: null, error: e?.message || "Lookup failed." };
  }
}
