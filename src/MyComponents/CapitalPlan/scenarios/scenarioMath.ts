/**
 * scenarioMath.ts — Pure math for the worth-it calculator.
 *
 * Given:
 *   - a candidate spend (cost, duration, expected revenue impact, confidence)
 *   - current capital state (cash on hand, monthly burn, next-round close date)
 * Returns:
 *   - total cost over the duration window
 *   - new monthly burn (with the candidate applied)
 *   - new runway months
 *   - delta from baseline runway
 *   - payback period in months (if revenue-generating)
 *   - opportunity-cost equivalents ("instead of this you could buy …")
 *   - a rule-based recommendation tier + rationale list
 *
 * Pure functions only. Used by ScenariosTab, the AxonAdvisorRail, and
 * the capital_advise AXON action so all three agree on the numbers.
 */

import type { CapitalConfidence } from "../CapitalPlan.queries";

export interface ScenarioInput {
  /** Short label, e.g. "Hire 2nd AE" */
  label: string;
  /** One-time upfront cost in dollars (e.g. $40K SOC2 audit). */
  upfrontCost?: number;
  /** Recurring monthly cost in dollars (e.g. $13K/mo for a $160K/yr hire). */
  monthlyCost?: number;
  /** How many months the recurring cost runs. Required when monthlyCost > 0. */
  durationMonths?: number;
  /** Expected NEW monthly recurring revenue this spend produces (best-case). */
  expectedMrrDelta?: number;
  /** How many months until expectedMrrDelta is fully realized (ramp). */
  rampMonths?: number;
  /** How confident the operator is in the projection. */
  confidence?: CapitalConfidence;
}

export interface CapitalSnapshot {
  cashOnHand: number;
  monthlyBurn: number;
  /** Days until the next round close target (null if no upcoming round). */
  daysToNextClose: number | null;
  nextRoundName?: string;
}

export interface ScenarioImpact {
  totalCost: number;
  /** Increase in monthly burn while this scenario is active. */
  marginalMonthlyBurn: number;
  /** Monthly burn AFTER the candidate is applied (during its active window). */
  newMonthlyBurn: number;
  /** Runway months at baseline (no scenario). */
  baselineRunwayMonths: number;
  /** Runway months WITH the scenario active. */
  newRunwayMonths: number;
  /** Difference in runway months (positive = shorter runway, negative = longer). */
  runwayMonthsShaved: number;
  /** Months until the new MRR pays back the total cost. Infinity if it never does. */
  paybackMonths: number;
  /** True if running the scenario depletes cash before the next round closes. */
  willRunOutBeforeNextClose: boolean;
  /** Verdict tier — used to color/grade the recommendation. */
  verdict: "strong-yes" | "yes" | "neutral" | "caution" | "no";
  /** Bulleted rationale for the verdict. */
  rationale: string[];
  /** Opportunity-cost reference points the user might find useful. */
  opportunityCost: { label: string; quantity: number }[];
}

const DEFAULT_CONFIDENCE_DISCOUNT: Record<CapitalConfidence, number> = {
  high:   0.85, // realize 85% of expected MRR
  medium: 0.55,
  low:    0.25,
};

