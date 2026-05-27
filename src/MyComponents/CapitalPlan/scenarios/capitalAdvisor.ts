/**
 * capitalAdvisor.ts — Rule-based advice generator for the AXON rail.
 *
 * Produces a structured recommendation given the full capital state.
 * Same input shape the eventual `capital_advise` AXON action will take,
 * so when the model-backed version lands it can use this as its
 * "deterministic baseline" and augment with narrative.
 *
 * Two entrypoints:
 *   - generateBriefing(): unprompted situation report (used on rail
 *     mount and after big state changes)
 *   - answerQuestion(): responds to a free-text question, routing to
 *     the right deterministic check ("how's runway", "should I hire",
 *     "next-close risk", etc.)
 *
 * Both return AdvisorResponse with a headline, color tone, and bullets.
 */

import type {
  CapitalPlanData, CapitalRound, CapitalCheck,
} from "../CapitalPlan.queries";
import {
  estimateMonthlyBurn, projectRunwayMonths, totalRaisedToDate,
  summarizeRoundProgress,
} from "../CapitalPlan.queries";

export type AdvisorTone = "ok" | "info" | "caution" | "warn" | "critical";

export interface AdvisorResponse {
  headline: string;
  tone: AdvisorTone;
  bullets: string[];
  /** Optional follow-up question chips the operator might tap next. */
  suggestedFollowups?: string[];
}

export interface AdvisorInput {
  plan: CapitalPlanData;
  cashOnHand: number;
}

// ─── Briefing — unprompted summary ─────────────────────────────

export function generateBriefing({ plan, cashOnHand }: AdvisorInput): AdvisorResponse {
  const burn = estimateMonthlyBurn(plan.actuals, plan.allocations);
  const runway = projectRunwayMonths(cashOnHand, burn);
  const raised = totalRaisedToDate(plan.rounds, plan.checks);

  const inFlight = plan.rounds.filter((r) => r.status === "raising" || r.status === "planning");
  const nextRound = nextUpcomingRound(plan.rounds);
  const nextProgress = nextRound ? summarizeRoundProgress(nextRound, plan.checks) : null;

  const bullets: string[] = [];
  let tone: AdvisorTone = "ok";
  let headline = "Capital state looks healthy.";

  // Runway summary
  if (runway === Infinity) {
    bullets.push(`No burn recorded — runway is effectively infinite. Add actuals in the Runway tab to get a real read.`);
    tone = "info";
    headline = "Need actuals to assess runway.";
  } else if (runway < 3) {
    bullets.push(`🔴 Runway is ${runway.toFixed(1)} months at ${formatDollars(burn)}/mo burn. This is critical.`);
    tone = "critical";
    headline = "Runway is critical — raise or cut burn now.";
  } else if (runway < 6) {
    bullets.push(`🟠 Runway is ${runway.toFixed(1)} months. You should be in active conversations.`);
    tone = "warn";
    headline = "Runway is tight — start the next raise.";
  } else if (runway < 9) {
    bullets.push(`🟡 Runway is ${runway.toFixed(1)} months. Plan the raise but no panic yet.`);
    tone = "caution";
    headline = "Runway is healthy but not luxurious.";
  } else {
    bullets.push(`🟢 Runway is ${runway.toFixed(1)} months at ${formatDollars(burn)}/mo burn.`);
  }

  // Next round
  if (nextProgress) {
    const r = nextProgress;
    const days = r.daysUntilTargetClose;
    if (days !== null && days < 30 && r.pctOfTarget < 0.5) {
      bullets.push(`⚠ ${r.round.name} closes in ${days}d but is only ${(r.pctOfTarget * 100).toFixed(0)}% committed.`);
      if (tone === "ok" || tone === "info") tone = "warn";
    } else if (r.pctOfTarget >= 1) {
      bullets.push(`✓ ${r.round.name} is fully committed (${formatDollars(r.committed)} of ${formatDollars(r.round.target_amount)}).`);
    } else {
      bullets.push(`${r.round.name}: ${(r.pctOfTarget * 100).toFixed(0)}% committed (${formatDollars(r.committed)} / ${formatDollars(r.round.target_amount)})${days !== null ? `, ${days}d to target close` : ""}.`);
    }
  } else if (inFlight.length === 0) {
    bullets.push(`No round in flight. Create one in the Rounds tab when you're ready.`);
  }

  // Total raised context
  if (raised > 0) {
    bullets.push(`Total raised to date: ${formatDollars(raised)} across ${plan.checks.filter((c) => c.status === "wired" || c.status === "signed").length} signed/wired checks.`);
  }

  // Stale investors
  const stale = staleInvestors(plan.checks);
  if (stale.length > 0) {
    bullets.push(`${stale.length} investor${stale.length === 1 ? "" : "s"} stale for >14 days — ${stale.slice(0, 3).map((c) => c.investor_name).join(", ")}${stale.length > 3 ? `, +${stale.length - 3} more` : ""}.`);
    if (tone === "ok") tone = "info";
  }

  return {
    headline,
    tone,
    bullets,
    suggestedFollowups: [
      "How tight is runway?",
      "Which investors should I follow up with?",
      "Should I delay the next raise?",
    ],
  };
}

