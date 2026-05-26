/**
 * FundingCalculator.tsx — Interactive cap-table what-if modeling.
 *
 * Sister surface to FundingPage.tsx. FundingPage is the PLAN (what
 * we'd quote investors today). This is the CALCULATOR — drag sliders,
 * see dilution propagate across all parties in real time.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────┬──────────────────────────────────┐
 *   │  CONTROLS (45%)              │  VISUALIZATION (55%)             │
 *   │                              │                                  │
 *   │  Scenario tabs               │  ┌── Final state hero card ──┐   │
 *   │  Founder section             │  │ Ali 24% / Hanif 16% / ... │   │
 *   │  Option pool section         │  └───────────────────────────┘   │
 *   │  Pre-Seed card               │                                  │
 *   │  Seed card                   │  ┌── Stacked round bars ────┐   │
 *   │  Series A card               │  │ Founding   ████████████ │   │
 *   │  Series B card               │  │ Pre-Seed   ████████████ │   │
 *   │                              │  │ Seed       ████████████ │   │
 *   │                              │  │ Series A   ████████████ │   │
 *   │                              │  │ Series B   ████████████ │   │
 *   │                              │  └─────────────────────────┘   │
 *   │                              │  Summary table                  │
 *   └──────────────────────────────┴──────────────────────────────────┘
 *
 * On narrow screens the columns stack vertically.
 *
 * State is persisted to localStorage (key: cwa-funding-calculator-v1)
 * with separate values per scenario (conservative / base / aggressive).
 *
 * THIS FILE IS THE DAY 1 SHELL. Math returns a hardcoded plausible
 * snapshot for visual evaluation. Day 2 swaps in the real cap-table
 * arithmetic (SAFE post/pre-money, priced round mechanics, pool
 * expansion, MFN, discounts).
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Sliders,
  Users,
  PieChart,
  Info,
  Copy,
  Save,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { formatDollars, formatPercent, prettyRoundName } from "./fundingMath";
import type { FundingRoundType } from "./Funding.queries";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type CalcScenarioKey = "conservative" | "base" | "aggressive";
export type CalcRoundKey = "preseed" | "seed" | "seriesA" | "seriesB";

const ROUND_ORDER: CalcRoundKey[] = ["preseed", "seed", "seriesA", "seriesB"];

const ROUND_TYPE_MAP: Record<CalcRoundKey, FundingRoundType> = {
  preseed: "pre-seed",
  seed: "seed",
  seriesA: "series-a",
  seriesB: "series-b",
};

export interface RoundInputs {
  included: boolean;
  instrument: "safe" | "priced";
  /** Dollars to raise this round. */
  raise: number;
  /** SAFE: valuation cap. Priced: pre-money valuation. */
  valuation: number;
  /** Post-money vs pre-money SAFE (YC standard is post-money). */
  postMoneySafe: boolean;
  /** Discount rate 0..0.30 — applied at SAFE conversion. */
  discount: number;
  /** MFN clause — earlier SAFE re-prices to better later terms. */
  mfn: boolean;
  /** Create or expand the option pool in this round. */
  expandPool: boolean;
  /** Target pool % AFTER expansion (only relevant when expandPool). */
  poolTargetAfter: number;
  /** Free-text date label shown on the visualization bar. */
  dateLabel: string;
}

export interface CalculatorScenario {
  ali: number;            // founding %
  hanif: number;          // founding %
  initialPool: number;    // founding pool %
  rounds: Record<CalcRoundKey, RoundInputs>;
}

export interface CalcState {
  active: CalcScenarioKey;
  scenarios: Record<CalcScenarioKey, CalculatorScenario>;
}

/** Ownership segment in a cap-table snapshot. */
export interface OwnerSegment {
  key: string;
  label: string;
  /** Fraction 0..1. Displayed as % in the UI. */
  pct: number;
  /** Tailwind class for the segment's fill color. */
  colorClass: string;
  /** Holder type — drives sort order + legend grouping. */
  group: "founder-ali" | "founder-hanif" | "pool" | "investor" | "other";
}

