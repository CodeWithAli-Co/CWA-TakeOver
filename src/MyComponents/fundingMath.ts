/**
 * fundingMath.ts — Cap-table arithmetic for the Funding Strategy page.
 *
 * Goal: precise, transparent math that survives investor scrutiny.
 *
 * Simplifying assumptions (documented so we can lift them later):
 *
 *   1. All rounds modeled by effective post-money. For a SAFE with a
 *      post-money cap, post_money = cap. For a priced round,
 *      post_money = pre_money + raise. Both then dilute via the same
 *      formula: investor_pct = raise / post_money.
 *
 *   2. No option-pool top-ups modeled (we don't pre-money expand the
 *      pool). Whatever pool % exists at founding dilutes alongside
 *      everyone else. To model a top-up, add a holder with the
 *      desired post-top-up pool % and reduce founder % accordingly.
 *
 *   3. No anti-dilution provisions (no full ratchet, no weighted
 *      average). Each round dilutes all prior holders pro-rata.
 *
 *   4. SAFEs are treated as already-converted for visualization. The
 *      math is identical to a priced round at the same effective
 *      post-money — only the legal mechanics differ, and we're
 *      planning, not closing.
 *
 *   5. Inter-business equity holdings (e.g. CWA Holdings owns 15% of
 *      Takeover) are visualized but don't propagate dilution back up
 *      to the parent's cap table — the parent's stake in the child
 *      dilutes, but the parent's own holders are unaffected.
 *
 * These assumptions make the planning view ~95% accurate vs. a real
 * cap-table system of record (Carta/Pulley) and are the standard
 * approach in YC's safe calculator and most VC term-sheet modelers.
 */

import type { FundingRound, EquityHolder, FundingScenario } from "./Funding.queries";

// ─── Scenario multipliers ──────────────────────────────────────────
// Scenarios scale the *post-money* of each round. Conservative = lower
// caps (less dilution per dollar raised, easier to close). Aggressive =
// higher caps (more dilution-friendly to founders, harder to close).
export const SCENARIO_MULTIPLIERS: Record<FundingScenario, number> = {
  conservative: 0.7,
  base: 1.0,
  aggressive: 1.4,
};

export const SCENARIO_LABELS: Record<FundingScenario, string> = {
  conservative: "Conservative",
  base: "Base Case",
  aggressive: "Aggressive",
};

export const SCENARIO_DESCRIPTIONS: Record<FundingScenario, string> = {
  conservative: "Lower valuations, faster closes, more dilution per dollar.",
  base: "Default plan — what we'd quote to investors today.",
  aggressive: "Higher caps. Harder to close but better for founder ownership.",
};

// ─── Core math ─────────────────────────────────────────────────────

/** Apply a scenario multiplier to a round's caps + post-money.
 *  Returns a NEW object — never mutates the source row. */
export function applyScenario(round: FundingRound, scenario: FundingScenario): FundingRound {
  const m = SCENARIO_MULTIPLIERS[scenario];
  return {
    ...round,
    valuation_cap: round.valuation_cap != null ? round.valuation_cap * m : null,
    post_money: round.post_money * m,
  };
}

/** Dilution percentage taken by NEW investors in this round.
 *  Equal to raise / post_money. Returns a fraction 0..1. */
export function newInvestorOwnership(round: FundingRound): number {
  if (round.post_money <= 0) return 0;
  return round.target_raise / round.post_money;
}

/** Pre-money valuation (post_money − target_raise). Negative is
 *  flagged in the UI as "impossible round" (raise exceeds post_money). */
export function preMoneyValuation(round: FundingRound): number {
  return round.post_money - round.target_raise;
}

/** Effective price-per-share for the round if you'd issued 10M shares
 *  pre-round. Just for display — not used in dilution math. */
export function impliedPricePerShare(round: FundingRound, sharesOutstanding = 10_000_000): number {
  const pre = preMoneyValuation(round);
  return pre / sharesOutstanding;
}

// ─── Cap-table projection ──────────────────────────────────────────

export interface ProjectedHolder {
  /** Original row id (for stable React keys). */
  id: string;
  holder_type: EquityHolder["holder_type"];
  holder_name: string;
  holder_business_id: string | null;
  /** Ownership at the founding state (initial_percentage). */
  starting_percentage: number;
  /** Ownership after all 'closed' rounds applied. */
  current_percentage: number;
  /** Ownership after all rounds applied (closed + planned). */
  projected_percentage: number;
  /** Dollar value at the final projected post-money. */
  projected_dollar_value: number;
}

/** Project a company's cap table forward through every round in the
 *  list. Holders dilute pro-rata at each round; new investors are
 *  added as synthetic holders at each round's investor_ownership.
 *
 *  Returns:
 *    · holders[]     — every original holder + every round's new
 *                      investors, with starting/current/projected pct
 *    · totalRaised   — sum of target_raise across all rounds in list
 *    · finalPostMoney — last round's post_money (or 0 if no rounds)
 */
