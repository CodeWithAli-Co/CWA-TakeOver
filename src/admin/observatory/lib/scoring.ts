import { manifest, Severity, Verdict, Finding, SystemNode } from "../data/manifest";

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25, high: 12, medium: 5, low: 2, info: 0,
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function openFindings(): Finding[] {
  return manifest.findings.filter((f) => f.status === "open");
}

/** 0–100. 100 = no open findings. */
export function securityScore(): number {
  // Exponential decay instead of a linear clamp: every open finding always
  // moves the needle, but the score never flatlines at 0 and hides progress.
  const burden = openFindings().reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
  return Math.round(100 * Math.exp(-burden / 90));
}

export function nodeFindings(nodeId: string): Finding[] {
  return manifest.findings.filter((f) => f.nodeIds.includes(nodeId) && f.status === "open");
}

export function nodeRisk(nodeId: string): number {
  return nodeFindings(nodeId).reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
}

export function severityCounts(): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  openFindings().forEach((f) => (c[f.severity] += 1));
  return c;
}

export function verdictCounts(): Record<Verdict, number> {
  const c: Record<Verdict, number> = { safe: 0, watch: 0, "at-risk": 0 };
  manifest.nodes.forEach((n) => (c[n.verdict] += 1));
  return c;
}

export function riskiestNodes(n = 3): SystemNode[] {
  return [...manifest.nodes].sort((a, b) => nodeRisk(b.id) - nodeRisk(a.id)).slice(0, n);
}

/** Secrets/PII whose only resting place is the client. */
export function exposedAssets() {
  return manifest.assets.filter(
    (a) =>
      (a.sensitivity === "secret" || a.sensitivity === "pii") &&
      a.storedIn.some((s) => ["localstorage", "tanstack"].includes(s.nodeId))
  );
}

export function coverage() {
  const apis = manifest.apis;
  const authed = apis.filter((r) => r.auth !== "none").length;
  const encryptedEdges = manifest.edges.filter((e) => e.encrypted).length;
  const rlsAssets = manifest.assets.filter((a) => a.rls && a.rls !== "n/a");
  const rlsFull = rlsAssets.filter((a) => a.rls === "full").length;
  return {
    apiAuthPct: Math.round((authed / apis.length) * 100),
    edgeEncPct: Math.round((encryptedEdges / manifest.edges.length) * 100),
    rlsPct: rlsAssets.length ? Math.round((rlsFull / rlsAssets.length) * 100) : 100,
  };
}

export const fmtSeverity = (s: Severity) => s.charAt(0).toUpperCase() + s.slice(1);