export interface RoundSnapshot {
  key: string;            // "founding" | "preseed" | ...
  label: string;
  date: string | null;
  /** Cumulative dollars raised after this round. */
  cumulativeRaise: number;
  /** Post-money valuation after this round (0 for founding). */
  postMoney: number;
  /** Fraction of company new investors took this round (0 for founding). */
  newInvestorPct: number;
  /** Founder dilution delta from previous snapshot. */
  founderDilutionDelta: number;
  /** Cumulative founder dilution from founding. */
  cumulativeFounderDilution: number;
  /** Resulting price per share post-conversion (display only). */
  pricePerShare: number | null;
  /** Ordered segments — always sum to ~1.0. */
  segments: OwnerSegment[];
}

// ═══════════════════════════════════════════════════════════════════
// Defaults + persistence
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_ROUNDS: Record<CalcRoundKey, RoundInputs> = {
  preseed: {
    included: false, instrument: "safe", raise: 1_500_000, valuation: 10_000_000,
    postMoneySafe: true, discount: 0.20, mfn: false, expandPool: false,
    poolTargetAfter: 10, dateLabel: "Jul 2026",
  },
  seed: {
    included: false, instrument: "safe", raise: 5_000_000, valuation: 40_000_000,
    postMoneySafe: true, discount: 0.20, mfn: false, expandPool: false,
    poolTargetAfter: 10, dateLabel: "Feb 2027",
  },
  seriesA: {
    included: false, instrument: "priced", raise: 15_000_000, valuation: 65_000_000,
    postMoneySafe: true, discount: 0.20, mfn: false, expandPool: true,
    poolTargetAfter: 15, dateLabel: "Apr 2028",
  },
  seriesB: {
    included: false, instrument: "priced", raise: 40_000_000, valuation: 210_000_000,
    postMoneySafe: true, discount: 0.20, mfn: false, expandPool: false,
    poolTargetAfter: 15, dateLabel: "Jan 2030",
  },
};

function defaultScenario(): CalculatorScenario {
  return {
    ali: 60,
    hanif: 40,
    initialPool: 10,
    rounds: structuredClone(DEFAULT_ROUNDS),
  };
}

function defaultState(): CalcState {
  return {
    active: "base",
    scenarios: {
      conservative: defaultScenario(),
      base: defaultScenario(),
      aggressive: defaultScenario(),
    },
  };
}

const STORAGE_KEY = "cwa-funding-calculator-v1";