// ─── Question routing ─────────────────────────────────────────

const ROUTES: { match: RegExp; handler: (q: string, ctx: AdvisorInput) => AdvisorResponse }[] = [
  { match: /\b(runway|cash|burn|out\s+of\s+money)\b/i,        handler: answerRunway },
  { match: /\b(hire|hiring|engineer|ae|founding|sales)\b/i,    handler: answerHire },
  { match: /\b(delay|push|move|postpone|slip)\b.*\b(raise|round|seed)\b/i, handler: answerDelay },
  { match: /\b(invest(or)?s?|check|follow.?up|stale|cold)\b/i, handler: answerInvestors },
  { match: /\b(spend|budget|allocat|bucket|over.?budget)\b/i,  handler: answerBudget },
  { match: /\b(risk|danger|worried|concern|biggest)\b/i,       handler: answerRisk },
];

export function answerQuestion(question: string, ctx: AdvisorInput): AdvisorResponse {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      headline: "Ask me anything about your capital plan.",
      tone: "info",
      bullets: ["Try: 'how's runway', 'which investors are stale', 'should I delay the raise'."],
    };
  }
  for (const r of ROUTES) {
    if (r.match.test(trimmed)) return r.handler(trimmed, ctx);
  }
  // Generic fallback — return a briefing.
  return generateBriefing(ctx);
}

// ─── Per-topic handlers ────────────────────────────────────────

