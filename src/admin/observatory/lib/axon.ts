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