function loadState(): CalcState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as CalcState;
    // Cheap shape validation — fall back to defaults on anything malformed.
    if (!parsed?.scenarios?.base?.rounds) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function persistState(state: CalcState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota / private mode — ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// STUB MATH (Day 1) — returns a hardcoded plausible cap-table walk
// so the shell visual fidelity can be evaluated before the real
// arithmetic is wired up. Day 2 swaps this for the real algorithm.
// ═══════════════════════════════════════════════════════════════════

function stubComputeCapTable(scenario: CalculatorScenario): RoundSnapshot[] {
  // Walk: founding → included rounds in chronological order.
  // Stub takes the ali/hanif/pool ratio at founding then dilutes
  // everyone naively round by round so the visual bars look real
  // enough for design sign-off.

  const founderTotal = scenario.ali + scenario.hanif;
  const totalAtFounding = founderTotal + scenario.initialPool;
  // Normalize to 100% if user's inputs sum elsewhere.
  const norm = totalAtFounding > 0 ? 100 / totalAtFounding : 1;

  const snapshots: RoundSnapshot[] = [];

  // Founding state
  let aliPct = (scenario.ali * norm) / 100;
  let hanifPct = (scenario.hanif * norm) / 100;
  let poolPct = (scenario.initialPool * norm) / 100;
  let investorSegments: { key: string; label: string; pct: number; round: CalcRoundKey }[] = [];

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
    segments: buildSegments(aliPct, hanifPct, poolPct, investorSegments),
  });

  let cumulativeRaise = 0;
  const founderStart = aliPct + hanifPct;

  for (const key of ROUND_ORDER) {
    const r = scenario.rounds[key];
    if (!r.included) continue;

    // STUB: investor pct = raise / post_money where post_money ~= valuation
    // (priced) or valuation (SAFE cap as post-money). This is a rough proxy
    // and not the real formula — just plausible enough to render bars.
    const postMoney = r.instrument === "priced" ? r.valuation + r.raise : r.valuation;
    const newPct = postMoney > 0 ? r.raise / postMoney : 0;
    const dilutionFactor = 1 - newPct;

    // Stub pool expansion: if expandPool flag set, bump pool to target % pre-investor (founder dilution).
    if (r.expandPool && r.poolTargetAfter > poolPct * 100) {
      const targetPool = r.poolTargetAfter / 100;
      const expansion = targetPool - poolPct;
      // Dilute founders proportionally to provide the expansion.
      const founderTotal2 = aliPct + hanifPct;
      if (founderTotal2 > 0) {
        const aliShare = aliPct / founderTotal2;
        const hanifShare = hanifPct / founderTotal2;
        aliPct -= expansion * aliShare;
        hanifPct -= expansion * hanifShare;
        poolPct = targetPool;
      }
    }

    aliPct *= dilutionFactor;
    hanifPct *= dilutionFactor;
    poolPct *= dilutionFactor;
    investorSegments = investorSegments.map((s) => ({ ...s, pct: s.pct * dilutionFactor }));
    investorSegments.push({
      key: `${key}-investors`,
      label: `${prettyRoundName(ROUND_TYPE_MAP[key])} Investors`,
      pct: newPct,
      round: key,
    });

    cumulativeRaise += r.raise;
    const founderEnd = aliPct + hanifPct;
    snapshots.push({
      key,
      label: prettyRoundName(ROUND_TYPE_MAP[key]),
      date: r.dateLabel || null,
      cumulativeRaise,
      postMoney,
      newInvestorPct: newPct,
      founderDilutionDelta: dilutionFactor < 1 ? 1 - dilutionFactor : 0,
      cumulativeFounderDilution: founderStart > 0 ? 1 - founderEnd / founderStart : 0,
      pricePerShare: null,
      segments: buildSegments(aliPct, hanifPct, poolPct, investorSegments),
    });
  }

  return snapshots;
}

function buildSegments(
  aliPct: number,
  hanifPct: number,
  poolPct: number,
  investors: { key: string; label: string; pct: number; round: CalcRoundKey }[],
): OwnerSegment[] {
  const segs: OwnerSegment[] = [];
  if (aliPct > 0) segs.push({
    key: "ali", label: "Ali", pct: aliPct, group: "founder-ali",
    colorClass: "bg-emerald-500",
  });
  if (hanifPct > 0) segs.push({
    key: "hanif", label: "Hanif", pct: hanifPct, group: "founder-hanif",
    colorClass: "bg-emerald-500/60",
  });
  if (poolPct > 0) segs.push({
    key: "pool", label: "Option Pool", pct: poolPct, group: "pool",
    colorClass: "bg-zinc-500/70",
  });
  for (const inv of investors) {
    segs.push({
      key: inv.key,
      label: inv.label,
      pct: inv.pct,
      group: "investor",
      colorClass: INVESTOR_COLORS[inv.round],
    });
  }
  return segs;
}

const INVESTOR_COLORS: Record<CalcRoundKey, string> = {
  preseed: "bg-amber-300/70",
  seed:    "bg-amber-500/70",
  seriesA: "bg-orange-500/70",
  seriesB: "bg-red-500/70",
};

// ═══════════════════════════════════════════════════════════════════
// Top-level component
// ═══════════════════════════════════════════════════════════════════

