/**
 * insights.ts — Heuristic engine that turns the raw Vercel deploy
 * list into the kind of observations AXON would make if she were
 * looking at it for you.
 *
 * Pure functions: take VercelDeployment[], return a list of
 * Insight objects. No network, no React, no AXON — the InsightCard
 * UI component renders them and AXON's voice layer can speak the
 * `line` field on demand.
 *
 * Categories:
 *   · "velocity"   — deploys/day trending up or down
 *   · "build-time" — build duration getting better or worse
 *   · "regression" — a project that suddenly started failing
 *   · "quality"    — overall success rate moving
 *   · "champion"   — biggest shipper this week
 *
 * Each insight has a severity that drives both visual tone and
 * voice pacing if AXON speaks it.
 */

import type { VercelDeployment } from "@/lib/vercel";

export type InsightSeverity = "info" | "good" | "watch" | "alert";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  /** The headline AXON would say — kept under ~20 words. */
  line: string;
  /** Optional second line for the card's body — context, fix
   *  suggestion, or specifics. */
  detail?: string;
  /** Category — drives sorting and icon mapping. */
  category: "velocity" | "build-time" | "regression" | "quality" | "champion";
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Main entry point — runs every heuristic + returns the union,
 *  sorted by severity (alert > watch > good > info). */
export function computeInsights(deployments: VercelDeployment[]): Insight[] {
  if (deployments.length < 3) return []; // Not enough data to say anything.

  const insights: Insight[] = [];
  insights.push(...velocityInsights(deployments));
  insights.push(...buildTimeInsights(deployments));
  insights.push(...regressionInsights(deployments));
  insights.push(...qualityInsights(deployments));
  insights.push(...championInsights(deployments));

  const rank: Record<InsightSeverity, number> = {
    alert: 0,
    watch: 1,
    good: 2,
    info: 3,
  };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ────────────────────────────────────────────────
// Per-category heuristics
// ────────────────────────────────────────────────

/** Compares deploys/day this week vs last week. Calls out ≥20%
 *  changes in either direction. */
function velocityInsights(deployments: VercelDeployment[]): Insight[] {
  const now = Date.now();
  const thisWeek = deployments.filter((d) => d.created >= now - WEEK_MS);
  const lastWeek = deployments.filter(
    (d) => d.created >= now - 2 * WEEK_MS && d.created < now - WEEK_MS,
  );
  if (lastWeek.length === 0) return [];
  const delta = thisWeek.length - lastWeek.length;
  const pct = lastWeek.length === 0 ? 0 : (delta / lastWeek.length) * 100;
  if (Math.abs(pct) < 20) return [];

  return [
    {
      id: "velocity",
      severity: pct > 0 ? "good" : "watch",
      category: "velocity",
      line:
        pct > 0
          ? `Shipping is up ${Math.round(pct)}% week-over-week — ${thisWeek.length} deploys this week vs ${lastWeek.length} last.`
          : `Shipping slowed ${Math.round(Math.abs(pct))}% week-over-week — only ${thisWeek.length} deploys this week vs ${lastWeek.length} last.`,
      detail:
        pct > 0
          ? "Strongest pace recently. Make sure the team has bandwidth."
          : "Worth a check-in — is something blocking, or just a quieter week?",
    },
  ];
}

/** Avg build time this week vs last week. Calls out ≥25% swings. */
function buildTimeInsights(deployments: VercelDeployment[]): Insight[] {
  const now = Date.now();

  const buildSeconds = (d: VercelDeployment) =>
    d.state === "READY" && d.ready && d.buildingAt
      ? (d.ready - d.buildingAt) / 1000
      : null;

  const avg = (arr: VercelDeployment[]) => {
    const durs = arr.map(buildSeconds).filter((n): n is number => n !== null);
    if (durs.length === 0) return null;
    return durs.reduce((s, n) => s + n, 0) / durs.length;
  };

  const thisWeek = deployments.filter((d) => d.created >= now - WEEK_MS);
  const lastWeek = deployments.filter(
    (d) => d.created >= now - 2 * WEEK_MS && d.created < now - WEEK_MS,
  );
  const cur = avg(thisWeek);
  const prev = avg(lastWeek);
  if (cur === null || prev === null) return [];

  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 25) return [];

  return [
    {
      id: "build-time",
      severity: pct > 0 ? "watch" : "good",
      category: "build-time",
      line:
        pct > 0
          ? `Build times are ${Math.round(pct)}% slower this week (~${formatSec(cur)} vs ${formatSec(prev)}).`
          : `Build times improved ${Math.round(Math.abs(pct))}% this week (~${formatSec(cur)} vs ${formatSec(prev)}).`,
      detail:
        pct > 0
          ? "Check what changed in dependencies or CI steps recently."
          : "Whatever you did, keep it.",
    },
  ];
}

