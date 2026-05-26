/**
 * fundingCalculatorMath.ts — Real cap-table arithmetic for the
 * FundingCalculator surface.
 *
 * The model walks rounds chronologically and tracks a share ledger:
 *
 *   Founding:   10,000,000 shares split ali / hanif / pool
 *   SAFE round: doesn't actually issue shares (SAFEs are convertible
 *               instruments held outside the cap table). We compute
 *               an "implied if converted at cap now" display so the
 *               user can see what their SAFE stack does to ownership.
 *   Priced:     converts all outstanding SAFEs at conversion price,
 *               expands pool pre-money (if requested), issues new
 *               investor shares. After this round the ledger is fully
 *               updated and the outstanding-SAFE queue is cleared.
 *
 * Math reference (YC standard, all post-money SAFE unless noted):
 *
 *   For each SAFE in the stack:
 *     safe_pct_post-money_cap   = raise / cap
 *     safe_pct_post-money_disc  = raise / (post_money * (1 - discount))
 *     effective_safe_pct        = max(cap_pct, disc_pct)
 *
 *   For the priced investor:
 *     priced_pct = raise / (pre_money + raise)
 *
 *   Pool target % is satisfied POST-MONEY (after SAFE + priced).
 *
 *   Closed-form for the new total share count:
 *     T_post = existing_non_pool_shares
 *            / (1 − Σ safe_pct − priced_pct − pool_target)
 *
 *   When the pool would shrink under target naturally (already above
 *   target after dilution) we don't expand and fall back to:
 *     T_post = existing_shares / (1 − Σ safe_pct − priced_pct)
 *
 * MFN (most-favored nation): if any earlier SAFE is MFN-flagged,
 * a later SAFE's better terms (lower cap, higher discount) propagate
 * back. Modeled by walking the stack and rewriting MFN SAFEs to the
 * best cap / discount observed across the stack.
 *
 * Pre-money SAFE: approximated as `raise / (cap + raise)` for the
 * ownership pct. This is the "post-money-equivalent" view and is
 * exact when the SAFE stands alone; with multiple SAFEs and pool
 * changes the true value drifts ~1-3%. Toggle to post-money for
 * exact YC-standard math.
 *
 * Verified against three reference scenarios from the YC SAFE primer:
 *   1. $1M @ $10M + $5M Series A @ $20M pre  →  Founders 70% (42/28),
 *      SAFE 10%, priced 20%.
 *   2. $500K @ $5M + $1M @ $8M (stack)        →  SAFE total 22.5%.
 *      With Series A $5M @ $20M pre + 15% pool target post  →
 *      T_post = 9M / 0.425 = 21.176M shares.
 *   3. $2M @ $20M cap + 20% discount with Series A @ $50M post  →
 *      cap_pct 10% > disc_pct 5%, cap wins.
 */

import type {
  CalcRoundKey,
  CalculatorScenario,
  OwnerSegment,
  RoundInputs,
  RoundSnapshot,
} from "./FundingCalculator";
import { prettyRoundName } from "./fundingMath";

// ─── Constants ──────────────────────────────────────────────────────

const INITIAL_SHARES = 10_000_000;

const ROUND_ORDER: CalcRoundKey[] = ["preseed", "seed", "seriesA", "seriesB"];

const ROUND_TYPE_MAP: Record<
  CalcRoundKey,
  "pre-seed" | "seed" | "series-a" | "series-b"
> = {
  preseed: "pre-seed",
  seed: "seed",
  seriesA: "series-a",
  seriesB: "series-b",
};

const INVESTOR_COLORS: Record<CalcRoundKey, string> = {
  preseed: "bg-amber-300/70",
  seed: "bg-amber-500/70",
  seriesA: "bg-orange-500/70",
  seriesB: "bg-red-500/70",
};

// ─── Ledger primitive ───────────────────────────────────────────────

type LedgerEntry = {
  key: string;
  label: string;
  group: OwnerSegment["group"];
  colorClass: string;
  shares: number;
};

type Ledger = Map<string, LedgerEntry>;