export default function FundingCalculator() {
  const [state, setState] = useState<CalcState>(() => loadState());
  useEffect(() => { persistState(state); }, [state]);

  const scenario = state.scenarios[state.active];

  // Memo the snapshots — recomputes only when active scenario changes.
  // Day 2 will wrap this in a debounce-on-slider-drag if needed.
  const snapshots = useMemo(() => stubComputeCapTable(scenario), [scenario]);
  const finalSnapshot = snapshots[snapshots.length - 1];

  // Helpers to update nested scenario state
  function updateActive(patch: Partial<CalculatorScenario>) {
    setState((s) => ({
      ...s,
      scenarios: { ...s.scenarios, [s.active]: { ...s.scenarios[s.active], ...patch } },
    }));
  }
  function updateRound(key: CalcRoundKey, patch: Partial<RoundInputs>) {
    setState((s) => ({
      ...s,
      scenarios: {
        ...s.scenarios,
        [s.active]: {
          ...s.scenarios[s.active],
          rounds: {
            ...s.scenarios[s.active].rounds,
            [key]: { ...s.scenarios[s.active].rounds[key], ...patch },
          },
        },
      },
    }));
  }
  function setActive(next: CalcScenarioKey) {
    setState((s) => ({ ...s, active: next }));
  }
  function copyFromBase() {
    setState((s) => ({
      ...s,
      scenarios: { ...s.scenarios, [s.active]: structuredClone(s.scenarios.base) },
    }));
  }

  const founderSum = scenario.ali + scenario.hanif;
  const founderImbalance = Math.abs(founderSum - 100) > 0.1;

  return (
    <div className="min-h-[calc(100vh-200px)] w-full bg-background text-foreground">
      {/* ── Scenario tabs ────────────────────────────────────────── */}
      <div className="px-10 pt-2 pb-4">
        <ScenarioTabs
          active={state.active}
          onChange={setActive}
          onCopyFromBase={copyFromBase}
        />
      </div>

      {/* ── Split layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6 px-10 pb-16">
        {/* ─── LEFT: Controls ─── */}
        <div className="space-y-5 min-w-0">
          <FounderSection
            ali={scenario.ali}
            hanif={scenario.hanif}
            imbalance={founderImbalance}
            sum={founderSum}
            onChangeAli={(v) => updateActive({ ali: v, hanif: clamp01(100 - v, 100) })}
            onChangeHanif={(v) => updateActive({ hanif: v })}
            onChangeAliOnly={(v) => updateActive({ ali: v })}
          />

          <OptionPoolSection
            initialPool={scenario.initialPool}
            onChangeInitial={(v) => updateActive({ initialPool: v })}
          />

          {ROUND_ORDER.map((key) => (
            <RoundSection
              key={key}
              roundKey={key}
              inputs={scenario.rounds[key]}
              onPatch={(patch) => updateRound(key, patch)}
            />
          ))}
        </div>

        {/* ─── RIGHT: Visualization ─── */}
        <div className="space-y-5 min-w-0">
          <FinalStateCard
            snapshot={finalSnapshot}
            totalRaised={finalSnapshot?.cumulativeRaise ?? 0}
            roundsCount={snapshots.length - 1}
          />

          <RoundBarsStack snapshots={snapshots} />

          <SummaryTable snapshots={snapshots} scenario={scenario} />

          <ExportRow scenario={scenario} snapshots={snapshots} />
        </div>
      </div>
    </div>
  );
}

