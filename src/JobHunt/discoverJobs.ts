/**
 * discoverJobs.ts — Axon-driven job search (mirrors discoverInvestors.ts).
 *
 * The operator describes the roles they want in free text ("remote senior
 * React/TS roles, $130k+, fintech or dev-tools, US"). Axon calls Claude with
 * the web_search tool, finds matching CURRENT postings, and returns them via a
 * submit_jobs tool so we get reliable structured output.
 *
 * NOTE: calls Anthropic directly with the bundled key, like the rest of the app
 * (see Observatory finding f-anthropic-client-direct). Route via takeover_b2b
 * once the proxy exists.
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export interface JobPosting {
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  salary: string | null;
  url: string | null;
  summary: string | null;
  requirements: string[];
  match_score: number;   // 0-100 vs the operator's resume + query
  match_reason: string;
}
export interface DiscoverJobsInput { query: string; resume?: string | null; maxJobs?: number }
export interface DiscoverJobsResult { jobs: JobPosting[]; error?: string }

const SYSTEM_PROMPT = [
  "You are Axon, a job-search assistant helping a candidate find roles they can apply to today.",
  "",
  "Given a free-text description of the roles they want (and optionally their resume), find 8-15 CURRENTLY-OPEN postings and return them via the submit_jobs tool.",
  "",
  "Workflow:",
  "1. Use the web_search tool to find real, current openings (company career pages, Greenhouse/Lever/Ashby boards, LinkedIn/Indeed result pages, Remotive, etc.). Search liberally — up to 6 searches.",
  "2. Then call submit_jobs with the structured payload. Do NOT write the result as prose; the system only reads the tool call.",
  "",
  "Hard rules:",
  "- USE web_search. Listings change fast; training data is stale.",
  "- NEVER invent a posting or a URL. If you can't find a real application URL, set url: null. A wrong URL wastes the candidate's time.",
  "- Prefer roles the candidate is actually competitive for, based on their resume. Match seniority honestly.",
  "- requirements: 3-6 short bullet phrases of the key must-haves from the posting (skills/years/stack).",
  "- match_score 0-100 vs the candidate's resume+query. 80+ strong, 50-79 decent, <50 leave out.",
  "- match_reason: ONE sentence, your voice, e.g. \"Exact React/TS + fintech fit, fully remote, posted this week.\"",
  "- salary: a string if stated ($ range), else null. location: city/region or 'Remote'.",
  "",
  "If you find nothing, still call submit_jobs with {\"jobs\": []}.",
].join("\n");

const SUBMIT_JOBS_TOOL = {
  name: "submit_jobs",
  description: "Submit the matching job postings after your research is complete.",
  input_schema: {
    type: "object",
    properties: {
      jobs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            title: { type: "string" },
            location: { type: ["string", "null"] },
            remote: { type: "boolean" },
            salary: { type: ["string", "null"] },
            url: { type: ["string", "null"], description: "Real application URL or null. Never invent." },
            summary: { type: ["string", "null"] },
            requirements: { type: "array", items: { type: "string" } },
            match_score: { type: "number", minimum: 0, maximum: 100 },
            match_reason: { type: "string" },
          },
          required: ["company", "title", "match_score", "match_reason", "requirements", "remote"],
        },
      },
    },
    required: ["jobs"],
  },
} as const;

export async function discoverJobs(inp: DiscoverJobsInput): Promise<DiscoverJobsResult> {
  if (!inp.query?.trim()) return { jobs: [], error: "Describe the roles you're looking for." };
  if (!ANTHROPIC_API_KEY) return { jobs: [], error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY and restart." };

  const userPrompt = [
    `Roles wanted: ${inp.query.trim()}`,
    inp.resume?.trim() ? `\nCandidate resume (ground matches in this):\n${inp.resume.trim().slice(0, 6000)}` : "",
    `\nFind ${inp.maxJobs ?? 12} current openings. Use web search liberally, then call submit_jobs.`,
  ].join("\n");

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }, SUBMIT_JOBS_TOOL],
    messages: [{ role: "user" as const, content: [{ type: "text" as const, text: userPrompt }] }],
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
    if (!res.ok) return { jobs: [], error: `Axon API error: ${(await res.text().catch(() => res.statusText)).slice(0, 200)}` };
    const json = (await res.json()) as { content: any[] };
    const submit = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_jobs") as { input?: { jobs?: any[] } } | undefined;
    const raw = submit?.input?.jobs ?? [];
    const jobs: JobPosting[] = raw
      .filter((j: any) => j && j.company && j.title && (j.match_score ?? 0) >= 50)
      .map((j: any) => ({
        company: String(j.company),
        title: String(j.title),
        location: j.location ?? null,
        remote: !!j.remote,
        salary: j.salary ?? null,
        url: j.url ?? null,
        summary: j.summary ?? null,
        requirements: Array.isArray(j.requirements) ? j.requirements.map(String) : [],
        match_score: Math.max(0, Math.min(100, Math.round(j.match_score ?? 0))),
        match_reason: String(j.match_reason ?? ""),
      }))
      .sort((a, b) => b.match_score - a.match_score);
    return { jobs };
  } catch (e: any) {
    return { jobs: [], error: e?.message || "Discovery failed." };
  }
}