function answerRunway(_q: string, { plan, cashOnHand }: AdvisorInput): AdvisorResponse {
  const burn = estimateMonthlyBurn(plan.actuals, plan.allocations);
  const runway = projectRunwayMonths(cashOnHand, burn);
  const nextRound = nextUpcomingRound(plan.rounds);
  const bullets: string[] = [];

  if (runway === Infinity) {
    return {
      headline: "Can't compute runway — no burn recorded.",
      tone: "info",
      bullets: ["Log monthly spend in the Runway tab and I'll have a real answer."],
    };
  }

  bullets.push(`Burn: ${formatDollars(burn)}/mo. Cash: ${formatDollars(cashOnHand)}. Runway: ${runway.toFixed(1)} months.`);

  if (nextRound?.target_close_date) {
    const days = Math.ceil((new Date(nextRound.target_close_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (runway * 30 >= days) {
      bullets.push(`✓ Covers ${nextRound.name} close (${days}d away) with ~${(runway - days / 30).toFixed(1)} months to spare.`);
    } else {
      bullets.push(`✗ Falls ${(days / 30 - runway).toFixed(1)} months short of ${nextRound.name} close (${days}d away).`);
    }
  }

  let tone: AdvisorTone = "ok";
  let headline = `Runway: ${runway.toFixed(1)} months.`;
  if (runway < 3) { tone = "critical"; headline = "Runway is critical."; }
  else if (runway < 6) { tone = "warn"; headline = "Runway is tight."; }
  else if (runway < 9) { tone = "caution"; headline = "Runway is workable."; }

  return { headline, tone, bullets };
}

function answerHire(_q: string, { plan, cashOnHand }: AdvisorInput): AdvisorResponse {
  const burn = estimateMonthlyBurn(plan.actuals, plan.allocations);
  const runway = projectRunwayMonths(cashOnHand, burn);
  const peopleBucket = plan.allocations
    .filter((a) => a.category === "people")
    .reduce((s, a) => s + a.planned_amount, 0);

  const bullets: string[] = [];
  let tone: AdvisorTone = "info";
  let headline: string;

  if (runway === Infinity) {
    headline = "Hard to advise hiring without a burn read.";
    bullets.push("Log actuals in the Runway tab first.");
  } else if (runway < 6) {
    tone = "warn";
    headline = "Don't add hires right now.";
    bullets.push(`Runway is ${runway.toFixed(1)} months. New monthly cost shaves runway further — wait until the next raise closes.`);
  } else if (runway < 12) {
    tone = "caution";
    headline = "Hire only if directly revenue-driving.";
    bullets.push(`Runway is ${runway.toFixed(1)} months. A Founding AE that closes 2-3 design partners in 90 days pays back. A generalist engineer does not.`);
  } else {
    tone = "ok";
    headline = "You can absorb a hire.";
    bullets.push(`${runway.toFixed(1)} months of runway gives room to bring on a Founding AE without breaking the seed timeline.`);
  }

  bullets.push(`People bucket allocated: ${formatDollars(peopleBucket)} across current rounds.`);
  bullets.push(`Model the specific hire in the Scenarios tab to see exact runway impact + payback.`);
  return { headline, tone, bullets };
}

function answerDelay(_q: string, { plan }: AdvisorInput): AdvisorResponse {
  const next = nextUpcomingRound(plan.rounds);
  if (!next) {
    return {
      headline: "No round to delay.",
      tone: "info",
      bullets: ["Create a round in the Rounds tab first."],
    };
  }
  const prog = summarizeRoundProgress(next, plan.checks);
  const days = prog.daysUntilTargetClose;
  const bullets: string[] = [];
  let tone: AdvisorTone = "info";
  let headline: string;

  if (prog.pctOfTarget >= 1) {
    tone = "ok";
    headline = `${next.name} is fully committed — no reason to delay.`;
    bullets.push(`Close on time and start the next raise's pipeline.`);
  } else if (days !== null && days < 14 && prog.pctOfTarget < 0.5) {
    tone = "warn";
    headline = `Hard not to delay — only ${(prog.pctOfTarget * 100).toFixed(0)}% committed with ${days}d to go.`;
    bullets.push(`Extending 2-4 weeks is normal at this stage. Have a story for new investors about why (e.g., "lead picked up an oversubscribed allocation").`);
  } else {
    tone = "info";
    headline = `Delaying ${next.name} is a tradeoff.`;
    bullets.push(`Pro: more time = more commits = higher cap negotiating power.`);
    bullets.push(`Con: every extra month = ${formatDollars(estimateMonthlyBurn(plan.actuals, plan.allocations))} burned without close + signal-erosion if it leaks.`);
    bullets.push(`Don't delay past 3 months — investor memory is short.`);
  }
  return { headline, tone, bullets };
}

function answerInvestors(_q: string, { plan }: AdvisorInput): AdvisorResponse {
  const stale = staleInvestors(plan.checks);
  const overdueNext = plan.checks.filter((c) =>
    c.next_step_due && new Date(c.next_step_due).getTime() < Date.now()
    && !["wired", "passed", "ghosted"].includes(c.status),
  );
  const bullets: string[] = [];
  let tone: AdvisorTone = "ok";
  let headline = "Investor pipeline is current.";

  if (overdueNext.length > 0) {
    tone = "warn";
    headline = `${overdueNext.length} investor${overdueNext.length === 1 ? " has" : "s have"} overdue next-steps.`;
    for (const c of overdueNext.slice(0, 5)) {
      const days = Math.floor((Date.now() - new Date(c.next_step_due!).getTime()) / (24 * 60 * 60 * 1000));
      bullets.push(`${c.investor_name}: ${c.next_step} (${days}d overdue)`);
    }
  } else if (stale.length > 0) {
    tone = "caution";
    headline = `${stale.length} investor${stale.length === 1 ? "" : "s"} stale (>14 days no touch).`;
    for (const c of stale.slice(0, 5)) {
      const days = Math.floor((Date.now() - new Date(c.last_touch_at!).getTime()) / (24 * 60 * 60 * 1000));
      bullets.push(`${c.investor_name} — ${days}d since last touch (${c.status})`);
    }
    bullets.push(`Open each in the Checks tab and tap "AXON follow-up draft" to send a fast nudge.`);
  } else {
    bullets.push(`No stale investors, no overdue next-steps. Good shape.`);
  }
  return { headline, tone, bullets };
}

function answerBudget(_q: string, { plan }: AdvisorInput): AdvisorResponse {
  const overspent = plan.allocations
    .map((a) => {
      const spent = plan.actuals.filter((x) => x.allocation_id === a.id).reduce((s, x) => s + x.amount, 0);
      return { alloc: a, spent, over: spent - a.planned_amount };
    })
    .filter((x) => x.over > 0);

  const bullets: string[] = [];
  let tone: AdvisorTone = "ok";
  let headline = "Budget is on plan.";

  if (overspent.length > 0) {
    tone = "warn";
    headline = `${overspent.length} bucket${overspent.length === 1 ? "" : "s"} over budget.`;
    for (const x of overspent.slice(0, 5)) {
      bullets.push(`${x.alloc.bucket_name}: +${formatDollars(x.over)} over (${formatDollars(x.spent)} spent on ${formatDollars(x.alloc.planned_amount)} planned).`);
    }
    bullets.push(`Either reallocate from a reserve bucket or accept and update the plan.`);
  } else {
    bullets.push(`No bucket is over budget. Check the Variance section of the Runway tab for closer-look.`);
  }
  return { headline, tone, bullets };
}

function answerRisk(_q: string, ctx: AdvisorInput): AdvisorResponse {
  const { plan, cashOnHand } = ctx;
  const burn = estimateMonthlyBurn(plan.actuals, plan.allocations);
  const runway = projectRunwayMonths(cashOnHand, burn);
  const nextRound = nextUpcomingRound(plan.rounds);
  const nextProg = nextRound ? summarizeRoundProgress(nextRound, plan.checks) : null;
  const overdue = plan.checks.filter((c) =>
    c.next_step_due && new Date(c.next_step_due).getTime() < Date.now()
    && !["wired", "passed", "ghosted"].includes(c.status),
  ).length;

  // Score-and-rank risks
  const risks: { risk: string; score: number }[] = [];
  if (runway !== Infinity && runway < 6) {
    risks.push({ risk: `Runway is ${runway.toFixed(1)} months — you'll be raising under pressure soon`, score: 100 - runway * 10 });
  }
  if (nextProg && nextProg.daysUntilTargetClose !== null && nextProg.daysUntilTargetClose < 30 && nextProg.pctOfTarget < 0.5) {
    risks.push({ risk: `${nextProg.round.name} closes in ${nextProg.daysUntilTargetClose}d at ${(nextProg.pctOfTarget * 100).toFixed(0)}% committed`, score: 80 });
  }
  if (overdue > 0) {
    risks.push({ risk: `${overdue} overdue investor follow-up${overdue === 1 ? "" : "s"}`, score: 30 + overdue * 5 });
  }
  if (plan.checks.length < 10 && plan.rounds.some((r) => r.status === "raising")) {
    risks.push({ risk: `Pipeline is thin — only ${plan.checks.length} investor${plan.checks.length === 1 ? "" : "s"} tracked for an active raise`, score: 50 });
  }

  risks.sort((a, b) => b.score - a.score);
  const top = risks.slice(0, 5);

  if (top.length === 0) {
    return {
      headline: "No major risks flagged right now.",
      tone: "ok",
      bullets: ["Runway healthy, no overdue follow-ups, pipeline reasonable. Keep shipping."],
    };
  }
  return {
    headline: `${top.length} risk${top.length === 1 ? "" : "s"} ranked by severity:`,
    tone: top[0].score > 70 ? "warn" : "caution",
    bullets: top.map((r) => r.risk),
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function nextUpcomingRound(rounds: CapitalRound[]): CapitalRound | null {
  const up = rounds
    .filter((r) => r.target_close_date && (r.status === "planning" || r.status === "raising"))
    .sort((a, b) => new Date(a.target_close_date!).getTime() - new Date(b.target_close_date!).getTime());
  return up[0] ?? null;
}

function staleInvestors(checks: CapitalCheck[]): CapitalCheck[] {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return checks.filter((c) =>
    c.last_touch_at
    && new Date(c.last_touch_at).getTime() < cutoff
    && !["wired", "passed", "ghosted"].includes(c.status)
  );
}

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
