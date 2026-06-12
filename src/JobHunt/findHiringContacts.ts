/**
 * findHiringContacts.ts — find the RIGHT people to reach to get hired, not just
 * a careers inbox. For a role + company, Claude web-searches for the likely
 * hiring manager (the exec the role reports to), other leaders in that org,
 * and recruiters — each with a verifiable contact path (or null) and a one-line
 * outreach angle. Referrals + direct hiring-manager notes convert ~10x a cold
 * application, so this is the high-leverage channel.
 *
 * Same client-direct Anthropic + web_search pattern as findRecruiterEmail.
 * NEVER fabricates an email or URL.
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";

export type ContactKind = "hiring_manager" | "leadership" | "recruiter" | "team";
export interface HiringContact {
  name: string | null;
  title: string | null;
  kind: ContactKind;
  rationale: string;          // why this person matters for this role
  email: string | null;       // only if verifiable
  linkedin: string | null;    // profile URL if found
  source_label: string | null;
  outreach_angle: string;     // one-line hook for the message
}
export interface FindHiringContactsResult { contacts: HiringContact[]; note?: string; error?: string }
export interface FindHiringContactsInput { company: string; title: string }

const SYSTEM_PROMPT = [
  "You help a candidate reach the people who actually decide hiring — the hiring manager and leaders in the relevant org — not just a recruiting inbox. Referrals and direct hiring-manager notes convert far better than cold applications.",
  "",
  "For the given role + company, use web_search (up to 6 searches) to identify 3-6 people worth reaching:",
  "  · The likely HIRING MANAGER — the leader the role reports to (e.g. for 'VP Eng', the CTO/SVP Eng; for an IC role, the team's manager/director). This is the priority.",
  "  · Other LEADERSHIP in that function who'd influence the hire.",
  "  · A RECRUITER / talent partner for the role.",
  "Use the company's team/about/leadership pages, LinkedIn, conference talks, podcasts, press, and the job posting itself.",
  "",
  "For EACH contact return: name, title, kind, a one-sentence rationale (why them), a verifiable email OR linkedin URL (or both null), a source_label for where you found them, and a one-line outreach_angle (a specific hook the candidate can open with).",
  "",
  "Hard rules:",
  "- NEVER fabricate or pattern-guess an email or URL. Use null unless you actually found it. A name + title + LinkedIn is valuable even with email null.",
  "- Lead with the hiring manager. Rank contacts by who matters most.",
  "- rationale and outreach_angle must be specific to this company/role, grounded in something real (their org, recent news, the team's focus).",
  "- If you can't identify anyone concrete, return { contacts: [], note: '<where the candidate should look>' }.",
  "Return everything via submit_contacts. No prose outside the tool call.",
].join("\n");

const SUBMIT_TOOL = {
  name: "submit_contacts",
  description: "Submit the people worth reaching for this role.",
  input_schema: {
    type: "object",
    properties: {
      contacts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            kind: { type: "string", enum: ["hiring_manager", "leadership", "recruiter", "team"] },
            rationale: { type: "string" },
            email: { type: ["string", "null"], description: "Verifiable email or null. Never invent." },
            linkedin: { type: ["string", "null"] },
            source_label: { type: ["string", "null"] },
            outreach_angle: { type: "string" },
          },
          required: ["kind", "rationale", "outreach_angle"],
        },
      },
      note: { type: ["string", "null"] },
    },
    required: ["contacts"],
  },
} as const;

const KIND_RANK: Record<ContactKind, number> = { hiring_manager: 0, leadership: 1, team: 2, recruiter: 3 };

export async function findHiringContacts(inp: FindHiringContactsInput): Promise<FindHiringContactsResult> {
  if (!ANTHROPIC_API_KEY) return { contacts: [], error: "Anthropic key missing — add VITE_ANTHROPIC_API_KEY." };
  const userPrompt = `Role: "${inp.title}" at "${inp.company}". Find the hiring manager + the right people to reach. Use web_search, then call submit_contacts.`;
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
        model: CLAUDE_MODEL, max_tokens: 4000, temperature: 0.3,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }, SUBMIT_TOOL],
        messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      }),
    });
    if (!res.ok) return { contacts: [], error: `Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}` };
    const json = (await res.json()) as { content: any[] };
    const t = json.content.find((b: any) => b.type === "tool_use" && b.name === "submit_contacts") as { input?: { contacts?: any[]; note?: string } } | undefined;
    const raw = t?.input?.contacts ?? [];
    const contacts: HiringContact[] = raw.map((c: any) => ({
      name: c.name ?? null,
      title: c.title ?? null,
      kind: (["hiring_manager", "leadership", "recruiter", "team"].includes(c.kind) ? c.kind : "team") as ContactKind,
      rationale: String(c.rationale ?? ""),
      email: typeof c.email === "string" && c.email.includes("@") ? c.email.trim() : null,
      linkedin: typeof c.linkedin === "string" && c.linkedin.startsWith("http") ? c.linkedin.trim() : null,
      source_label: c.source_label ?? null,
      outreach_angle: String(c.outreach_angle ?? ""),
    })).sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    return { contacts, note: t?.input?.note ?? undefined };
  } catch (e: any) {
    return { contacts: [], error: e?.message || "Lookup failed." };
  }
}