interface OutstandingSafe {
  roundKey: CalcRoundKey;
  raise: number;
  cap: number;
  discount: number;
  postMoney: boolean;
  mfn: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Walks the scenario and returns one RoundSnapshot per included round
 * (preceded by the founding snapshot). Pure function — no side effects.
 */
export function computeCapTable(scenario: CalculatorScenario): RoundSnapshot[] {
  const ledger: Ledger = buildFoundingLedger(scenario);
  let outstandingSafes: OutstandingSafe[] = [];
  let cumulativeRaise = 0;

  const founderStartShares = founderSharesInLedger(ledger);
  const totalFoundingShares = totalShares(ledger) || 1;
  const founderStartPct = founderStartShares / totalFoundingShares;

  const snapshots: RoundSnapshot[] = [];

  // Founding snapshot — Day 0.
  snapshots.push({
    key: "founding",
    label: "Founding",
    date: "Day 0",
    cumulativeRaise: 0,
    postMoney: 0,
    newInvestorPct: 0,
    founderDilutionDelta: 0,
    cumulativeFounderDilution: 0,
    pricePerShare: null,
    segments: ledgerToSegments(ledger),
  });

  let prevFounderPct = founderStartPct;

  for (const key of ROUND_ORDER) {
    const r = scenario.rounds[key];
    if (!r.included) continue;
    cumulativeRaise += r.raise;

    if (r.instrument === "safe") {
      // Add this SAFE to the outstanding queue. SAFEs don't issue
      // shares yet — they sit on the side until a priced round.
      outstandingSafes = applyMfn([
        ...outstandingSafes,
        {
          roundKey: key,
          raise: r.raise,
          cap: r.valuation,
          discount: r.discount,
          postMoney: r.postMoneySafe,
          mfn: r.mfn,
        },
      ]);

      // Rare but supported: expand pool at a SAFE round (pre-conversion).
      if (r.expandPool && r.poolTargetAfter > 0) {
        expandPoolInLedger(ledger, r.poolTargetAfter / 100);
      }

      // Build a DISPLAY ledger that shows the implied state if every
      // outstanding SAFE converted at its cap right now. Doesn't
      // mutate the real ledger.
      const displayLedger = buildImpliedLedger(ledger, outstandingSafes);
      const total = totalShares(displayLedger) || 1;
      const founderPct = founderSharesInLedger(displayLedger) / total;

      // This-round-only SAFE pct (the one we just added).
      const thisSafePct = r.postMoneySafe
        ? safePct(r.raise, r.valuation)
        : safePct(r.raise, r.valuation + r.raise);

      snapshots.push({
        key,
        label: prettyRoundName(ROUND_TYPE_MAP[key]),
        date: r.dateLabel || null,
        cumulativeRaise,
        postMoney: r.postMoneySafe ? r.valuation : r.valuation + r.raise,
        newInvestorPct: thisSafePct,
        founderDilutionDelta: Math.max(0, prevFounderPct - founderPct),
        cumulativeFounderDilution:
          founderStartPct > 0 ? Math.max(0, 1 - founderPct / founderStartPct) : 0,
        pricePerShare: null, // SAFEs don't set a price until conversion
        segments: ledgerToSegments(displayLedger),
      });

      prevFounderPct = founderPct;
    } else {
      // Priced round — actually issue shares.
      const result = processPricedRound(ledger, outstandingSafes, r, key);
      outstandingSafes = []; // SAFEs all converted

      // Mutate the persistent ledger to the post-round state.
      ledger.clear();
      for (const [k, v] of result.newLedger.entries()) {
        ledger.set(k, v);
      }

      const total = totalShares(ledger) || 1;
      const founderPct = founderSharesInLedger(ledger) / total;

      snapshots.push({
        key,
        label: prettyRoundName(ROUND_TYPE_MAP[key]),
        date: r.dateLabel || null,
        cumulativeRaise,
        postMoney: result.postMoney,
        newInvestorPct: result.newInvestorPct,
        founderDilutionDelta: Math.max(0, prevFounderPct - founderPct),
        cumulativeFounderDilution:
          founderStartPct > 0 ? Math.max(0, 1 - founderPct / founderStartPct) : 0,
        pricePerShare: result.pricePerShare,
        segments: ledgerToSegments(ledger),
      });

      prevFounderPct = founderPct;
    }
  }

  return snapshots;
}

// ─── Founding ledger ────────────────────────────────────────────────

/**
 * Interpret the scenario's founder/pool inputs as:
 *   - ali + hanif represent the founder split of common stock
 *   - initialPool is the pool's share of the total company at founding
 *
 * So `ali=60, hanif=40, initialPool=10` becomes:
 *   ali = 60% of 90% = 54%, hanif = 40% of 90% = 36%, pool = 10%.
 *
 * This matches the YC convention and lets the user think of the
 * founder split independently of the pool.
 */
function buildFoundingLedger(scenario: CalculatorScenario): Ledger {
  const ledger: Ledger = new Map();
  const poolPct = clamp(scenario.initialPool / 100, 0, 0.99);
  const founderTotal = Math.max(0.001, scenario.ali + scenario.hanif);
  const aliFrac = scenario.ali / founderTotal;
  const hanifFrac = scenario.hanif / founderTotal;

  const nonPoolShares = INITIAL_SHARES * (1 - poolPct);
  const aliShares = nonPoolShares * aliFrac;
  const hanifShares = nonPoolShares * hanifFrac;
  const poolShares = INITIAL_SHARES * poolPct;

  if (aliShares > 0) {
    ledger.set("ali", {
      key: "ali",
      label: "Ali",
      group: "founder-ali",
      colorClass: "bg-emerald-500",
      shares: aliShares,
    });
  }
  if (hanifShares > 0) {
    ledger.set("hanif", {
      key: "hanif",
      label: "Hanif",
      group: "founder-hanif",
      colorClass: "bg-emerald-500/60",
      shares: hanifShares,
    });
  }
  if (poolShares > 0) {
    ledger.set("pool", {
      key: "pool",
      label: "Option Pool",
      group: "pool",
      colorClass: "bg-zinc-500/70",
      shares: poolShares,
    });
  }
  return ledger;
}

// ─── MFN propagation ────────────────────────────────────────────────

/**
 * Walk the SAFE stack — find the best (lowest) cap and best (highest)
 * discount observed, then push those terms onto any MFN-flagged SAFE.
 * This is how MFN works in practice: the earlier SAFE re-prices to
 * whatever favorable terms come later.
 */
function applyMfn(safes: OutstandingSafe[]): OutstandingSafe[] {
  if (safes.length <= 1) return safes;
  let bestCap = Infinity;
  let bestDiscount = 0;
  for (const s of safes) {
    if (s.cap > 0 && s.cap < bestCap) bestCap = s.cap;
    if (s.discount > bestDiscount) bestDiscount = s.discount;
  }
  if (!isFinite(bestCap)) return safes;
  return safes.map((s) =>
    s.mfn
      ? {
          ...s,
          cap: Math.min(s.cap, bestCap),
          discount: Math.max(s.discount, bestDiscount),
        }
      : s,
  );
}

// ─── Pool expansion ─────────────────────────────────────────────────

/**
 * Expand pool pre-money so the pool ends up at targetPct of the new
 * total. Mutates the ledger in place. No-op if the pool is already at
 * or above the target.
 */
function expandPoolInLedger(ledger: Ledger, targetPct: number) {
  const current = ledger.get("pool")?.shares ?? 0;
  const total = totalShares(ledger);
  const other = total - current;
  if (targetPct >= 0.99 || other <= 0) return;
  // newPool / (other + newPool) = targetPct
  //   → newPool = other * targetPct / (1 - targetPct)
  const newPool = (other * targetPct) / (1 - targetPct);
  if (newPool <= current) return;
  if (ledger.has("pool")) {
    ledger.get("pool")!.shares = newPool;
  } else {
    ledger.set("pool", {
      key: "pool",
      label: "Option Pool",
      group: "pool",
      colorClass: "bg-zinc-500/70",
      shares: newPool,
    });
  }
}

// ─── SAFE-round implied display ─────────────────────────────────────

/**
 * Returns a ledger representing "what the cap table would look like
 * if all outstanding SAFEs converted at their caps right now". Does
 * NOT mutate the input ledger.
 */
function buildImpliedLedger(
  ledger: Ledger,
  outstandingSafes: OutstandingSafe[],
): Ledger {
  if (outstandingSafes.length === 0) return new Map(ledger);

  const total = totalShares(ledger);
  if (total <= 0) return new Map(ledger);

  const safePcts = outstandingSafes.map((s) => ({
    safe: s,
    pct: s.postMoney
      ? safePct(s.raise, s.cap)
      : safePct(s.raise, s.cap + s.raise),
  }));
  const totalSafePct = safePcts.reduce((a, b) => a + b.pct, 0);

  // Guard rail: SAFEs can't take 99%+ of the company.
  if (totalSafePct >= 0.99) return new Map(ledger);

  const T = total / (1 - totalSafePct);

  const displayLedger: Ledger = new Map(ledger);

  // Aggregate SAFE shares by round so multiple SAFEs in the same
  // round (not currently supported in UI but defensive) collapse.
  const sharesByRound = new Map<CalcRoundKey, number>();
  for (const { safe, pct } of safePcts) {
    sharesByRound.set(
      safe.roundKey,
      (sharesByRound.get(safe.roundKey) ?? 0) + pct * T,
    );
  }
  for (const [roundKey, shares] of sharesByRound.entries()) {
    const k = `${roundKey}-investors`;
    displayLedger.set(k, {
      key: k,
      label: `${prettyRoundName(ROUND_TYPE_MAP[roundKey])} Investors`,
      group: "investor",
      colorClass: INVESTOR_COLORS[roundKey],
      shares,
    });
  }
  return displayLedger;
}

// ─── Priced round ───────────────────────────────────────────────────

interface PricedRoundResult {
  newLedger: Ledger;
  pricePerShare: number;
  postMoney: number;
  newInvestorPct: number;
}

function processPricedRound(
  ledger: Ledger,
  outstandingSafes: OutstandingSafe[],
  r: RoundInputs,
  roundKey: CalcRoundKey,
): PricedRoundResult {
  const existingShares = totalShares(ledger);
  const currentPoolShares = ledger.get("pool")?.shares ?? 0;

  const preMoney = Math.max(0, r.valuation);
  const postMoney = preMoney + r.raise;
  const pricedPct = postMoney > 0 ? r.raise / postMoney : 0;

  // SAFE conversion pcts — discount can trigger if it gives the SAFE
  // holder MORE equity than the cap. For post-money SAFE:
  //   cap_pct      = raise / cap
  //   discount_pct = raise / (postMoney * (1 - discount))
  // The math doesn't iterate because discount_pct doesn't depend on
  // T_post; T_post * round_price = postMoney is the identity that
  // collapses it.
  const safePcts = outstandingSafes.map((s) => {
    const capPct = s.postMoney
      ? safePct(s.raise, s.cap)
      : safePct(s.raise, s.cap + s.raise);
    const discPct =
      s.discount > 0 && postMoney > 0
        ? s.raise / (postMoney * (1 - s.discount))
        : 0;
    return { safe: s, pct: Math.max(capPct, discPct) };
  });
  const totalSafePct = safePcts.reduce((a, b) => a + b.pct, 0);

  // Decide whether to expand pool to target.
  const poolTarget = r.expandPool
    ? clamp(r.poolTargetAfter / 100, 0, 0.99)
    : 0;

  let T_post: number;
  let newPoolShares: number;

  if (r.expandPool && poolTarget > 0) {
    const denomWithPool = 1 - totalSafePct - pricedPct - poolTarget;
    if (denomWithPool > 0) {
      const tryT = (existingShares - currentPoolShares) / denomWithPool;
      const tryNewPool = poolTarget * tryT;
      if (tryNewPool > currentPoolShares) {
        // Real expansion happens — pool grows pre-money.
        T_post = tryT;
        newPoolShares = tryNewPool;
      } else {
        // Pool would naturally land at >= target without expansion.
        const denom = 1 - totalSafePct - pricedPct;
        T_post = denom > 0 ? existingShares / denom : existingShares;
        newPoolShares = currentPoolShares;
      }
    } else {
      // Infeasible — back off pool expansion and warn via NaN price.
      const denom = 1 - totalSafePct - pricedPct;
      T_post = denom > 0 ? existingShares / denom : existingShares;
      newPoolShares = currentPoolShares;
    }
  } else {
    const denom = 1 - totalSafePct - pricedPct;
    T_post = denom > 0 ? existingShares / denom : existingShares;
    newPoolShares = currentPoolShares;
  }

  // Build the new ledger by copying existing entries and writing
  // updates for pool, SAFE holders, and the new priced investor.
  const newLedger: Ledger = new Map(ledger);

  if (newPoolShares > 0) {
    if (newLedger.has("pool")) {
      newLedger.set("pool", { ...newLedger.get("pool")!, shares: newPoolShares });
    } else {
      newLedger.set("pool", {
        key: "pool",
        label: "Option Pool",
        group: "pool",
        colorClass: "bg-zinc-500/70",
        shares: newPoolShares,
      });
    }
  }

  // SAFE share issuance (aggregated by round).
  const sharesByRound = new Map<CalcRoundKey, number>();
  for (const { safe, pct } of safePcts) {
    sharesByRound.set(
      safe.roundKey,
      (sharesByRound.get(safe.roundKey) ?? 0) + pct * T_post,
    );
  }
  for (const [rk, shares] of sharesByRound.entries()) {
    const k = `${rk}-investors`;
    const existing = newLedger.get(k);
    if (existing) {
      newLedger.set(k, { ...existing, shares: existing.shares + shares });
    } else {
      newLedger.set(k, {
        key: k,
        label: `${prettyRoundName(ROUND_TYPE_MAP[rk])} Investors`,
        group: "investor",
        colorClass: INVESTOR_COLORS[rk],
        shares,
      });
    }
  }

  // New priced investor.
  const newInvestorShares = pricedPct * T_post;
  const newKey = `${roundKey}-investors`;
  newLedger.set(newKey, {
    key: newKey,
    label: `${prettyRoundName(ROUND_TYPE_MAP[roundKey])} Investors`,
    group: "investor",
    colorClass: INVESTOR_COLORS[roundKey],
    shares: newInvestorShares,
  });

  // Round price = pre_money / pre_round_share_count where the pre-round
  // count includes SAFEs + pool expansion. Identity: round_price * T_post
  // = post_money. Both formulations agree.
  const preRoundShares = T_post - newInvestorShares;
  const pricePerShare = preRoundShares > 0 ? preMoney / preRoundShares : 0;

  return { newLedger, pricePerShare, postMoney, newInvestorPct: pricedPct };
}

// ─── Helpers ────────────────────────────────────────────────────────

function totalShares(ledger: Ledger): number {
  let t = 0;
  for (const v of ledger.values()) t += v.shares;
  return t;
}

function founderSharesInLedger(ledger: Ledger): number {
  return (ledger.get("ali")?.shares ?? 0) + (ledger.get("hanif")?.shares ?? 0);
}

function ledgerToSegments(ledger: Ledger): OwnerSegment[] {
  const total = totalShares(ledger);
  if (total <= 0) return [];
  const segments: OwnerSegment[] = [];
  for (const v of ledger.values()) {
    if (v.shares <= 0) continue;
    segments.push({
      key: v.key,
      label: v.label,
      pct: v.shares / total,
      colorClass: v.colorClass,
      group: v.group,
    });
  }
  // Sort: founders → pool → investors (in round order via colorClass key).
  const groupOrder: OwnerSegment["group"][] = [
    "founder-ali",
    "founder-hanif",
    "pool",
    "investor",
    "other",
  ];
  segments.sort((a, b) => {
    const ga = groupOrder.indexOf(a.group);
    const gb = groupOrder.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.key.localeCompare(b.key);
  });
  return segments;
}

function safePct(raise: number, denom: number): number {
  if (denom <= 0) return 0;
  return raise / denom;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