export function computeScenarioImpact(
  input: ScenarioInput,
  snapshot: CapitalSnapshot,
): ScenarioImpact {
  const upfront = Math.max(0, input.upfrontCost ?? 0);
  const monthly = Math.max(0, input.monthlyCost ?? 0);
  const duration = Math.max(0, input.durationMonths ?? (monthly > 0 ? 12 : 0));
  const totalCost = upfront + monthly * duration;

  const marginalMonthlyBurn = monthly; // upfront is amortized into totalCost, not ongoing burn
  const newMonthlyBurn = snapshot.monthlyBurn + marginalMonthlyBurn;

  const baselineRunwayMonths = snapshot.monthlyBurn > 0
    ? snapshot.cashOnHand / snapshot.monthlyBurn
    : Infinity;

  // After paying upfront, what's left? Then divide by new monthly burn.
  const cashAfterUpfront = Math.max(0, snapshot.cashOnHand - upfront);
  const newRunwayMonths = newMonthlyBurn > 0
    ? cashAfterUpfront / newMonthlyBurn
    : Infinity;

  const runwayMonthsShaved = baselineRunwayMonths === Infinity || newRunwayMonths === Infinity
    ? 0
    : baselineRunwayMonths - newRunwayMonths;

  // Payback: realized monthly MRR * months ≥ totalCost
  const conf = input.confidence ?? "medium";
  const ramp = Math.max(1, input.rampMonths ?? 3);
  const realizedMrr = (input.expectedMrrDelta ?? 0) * DEFAULT_CONFIDENCE_DISCOUNT[conf];

  // Crude payback: assume MRR ramps linearly over `ramp` months, then plateaus.
  // After ramp, monthly contribution = realizedMrr. Solve for month t.
  let paybackMonths = Infinity;
  if (realizedMrr > 0) {
    // Cumulative revenue at month t (t > ramp): ramp/2 * realizedMrr + (t - ramp) * realizedMrr
    // = realizedMrr * (t - ramp/2). Set ≥ totalCost: t ≥ ramp/2 + totalCost/realizedMrr.
    const t = ramp / 2 + totalCost / realizedMrr;
    paybackMonths = Math.max(t, 1);
  }

  // Will it run out before the next round closes?
  const daysToClose = snapshot.daysToNextClose;
  const willRunOutBeforeNextClose = daysToClose !== null
    && newRunwayMonths !== Infinity
    && newRunwayMonths * 30 < daysToClose;

  // Verdict heuristics
  const rationale: string[] = [];
  let verdict: ScenarioImpact["verdict"] = "neutral";

  if (willRunOutBeforeNextClose) {
    verdict = "no";
    rationale.push(
      `Running this scenario depletes cash in ~${Math.floor(newRunwayMonths)} months — ` +
      `before ${snapshot.nextRoundName ?? "the next round"} closes in ~${Math.ceil(daysToClose / 30)} months.`,
    );
  } else if (runwayMonthsShaved > 6 && baselineRunwayMonths < 12) {
    verdict = "caution";
    rationale.push(
      `Shaves ${runwayMonthsShaved.toFixed(1)} months of runway when you only have ${baselineRunwayMonths.toFixed(1)} to begin with.`,
    );
  }

  if (realizedMrr > 0 && paybackMonths < 9) {
    if (verdict === "neutral" || verdict === "caution") verdict = "yes";
    if (paybackMonths < 4) verdict = "strong-yes";
    rationale.push(
      `Payback in ~${paybackMonths.toFixed(1)} months at ${conf} confidence ` +
      `(${formatDollars(realizedMrr)}/mo realized).`,
    );
  } else if (realizedMrr > 0 && paybackMonths < 18) {
    if (verdict === "neutral") verdict = "neutral";
    rationale.push(
      `Payback in ~${paybackMonths.toFixed(1)} months at ${conf} confidence — within seed-horizon.`,
    );
  } else if (realizedMrr > 0) {
    if (verdict !== "no") verdict = "caution";
    rationale.push(
      `Payback ~${paybackMonths === Infinity ? "never at projected MRR" : paybackMonths.toFixed(1) + " months"} ` +
      `— longer than your runway horizon.`,
    );
  } else {
    rationale.push(
      `No direct revenue impact projected — judge by strategic value, not payback.`,
    );
  }

  if (totalCost > snapshot.cashOnHand * 0.4 && verdict !== "strong-yes") {
    if (verdict === "yes" || verdict === "neutral") verdict = "caution";
    rationale.push(
      `${formatDollars(totalCost)} is ${((totalCost / snapshot.cashOnHand) * 100).toFixed(0)}% of cash on hand — material concentration.`,
    );
  }

  if (conf === "low" && verdict !== "no") {
    verdict = verdict === "strong-yes" ? "yes" : "caution";
    rationale.push(`Low confidence — the upside numbers are guesses; size accordingly.`);
  }

  // Opportunity-cost reference points
  const opportunityCost: { label: string; quantity: number }[] = [];
  if (totalCost > 0) {
    opportunityCost.push({ label: `months of runway`, quantity: snapshot.monthlyBurn > 0 ? totalCost / snapshot.monthlyBurn : 0 });
    opportunityCost.push({ label: `founding AE months ($15K/mo)`, quantity: totalCost / 15000 });
    opportunityCost.push({ label: `months of paid ads ($10K/mo)`, quantity: totalCost / 10000 });
    opportunityCost.push({ label: `SOC 2 audits (~$50K)`, quantity: totalCost / 50000 });
  }

  return {
    totalCost,
    marginalMonthlyBurn,
    newMonthlyBurn,
    baselineRunwayMonths,
    newRunwayMonths,
    runwayMonthsShaved,
    paybackMonths,
    willRunOutBeforeNextClose,
    verdict,
    rationale,
    opportunityCost,
  };
}

// ─── Verdict metadata ──────────────────────────────────────────

export const VERDICT_META: Record<
  ScenarioImpact["verdict"],
  { label: string; tone: string; emoji: string }
> = {
  "strong-yes": { label: "Strong yes",  tone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/40", emoji: "✓✓" },
  "yes":        { label: "Yes",         tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", emoji: "✓"  },
  "neutral":    { label: "Neutral",     tone: "text-foreground bg-muted/30 border-border",                emoji: "·"  },
  "caution":    { label: "Caution",     tone: "text-amber-200 bg-amber-500/10 border-amber-500/30",      emoji: "⚠"  },
  "no":         { label: "No",          tone: "text-red-200 bg-red-500/10 border-red-500/40",            emoji: "✗"  },
};

// ─── Helpers (internal) ────────────────────────────────────────

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
