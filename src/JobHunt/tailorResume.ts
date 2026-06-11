/**
 * tailorResume.ts — tailor the candidate's master resume to a specific posting.
 * Returns an ATS-keyword-matched resume, a cover letter, a skills-gap list, and
 * a match score, via a submit_tailored tool for reliable structured output.
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export interface TailorInput {
  resume: string;
  job: { company: string; title: string; summary?: string | null; requirements?: string[] };
}
export interface TailorResult {
  tailored_resume: string;   // markdown
  cover_letter: string;      // markdown
  gaps: string[];            // requirements the resume doesn't clearly meet
  keywords: string[];        // ATS keywords pulled from the posting worth including
  match_score: number;       // 0-100 fit
  error?: string;
}

const SYSTEM_PROMPT = [
  "You are an expert technical recruiter + resume writer. Tailor a candidate's resume to ONE specific job and write a matching cover letter.",
  "",
  "Rules:",
  "- Work ONLY from facts in the candidate's resume. NEVER fabricate experience, titles, dates, or skills they don't have. Reframe and reorder; don't invent.",
  "- tailored_resume: a full resume in markdown, reordered/rewritten so the most relevant experience leads, mirroring the posting's language and ATS keywords where TRUTHFUL.",
  "- cover_letter: 3 short paragraphs, specific to this company/role, grounded in the resume. No clichés.",
  "- gaps: requirements the posting wants that the resume does NOT clearly show. Be honest — this is for the candidate's eyes.",
  "- keywords: ATS keywords from the posting worth weaving in (only ones the candidate can truthfully claim).",
  "- match_score 0-100: honest fit of THIS resume to THIS role.",
  "Return everything via the submit_tailored tool. Do not write prose outside the tool call.",
].join("\n");

const SUBMIT_TOOL = {
  name: "submit_tailored",
  description: "Submit the tailored resume, cover letter, gaps, keywords, and match score.",
  input_schema: {
    type: "object",
    properties: {
      tailored_resume: { type: "string" },
      cover_letter: { type: "string" },
      gaps: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
      match_score: { type: "number", minimum: 0, maximum: 100 },
    },
    required: ["tailored_resume", "cover_letter", "gaps", "keywords", "match_score"],
  },
} as const;

export async function tailorResume(inp: TailorInput): Promise<TailorResult> {
  const empty: TailorResult = { tailored_resume: "", cover_letter: "", gaps: [], keywords: [], match_score: 0 };
  if (!inp.resume?.trim()) return { ...empty, error: "Add your master resume first (Settings)." };
  if (!ANTHROPIC_API_KEY) return { ...empty, error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY and restart." };

  const userPrompt = [
    `JOB: ${inp.job.title} @ ${inp.job.company}`,
    inp.job.summary ? `\nPosting summary:\n${inp.job.summary}` : "",
    inp.job.requirements?.length ? `\nRequirements:\n- ${inp.job.requirements.join("\n- ")}` : "",
    `\nCANDIDATE MASTER RESUME:\n${inp.resume.trim().slice(0, 9000)}`,
    "\nTailor it. Call submit_tailored.",
  ].join("\n");

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "tool", name: "submit_tailored" },
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
    if (!res.ok) return { ...empty, error: `Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const json = (await res.json()) as { content: any[] };
    const submit = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_tailored") as { input?: any } | undefined;
    const o = submit?.input;
    if (!o) return { ...empty, error: "No tailored output returned. Try again." };
    return {
      tailored_resume: String(o.tailored_resume ?? ""),
      cover_letter: String(o.cover_letter ?? ""),
      gaps: Array.isArray(o.gaps) ? o.gaps.map(String) : [],
      keywords: Array.isArray(o.keywords) ? o.keywords.map(String) : [],
      match_score: Math.max(0, Math.min(100, Math.round(o.match_score ?? 0))),
    };
  } catch (e: any) {
    return { ...empty, error: e?.message || "Tailoring failed." };
  }
}
