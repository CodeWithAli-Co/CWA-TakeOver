/**
 * draftRecruiterEmail.ts — a short, tailored cold intro to a recruiter / hiring
 * manager for a specific role, grounded in the candidate's resume. Mirrors the
 * Fundraise draftInvestorEmail shape; returns {subject, body} via a submit tool.
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export interface RecruiterDraftInput {
  resume: string;
  job: { company: string; title: string; summary?: string | null; requirements?: string[] };
}
export interface RecruiterDraft { subject: string; body: string; error?: string }

const SYSTEM_PROMPT = [
  "You write concise, specific cold intro emails from a job candidate to a recruiter or hiring manager.",
  "",
  "Rules:",
  "- 4-6 sentences. No fluff, no 'I hope this finds you well'.",
  "- Open with a SPECIFIC hook: one concrete, relevant accomplishment from the resume that maps to this role.",
  "- One line on why they're a fit for THIS company/role.",
  "- A soft ask: a brief chat or to be considered.",
  "- Sign with the candidate's real name if it's in the resume (usually the first line); otherwise '[Your name]'.",
  "- Ground everything in the resume. Never invent experience.",
  "Return via the submit_email tool only.",
].join("\n");

const SUBMIT_TOOL = {
  name: "submit_email",
  description: "Submit the drafted intro email.",
  input_schema: {
    type: "object",
    properties: { subject: { type: "string" }, body: { type: "string" } },
    required: ["subject", "body"],
  },
} as const;

export async function draftRecruiterEmail(inp: RecruiterDraftInput): Promise<RecruiterDraft> {
  if (!inp.resume?.trim()) return { subject: "", body: "", error: "Add your master resume first." };
  if (!ANTHROPIC_API_KEY) return { subject: "", body: "", error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY." };

  const userPrompt = [
    `ROLE: ${inp.job.title} @ ${inp.job.company}`,
    inp.job.summary ? `\nPosting:\n${inp.job.summary}` : "",
    inp.job.requirements?.length ? `\nKey requirements: ${inp.job.requirements.join(", ")}` : "",
    `\nCANDIDATE RESUME:\n${inp.resume.trim().slice(0, 8000)}`,
    "\nWrite the intro email. Call submit_email.",
  ].join("\n");

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
        model: CLAUDE_MODEL, max_tokens: 1000, temperature: 0.7,
        system: SYSTEM_PROMPT, tools: [SUBMIT_TOOL], tool_choice: { type: "tool", name: "submit_email" },
        messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      }),
    });
    if (!res.ok) return { subject: "", body: "", error: `Anthropic ${res.status}` };
    const json = (await res.json()) as { content: any[] };
    const t = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_email") as { input?: any } | undefined;
    if (!t?.input) return { subject: "", body: "", error: "No draft returned." };
    return { subject: String(t.input.subject ?? ""), body: String(t.input.body ?? "") };
  } catch (e: any) {
    return { subject: "", body: "", error: e?.message || "Draft failed." };
  }
}
