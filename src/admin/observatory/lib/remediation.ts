/**
 * remediation.ts — turn the threat board into a shareable, prioritized plan.
 * Builds Markdown from the live (triaged) findings and downloads it, so you and
 * your backender can paste it into a doc, an issue tracker, or a standup.
 */
import { manifest } from "../data/manifest";
import { securityScore, SEVERITY_ORDER } from "./scoring";
import { effectiveStatus, triageOf } from "./triage";

export function buildRemediationMarkdown(): string {
  const nodeLabel = (id: string) => manifest.nodes.find((n) => n.id === id)?.label ?? id;
  const assetName = (id: string) => manifest.assets.find((a) => a.id === id)?.name ?? id;

  const findings = [...manifest.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  const open = findings.filter((f) => effectiveStatus(f.id) === "open");
  const done = findings.filter((f) => effectiveStatus(f.id) !== "open");

  const L: string[] = [];
  L.push(`# Takeover — Remediation Plan`);
  L.push("");
  L.push(`_Generated ${new Date().toISOString().slice(0, 10)} from the Observatory · posture ${securityScore()}/100 · ${open.length} open / ${done.length} closed._`);
  L.push("");

  const counts = SEVERITY_ORDER.map((s) => `${open.filter((f) => f.severity === s).length} ${s}`).join(" · ");
  L.push(`**Open by severity:** ${counts}`);
  L.push("");
  L.push(`## Open items (do these, top-down)`);
  L.push("");

  open.forEach((f, i) => {
    const t = triageOf(f.id);
    L.push(`### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
    L.push(`- **Effort:** ${f.effort}${t.owner ? ` · **Owner:** ${t.owner}` : ""}${t.target ? ` · **Target:** ${t.target}` : ""}`);
    L.push(`- **Components:** ${f.nodeIds.map(nodeLabel).join(", ") || "—"}`);
    if (f.assetIds.length) L.push(`- **Data at stake:** ${f.assetIds.map(assetName).join(", ")}`);
    L.push(`- **Risk:** ${f.risk}`);
    L.push(`- **Evidence:** ${f.evidence}`);
    L.push(`- **Fix:** ${f.fix}`);
    L.push("");
  });

  if (done.length) {
    L.push(`## Closed / accepted`);
    L.push("");
    done.forEach((f) => L.push(`- ~~[${f.severity.toUpperCase()}] ${f.title}~~ (${effectiveStatus(f.id)})`));
    L.push("");
  }

  L.push(`## Recommended sequence (from the scenario engine)`);
  L.push("");
  manifest.scenarios
    .filter((s) => s.recommended)
    .forEach((s) => L.push(`- **${s.title}** — ${s.swap.from} → ${s.swap.to} _(effort: ${s.effort})_`));
  L.push("");
  return L.join("\n");
}

export function downloadRemediationPlan() {
  const md = buildRemediationMarkdown();
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `takeover-remediation-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
