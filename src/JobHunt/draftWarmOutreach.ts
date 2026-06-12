/**
 * draftWarmOutreach.ts — draft a SHORT, specific, senior-appropriate message to
 * a real person (hiring manager, leader, or referral), grounded only in the
 * candidate's resume. Not a generic "I'm reaching out" intro. One clear ask.
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export type OutreachMode = "hiring_manager" | "referral" | "recruiter";
export interface DraftOutreachInput {
  resume: string;
  job: { company: string; title: string; summary?: string | null; requirements?: string[] };
  contact: { name?: string | null; title?: string | null; angle?: string | null };
  mode: OutreachMode;
}
export interface DraftOutreachResult { subject: string; body: string; error?: string }

const MODE_GUIDE: Record<OutreachMode, string> = {
  hiring_manager:
    "Mode: DIRECT to the hiring manager. Confident and peer-level (the candidate is senior). Lead with one concrete proof point that maps to what their org needs, then a single specific ask for a short conversation. No 'I'm reaching out', no résumé dump.",
  referral:
    "Mode: REFERRAL / warm intro ask. Respectful of their time. Briefly say why this role fits, then ask if they'd be open to referring you or pointing you to the right person. Make it easy to say yes (offer to send a blurb they can forward).",
  recruiter:
    "Mode: RECRUITER. Crisp and outcome-focused. State the role, one line on fit, and ask about next steps / process. Attach-ready.",
};

const SYSTEM_PROMPT = [
  "You write outreach that gets senior candidates a reply. Short, specific, human. The candidate is reaching a real named person about a specific role.",
  "",
  "Rules:",
  "- 4-7 sentences MAX in the body. Brevity signals seniority and respect for their time.",
  "- Ground EVERY claim in the candidate's resume. Never invent experience, metrics, or titles.",
  "- Open with something specific to THEM or their org/role — not 'I hope this finds you well' or 'I'm reaching out regarding'.",
  "- Exactly ONE clear ask (a 15-min chat, a referral, next steps). No multiple CTAs.",
  "- No clichés, no buzzword soup, no flattery. Plain, confident, warm.",
  "- subject: 4-7 words, specific, lowercase-ish human (not 'Application for...').",
  "Return via submit_outreach. No prose outside the tool call.",
].join("\n");

const SUBMIT_TOOL = {
  name: "submit_outreach",
  description: "Submit the drafted subject + body.",
  input_schema: {
    type: "object",
    properties: { subject: { type: "string" }, body: { type: "string" } },
    required: ["subject", "body"],
  },
} as const;

export async function draftWarmOutreach(inp: DraftOutreachInput): Promise<DraftOutreachResult> {
  if (!inp.resume?.trim()) return { subject: "", body: "", error: "Add your master resume first." };
  if (!ANTHROPIC_API_KEY) return { subject: "", body: "", error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY." };

  const userPrompt = [
    `ROLE: ${inp.job.title} @ ${inp.job.company}`,
    inp.job.summary ? `Posting: ${inp.job.summary}` : "",
    `CONTACT: ${inp.contact.name || "the right person"}${inp.contact.title ? `, ${inp.contact.title}` : ""}`,
    inp.contact.angle ? `Angle to open with: ${inp.contact.angle}` : "",
    MODE_GUIDE[inp.mode],
    `\nCANDIDATE RESUME:\n${inp.resume.trim().slice(0, 6000)}`,
    "\nWrite the message. Call submit_outreach.",
  ].filter(Boolean).join("\n");

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
        model: CLAUDE_MODEL, max_tokens: 1200, temperature: 0.6,
        system: SYSTEM_PROMPT,
        tools: [SUBMIT_TOOL],
        tool_choice: { type: "tool", name: "submit_outreach" },
        messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      }),
    });
    if (!res.ok) return { subject: "", body: "", error: `Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}` };
    const json = (await res.json()) as { content: any[] };
    const t = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_outreach") as { input?: any } | undefined;
    const o = t?.input;
    if (!o) return { subject: "", body: "", error: "No draft returned. Try again." };
    return { subject: String(o.subject ?? ""), body: String(o.body ?? "") };
  } catch (e: any) {
    return { subject: "", body: "", error: e?.message || "Draft failed." };
  }
}