function clamp01(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

// ═══════════════════════════════════════════════════════════════════
// Scenario tabs
// ═══════════════════════════════════════════════════════════════════
function ScenarioTabs({
  active, onChange, onCopyFromBase,
}: {
  active: CalcScenarioKey;
  onChange: (k: CalcScenarioKey) => void;
  onCopyFromBase: () => void;
}) {
  const tabs: { id: CalcScenarioKey; label: string; tone: string }[] = [
    { id: "conservative", label: "Conservative", tone: "text-emerald-200" },
    { id: "base",         label: "Base Case",    tone: "text-foreground" },
    { id: "aggressive",   label: "Aggressive",   tone: "text-red-200" },
  ];
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden bg-card">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative px-5 py-2.5 text-[12.5px] font-semibold transition-colors ${
                isActive ? `bg-muted/60 ${t.tone}` : "text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted/30"
              }`}
            >
              {t.label}
              {isActive && (
                <motion.div
                  layoutId="calc-scenario-underline"
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
            </button>
          );
        })}
      </div>
      {active !== "base" && (
        <button
          type="button"
          onClick={onCopyFromBase}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          title="Copy Base Case values into this scenario"
        >
          <Sparkles className="h-3 w-3" />
          Copy from Base Case
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Founder section
// ═══════════════════════════════════════════════════════════════════
function FounderSection({
  ali, hanif, sum, imbalance,
  onChangeAli, onChangeHanif, onChangeAliOnly,
}: {
  ali: number; hanif: number; sum: number; imbalance: boolean;
  onChangeAli: (v: number) => void;
  onChangeHanif: (v: number) => void;
  onChangeAliOnly: (v: number) => void;
}) {
  return (
    <SectionCard icon={<Users className="h-3.5 w-3.5" />} title="Founders" accent="emerald">
      <SliderRow
        label="Ali"
        value={ali}
        min={0}
        max={100}
        step={0.5}
        suffix="%"
        onChange={onChangeAli}
        onChangeAlternate={onChangeAliOnly}
        alternateHint="Hold ⇧ to edit Ali only (don't auto-fill Hanif)"
        accent="emerald"
      />
      <SliderRow
        label="Hanif"
        value={hanif}
        min={0}
        max={100}
        step={0.5}
        suffix="%"
        onChange={onChangeHanif}
        accent="emerald-dim"
      />
      {imbalance && (
        <div className="mt-2 flex items-start gap-2 text-[11.5px] text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Founders sum to <strong className="tabular-nums">{sum.toFixed(1)}%</strong> — not 100%.
            That's fine during editing (e.g. you're negotiating a third founder). Math runs against whatever you set.
          </span>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Option pool section
// ═══════════════════════════════════════════════════════════════════
function OptionPoolSection({
  initialPool, onChangeInitial,
}: {
  initialPool: number;
  onChangeInitial: (v: number) => void;
}) {
  return (
    <SectionCard icon={<PieChart className="h-3.5 w-3.5" />} title="Option Pool" accent="zinc">
      <SliderRow
        label="Initial pool at founding"
        value={initialPool}
        min={0} max={25} step={0.5} suffix="%"
        onChange={onChangeInitial}
        accent="zinc"
      />
      <div className="mt-3 inline-flex items-start gap-2 text-[11px] text-muted-foreground/90 leading-relaxed">
        <Info className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
        <span>
          Option pool dilutes founders BEFORE investors come in. Standard: 10% at founding,
          expanded to 15% pre Series A. Per-round expansion is configured inside each round card below.
        </span>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Round section
// ═══════════════════════════════════════════════════════════════════
function RoundSection({
  roundKey, inputs, onPatch,
}: {
  roundKey: CalcRoundKey;
  inputs: RoundInputs;
  onPatch: (patch: Partial<RoundInputs>) => void;
}) {
  const niceName = prettyRoundName(ROUND_TYPE_MAP[roundKey]);
  // Per-round raise + valuation scales so sliders feel sensible.
  const scales: Record<CalcRoundKey, { raiseMax: number; valMax: number }> = {
    preseed: { raiseMax: 5_000_000,   valMax: 20_000_000 },
    seed:    { raiseMax: 15_000_000,  valMax: 75_000_000 },
    seriesA: { raiseMax: 40_000_000,  valMax: 200_000_000 },
    seriesB: { raiseMax: 100_000_000, valMax: 500_000_000 },
  };
  const { raiseMax, valMax } = scales[roundKey];

  return (
    <SectionCard
      icon={<Sliders className="h-3.5 w-3.5" />}
      title={niceName}
      accent={ROUND_ACCENT[roundKey]}
      collapsedHint={inputs.included ? undefined : "Off — toggle on to model this round"}
      headerRight={
        <Toggle
          checked={inputs.included}
          onChange={(v) => onPatch({ included: v })}
          srLabel={`Include ${niceName}`}
        />
      }
      muted={!inputs.included}
    >
      {/* Body fades when toggle is off but stays visible/editable */}
      <div className={inputs.included ? "" : "opacity-50 pointer-events-auto"}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Instrument">
            <select
              value={inputs.instrument}
              onChange={(e) => onPatch({ instrument: e.target.value as "safe" | "priced" })}
              className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            >
              <option value="safe">SAFE</option>
              <option value="priced">Priced Round</option>
            </select>
          </Field>
          <Field label="Date label">
            <input
              type="text"
              value={inputs.dateLabel}
              onChange={(e) => onPatch({ dateLabel: e.target.value })}
              placeholder="e.g. Jul 2026"
              className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </Field>
        </div>

        <SliderRow
          label="Raise"
          value={inputs.raise}
          min={0}
          max={raiseMax}
          step={50_000}
          format={(v) => formatDollars(v, { compact: true })}
          onChange={(v) => onPatch({ raise: v })}
          accent="emerald"
        />
        <SliderRow
          label={inputs.instrument === "safe" ? "Valuation cap" : "Pre-money valuation"}
          value={inputs.valuation}
          min={0}
          max={valMax}
          step={250_000}
          format={(v) => formatDollars(v, { compact: true })}
          onChange={(v) => onPatch({ valuation: v })}
          accent="amber"
        />

        {inputs.instrument === "safe" && (
          <>
            <SliderRow
              label="Discount"
              value={inputs.discount * 100}
              min={0} max={30} step={1} suffix="%"
              onChange={(v) => onPatch({ discount: v / 100 })}
              accent="amber"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Toggle
                checked={inputs.postMoneySafe}
                onChange={(v) => onPatch({ postMoneySafe: v })}
                srLabel="Post-money SAFE"
                inline
                rightLabel={inputs.postMoneySafe ? "Post-money cap" : "Pre-money cap"}
              />
              <Toggle
                checked={inputs.mfn}
                onChange={(v) => onPatch({ mfn: v })}
                srLabel="MFN clause"
                inline
                rightLabel={inputs.mfn ? "MFN: on" : "MFN: off"}
              />
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Toggle
            checked={inputs.expandPool}
            onChange={(v) => onPatch({ expandPool: v })}
            inline
            rightLabel="Create / expand pool this round"
            srLabel="Expand pool"
          />
          {inputs.expandPool && (
            <SliderRow
              label="Pool target after"
              value={inputs.poolTargetAfter}
              min={0} max={25} step={0.5} suffix="%"
              compact
              onChange={(v) => onPatch({ poolTargetAfter: v })}
              accent="zinc"
            />
          )}
        </div>

        {/* Live calculated readouts — Day 1 stubs */}
        <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
          <ReadoutTile label="Price / share" value="—" hint="post-conversion" />
          <ReadoutTile label="New investor %" value="—" hint="this round" />
          <ReadoutTile label="Founder dilution" value="—" hint="this round" />
        </div>
      </div>
    </SectionCard>
  );
}

const ROUND_ACCENT: Record<CalcRoundKey, "amber" | "emerald" | "zinc" | "red" | "violet"> = {
  preseed: "amber",
  seed:    "amber",
  seriesA: "violet",
  seriesB: "red",
};

// ═══════════════════════════════════════════════════════════════════
// Right column — Final state hero card
// ═══════════════════════════════════════════════════════════════════
function FinalStateCard({
  snapshot, totalRaised, roundsCount,
}: {
  snapshot: RoundSnapshot | undefined;
  totalRaised: number;
  roundsCount: number;
}) {
  if (!snapshot || roundsCount === 0) {
    return (
      <div className="border border-dashed border-border rounded-sm bg-card/30 px-6 py-8 text-center">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground/60 font-semibold">
          Final State
        </p>
        <p className="mt-2 text-[14px] text-foreground/55">
          Toggle a round on to start modeling.
        </p>
      </div>
    );
  }
  return (
    <motion.div
      key={snapshot.key}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="border border-emerald-500/30 bg-emerald-500/[0.04] rounded-sm p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10.5px] uppercase tracking-[0.2em] text-emerald-300 font-bold">
          After all included rounds
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {roundsCount} round{roundsCount === 1 ? "" : "s"} modeled
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {snapshot.segments.map((seg) => (
          <div key={seg.key} className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-foreground/85 truncate">{seg.label}</span>
            <span className="text-[20px] font-bold text-foreground tabular-nums tracking-tight">
              {formatPercent(seg.pct * 100, 1)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span>Total raised: <span className="text-foreground/85 font-semibold tabular-nums">{formatDollars(totalRaised, { compact: true })}</span></span>
        <span>Post-money: <span className="text-foreground/85 font-semibold tabular-nums">{formatDollars(snapshot.postMoney, { compact: true })}</span></span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Right column — Stacked round bars
// ═══════════════════════════════════════════════════════════════════
function RoundBarsStack({ snapshots }: { snapshots: RoundSnapshot[] }) {
  if (snapshots.length === 0) return null;
  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Ownership Walk
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground/70">
          {snapshots.length} snapshots
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {snapshots.map((snap, idx) => (
          <SnapshotBar key={snap.key} snapshot={snap} index={idx} />
        ))}
      </div>
    </div>
  );
}

function SnapshotBar({ snapshot, index }: { snapshot: RoundSnapshot; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="px-5 py-3 grid grid-cols-[140px_1fr] gap-4 items-center hover:bg-muted/20 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-foreground tracking-tight truncate">
          {snapshot.label}
        </div>
        {snapshot.date && (
          <div className="text-[10.5px] text-muted-foreground tabular-nums">{snapshot.date}</div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex h-7 w-full overflow-hidden rounded-sm border border-border/60 bg-background/50">
          {snapshot.segments.map((seg) => {
            const widthPct = seg.pct * 100;
            const showLabel = widthPct > 8;
            return (
              <div
                key={seg.key}
                className={`${seg.colorClass} flex items-center justify-center transition-all`}
                style={{ width: `${widthPct}%` }}
                title={`${seg.label} — ${formatPercent(widthPct)}`}
              >
                {showLabel && (
                  <span className="text-[10px] font-bold text-foreground tabular-nums px-1 truncate">
                    {formatPercent(widthPct, 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Right column — Summary table
// ═══════════════════════════════════════════════════════════════════
function SummaryTable({
  snapshots,
  scenario,
}: {
  snapshots: RoundSnapshot[];
  scenario: CalculatorScenario;
}) {
  // Skip the founding row in the table — that's the starting state.
  const rows = snapshots.slice(1);
  if (rows.length === 0) return null;

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Round Summary
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
              <th className="text-left px-4 py-2.5 font-semibold">Round</th>
              <th className="text-left px-2 py-2.5 font-semibold">Date</th>
              <th className="text-left px-2 py-2.5 font-semibold">Instrument</th>
              <th className="text-right px-2 py-2.5 font-semibold">Raise</th>
              <th className="text-right px-2 py-2.5 font-semibold">Valuation</th>
              <th className="text-right px-2 py-2.5 font-semibold">Post-Money</th>
              <th className="text-right px-2 py-2.5 font-semibold">New Inv %</th>
              <th className="text-right px-4 py-2.5 font-semibold">Cum. Dilution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const roundKey = r.key as CalcRoundKey;
              const inputs = scenario.rounds[roundKey];
              const valuation = inputs?.valuation ?? 0;
              const instrument = inputs?.instrument ?? "safe";
              return (
                <tr key={r.key} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.label}</td>
                  <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{r.date ?? "—"}</td>
                  <td className="px-2 py-2.5 text-muted-foreground uppercase text-[10.5px] tracking-wide">
                    {instrument === "safe" ? "SAFE" : "Priced"}
                  </td>
                  <td className="px-2 py-2.5 text-right text-emerald-200 font-semibold tabular-nums">
                    {formatDollars(r.cumulativeRaise === 0 ? 0 : inputs?.raise ?? 0, { compact: true })}
                  </td>
                  <td className="px-2 py-2.5 text-right text-foreground/85 tabular-nums">
                    {formatDollars(valuation, { compact: true })}
                  </td>
                  <td className="px-2 py-2.5 text-right text-foreground/85 tabular-nums">
                    {formatDollars(r.postMoney, { compact: true })}
                  </td>
                  <td className="px-2 py-2.5 text-right text-amber-200 font-semibold tabular-nums">
                    {formatPercent(r.newInvestorPct * 100)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-200 font-semibold tabular-nums">
                    {formatPercent(r.cumulativeFounderDilution * 100)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Right column — Export row
// ═══════════════════════════════════════════════════════════════════
function ExportRow({
  scenario: _scenario, snapshots: _snapshots,
}: {
  scenario: CalculatorScenario;
  snapshots: RoundSnapshot[];
}) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
        title="Wired in Day 3"
      >
        <Copy className="h-3 w-3" />
        Copy summary
      </button>
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
        title="Wired in Day 3"
      >
        <Save className="h-3 w-3" />
        Save scenario
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Primitives — SectionCard, SliderRow, Toggle, ReadoutTile, Field
// ═══════════════════════════════════════════════════════════════════

const ACCENT_BORDER: Record<string, string> = {
  emerald: "border-l-emerald-500/40",
  amber: "border-l-amber-500/40",
  zinc: "border-l-zinc-500/40",
  red: "border-l-red-500/40",
  violet: "border-l-violet-500/40",
};

function SectionCard({
  icon, title, accent = "emerald", children, headerRight, muted, collapsedHint,
}: {
  icon?: React.ReactNode;
  title: string;
  accent?: keyof typeof ACCENT_BORDER;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  muted?: boolean;
  collapsedHint?: string;
}) {
  return (
    <div
      className={`border-l-2 ${ACCENT_BORDER[accent]} border-y border-r border-border rounded-sm bg-card/40 ${
        muted ? "opacity-95" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground/70">{icon}</span>}
          <span className="text-[11.5px] uppercase tracking-[0.18em] text-foreground/85 font-bold">
            {title}
          </span>
          {collapsedHint && (
            <span className="text-[10.5px] text-muted-foreground/60 italic ml-1">
              · {collapsedHint}
            </span>
          )}
        </div>
        {headerRight}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, suffix, format,
  onChange, onChangeAlternate, alternateHint, accent,
  compact,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onChangeAlternate?: (v: number) => void;
  alternateHint?: string;
  accent?: "emerald" | "emerald-dim" | "amber" | "zinc" | "red";
  compact?: boolean;
}) {
  const display = format ? format(value) : `${value}${suffix ?? ""}`;
  const accentText: Record<string, string> = {
    emerald: "text-emerald-200",
    "emerald-dim": "text-emerald-300/70",
    amber: "text-amber-200",
    zinc: "text-zinc-200",
    red: "text-red-200",
  };
  const tone = accent ? accentText[accent] : "text-foreground";

  return (
    <div className={compact ? "" : "mb-2"}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/90 font-semibold">
          {label}
        </span>
        <span className={`text-[12.5px] font-bold tabular-nums ${tone}`}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          // Hold Shift to use the alternate handler (Ali-only without
          // auto-filling Hanif). Native range inputs don't bubble Shift
          // through the change event, so we use the underlying mouse
          // event on the input to check.
          const native = e.nativeEvent as InputEvent & { shiftKey?: boolean };
          if (native.shiftKey && onChangeAlternate) {
            onChangeAlternate(v);
          } else {
            onChange(v);
          }
        }}
        className="w-full h-1 bg-muted rounded-sm appearance-none cursor-pointer accent-primary"
      />
      {alternateHint && (
        <div className="text-[10px] text-muted-foreground/50 mt-1 italic">{alternateHint}</div>
      )}
    </div>
  );
}

function Toggle({
  checked, onChange, srLabel, inline, rightLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  srLabel: string;
  inline?: boolean;
  rightLabel?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 cursor-pointer select-none ${
        inline ? "" : ""
      }`}
    >
      <span
        role="switch"
        aria-checked={checked}
        aria-label={srLabel}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {rightLabel && (
        <span className="text-[11px] text-muted-foreground/90 font-medium">{rightLabel}</span>
      )}
    </label>
  );
}

function ReadoutTile({
  label, value, hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] font-bold text-foreground/80 tabular-nums">{value}</div>
      {hint && <div className="text-[9.5px] text-muted-foreground/50 mt-0.5">{hint}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

// Re-export the icon for parity with the parent toggle
export { Calculator };
