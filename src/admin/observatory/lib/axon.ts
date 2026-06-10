/**
 * axon.ts — ask Axon (Claude) for a concrete, code-specific remediation for a
 * finding, using the same Anthropic config the rest of the app uses.
 * NOTE: this currently calls Anthropic directly with the bundled key — the very
 * pattern finding f-anthropic-client-direct flags. Route it through takeover_b2b
 * once the proxy route exists (scenario s-proxy-secrets).
 */
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODEL } from "@/Axon/config";
import { Finding } from "../data/manifest";

export async function askAxonForFix(finding: Finding, code: { file: string; text: string }[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic key missing — add VITE_ANTHROPIC_API_KEY and restart the dev server.");
  const codeBlock = code.length
    ? code.map((c) => `// ===== ${c.file} =====\n${c.text.slice(0, 6000)}`).join("\n\n")
    : "(no source loaded — advise from the description)";
  const prompt =
`You are a senior application-security engineer reviewing the "Takeover" codebase
(Tauri + React client "cwa_manager" and a Next.js API "takeover_b2b").

FINDING: ${finding.title}
SEVERITY: ${finding.severity}
RISK: ${finding.risk}
SUGGESTED DIRECTION: ${finding.fix}
EVIDENCE: ${finding.evidence}

RELEVANT SOURCE:
${codeBlock}

Give a concrete remediation for THIS code (not generic advice):
1. One-sentence summary of the change.
2. The exact edits — show before/after snippets or a diff against the file(s) above.
3. Anything to verify after (a test, a re-scan signal).
Keep it tight and senior-level. Use markdown.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1400, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 220)}`);
  const data: any = await res.json();
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  return text || "(no suggestion returned)";
}

export interface AxonChange { file: string; line?: number; order: number; note: string }
export interface AxonPlan { summary: string; changes: AxonChange[] }

/** Ask Axon for an ordered change plan with real line numbers, as JSON we can
 *  overlay on the code. Falls back to prose-only if the model doesn't return JSON. */
export async function askAxonForPlan(finding: Finding, code: { file: string; text: string }[]): Promise<AxonPlan> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic key missing — add VITE_ANTHROPIC_API_KEY and restart the dev server.");
  const codeBlock = code.length
    ? code.map((c) => `// ===== ${c.file} =====\n` + c.text.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n").slice(0, 8000)).join("\n\n")
    : "(no source loaded)";
  const prompt =
`You are a senior application-security engineer fixing a finding in the "Takeover" codebase.

FINDING: ${finding.title} [${finding.severity}]
RISK: ${finding.risk}
DIRECTION: ${finding.fix}
EVIDENCE: ${finding.evidence}

SOURCE (line-numbered):
${codeBlock}

Respond with ONLY a JSON object, no prose outside it:
{
  "summary": "<2-4 sentence markdown explanation; you may include fenced code blocks>",
  "changes": [
    { "file": "<repo-relative path exactly as shown>", "line": <real line number from the source, or null>, "order": <1-based step>, "note": "<the concrete edit to make at that line>" }
  ]
}
Order the changes in the sequence they should be applied. Use REAL line numbers from the numbered source above. 3-7 changes.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 220)}`);
  const data: any = await res.json();
  const raw = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  try {
    const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
    const obj = JSON.parse(raw.slice(start, end + 1));
    return { summary: typeof obj.summary === "string" ? obj.summary : raw, changes: Array.isArray(obj.changes) ? obj.changes : [] };
  } catch {
    return { summary: raw || "(no suggestion returned)", changes: [] };
  }
}
