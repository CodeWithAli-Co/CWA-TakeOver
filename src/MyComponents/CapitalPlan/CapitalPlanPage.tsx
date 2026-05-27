/**
 * CapitalPlanPage.tsx — Admin → Capital Plan top-level surface.
 *
 * Five tabs:
 *   Rounds       Plan/edit each funding round (terms, instrument, cap)
 *   Checks       Investor CRM — pipeline kanban + per-investor drawer
 *   Allocation   Editable budget table per round + line-item drilldown
 *   Runway       Manual burn entry + runway timeline + variance chart
 *   Scenarios    Worth-it calculator + saved scenarios
 *
 * AXON column lives in the right rail (collapsible) — answers questions
 * about the current state, surfaces inline suggestions, can auto-apply
 * with one-click undo.
 *
 * Gated to CEO / COO / CFO by:
 *   - UserView wrapper at the route level (client-side hide)
 *   - is_finance_role() RLS in Supabase (server-side enforce)
 *
 * Day 1 ships the shell + the Rounds tab read-only. Subsequent
 * phases fill in Checks (CRM), Allocation, Runway, Scenarios.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,           // Rounds icon
  Users,           // Checks icon
  PieChart,        // Allocation icon
  Activity,        // Runway icon
  GitBranch,       // Scenarios icon
  Sparkles,        // AXON column trigger
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import {
  useCapitalPlan,
  useCapitalPlanRealtime,
  summarizeRoundProgress,
  totalRaisedToDate,
  type CapitalRound,
} from "./CapitalPlan.queries";
import { RoundsTab } from "./tabs/RoundsTab";
import { ChecksTab } from "./tabs/ChecksTab";
import { AllocationTab } from "./tabs/AllocationTab";
import { RunwayTab } from "./tabs/RunwayTab";
import { ScenariosTab } from "./tabs/ScenariosTab";
import { AxonAdvisorRail } from "./AxonAdvisorRail";
import {
  buildInvestorUpdateMarkdown, buildFullSnapshotMarkdown,
} from "./capitalSnapshot";

const CASH_KEY = "cwa-capital-plan-cash-on-hand";

// ─── Tab definition ─────────────────────────────────────────────

type CapitalTabKey = "rounds" | "checks" | "allocation" | "runway" | "scenarios";

const TABS: { key: CapitalTabKey; label: string; icon: typeof Coins; tone: string }[] = [
  { key: "rounds",     label: "Rounds",     icon: Coins,    tone: "text-emerald-200" },
  { key: "checks",     label: "Checks",     icon: Users,    tone: "text-amber-200"   },
  { key: "allocation", label: "Allocation", icon: PieChart, tone: "text-violet-200"  },
  { key: "runway",     label: "Runway",     icon: Activity, tone: "text-cyan-200"    },
  { key: "scenarios",  label: "Scenarios",  icon: GitBranch, tone: "text-rose-200"   },
];

const ACTIVE_TAB_KEY = "cwa-capital-plan-tab";

function loadActiveTab(): CapitalTabKey {
  try {
    const raw = window.localStorage.getItem(ACTIVE_TAB_KEY);
    if (raw && TABS.some((t) => t.key === raw)) return raw as CapitalTabKey;
  } catch { /* ignore */ }
  return "rounds";
}

// ─── Top-level ──────────────────────────────────────────────────

