/**
 * ScenariosTab.tsx — Worth-it calculator + saved scenarios.
 *
 * Layout:
 *   - Composer at top: label, costs, duration, expected MRR, confidence
 *   - Live impact panel beside it: total cost, runway delta, payback,
 *     verdict tier, AXON's reasoning bullets
 *   - Save / Reset row
 *   - Saved scenarios grid below — each card shows verdict + summary,
 *     hover to preview, click to load back into the composer
 *
 * Pure math from scenarioMath.ts; advice from capitalAdvisor.ts.
 * No model calls yet — every number is deterministic and reproducible.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Save, Trash2, GitBranch, RefreshCw, Sparkles,
  TrendingDown, Clock, AlertTriangle, Check,
} from "lucide-react";
import {
  useUpsertScenario, useDeleteScenario,
  estimateMonthlyBurn,
  type CapitalPlanData, type CapitalScenario, type CapitalConfidence,
} from "../CapitalPlan.queries";
import {
  computeScenarioImpact, VERDICT_META,
  type ScenarioInput, type CapitalSnapshot,
} from "../scenarios/scenarioMath";

const CASH_KEY = "cwa-capital-plan-cash-on-hand";

export function ScenariosTab({ plan }: { plan: CapitalPlanData }) {
  // Read cash from the same localStorage key the Runway tab uses
  const [cashOnHand, setCashOnHand] = useState<number>(() => {
    try { return Number(window.localStorage.getItem(CASH_KEY)) || 0; } catch { return 0; }
  });
  // Re-read on tab mount in case Runway edited it
  useEffect(() => {
    function reread() {
      try { setCashOnHand(Number(window.localStorage.getItem(CASH_KEY)) || 0); } catch { /* ignore */ }
    }
    window.addEventListener("storage", reread);
    return () => window.removeEventListener("storage", reread);
  }, []);

  const monthlyBurn = useMemo(
    () => estimateMonthlyBurn(plan.actuals, plan.allocations),
    [plan.actuals, plan.allocations],
  );

  const nextRound = useMemo(() => {
    const upcoming = plan.rounds
      .filter((r) => r.target_close_date && (r.status === "planning" || r.status === "raising"))
      .sort((a, b) => new Date(a.target_close_date!).getTime() - new Date(b.target_close_date!).getTime());
    return upcoming[0] ?? null;
  }, [plan.rounds]);

  const snapshot: CapitalSnapshot = {
    cashOnHand,
    monthlyBurn,
    daysToNextClose: nextRound?.target_close_date
      ? Math.ceil((new Date(nextRound.target_close_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null,
    nextRoundName: nextRound?.name,
  };

  // Composer state
  const [input, setInput] = useState<ScenarioInput>({
    label: "",
    upfrontCost: 0,
    monthlyCost: 0,
    durationMonths: 12,
    expectedMrrDelta: 0,
    rampMonths: 3,
    confidence: "medium",
  });

  const impact = useMemo(() => computeScenarioImpact(input, snapshot), [input, snapshot]);

  const upsert = useUpsertScenario();
  const remove = useDeleteScenario();

  async function saveScenario() {
    if (!input.label.trim()) return;
    await upsert.mutateAsync({
      name: input.label,
      candidate_label: input.label,
      candidate_cost: impact.totalCost,
      duration_months: input.durationMonths ?? null,
      expected_impact: input.expectedMrrDelta && input.expectedMrrDelta > 0
        ? `${formatDollars(input.expectedMrrDelta)}/mo (${input.confidence ?? "medium"} confidence, ${input.rampMonths ?? 3}mo ramp)`
        : "Strategic — no direct revenue projected",
      confidence: input.confidence ?? null,
      axon_verdict: `${VERDICT_META[impact.verdict].label} · ${impact.rationale[0] ?? ""}`,
      state: { input, snapshot, impact } as unknown as Record<string, unknown>,
    });
  }

  function reset() {
    setInput({ label: "", upfrontCost: 0, monthlyCost: 0, durationMonths: 12, expectedMrrDelta: 0, rampMonths: 3, confidence: "medium" });
  }

  function loadSaved(s: CapitalScenario) {
    const st = s.state as { input?: ScenarioInput };
    if (st?.input) setInput(st.input);
  }

  function patch<K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) {
    setInput((i) => ({ ...i, [key]: value }));
  }

  // Cash on hand guard
  if (cashOnHand === 0 && plan.actuals.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-sm p-10 text-center">
        <div className="max-w-md mx-auto">
          <Calculator className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-[14px] font-bold text-foreground mb-2">
            Set cash on hand first
          </h3>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            The worth-it calculator needs your current cash balance to project runway impact.
            Open the Runway tab and edit the Cash on hand tile (or log a few actuals so I can derive it).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Context strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 text-[11px] text-muted-foreground">
          <span>Cash: <span className="text-emerald-200 font-bold tabular-nums">{formatDollars(cashOnHand)}</span></span>
          <span>Burn: <span className="text-amber-200 font-bold tabular-nums">{formatDollars(monthlyBurn)}/mo</span></span>
          <span>Runway: <span className="text-foreground font-bold tabular-nums">{impact.baselineRunwayMonths === Infinity ? "∞" : `${impact.baselineRunwayMonths.toFixed(1)}mo`}</span></span>
          {nextRound && (
            <span>Next close: <span className="text-foreground font-bold">{nextRound.name}</span> in {snapshot.daysToNextClose}d</span>
          )}
        </div>
      </div>

      {/* Composer + Impact side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Composer input={input} onPatch={patch} />
        <ImpactPanel input={input} impact={impact} />
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-muted-foreground">
          {input.label
            ? `"${input.label}" — ${VERDICT_META[impact.verdict].label}`
            : "Name your scenario to save it."}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={saveScenario}
            disabled={!input.label.trim()}
            className="inline-flex items-center gap-1.5 px-4 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-3 w-3" />
            Save scenario
          </button>
        </div>
      </div>

      {/* Saved scenarios */}
      <SavedScenarios
        scenarios={plan.scenarios}
        onLoad={loadSaved}
        onDelete={(id) => remove.mutateAsync(id)}
      />
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────

function Composer({
  input, onPatch,
}: {
  input: ScenarioInput;
  onPatch: <K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) => void;
}) {
  return (
    <div className="border border-border border-l-[3px] border-l-rose-500 rounded-md bg-card overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Calculator className="h-3.5 w-3.5 text-rose-300" />
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-rose-300/80 font-bold">
          Candidate spend
        </span>
      </div>
      <div className="p-4 space-y-3">
        <Field label="What is this?">
          <input
            type="text"
            value={input.label}
            onChange={(e) => onPatch("label", e.target.value)}
            placeholder='e.g. "Hire 2nd AE" · "LinkedIn ads pilot" · "Vanta + SOC 2 audit"'
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Upfront cost ($)">
            <input
              type="number"
              value={input.upfrontCost ?? 0}
              onChange={(e) => onPatch("upfrontCost", Number(e.target.value))}
              step="1000"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-emerald-200 font-bold tabular-nums focus:outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Monthly cost ($/mo)">
            <input
              type="number"
              value={input.monthlyCost ?? 0}
              onChange={(e) => onPatch("monthlyCost", Number(e.target.value))}
              step="500"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-emerald-200 font-bold tabular-nums focus:outline-none focus:border-primary/60"
            />
          </Field>
        </div>

        <Field label="How many months does this run?">
          <input
            type="range"
            value={input.durationMonths ?? 12}
            onChange={(e) => onPatch("durationMonths", Number(e.target.value))}
            min={0}
            max={36}
            step={1}
            className="w-full h-1 bg-muted rounded-sm accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums mt-1">
            <span>0</span>
            <span className="text-foreground font-bold">{input.durationMonths ?? 12} months</span>
            <span>36</span>
          </div>
        </Field>

        <div className="pt-3 border-t border-border/40">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-2">
            Expected revenue impact (optional)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New MRR ($/mo)">
              <input
                type="number"
                value={input.expectedMrrDelta ?? 0}
                onChange={(e) => onPatch("expectedMrrDelta", Number(e.target.value))}
                step="500"
                placeholder="0 = strategic only"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Ramp (months)">
              <input
                type="number"
                value={input.rampMonths ?? 3}
                onChange={(e) => onPatch("rampMonths", Number(e.target.value))}
                step="1" min="1" max="24"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          <Field label="Confidence">
            <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden mt-1">
              {(["low", "medium", "high"] as CapitalConfidence[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onPatch("confidence", c)}
                  className={`px-3 h-7 text-[10.5px] uppercase tracking-[0.14em] font-bold transition-colors ${
                    input.confidence === c
                      ? c === "high"   ? "bg-emerald-500/20 text-emerald-200"
                      : c === "medium" ? "bg-amber-500/15 text-amber-200"
                      :                  "bg-red-500/10 text-red-200"
                      : "text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Impact panel ─────────────────────────────────────────────

function ImpactPanel({
  input, impact,
}: {
  input: ScenarioInput;
  impact: ReturnType<typeof computeScenarioImpact>;
}) {
  const verdict = VERDICT_META[impact.verdict];

  return (
    <div className={`border-l-[3px] rounded-md overflow-hidden bg-card transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${
      impact.verdict === "strong-yes" || impact.verdict === "yes" ? "border-l-emerald-500" :
      impact.verdict === "caution" ? "border-l-amber-500" :
      impact.verdict === "no" ? "border-l-red-500" :
      "border-l-muted-foreground/40"
    } border-y border-r border-border`}>
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
            Impact + AXON's take
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border text-[10px] uppercase tracking-[0.16em] font-bold ${verdict.tone}`}>
          {verdict.emoji} {verdict.label}
        </span>
      </div>

      {!input.label && impact.totalCost === 0 && (
        <div className="p-6 text-center text-[12px] text-muted-foreground/70 italic">
          Fill in the candidate spend to see impact + recommendation.
        </div>
      )}

      {(input.label || impact.totalCost > 0) && (
        <div className="p-4 space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-3">
            <ImpactKPI
              icon={<TrendingDown className="h-3 w-3" />}
              label="Total cost"
              value={formatDollars(impact.totalCost)}
              sub={impact.marginalMonthlyBurn > 0 ? `+${formatDollars(impact.marginalMonthlyBurn)}/mo burn` : "one-time"}
              tone="text-amber-200"
            />
            <ImpactKPI
              icon={<Clock className="h-3 w-3" />}
              label="Runway after"
              value={impact.newRunwayMonths === Infinity ? "∞" : `${impact.newRunwayMonths.toFixed(1)}mo`}
              sub={impact.runwayMonthsShaved > 0 ? `−${impact.runwayMonthsShaved.toFixed(1)}mo` : "no change"}
              tone={
                impact.newRunwayMonths === Infinity ? "text-foreground" :
                impact.newRunwayMonths < 3 ? "text-red-300" :
                impact.newRunwayMonths < 6 ? "text-amber-200" :
                "text-emerald-200"
              }
            />
            <ImpactKPI
              icon={<Check className="h-3 w-3" />}
              label="Payback"
              value={
                impact.paybackMonths === Infinity ? "—" :
                `${impact.paybackMonths.toFixed(1)}mo`
              }
              sub={
                impact.paybackMonths === Infinity ? "no revenue modeled" :
                impact.paybackMonths < 6 ? "fast" :
                impact.paybackMonths < 12 ? "within year" :
                "long"
              }
              tone={
                impact.paybackMonths === Infinity ? "text-muted-foreground" :
                impact.paybackMonths < 6 ? "text-emerald-200" :
                impact.paybackMonths < 12 ? "text-amber-200" :
                "text-red-300"
              }
            />
          </div>

          {/* Rationale */}
          <div className="border-t border-border/40 pt-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-2">
              Why
            </div>
            <ul className="space-y-1.5">
              {impact.rationale.map((r, i) => (
                <li key={i} className="text-[12px] text-foreground/85 leading-relaxed flex items-start gap-2">
                  <span className="text-violet-400/60 mt-0.5">·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Will-it-run-out warning */}
          {impact.willRunOutBeforeNextClose && (
            <div className="border border-red-500/30 bg-red-500/10 rounded-sm px-3 py-2 flex items-start gap-2 text-[11.5px] text-red-200">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                <strong>Hard stop:</strong> this scenario depletes cash before the next round closes.
                Don't run it without either cutting it down or raising more first.
              </span>
            </div>
          )}

          {/* Opportunity cost */}
          {impact.totalCost > 0 && (
            <div className="border-t border-border/40 pt-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-2">
                Same money could buy
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
                {impact.opportunityCost.map((oc, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground truncate">{oc.label}</span>
                    <span className="text-foreground font-bold tabular-nums shrink-0">
                      {oc.quantity.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactKPI({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="border border-border rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold mb-1">
        <span className="text-muted-foreground/50">{icon}</span>
        {label}
      </div>
      <div className={`text-[16px] font-bold tabular-nums tracking-tight ${tone ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[9.5px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Saved scenarios grid ─────────────────────────────────────

function SavedScenarios({
  scenarios, onLoad, onDelete,
}: {
  scenarios: CapitalScenario[];
  onLoad: (s: CapitalScenario) => void;
  onDelete: (id: string) => Promise<unknown>;
}) {
  if (scenarios.length === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-md bg-card overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Saved scenarios ({scenarios.length})
        </span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <AnimatePresence>
          {scenarios.map((s) => (
            <SavedScenarioCard key={s.id} scenario={s} onLoad={() => onLoad(s)} onDelete={() => onDelete(s.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SavedScenarioCard({
  scenario, onLoad, onDelete,
}: {
  scenario: CapitalScenario;
  onLoad: () => void;
  onDelete: () => void;
}) {
  // Decode verdict from axon_verdict text (best-effort)
  const verdict = (Object.entries(VERDICT_META).find(([, v]) =>
    scenario.axon_verdict?.startsWith(v.label),
  )?.[0]) as keyof typeof VERDICT_META | undefined;
  const meta = verdict ? VERDICT_META[verdict] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group border border-border rounded-sm bg-background hover:border-foreground/30 hover:bg-card/50 cursor-pointer transition-colors p-3"
      onClick={onLoad}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[12px] font-bold text-foreground truncate flex-1">
          {scenario.name}
        </span>
        {meta && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.14em] font-bold shrink-0 ${meta.tone}`}>
            {meta.emoji}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px]">
        <span className="text-muted-foreground">Cost</span>
        <span className="text-amber-200 font-semibold tabular-nums text-right">
          {scenario.candidate_cost ? formatDollars(scenario.candidate_cost) : "—"}
        </span>
        {scenario.duration_months !== null && (
          <>
            <span className="text-muted-foreground">Duration</span>
            <span className="text-foreground tabular-nums text-right">{scenario.duration_months}mo</span>
          </>
        )}
        {scenario.confidence && (
          <>
            <span className="text-muted-foreground">Confidence</span>
            <span className="text-foreground capitalize text-right">{scenario.confidence}</span>
          </>
        )}
      </div>
      {scenario.expected_impact && (
        <div className="mt-2 pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground italic line-clamp-2">
          {scenario.expected_impact}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9.5px] text-muted-foreground/50">
          {new Date(scenario.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${scenario.name}"?`)) onDelete(); }}
          className="p-1 text-muted-foreground/40 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Delete scenario"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
