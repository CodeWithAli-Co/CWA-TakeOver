/**
 * linearInsights.ts — Heuristic engine producing AXON observations
 * over the issue + cycle dataset. Pure functions, identical shape
 * to the Vercel insights engine so the UI primitives can be reused
 * across surfaces in a follow-up.
 *
 * Categories:
 *   · "blockers"  — labels containing "blocked"/"blocker" piling up
 *   · "stale"     — high-priority issues that haven't moved in 7d+
 *   · "bottleneck"— a single assignee owns >40% of active work
 *   · "regression"— in-review/in-progress counts vs week prior
 *   · "champion"  — assignee who closed the most this week
 */

import type { LinearIssue } from "@/lib/linear";

export type LinearInsightSeverity = "info" | "good" | "watch" | "alert";

export interface LinearInsight {
  id: string;
  severity: LinearInsightSeverity;
  /** Headline AXON would say (≤ ~20 words). */
  line: string;
  detail?: string;
  category: "blockers" | "stale" | "bottleneck" | "regression" | "champion";
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function computeLinearInsights(issues: LinearIssue[]): LinearInsight[] {
  if (issues.length < 5) return [];

  const out: LinearInsight[] = [];
  out.push(...blockerInsights(issues));
  out.push(...staleInsights(issues));
  out.push(...bottleneckInsights(issues));
  out.push(...championInsights(issues));

  const rank: Record<LinearInsightSeverity, number> = {
    alert: 0,
    watch: 1,
    good: 2,
    info: 3,
  };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ────────────────────────────────────────────────
// Individual heuristics
// ────────────────────────────────────────────────

function blockerInsights(issues: LinearIssue[]): LinearInsight[] {
  const blockedActive = issues.filter(
    (i) =>
      (i.state.type === "started" ||
        i.state.type === "unstarted" ||
        i.state.type === "backlog") &&
      i.labels?.nodes?.some((l) =>
        /(blocked|blocker|wait)/i.test(l.name ?? ""),
      ),
  );
  if (blockedActive.length < 2) return [];
  return [
    {
      id: "blockers",
      severity: blockedActive.length >= 5 ? "alert" : "watch",
      category: "blockers",
      line: `${blockedActive.length} issues are tagged blocked or waiting.`,
      detail:
        blockedActive.length >= 5
          ? "Real risk — the queue is jammed. Unblock the top 2 first."
          : "Not a crisis yet, but worth a sweep.",
    },
  ];
}

function staleInsights(issues: LinearIssue[]): LinearInsight[] {
  const cutoff = Date.now() - WEEK_MS;
  // High/urgent priority issues that haven't been touched in a week
  // and are still active — those are the ones that get forgotten.
  const stale = issues.filter(
    (i) =>
      (i.priority === 1 || i.priority === 2) &&
      (i.state.type === "started" || i.state.type === "unstarted") &&
      Date.parse(i.updatedAt) < cutoff,
  );
  if (stale.length === 0) return [];
  const top = stale[0]!;
  return [
    {
      id: "stale",
      severity: stale.length >= 3 ? "alert" : "watch",
      category: "stale",
      line:
        stale.length === 1
          ? `${top.identifier} (${top.priorityLabel}) hasn't moved in a week.`
          : `${stale.length} high-priority issues haven't moved in 7d+ — starting with ${top.identifier}.`,
      detail: "Either ship them or drop the priority. Both are fine.",
    },
  ];
}

function bottleneckInsights(issues: LinearIssue[]): LinearInsight[] {
  const active = issues.filter(
    (i) => i.state.type === "started" || i.state.type === "unstarted",
  );
  if (active.length < 8) return [];

  const counts = new Map<string, { name: string; count: number }>();
  for (const i of active) {
    if (!i.assignee) continue;
    const entry = counts.get(i.assignee.id) ?? {
      name: i.assignee.name,
      count: 0,
    };
    entry.count += 1;
    counts.set(i.assignee.id, entry);
  }
  let top: { name: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!top || entry.count > top.count) top = entry;
  }
  if (!top) return [];
  const pct = (top.count / active.length) * 100;
  if (pct < 40) return [];

  return [
    {
      id: "bottleneck",
      severity: pct >= 60 ? "alert" : "watch",
      category: "bottleneck",
      line: `${top.name} owns ${Math.round(pct)}% of active work (${top.count} of ${active.length} issues).`,
      detail:
        "Single-point-of-failure risk. Rebalance or unblock them.",
    },
  ];
}

function championInsights(issues: LinearIssue[]): LinearInsight[] {
  const cutoff = Date.now() - WEEK_MS;
  const closedThisWeek = issues.filter(
    (i) =>
      (i.state.type === "completed" || i.state.type === "canceled") &&
      Date.parse(i.updatedAt) >= cutoff,
  );
  if (closedThisWeek.length < 3) return [];

  const counts = new Map<string, { name: string; count: number }>();
  for (const i of closedThisWeek) {
    if (!i.assignee) continue;
    const entry = counts.get(i.assignee.id) ?? {
      name: i.assignee.name,
      count: 0,
    };
    entry.count += 1;
    counts.set(i.assignee.id, entry);
  }
  let top: { name: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!top || entry.count > top.count) top = entry;
  }
  if (!top || top.count < 2) return [];

  return [
    {
      id: "champion",
      severity: "good",
      category: "champion",
      line: `${top.name} closed ${top.count} issues this week — the team's top shipper.`,
    },
  ];
}