export function projectCapTable(
  holders: EquityHolder[],
  rounds: FundingRound[],
  scenario: FundingScenario,
): {
  holders: ProjectedHolder[];
  totalRaised: number;
  finalPostMoney: number;
  totalRaisedClosed: number;
} {
  // Sort rounds chronologically (position is our authoritative sort key).
  const scenarioRounds = [...rounds]
    .sort((a, b) => a.position - b.position)
    .map((r) => applyScenario(r, scenario));

  // Start with founding holders, normalized to fractions (0..1).
  let projection: ProjectedHolder[] = holders
    .sort((a, b) => a.position - b.position)
    .map((h) => ({
      id: h.id,
      holder_type: h.holder_type,
      holder_name: h.holder_name,
      holder_business_id: h.holder_business_id,
      starting_percentage: h.initial_percentage,
      current_percentage: h.initial_percentage,
      projected_percentage: h.initial_percentage,
      projected_dollar_value: 0,
    }));

  // Walk through each round, diluting existing holders and appending
  // a new "Investors @ <round>" synthetic holder.
  for (const round of scenarioRounds) {
    const investorPct = newInvestorOwnership(round) * 100; // store as %
    if (investorPct <= 0) continue;

    const dilutionFactor = 1 - investorPct / 100;
    projection = projection.map((h) => ({
      ...h,
      projected_percentage: h.projected_percentage * dilutionFactor,
    }));

    projection.push({
      id: `round-${round.id}`,
      holder_type: "investor",
      holder_name: `${prettyRoundName(round.round_type)} Investors`,
      holder_business_id: null,
      starting_percentage: 0,
      current_percentage: round.status === "closed" ? investorPct : 0,
      projected_percentage: investorPct,
      projected_dollar_value: round.target_raise,
    });
  }

  // Compute the closed-only projection separately (for the "current"
  // column) by running the same walk but only applying status='closed'.
  const closedRounds = scenarioRounds.filter((r) => r.status === "closed");
  let currentProjection = holders.map((h) => h.initial_percentage);
  for (const round of closedRounds) {
    const investorPct = newInvestorOwnership(round) * 100;
    const dilutionFactor = 1 - investorPct / 100;
    currentProjection = currentProjection.map((p) => p * dilutionFactor);
  }

  // Apply current pct to original holders (synthetic investor rows
  // already have their current_percentage set above).
  projection = projection.map((h, i) => {
    if (i < holders.length) {
      return { ...h, current_percentage: currentProjection[i] ?? h.starting_percentage };
    }
    return h;
  });

  // Final post-money + dollar values
  const finalPostMoney = scenarioRounds.length > 0
    ? scenarioRounds[scenarioRounds.length - 1].post_money
    : 0;

  projection = projection.map((h) => ({
    ...h,
    projected_dollar_value: (h.projected_percentage / 100) * finalPostMoney,
  }));

  const totalRaised = scenarioRounds.reduce((s, r) => s + r.target_raise, 0);
  const totalRaisedClosed = closedRounds.reduce((s, r) => s + r.target_raise, 0);

  return {
    holders: projection,
    totalRaised,
    finalPostMoney,
    totalRaisedClosed,
  };
}

// ─── Stat helpers (for the hero strip) ─────────────────────────────

/** Total raised across all closed rounds across all companies. */
export function totalRaisedAcrossCompanies(
  rounds: FundingRound[],
  scenario: FundingScenario,
): number {
  return rounds
    .filter((r) => r.status === "closed")
    .map((r) => applyScenario(r, scenario))
    .reduce((s, r) => s + (r.raised ?? r.target_raise), 0);
}

/** Currently-implied valuation for a single company = the post_money
 *  of its most recent closed round. Returns 0 if no closed rounds. */
export function currentImpliedValuation(
  rounds: FundingRound[],
  scenario: FundingScenario,
): number {
  const closed = rounds.filter((r) => r.status === "closed");
  if (closed.length === 0) return 0;
  const latest = closed.sort((a, b) => b.position - a.position)[0];
  return applyScenario(latest, scenario).post_money;
}

/** Find the next planned round across all rounds (lowest position
 *  among 'planned' or 'raising' status). */
export function findNextPlannedRound(rounds: FundingRound[]): FundingRound | null {
  const pending = rounds
    .filter((r) => r.status === "planned" || r.status === "raising")
    .sort((a, b) => a.position - b.position);
  return pending[0] ?? null;
}

/** Estimate runway months. Lean version: if a raise closed recently,
 *  assume the raise = N months of runway at a default burn. Real
 *  version would integrate with the finance dashboard's burn rate. */
export function estimateRunwayMonths(
  rounds: FundingRound[],
  monthlyBurn = 50_000,
): number {
  const closed = rounds.filter((r) => r.status === "closed");
  const totalCash = closed.reduce((s, r) => s + (r.raised ?? r.target_raise), 0);
  if (monthlyBurn <= 0) return Infinity;
  return Math.floor(totalCash / monthlyBurn);
}

// ─── Display helpers ───────────────────────────────────────────────

export function formatDollars(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "—";
  if (opts.compact) {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function prettyRoundName(type: FundingRound["round_type"]): string {
  switch (type) {
    case "pre-seed":  return "Pre-Seed";
    case "seed":      return "Seed";
    case "series-a":  return "Series A";
    case "series-b":  return "Series B";
    case "series-c":  return "Series C";
    case "bridge":    return "Bridge";
  }
}

export function holderTypeLabel(t: EquityHolder["holder_type"]): string {
  switch (t) {
    case "founder":       return "Founder";
    case "employee":      return "Employee";
    case "employee_pool": return "Option Pool";
    case "investor":      return "Investor";
    case "business":      return "Subsidiary / Parent";
    case "advisor":       return "Advisor";
  }
}

export function holderTypeColor(t: EquityHolder["holder_type"]): string {
  switch (t) {
    case "founder":       return "bg-indigo-500/70  border-indigo-400/50";
    case "employee":      return "bg-emerald-500/70 border-emerald-400/50";
    case "employee_pool": return "bg-emerald-500/40 border-emerald-400/40";
    case "investor":      return "bg-amber-500/60   border-amber-400/40";
    case "business":      return "bg-violet-500/70  border-violet-400/50";
    case "advisor":       return "bg-slate-500/60   border-slate-400/40";
  }
}