/** Calls out projects whose last 3+ deploys all failed. */
function regressionInsights(deployments: VercelDeployment[]): Insight[] {
  // Group by project name, newest-first per group.
  const byProject = new Map<string, VercelDeployment[]>();
  for (const d of deployments) {
    if (!byProject.has(d.name)) byProject.set(d.name, []);
    byProject.get(d.name)!.push(d);
  }

  const insights: Insight[] = [];
  for (const [name, list] of byProject) {
    list.sort((a, b) => b.created - a.created);
    const recent = list.slice(0, 3);
    if (recent.length < 3) continue;
    if (recent.every((d) => d.state === "ERROR")) {
      insights.push({
        id: `regression:${name}`,
        severity: "alert",
        category: "regression",
        line: `${name}'s last 3 deploys all failed. Production may be stuck on a stale build.`,
        detail: "Click the project's latest deploy to open Vercel and dig in.",
      });
    }
  }
  return insights;
}

/** Success rate this week vs last week. */
function qualityInsights(deployments: VercelDeployment[]): Insight[] {
  const now = Date.now();
  const completedThis = deployments.filter(
    (d) =>
      d.created >= now - WEEK_MS &&
      (d.state === "READY" || d.state === "ERROR"),
  );
  const completedPrev = deployments.filter(
    (d) =>
      d.created >= now - 2 * WEEK_MS &&
      d.created < now - WEEK_MS &&
      (d.state === "READY" || d.state === "ERROR"),
  );
  if (completedThis.length < 5 || completedPrev.length < 5) return [];

  const rate = (arr: VercelDeployment[]) =>
    arr.length === 0
      ? 0
      : (arr.filter((d) => d.state === "READY").length / arr.length) * 100;
  const cur = rate(completedThis);
  const prev = rate(completedPrev);
  const delta = cur - prev;
  if (Math.abs(delta) < 10) return [];

  return [
    {
      id: "quality",
      severity: delta > 0 ? "good" : "watch",
      category: "quality",
      line:
        delta > 0
          ? `Success rate up ${Math.round(delta)} points this week (${Math.round(cur)}% vs ${Math.round(prev)}%).`
          : `Success rate down ${Math.round(Math.abs(delta))} points this week (${Math.round(cur)}% vs ${Math.round(prev)}%).`,
      detail:
        delta > 0
          ? "Whatever you fixed, keep it."
          : "Recent failures clustered — investigate which project regressed.",
    },
  ];
}

/** Identifies the project with the most deploys this week. */
function championInsights(deployments: VercelDeployment[]): Insight[] {
  const now = Date.now();
  const thisWeek = deployments.filter((d) => d.created >= now - WEEK_MS);
  if (thisWeek.length < 5) return [];

  const counts = new Map<string, number>();
  for (const d of thisWeek) {
    counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
  }
  let top: [string, number] | null = null;
  for (const entry of counts) {
    if (!top || entry[1] > top[1]) top = entry;
  }
  if (!top || top[1] < 3) return [];

  return [
    {
      id: `champion:${top[0]}`,
      severity: "info",
      category: "champion",
      line: `${top[0]} is the most active project this week — ${top[1]} deploys.`,
    },
  ];
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function formatSec(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
