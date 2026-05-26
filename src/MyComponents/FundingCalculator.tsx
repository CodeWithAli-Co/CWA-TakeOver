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

import { useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
  Trash2,
  Check,
} from "lucide-react";
import { formatDollars, formatPercent, prettyRoundName } from "./fundingMath";
import { computeCapTable } from "./fundingCalculatorMath";
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
const SAVED_KEY = "cwa-funding-calculator-saves-v1";

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

// ─── Saved scenarios (separate persistent slot) ─────────────────────

export interface SavedScenario {
  id: string;
  name: string;
  scenario: CalculatorScenario;
  savedAt: string; // ISO timestamp
  scenarioKey: CalcScenarioKey; // which slot it was saved from
}

function loadSaves(): SavedScenario[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedScenario[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistSaves(saves: SavedScenario[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(saves));
  } catch { /* quota — ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// Top-level component
// ═══════════════════════════════════════════════════════════════════

export default function FundingCalculator() {
  const [state, setState] = useState<CalcState>(() => loadState());
  const [saves, setSaves] = useState<SavedScenario[]>(() => loadSaves());
  useEffect(() => { persistState(state); }, [state]);
  useEffect(() => { persistSaves(saves); }, [saves]);

  const scenario = state.scenarios[state.active];

  // Memo the snapshots — recomputes only when active scenario changes.
  // The real cap-table math (computeCapTable) is pure and fast; no
  // need for debounce even on slider drag.
  const snapshots = useMemo(() => computeCapTable(scenario), [scenario]);
  const finalSnapshot = snapshots[snapshots.length - 1];

  // Index snapshots by round key so each RoundSection can show its
  // own readouts (price/share, new investor %, founder dilution delta).
  const snapshotByRound = useMemo(() => {
    const map = new Map<string, RoundSnapshot>();
    for (const snap of snapshots) map.set(snap.key, snap);
    return map;
  }, [snapshots]);

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
  function resetActive() {
    setState((s) => ({
      ...s,
      scenarios: { ...s.scenarios, [s.active]: defaultScenario() },
    }));
  }
  function saveCurrent(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newSave: SavedScenario = {
      id: `sav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      scenario: structuredClone(scenario),
      savedAt: new Date().toISOString(),
      scenarioKey: state.active,
    };
    setSaves((arr) => [newSave, ...arr].slice(0, 24)); // cap at 24
  }
  function loadSave(id: string) {
    const found = saves.find((s) => s.id === id);
    if (!found) return;
    setState((s) => ({
      ...s,
      scenarios: { ...s.scenarios, [s.active]: structuredClone(found.scenario) },
    }));
  }
  function deleteSave(id: string) {
    setSaves((arr) => arr.filter((s) => s.id !== id));
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
          onReset={resetActive}
          savesCount={saves.length}
        />
      </div>

      {/* ── Saved scenarios strip (only when there are saves) ───── */}
      {saves.length > 0 && (
        <div className="px-10 pb-4">
          <SavedScenariosStrip
            saves={saves}
            onLoad={loadSave}
            onDelete={deleteSave}
          />
        </div>
      )}

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
              snapshot={snapshotByRound.get(key)}
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

          <ExportRow
            scenario={scenario}
            snapshots={snapshots}
            scenarioLabel={SCENARIO_LABELS[state.active]}
            onSave={saveCurrent}
          />
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
const SCENARIO_LABELS: Record<CalcScenarioKey, string> = {
  conservative: "Conservative",
  base: "Base Case",
  aggressive: "Aggressive",
};

function ScenarioTabs({
  active, onChange, onCopyFromBase, onReset, savesCount,
}: {
  active: CalcScenarioKey;
  onChange: (k: CalcScenarioKey) => void;
  onCopyFromBase: () => void;
  onReset: () => void;
  savesCount: number;
}) {
  const tabs: { id: CalcScenarioKey; label: string; tone: string }[] = [
    { id: "conservative", label: "Conservative", tone: "text-emerald-200" },
    { id: "base",         label: "Base Case",    tone: "text-foreground" },
    { id: "aggressive",   label: "Aggressive",   tone: "text-red-200" },
  ];
  const [confirmingReset, setConfirmingReset] = useState(false);
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
      <div className="flex items-center gap-2">
        {savesCount > 0 && (
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">
            {savesCount} saved
          </span>
        )}
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
        {confirmingReset ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => { onReset(); setConfirmingReset(false); }}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-red-500/40 bg-red-500/10 text-[11px] uppercase tracking-[0.16em] font-semibold text-red-200 hover:bg-red-500/20 transition-colors"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="inline-flex items-center px-2 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Reset this scenario to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Saved scenarios strip
// ═══════════════════════════════════════════════════════════════════
function SavedScenariosStrip({
  saves, onLoad, onDelete,
}: {
  saves: SavedScenario[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border border-border rounded-sm bg-card/30 px-3 py-2.5 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold shrink-0 pl-1 pr-2">
          Saved
        </span>
        {saves.map((sav) => (
          <div
            key={sav.id}
            className="group inline-flex items-stretch border border-border rounded-sm overflow-hidden shrink-0"
          >
            <button
              type="button"
              onClick={() => onLoad(sav.id)}
              className="px-3 py-1.5 text-[11.5px] font-semibold text-foreground/85 hover:bg-muted/40 transition-colors text-left max-w-[160px] truncate"
              title={`Load "${sav.name}" into current scenario\nSaved ${new Date(sav.savedAt).toLocaleString()} from ${SCENARIO_LABELS[sav.scenarioKey]}`}
            >
              {sav.name}
            </button>
            <button
              type="button"
              onClick={() => onDelete(sav.id)}
              className="px-2 border-l border-border/60 text-muted-foreground/60 hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete saved scenario"
              aria-label={`Delete ${sav.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
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
  roundKey, inputs, snapshot, onPatch,
}: {
  roundKey: CalcRoundKey;
  inputs: RoundInputs;
  snapshot: RoundSnapshot | undefined;
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

        {/* Live calculated readouts — wired to real cap-table math */}
        <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
          <ReadoutTile
            label="Price / share"
            value={
              !inputs.included
                ? "—"
                : snapshot?.pricePerShare && snapshot.pricePerShare > 0
                  ? `$${snapshot.pricePerShare.toFixed(snapshot.pricePerShare < 1 ? 3 : 2)}`
                  : inputs.instrument === "safe"
                    ? "n/a"
                    : "—"
            }
            hint={inputs.instrument === "safe" ? "SAFE — no price set" : "post-conversion"}
          />
          <ReadoutTile
            label="New investor %"
            value={
              !inputs.included
                ? "—"
                : snapshot
                  ? formatPercent(snapshot.newInvestorPct * 100, 1)
                  : "—"
            }
            hint="this round"
          />
          <ReadoutTile
            label="Founder dilution"
            value={
              !inputs.included
                ? "—"
                : snapshot
                  ? formatPercent(snapshot.founderDilutionDelta * 100, 1)
                  : "—"
            }
            hint="vs. prev round"
          />
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
// Right column — Export row (Copy summary + Save scenario)
// ═══════════════════════════════════════════════════════════════════
function ExportRow({
  scenario, snapshots, scenarioLabel, onSave,
}: {
  scenario: CalculatorScenario;
  snapshots: RoundSnapshot[];
  scenarioLabel: string;
  onSave: (name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Default save name when user clicks Save — current scenario label + timestamp.
  function startSave() {
    const stamp = new Date().toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    setSavingName(`${scenarioLabel} — ${stamp}`);
    // focus on next tick once input mounts
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }
  function commitSave() {
    if (savingName !== null) {
      onSave(savingName);
      setSavingName(null);
    }
  }

  async function copySummary() {
    const md = buildSummaryMarkdown(scenario, snapshots, scenarioLabel);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: open prompt with the text so user can copy manually.
      // In Tauri WKWebView prompt() is suppressed — log to console as final fallback.
      console.warn("Clipboard write failed. Summary:\n\n" + md);
    }
  }

  const hasRounds = snapshots.length > 1;

  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      {savingName !== null ? (
        <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSave();
              if (e.key === "Escape") setSavingName(null);
            }}
            placeholder="Scenario name"
            maxLength={60}
            className="bg-background px-3 h-8 text-[12px] text-foreground w-56 focus:outline-none focus:bg-muted/30"
          />
          <button
            type="button"
            onClick={commitSave}
            disabled={!savingName.trim()}
            className="px-3 h-8 border-l border-border bg-emerald-500/15 text-[11px] uppercase tracking-[0.16em] font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setSavingName(null)}
            className="px-2 h-8 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="Cancel save"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={copySummary}
            disabled={!hasRounds}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={hasRounds ? "Copy scenario summary as markdown to clipboard" : "Toggle on at least one round first"}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button
            type="button"
            onClick={startSave}
            disabled={!hasRounds}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={hasRounds ? "Save this scenario to the named-scenarios shelf" : "Toggle on at least one round first"}
          >
            <Save className="h-3 w-3" />
            Save scenario
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Build a markdown summary of a scenario for clipboard pasting into
 * email / pitch deck / investor update.
 */
function buildSummaryMarkdown(
  scenario: CalculatorScenario,
  snapshots: RoundSnapshot[],
  scenarioLabel: string,
): string {
  const final = snapshots[snapshots.length - 1];
  if (!final) return `# Cap Table — ${scenarioLabel}\n\n(no rounds modeled)`;

  const lines: string[] = [];
  lines.push(`# Cap Table — ${scenarioLabel}`);
  lines.push("");
  lines.push(`**Total raised:** ${formatDollars(final.cumulativeRaise, { compact: true })}  `);
  if (final.postMoney > 0) {
    lines.push(`**Final post-money:** ${formatDollars(final.postMoney, { compact: true })}  `);
  }
  lines.push(`**Cumulative founder dilution:** ${formatPercent(final.cumulativeFounderDilution * 100, 1)}`);
  lines.push("");

  // Final ownership
  lines.push("## Final Ownership");
  lines.push("");
  lines.push("| Holder | % |");
  lines.push("|---|---:|");
  for (const seg of final.segments) {
    lines.push(`| ${seg.label} | ${formatPercent(seg.pct * 100, 1)} |`);
  }
  lines.push("");

  // Round walk
  const rounds = snapshots.slice(1);
  if (rounds.length > 0) {
    lines.push("## Round Walk");
    lines.push("");
    lines.push("| Round | Date | Instrument | Raise | Valuation | Post-Money | New Inv % | Cum. Dilution |");
    lines.push("|---|---|---|---:|---:|---:|---:|---:|");
    for (const r of rounds) {
      const inputs = scenario.rounds[r.key as CalcRoundKey];
      const valuation = inputs?.valuation ?? 0;
      const instrument = inputs?.instrument === "safe" ? "SAFE" : "Priced";
      const raise = inputs?.raise ?? 0;
      lines.push(
        `| ${r.label} | ${r.date ?? "—"} | ${instrument} | ${formatDollars(raise, { compact: true })} | ${formatDollars(valuation, { compact: true })} | ${formatDollars(r.postMoney, { compact: true })} | ${formatPercent(r.newInvestorPct * 100, 1)} | ${formatPercent(r.cumulativeFounderDilution * 100, 1)} |`,
      );
    }
    lines.push("");
  }

  lines.push(`_Generated by CWA TakeOver Cap Table Calculator — ${new Date().toLocaleString()}_`);
  return lines.join("\n");
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
