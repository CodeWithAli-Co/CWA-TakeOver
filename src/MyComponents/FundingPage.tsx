/**
 * FundingPage.tsx — Executive funding-strategy dashboard.
 *
 * Audience: CEO + COO only (route-gated via UserView).
 * Aesthetic: matches GraduationPlan — dark editorial, monochrome
 * neutrals, semantic accent colors, thin dividers, typographic
 * hierarchy.
 *
 * Sections:
 *   1. Hero (program, scenario badge, multi-company stats)
 *   2. Scenario toggle — Conservative / Base / Aggressive
 *   3. Stat strip (total raised, current valuation, runway, next round)
 *   4. Round timeline (horizontal sweep across all companies)
 *   5. Per-company cards (cap table stacked bar, rounds list)
 *   6. Inter-business equity flow (parent ↔ subsidiary indicators)
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Target,
  Wallet,
  CalendarClock,
  AlertTriangle,
  Building2,
  Network,
  Sparkles,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  ChevronDown,
  FileText,
  Calculator as CalculatorIcon,
} from "lucide-react";
import FundingCalculator from "./FundingCalculator";

import { takeOversupabase } from "./supabase";
import {
  FUNDING_QUERY_KEY,
  FundingCompany,
  FundingData,
  FundingRound,
  FundingRoundStatus,
  FundingRoundType,
  FundingScenario,
  useFunding,
  useUpdateRound,
  useDeleteRound,
  useAddRound,
} from "./Funding.queries";
import {
  SCENARIO_DESCRIPTIONS,
  SCENARIO_LABELS,
  applyScenario,
  currentImpliedValuation,
  estimateRunwayMonths,
  findNextPlannedRound,
  formatDollars,
  formatPercent,
  holderTypeColor,
  holderTypeLabel,
  newInvestorOwnership,
  preMoneyValuation,
  prettyRoundName,
  projectCapTable,
  totalRaisedAcrossCompanies,
} from "./fundingMath";

// ═══════════════════════════════════════════════════════════════════
// Top-level component
// ═══════════════════════════════════════════════════════════════════
export default function FundingPage() {
  const { data, isLoading, error } = useFunding();
  const qc = useQueryClient();

  // Realtime sync — multi-operator (Ali + Hanif both planning)
  useEffect(() => {
    const ch = takeOversupabase
      .channel("funding-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "funding_companies" },
        () => qc.invalidateQueries({ queryKey: FUNDING_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "funding_rounds" },
        () => qc.invalidateQueries({ queryKey: FUNDING_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "equity_holders" },
        () => qc.invalidateQueries({ queryKey: FUNDING_QUERY_KEY }))
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [qc]);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "No funding data"} />;
  return <FundingView data={data} />;
}

function Loading() {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-3" />
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          Couldn't load funding plan
        </h2>
        <p className="text-[12.5px] text-muted-foreground">{message}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-3">
          Run <code className="text-foreground/85">migrations/funding_schema.sql</code> in Supabase.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main view
// ═══════════════════════════════════════════════════════════════════
type FundingMode = "plan" | "calculator";

function FundingView({ data }: { data: FundingData }) {
  const [scenario, setScenario] = useState<FundingScenario>("base");
  // Top-level mode toggle — Plan (the existing live document quoted
  // to investors) vs Calculator (what-if dilution modeling tool).
  // Persists across visits so the user lands where they left off.
  const [mode, setMode] = useState<FundingMode>(() => {
    try {
      return (window.localStorage.getItem("cwa-funding-mode") as FundingMode) ?? "plan";
    } catch { return "plan"; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("cwa-funding-mode", mode); } catch { /* noop */ }
  }, [mode]);

  const activeCompany = useMemo(
    () => data.companies.find((c) => c.is_active_raise) ?? data.companies[0],
    [data.companies],
  );

  // Cross-company aggregates (hero stats)
  const totalRaised = totalRaisedAcrossCompanies(data.rounds, scenario);
  const activeCompanyRounds = useMemo(
    () => activeCompany ? data.rounds.filter((r) => r.company_id === activeCompany.id) : [],
    [activeCompany, data.rounds],
  );
  const activeValuation = currentImpliedValuation(activeCompanyRounds, scenario);
  const nextRound = findNextPlannedRound(activeCompanyRounds);
  const runwayMonths = estimateRunwayMonths(activeCompanyRounds);

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-y-auto">
      {/* ── Mode toggle: Plan vs Calculator ────────────────────────
          Sits at the very top of the page above the Hero so the
          user can switch between strategic documentation (Plan) and
          interactive modeling (Calculator) without leaving /funding. */}
      <ModeToggle mode={mode} onChange={setMode} />

      {mode === "calculator" ? (
        <FundingCalculator />
      ) : (
        <>
      {/* 1 · HERO HEADER */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="px-10 pt-6 pb-6"
      >
        <Hero
          activeCompany={activeCompany}
          scenario={scenario}
          totalCompanies={data.companies.length}
        />
      </motion.section>

      {/* 2 · SCENARIO TOGGLE */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="px-10 pb-6"
      >
        <ScenarioToggle active={scenario} onChange={setScenario} />
      </motion.section>

      {/* 3 · STAT STRIP */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="px-10 pb-8"
      >
        <div className="border-y border-border">
          <div className="grid grid-cols-4 divide-x divide-border">
            <Stat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Total Raised"
              value={formatDollars(totalRaised, { compact: true })}
              sub={`Across ${data.companies.length} companies`}
            />
            <Stat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label={`${activeCompany?.name ?? "—"} Valuation`}
              value={activeValuation > 0 ? formatDollars(activeValuation, { compact: true }) : "—"}
              sub={activeValuation > 0 ? "Last closed round" : "No closed rounds yet"}
              accent={activeValuation > 0 ? "emerald" : undefined}
            />
            <Stat
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Next Round"
              value={nextRound ? prettyRoundName(nextRound.round_type) : "—"}
              sub={nextRound
                ? `${formatDollars(applyScenario(nextRound, scenario).target_raise, { compact: true })} @ ${formatDollars(applyScenario(nextRound, scenario).post_money, { compact: true })} cap`
                : "All rounds closed or planned"
              }
              accent="amber"
            />
            <Stat
              icon={<Target className="h-3.5 w-3.5" />}
              label="Runway"
              value={runwayMonths > 0 && Number.isFinite(runwayMonths) ? `${runwayMonths} mo` : "—"}
              sub="At $50K/mo burn (estimate)"
              accent={runwayMonths < 6 ? "red" : runwayMonths < 12 ? "amber" : "emerald"}
            />
          </div>
        </div>
      </motion.section>

      {/* 4 · ROUND TIMELINE */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="px-10 pb-10"
      >
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            Round Timeline
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {SCENARIO_LABELS[scenario]} scenario
          </span>
        </div>
        {activeCompany && (
          <RoundTimeline
            rounds={activeCompanyRounds}
            scenario={scenario}
            company={activeCompany}
          />
        )}
      </motion.section>

      {/* 5 · PER-COMPANY CAP TABLE PROJECTIONS */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
        className="px-10 pb-10"
      >
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            Cap Tables
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Projected post-final-round
          </span>
        </div>
        <div className="space-y-5">
          {data.companies.map((c) => (
            <CompanyCapTableCard
              key={c.id}
              company={c}
              rounds={data.rounds.filter((r) => r.company_id === c.id)}
              holders={data.holders.filter((h) => h.company_id === c.id)}
              scenario={scenario}
              allCompanies={data.companies}
            />
          ))}
        </div>
      </motion.section>

      {/* 6 · INTER-BUSINESS EQUITY FLOW */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14, ease: "easeOut" }}
        className="px-10 pb-16"
      >
        <div className="flex items-center gap-2.5 mb-5">
          <Network className="h-5 w-5 text-violet-300" />
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            Inter-Business Equity Flow
          </h2>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold ml-2">
            Parent ↔ Subsidiary holdings
          </span>
        </div>
        <InterBusinessFlow data={data} scenario={scenario} />
      </motion.section>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Mode toggle (Plan / Calculator)
// ═══════════════════════════════════════════════════════════════════
function ModeToggle({
  mode, onChange,
}: {
  mode: FundingMode;
  onChange: (m: FundingMode) => void;
}) {
  const options: { id: FundingMode; label: string; icon: React.ReactNode; hint: string }[] = [
    { id: "plan",       label: "Plan",       icon: <FileText className="h-3.5 w-3.5" />,        hint: "Live document quoted to investors" },
    { id: "calculator", label: "Calculator", icon: <CalculatorIcon className="h-3.5 w-3.5" />,  hint: "What-if dilution modeling" },
  ];
  return (
    <div className="px-10 pt-6 pb-2">
      <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden bg-card">
        {options.map((opt) => {
          const isActive = opt.id === mode;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`relative px-4 py-2 inline-flex items-center gap-2 text-[12px] font-semibold transition-colors ${
                isActive
                  ? "bg-muted/60 text-foreground"
                  : "text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted/30"
              }`}
              title={opt.hint}
            >
              {opt.icon}
              {opt.label}
              {isActive && (
                <motion.div
                  layoutId="funding-mode-underline"
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Hero header
// ═══════════════════════════════════════════════════════════════════
function Hero({
  activeCompany,
  scenario,
  totalCompanies,
}: {
  activeCompany: FundingCompany | undefined;
  scenario: FundingScenario;
  totalCompanies: number;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-sm bg-primary/[0.12] border border-primary/30">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-foreground/70 font-semibold">
              Executive · Funding Strategy
            </span>
          </div>

          <h1 className="text-[38px] leading-[1.05] font-bold tracking-tight text-foreground">
            Multi-Business <span className="text-muted-foreground/70">Cap Table &amp;</span> Raise Plan
          </h1>

          <div className="mt-3 flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap">
            <span className="text-foreground/75 font-medium">
              {totalCompanies} business{totalCompanies === 1 ? "" : "es"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              Active raise:
              <span className="text-foreground font-semibold ml-1">{activeCompany?.name ?? "None"}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              Modeling:{" "}
              <span className="text-foreground font-semibold">
                {SCENARIO_LABELS[scenario]}
              </span>
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-sm border text-[12px] font-semibold tracking-wide bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Plan Active
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Scenario toggle
// ═══════════════════════════════════════════════════════════════════
function ScenarioToggle({
  active,
  onChange,
}: {
  active: FundingScenario;
  onChange: (s: FundingScenario) => void;
}) {
  const options: FundingScenario[] = ["conservative", "base", "aggressive"];
  return (
    <div className="flex items-stretch gap-3 flex-wrap">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground font-semibold self-center">
        Scenario
      </div>
      <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden bg-card">
        {options.map((opt) => {
          const isActive = opt === active;
          const intensityCls =
            opt === "conservative" ? "text-emerald-200" :
            opt === "base"         ? "text-foreground" :
                                     "text-red-200";
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`relative px-5 py-2.5 text-[12.5px] font-semibold transition-colors ${
                isActive
                  ? `bg-muted/60 ${intensityCls}`
                  : "text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted/30"
              }`}
            >
              {SCENARIO_LABELS[opt]}
              {isActive && (
                <motion.div
                  layoutId="scenario-pill-underline"
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
            </button>
          );
        })}
      </div>
      <span className="text-[11.5px] text-muted-foreground self-center italic">
        {SCENARIO_DESCRIPTIONS[active]}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Stat (hero strip cell)
// ═══════════════════════════════════════════════════════════════════
function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "red" | "amber" | "emerald";
}) {
  const cls =
    accent === "red"     ? "text-red-300"      :
    accent === "amber"   ? "text-amber-200"    :
    accent === "emerald" ? "text-emerald-200"  :
                           "text-foreground";
  return (
    <div className="px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium inline-flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        {label}
      </div>
      <div className={`mt-2 text-[26px] font-bold tabular-nums tracking-tight leading-none ${cls}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[11.5px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Round timeline (horizontal sweep)
// ═══════════════════════════════════════════════════════════════════
function RoundTimeline({
  rounds,
  scenario,
  company,
}: {
  rounds: FundingRound[];
  scenario: FundingScenario;
  company: FundingCompany;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addRound = useAddRound();

  const sortedRounds = [...rounds].sort((a, b) => a.position - b.position);

  return (
    <div className="border-t border-border">
      {sortedRounds.map((r, idx) => (
        <RoundRow
          key={r.id}
          round={r}
          scenario={scenario}
          isLast={idx === sortedRounds.length - 1}
          isEditing={editingId === r.id}
          onStartEdit={() => setEditingId(r.id)}
          onStopEdit={() => setEditingId(null)}
        />
      ))}

      {/* Add-round row */}
      {adding ? (
        <AddRoundForm
          companyId={company.id}
          onSubmit={(payload) => {
            addRound.mutate(payload, { onSuccess: () => setAdding(false) });
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-3 text-[12px] text-muted-foreground hover:text-primary hover:bg-primary/[0.04] border-t border-border transition-colors font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add round
        </button>
      )}
    </div>
  );
}

function RoundRow({
  round,
  scenario,
  isLast,
  isEditing,
  onStartEdit,
  onStopEdit,
}: {
  round: FundingRound;
  scenario: FundingScenario;
  isLast: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const adjusted = applyScenario(round, scenario);
  const investorPct = newInvestorOwnership(adjusted) * 100;
  const preMoney = preMoneyValuation(adjusted);
  const updateRound = useUpdateRound();
  const deleteRound = useDeleteRound();

  if (isEditing) {
    return <EditRoundInline round={round} onSubmit={(patch) => {
      updateRound.mutate({ id: round.id, patch }, { onSuccess: onStopEdit });
    }} onCancel={onStopEdit} />;
  }

  const accentBar =
    round.status === "closed"   ? "bg-emerald-500/70" :
    round.status === "raising"  ? "bg-amber-500/70"   :
    round.status === "skipped"  ? "bg-red-500/40"     :
                                  "bg-slate-500/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`grid grid-cols-[200px_1fr] gap-x-8 py-6 ${isLast ? "" : "border-b border-border"} group hover:bg-muted/20 transition-colors`}
    >
      {/* Left rail — round label */}
      <div className="relative pl-5">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${accentBar}`} />
        <div className="text-[20px] font-bold text-foreground tracking-tight leading-tight">
          {prettyRoundName(round.round_type)}
        </div>
        <RoundStatusPill status={round.status} />
        <div className="mt-3 text-[12px] text-muted-foreground tabular-nums">
          {round.date_planned
            ? new Date(round.date_planned).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Date TBD"}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground/80 inline-flex items-center gap-1">
          {round.instrument === "safe" ? "SAFE" : round.instrument === "priced" ? "Priced Round" : round.instrument}
        </div>
      </div>

      {/* Right column — round economics */}
      <div className="min-w-0 grid grid-cols-4 gap-x-6 gap-y-3 items-start">
        <Metric label="Target Raise" value={formatDollars(adjusted.target_raise, { compact: true })} accent="emerald" />
        <Metric label="Post-Money"   value={formatDollars(adjusted.post_money,   { compact: true })} accent="foreground" />
        <Metric label="Pre-Money"    value={preMoney >= 0 ? formatDollars(preMoney, { compact: true }) : "—"} sub={preMoney < 0 ? "Raise exceeds post-money" : undefined} accent={preMoney < 0 ? "red" : "foreground"} />
        <Metric label="New Dilution" value={formatPercent(investorPct)} accent="amber" sub="to investors" />

        {round.notes && (
          <div className="col-span-4 text-[12.5px] text-muted-foreground italic leading-relaxed mt-1">
            {round.notes}
          </div>
        )}

        {/* Hover actions */}
        <div className="col-span-4 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onStartEdit}
            className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit round"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${prettyRoundName(round.round_type)}?`)) {
                deleteRound.mutate(round.id);
              }
            }}
            className="p-1.5 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
            title="Delete round"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "red" | "amber" | "emerald" | "foreground";
}) {
  const cls =
    accent === "red"      ? "text-red-300"      :
    accent === "amber"    ? "text-amber-200"    :
    accent === "emerald"  ? "text-emerald-200"  :
                            "text-foreground";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
        {label}
      </div>
      <div className={`mt-1 text-[18px] font-bold tabular-nums tracking-tight leading-none ${cls}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RoundStatusPill({ status }: { status: FundingRoundStatus }) {
  const map = {
    closed:  { label: "Closed",  cls: "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40" },
    raising: { label: "Raising", cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40" },
    planned: { label: "Planned", cls: "bg-slate-500/[0.12] text-slate-300 border-slate-400/30" },
    skipped: { label: "Skipped", cls: "bg-red-500/[0.10] text-red-300 border-red-400/30" },
  };
  const m = map[status];
  return (
    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-sm border text-[10.5px] font-semibold tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Inline edit form for a round
// ═══════════════════════════════════════════════════════════════════
function EditRoundInline({
  round,
  onSubmit,
  onCancel,
}: {
  round: FundingRound;
  onSubmit: (patch: Partial<FundingRound>) => void;
  onCancel: () => void;
}) {
  const [targetRaise, setTargetRaise] = useState(round.target_raise);
  const [postMoney, setPostMoney] = useState(round.post_money);
  const [status, setStatus] = useState(round.status);
  const [datePlanned, setDatePlanned] = useState(round.date_planned ?? "");
  const [notes, setNotes] = useState(round.notes ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          target_raise: targetRaise,
          post_money: postMoney,
          valuation_cap: postMoney,
          status,
          date_planned: datePlanned || null,
          notes: notes || null,
        });
      }}
      className="grid grid-cols-[200px_1fr] gap-x-8 py-6 border-b border-border bg-amber-500/[0.04]"
    >
      <div className="pl-5 text-[20px] font-bold text-foreground tracking-tight">
        {prettyRoundName(round.round_type)}
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">Editing</div>
      </div>
      <div className="grid grid-cols-4 gap-3 items-end">
        <Field label="Target Raise ($)">
          <input type="number" value={targetRaise} onChange={(e) => setTargetRaise(Number(e.target.value))}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <Field label="Post-Money ($)">
          <input type="number" value={postMoney} onChange={(e) => setPostMoney(Number(e.target.value))}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as FundingRoundStatus)}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground w-full focus:outline-none focus:border-primary/60">
            <option value="planned">Planned</option>
            <option value="raising">Raising</option>
            <option value="closed">Closed</option>
            <option value="skipped">Skipped</option>
          </select>
        </Field>
        <Field label="Date Planned">
          <input type="date" value={datePlanned} onChange={(e) => setDatePlanned(e.target.value)}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <div className="col-span-4">
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="bg-background border border-border rounded-sm px-2 py-1.5 text-[12.5px] text-foreground w-full focus:outline-none focus:border-primary/60 resize-none" />
          </Field>
        </div>
        <div className="col-span-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="px-3 py-1.5 rounded-sm text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button type="submit"
            className="px-3 py-1.5 rounded-sm text-[12px] text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/[0.08] transition-colors inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Add-round form (collapses inline at the bottom of the timeline)
// ═══════════════════════════════════════════════════════════════════
function AddRoundForm({
  companyId,
  onSubmit,
  onCancel,
}: {
  companyId: string;
  onSubmit: (payload: any) => void;
  onCancel: () => void;
}) {
  const [roundType, setRoundType] = useState<FundingRoundType>("seed");
  const [instrument, setInstrument] = useState<"safe" | "priced">("safe");
  const [targetRaise, setTargetRaise] = useState(5_000_000);
  const [postMoney, setPostMoney] = useState(25_000_000);
  const [datePlanned, setDatePlanned] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          company_id: companyId,
          round_type: roundType,
          instrument,
          target_raise: targetRaise,
          post_money: postMoney,
          valuation_cap: instrument === "safe" ? postMoney : undefined,
          date_planned: datePlanned || undefined,
        });
      }}
      className="grid grid-cols-[200px_1fr] gap-x-8 py-6 border-t border-border bg-primary/[0.04]"
    >
      <div className="pl-5 text-[20px] font-bold text-foreground tracking-tight">
        New Round
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Adding</div>
      </div>
      <div className="grid grid-cols-4 gap-3 items-end">
        <Field label="Type">
          <select value={roundType} onChange={(e) => setRoundType(e.target.value as FundingRoundType)}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground w-full focus:outline-none focus:border-primary/60">
            <option value="pre-seed">Pre-Seed</option>
            <option value="seed">Seed</option>
            <option value="series-a">Series A</option>
            <option value="series-b">Series B</option>
            <option value="series-c">Series C</option>
            <option value="bridge">Bridge</option>
          </select>
        </Field>
        <Field label="Instrument">
          <select value={instrument} onChange={(e) => setInstrument(e.target.value as "safe" | "priced")}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground w-full focus:outline-none focus:border-primary/60">
            <option value="safe">SAFE</option>
            <option value="priced">Priced Round</option>
          </select>
        </Field>
        <Field label="Target Raise ($)">
          <input type="number" value={targetRaise} onChange={(e) => setTargetRaise(Number(e.target.value))}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <Field label="Post-Money ($)">
          <input type="number" value={postMoney} onChange={(e) => setPostMoney(Number(e.target.value))}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <Field label="Date Planned">
          <input type="date" value={datePlanned} onChange={(e) => setDatePlanned(e.target.value)}
            className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground w-full focus:outline-none focus:border-primary/60" />
        </Field>
        <div className="col-span-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="px-3 py-1.5 rounded-sm text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button type="submit"
            className="px-3 py-1.5 rounded-sm text-[12px] text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/[0.08] transition-colors inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Add Round
          </button>
        </div>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Per-company cap table card
// ═══════════════════════════════════════════════════════════════════
function CompanyCapTableCard({
  company,
  rounds,
  holders,
  scenario,
  allCompanies,
}: {
  company: FundingCompany;
  rounds: FundingRound[];
  holders: any[];
  scenario: FundingScenario;
  allCompanies: FundingCompany[];
}) {
  const [showDetail, setShowDetail] = useState(false);

  const projection = useMemo(
    () => projectCapTable(holders, rounds, scenario),
    [holders, rounds, scenario],
  );

  const parent = company.parent_company_id
    ? allCompanies.find((c) => c.id === company.parent_company_id)
    : null;

  const totalProjected = projection.holders.reduce((s, h) => s + h.projected_percentage, 0);

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setShowDetail((d) => !d)}
        className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: company.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[15px] font-bold text-foreground tracking-tight">{company.name}</span>
              {company.is_active_raise && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-bold tracking-wide bg-amber-500/[0.14] text-amber-200 border-amber-400/40">
                  <Sparkles className="h-2.5 w-2.5 mr-1" /> Active raise
                </span>
              )}
              {parent && (
                <span className="text-[11px] text-muted-foreground">
                  · Subsidiary of <span className="text-foreground/85">{parent.name}</span>
                </span>
              )}
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              {projection.holders.length} holders · {rounds.length} round{rounds.length === 1 ? "" : "s"}
              {projection.totalRaisedClosed > 0 && (
                <> · {formatDollars(projection.totalRaisedClosed, { compact: true })} raised</>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${showDetail ? "rotate-180" : ""}`}
        />
      </button>

      {/* Stacked bar (always visible) */}
      <div className="px-6 pb-4">
        <div className="flex h-9 w-full overflow-hidden rounded-sm border border-border bg-muted/20">
          {projection.holders
            .filter((h) => h.projected_percentage > 0.5)
            .map((h) => {
              const widthPct = (h.projected_percentage / Math.max(totalProjected, 100)) * 100;
              return (
                <div
                  key={h.id}
                  className={`${holderTypeColor(h.holder_type)} border-r flex items-center justify-center transition-all`}
                  style={{ width: `${widthPct}%` }}
                  title={`${h.holder_name} — ${formatPercent(h.projected_percentage)}`}
                >
                  {widthPct > 8 && (
                    <span className="text-[10.5px] font-bold text-foreground tabular-nums truncate px-1">
                      {formatPercent(h.projected_percentage, 0)}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
        {/* Legend */}
        <div className="mt-2.5 flex items-center gap-x-4 gap-y-1.5 flex-wrap">
          {projection.holders
            .filter((h) => h.projected_percentage > 0.5)
            .map((h) => (
              <span key={h.id} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span className={`h-2 w-2 rounded-sm ${holderTypeColor(h.holder_type).split(" ")[0]}`} />
                <span className="text-foreground/85 font-medium">{h.holder_name}</span>
                <span className="tabular-nums">{formatPercent(h.projected_percentage)}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Detail table */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-6 py-4">
              <div className="grid grid-cols-[2fr_1fr_minmax(90px,auto)_minmax(90px,auto)_minmax(110px,auto)] gap-x-4 py-2 border-b border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                <span>Holder</span>
                <span>Type</span>
                <span className="text-right">Starting</span>
                <span className="text-right">Current</span>
                <span className="text-right">Projected</span>
              </div>
              {projection.holders.map((h) => (
                <div
                  key={h.id}
                  className="grid grid-cols-[2fr_1fr_minmax(90px,auto)_minmax(90px,auto)_minmax(110px,auto)] gap-x-4 py-2.5 border-b border-border/40 last:border-b-0 text-[12.5px] items-baseline"
                >
                  <span className="text-foreground/90 font-medium truncate">{h.holder_name}</span>
                  <span className="text-muted-foreground text-[11.5px]">{holderTypeLabel(h.holder_type)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {h.starting_percentage > 0 ? formatPercent(h.starting_percentage) : "—"}
                  </span>
                  <span className="text-right tabular-nums text-foreground/85">
                    {h.current_percentage > 0 ? formatPercent(h.current_percentage) : "—"}
                  </span>
                  <span className="text-right tabular-nums text-foreground font-semibold">
                    {formatPercent(h.projected_percentage)}
                  </span>
                </div>
              ))}
              {projection.finalPostMoney > 0 && (
                <div className="mt-3 text-[11.5px] text-muted-foreground">
                  Projected final post-money: <span className="text-foreground/90 font-semibold">{formatDollars(projection.finalPostMoney, { compact: true })}</span> ·
                  Total raised across plan: <span className="text-foreground/90 font-semibold">{formatDollars(projection.totalRaised, { compact: true })}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Inter-business equity flow
// ═══════════════════════════════════════════════════════════════════
function InterBusinessFlow({ data, scenario }: { data: FundingData; scenario: FundingScenario }) {
  // Find every business-type holder where holder_business_id references another company
  const flows = useMemo(() => {
    const items: {
      from: FundingCompany;
      to: FundingCompany;
      currentPct: number;
      projectedPct: number;
    }[] = [];

    for (const company of data.companies) {
      const holders = data.holders.filter((h) => h.company_id === company.id);
      const rounds = data.rounds.filter((r) => r.company_id === company.id);
      const projection = projectCapTable(holders, rounds, scenario);

      for (const h of projection.holders) {
        if (h.holder_type === "business" && h.holder_business_id) {
          const parent = data.companies.find((c) => c.id === h.holder_business_id);
          if (parent) {
            items.push({
              from: parent,
              to: company,
              currentPct: h.current_percentage,
              projectedPct: h.projected_percentage,
            });
          }
        }
      }
    }
    return items;
  }, [data, scenario]);

  if (flows.length === 0) {
    return (
      <div className="border border-border rounded-sm bg-card/30 px-6 py-5">
        <p className="text-[12.5px] text-muted-foreground italic">
          No inter-business equity holdings yet. Add a business-type holder to a company's cap table to show parent ↔ subsidiary flows here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      {flows.map((f, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b border-border/40 last:border-b-0 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: f.from.color }} />
            <span className="text-[13px] font-semibold text-foreground">{f.from.name}</span>
            <Network className="h-3 w-3 text-muted-foreground/50 mx-1" />
            <span className="text-[12px] text-muted-foreground">owns</span>
            <Network className="h-3 w-3 text-muted-foreground/50 mx-1" />
            <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: f.to.color }} />
            <span className="text-[13px] font-semibold text-foreground">{f.to.name}</span>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">Now</div>
              <div className="text-[14px] font-bold text-foreground tabular-nums">
                {f.currentPct > 0 ? formatPercent(f.currentPct) : "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">After plan</div>
              <div className="text-[14px] font-bold text-amber-200 tabular-nums">
                {formatPercent(f.projectedPct)}
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="px-6 py-3 border-t border-border bg-muted/10">
        <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          Parent stakes dilute with each subsidiary round — same formula as direct equity holders.
        </div>
      </div>
    </div>
  );
}