export default function CapitalPlanPage() {
  useCapitalPlanRealtime();
  const { data, isLoading, error } = useCapitalPlan();
  const [activeTab, setActiveTab] = useState<CapitalTabKey>(() => loadActiveTab());
  const [axonOpen, setAxonOpen] = useState(true);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  function changeTab(next: CapitalTabKey) {
    setActiveTab(next);
    try { window.localStorage.setItem(ACTIVE_TAB_KEY, next); } catch { /* ignore */ }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading Capital Plan…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-start justify-center p-10">
        <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-6 max-w-xl">
          <div className="flex items-center gap-2 text-red-200 font-semibold mb-2">
            <AlertCircle className="h-4 w-4" />
            Couldn't load Capital Plan
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            This module is gated to CEO, COO, CFO via Supabase RLS. If you're one of those
            roles and still see this, check that the <code className="text-foreground/80">capital_plan_schema.sql</code>{" "}
            migration has been run.
          </p>
          <pre className="mt-3 text-[11px] text-red-200/70 overflow-auto">
            {String(error)}
          </pre>
        </div>
      </div>
    );
  }

  const plan = data!;
  const activeRounds = plan.rounds.filter((r) => r.status === "raising" || r.status === "planning");
  const totalRaised = totalRaisedToDate(plan.rounds, plan.checks);

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-background text-foreground">
      <HeaderStrip
        rounds={plan.rounds}
        activeRounds={activeRounds}
        totalRaised={totalRaised}
        checksCount={plan.checks.length}
        scenariosCount={plan.scenarios.length}
        plan={plan}
        axonOpen={axonOpen}
        onToggleAxon={() => setAxonOpen((o) => !o)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-0">
        {/* ─── Main column ─── */}
        <div className="min-w-0">
          {/* Tab bar */}
          <div className="border-b border-border px-8 pt-1">
            <div className="inline-flex items-stretch">
              {TABS.map((t) => {
                const isActive = activeTab === t.key;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => changeTab(t.key)}
                    className={`relative inline-flex items-center gap-2 px-4 py-3 text-[12.5px] font-semibold transition-colors ${
                      isActive
                        ? `${t.tone}`
                        : "text-muted-foreground/70 hover:text-foreground/85"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                    {isActive && (
                      <motion.div
                        layoutId="capital-tab-underline"
                        className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary"
                        transition={{ type: "spring", damping: 28, stiffness: 320 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="px-8 py-6">
            {activeTab === "rounds" && (
              <RoundsTab
                plan={plan}
                selectedRoundId={selectedRoundId}
                onSelectRound={setSelectedRoundId}
              />
            )}
            {activeTab === "checks" && (
              <ChecksTab plan={plan} selectedRoundId={selectedRoundId} />
            )}
            {activeTab === "allocation" && (
              <AllocationTab plan={plan} selectedRoundId={selectedRoundId} />
            )}
            {activeTab === "runway" && <RunwayTab plan={plan} />}
            {activeTab === "scenarios" && <ScenariosTab plan={plan} />}
          </div>
        </div>

        {/* ─── AXON advisor rail (collapsible) ─── */}
        {axonOpen && (
          <AxonAdvisorRail
            plan={plan}
            activeTab={activeTab}
            onClose={() => setAxonOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Header strip — at-a-glance state ──────────────────────────
function HeaderStrip({
  rounds, activeRounds, totalRaised, checksCount, scenariosCount, plan,
  axonOpen, onToggleAxon,
}: {
  rounds: CapitalRound[];
  activeRounds: CapitalRound[];
  totalRaised: number;
  checksCount: number;
  scenariosCount: number;
  plan: import("./CapitalPlan.queries").CapitalPlanData;
  axonOpen: boolean;
  onToggleAxon: () => void;
}) {
  return (
    <div className="border-b border-border bg-card/30">
      <div className="px-8 py-4 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-foreground tracking-tight">
            Capital Plan
          </h1>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Rounds, checks, allocation, runway. Visible to CEO, COO, CFO.
          </p>
        </div>

        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
          <Stat label="Rounds" value={String(rounds.length)} subtle={`${activeRounds.length} active`} />
          <Stat label="Investors" value={String(checksCount)} subtle="tracked" />
          <Stat label="Scenarios" value={String(scenariosCount)} subtle="saved" />
          <Stat
            label="Raised"
            value={formatCompactDollars(totalRaised)}
            subtle="committed + wired"
            tone="text-emerald-200"
          />
          <SnapshotButton plan={plan} />
          <button
            type="button"
            onClick={onToggleAxon}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border transition-colors ${
              axonOpen
                ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
            title={axonOpen ? "Hide AXON advisor" : "Show AXON advisor"}
          >
            <Sparkles className="h-3 w-3" />
            AXON
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Copy-snapshot button (header) ─────────────────────────────
function SnapshotButton({ plan }: { plan: import("./CapitalPlan.queries").CapitalPlanData }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"short" | "full" | null>(null);

  // Read cash from the same key Runway + Scenarios use
  function getCash(): number {
    try { return Number(window.localStorage.getItem(CASH_KEY)) || 0; } catch { return 0; }
  }

  async function copy(kind: "short" | "full") {
    const cash = getCash();
    const md = kind === "short"
      ? buildInvestorUpdateMarkdown({ plan, cashOnHand: cash })
      : buildFullSnapshotMarkdown({ plan, cashOnHand: cash });
    try {
      await navigator.clipboard.writeText(md);
      setCopied(kind);
      setTimeout(() => { setCopied(null); setOpen(false); }, 1200);
    } catch {
      console.warn("[CapitalPlan] clipboard write failed. Snapshot:\n\n" + md);
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function onDocClick() { setOpen(false); }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        title="Copy capital state as markdown for investor updates / co-founder review"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Snapshot"}
      </button>
      {open && !copied && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[220px] border border-border bg-background rounded-sm shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => copy("short")}
            className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/60"
          >
            <div className="text-[12px] font-bold text-foreground normal-case tracking-normal">Investor update</div>
            <div className="text-[10.5px] text-muted-foreground normal-case tracking-normal mt-0.5">
              One-pager: cash, burn, runway, in-flight rounds
            </div>
          </button>
          <button
            type="button"
            onClick={() => copy("full")}
            className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className="text-[12px] font-bold text-foreground normal-case tracking-normal">Full snapshot</div>
            <div className="text-[10.5px] text-muted-foreground normal-case tracking-normal mt-0.5">
              Everything: rounds + investors + budgets + actuals
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, subtle, tone,
}: { label: string; value: string; subtle?: string; tone?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9.5px] text-muted-foreground/70 font-semibold">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums tracking-tight ${tone ?? "text-foreground"}`}>
        {value}
      </div>
      {subtle && <div className="text-[9.5px] text-muted-foreground/60 mt-0.5">{subtle}</div>}
    </div>
  );
}

function formatCompactDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// Re-export so the route file can do `import CapitalPlanPage from …`
export { summarizeRoundProgress };
