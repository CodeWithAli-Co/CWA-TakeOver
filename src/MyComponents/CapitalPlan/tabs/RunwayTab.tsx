/**
 * RunwayTab.tsx — Burn entry + runway timeline + variance.
 *
 * Layout:
 *   - Top KPI strip: Cash on hand, Monthly burn, Runway months, Days
 *     to next round close.
 *   - Timeline bar: visual line from today → next close → runway end →
 *     seed target. Color-shifts based on tightness.
 *   - Burn entry composer: add an actual (date, amount, vendor, bucket).
 *   - Planned vs actual: per-bucket horizontal bars with variance %.
 *   - Recent actuals table (collapsible).
 *
 * Cash on hand is entered manually for v1 (settings input). When MCP
 * integration to Mercury/Brex/Ramp ships, this gets replaced with a
 * live balance read.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, X, Activity, BanknoteIcon, Clock, Calendar,
  TrendingDown, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  useUpsertActual, useDeleteActual,
  estimateMonthlyBurn, projectRunwayMonths, totalRaisedToDate,
  type CapitalPlanData, type CapitalActual,
} from "../CapitalPlan.queries";

const CASH_KEY = "cwa-capital-plan-cash-on-hand";

export function RunwayTab({ plan }: { plan: CapitalPlanData }) {
  // Manual cash-on-hand — persisted to localStorage. When MCP wires
  // in Mercury/Brex/Ramp this becomes a live balance read.
  const [cashOnHand, setCashOnHand] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(CASH_KEY);
      return raw ? Number(raw) : 0;
    } catch { return 0; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(CASH_KEY, String(cashOnHand)); } catch { /* ignore */ }
  }, [cashOnHand]);

  const totalRaised = useMemo(
    () => totalRaisedToDate(plan.rounds, plan.checks),
    [plan.rounds, plan.checks],
  );

  // If cash hasn't been set yet but we have raised funds, suggest the
  // raised amount minus actuals as a starting balance.
  const suggestedCash = useMemo(() => {
    const spentSoFar = plan.actuals.reduce((s, a) => s + a.amount, 0);
    return Math.max(0, totalRaised - spentSoFar);
  }, [totalRaised, plan.actuals]);

  const monthlyBurn = useMemo(
    () => estimateMonthlyBurn(plan.actuals, plan.allocations),
    [plan.actuals, plan.allocations],
  );
  const runwayMonths = useMemo(
    () => projectRunwayMonths(cashOnHand, monthlyBurn),
    [cashOnHand, monthlyBurn],
  );

  const nextRound = useMemo(() => {
    const upcoming = plan.rounds
      .filter((r) => r.target_close_date && (r.status === "planning" || r.status === "raising"))
      .sort((a, b) => new Date(a.target_close_date!).getTime() - new Date(b.target_close_date!).getTime());
    return upcoming[0] ?? null;
  }, [plan.rounds]);
  const daysToNextClose = nextRound?.target_close_date
    ? Math.ceil((new Date(nextRound.target_close_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CashKPI
          cashOnHand={cashOnHand}
          onChange={setCashOnHand}
          suggested={suggestedCash}
        />
        <KPI
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Monthly burn"
          value={formatDollars(monthlyBurn)}
          sub={plan.actuals.length > 0
            ? `last 90d from ${plan.actuals.length} actual${plan.actuals.length === 1 ? "" : "s"}`
            : "estimated from plan"}
          tone="text-amber-200"
        />
        <KPI
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Runway"
          value={runwayMonths === Infinity ? "∞" : `${runwayMonths.toFixed(1)}mo`}
          sub={runwayMonths < 6 && runwayMonths !== Infinity ? "⚠ less than 6 months" : "at current burn"}
          tone={
            runwayMonths === Infinity ? "text-foreground" :
            runwayMonths < 3 ? "text-red-300" :
            runwayMonths < 6 ? "text-amber-200" : "text-emerald-200"
          }
        />
        <KPI
          icon={<Calendar className="h-3.5 w-3.5" />}
          label={nextRound ? `${nextRound.name} closes` : "Next close"}
          value={daysToNextClose !== null ? `${Math.abs(daysToNextClose)}d` : "—"}
          sub={
            daysToNextClose === null ? "no upcoming target" :
            daysToNextClose < 0 ? "past target close" :
            daysToNextClose <= 30 ? "in <30 days" : ""
          }
          tone={
            daysToNextClose === null ? "text-muted-foreground" :
            daysToNextClose < 0 ? "text-red-300" :
            daysToNextClose <= 30 ? "text-amber-200" : "text-foreground"
          }
        />
      </div>

      {/* Runway timeline */}
      <RunwayTimeline
        cashOnHand={cashOnHand}
        monthlyBurn={monthlyBurn}
        runwayMonths={runwayMonths}
        rounds={plan.rounds}
      />

      {/* Burn entry + recent actuals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
        <BurnComposer plan={plan} />
        <ActualsList plan={plan} />
      </div>

      {/* Planned vs actual variance */}
      <VarianceChart plan={plan} />
    </div>
  );
}

// ─── KPI tiles ──────────────────────────────────────────────────

function KPI({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="border border-border rounded-sm bg-card/30 p-3.5">
      <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-1">
        <span className="text-muted-foreground/60">{icon}</span>
        {label}
      </div>
      <div className={`text-[20px] font-bold tabular-nums tracking-tight ${tone ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-1">{sub}</div>}
    </div>
  );
}

function CashKPI({
  cashOnHand, onChange, suggested,
}: {
  cashOnHand: number;
  onChange: (n: number) => void;
  suggested: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cashOnHand);
  function commit() {
    onChange(draft);
    setEditing(false);
  }
  return (
    <div
      className="border border-border rounded-sm bg-card/30 p-3.5 cursor-pointer hover:border-foreground/30 transition-colors"
      onClick={() => { if (!editing) { setDraft(cashOnHand); setEditing(true); } }}
    >
      <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-1">
        <BanknoteIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
        Cash on hand
      </div>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
            step="10000"
            className="flex-1 bg-background border border-primary/60 rounded-sm px-2 py-1 text-[18px] font-bold text-foreground tabular-nums focus:outline-none"
          />
        </div>
      ) : (
        <>
          <div className="text-[20px] font-bold text-emerald-200 tabular-nums tracking-tight">
            {formatDollars(cashOnHand)}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-1">
            click to edit
            {cashOnHand === 0 && suggested > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(suggested); }}
                className="ml-2 text-emerald-300/80 hover:text-emerald-200 underline-offset-2 hover:underline"
              >
                use raised: {formatDollars(suggested)}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Runway timeline ───────────────────────────────────────────

function RunwayTimeline({
  cashOnHand, monthlyBurn, runwayMonths, rounds,
}: {
  cashOnHand: number;
  monthlyBurn: number;
  runwayMonths: number;
  rounds: { id: string; name: string; target_close_date: string | null; status: string }[];
}) {
  // Establish the visible window: today → max(runwayEnd, latestRound, +12mo)
  const today = Date.now();
  const runwayEnd = runwayMonths !== Infinity && monthlyBurn > 0
    ? today + runwayMonths * 30 * 24 * 60 * 60 * 1000
    : today + 18 * 30 * 24 * 60 * 60 * 1000;
  const roundDates = rounds
    .filter((r) => r.target_close_date)
    .map((r) => new Date(r.target_close_date!).getTime());
  const windowEnd = Math.max(runwayEnd, ...roundDates, today + 12 * 30 * 24 * 60 * 60 * 1000);
  const windowStart = today;
  const span = windowEnd - windowStart;

  function pctOf(date: number) {
    return Math.max(0, Math.min(100, ((date - windowStart) / span) * 100));
  }

  const markers = [
    { date: today, label: "Today", color: "bg-foreground", textColor: "text-foreground" },
    ...rounds
      .filter((r) => r.target_close_date && (r.status === "planning" || r.status === "raising"))
      .map((r) => ({
        date: new Date(r.target_close_date!).getTime(),
        label: r.name,
        color: "bg-emerald-500",
        textColor: "text-emerald-300",
      })),
    ...(runwayMonths !== Infinity && monthlyBurn > 0 && cashOnHand > 0 ? [{
      date: runwayEnd,
      label: "Runway out",
      color: "bg-red-500",
      textColor: "text-red-300",
    }] : []),
  ].sort((a, b) => a.date - b.date);

  const runwayCoversNextRound = rounds.some((r) =>
    r.target_close_date &&
    (r.status === "planning" || r.status === "raising") &&
    new Date(r.target_close_date).getTime() <= runwayEnd
  );

  return (
    <div className="border border-border rounded-sm bg-card/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Runway timeline
        </span>
        {monthlyBurn > 0 && cashOnHand > 0 && (
          <span className={`text-[10.5px] uppercase tracking-[0.18em] font-bold ${
            runwayCoversNextRound ? "text-emerald-300" : "text-red-300"
          }`}>
            {runwayCoversNextRound ? "✓ Runway covers next close" : "⚠ Will run out before next close"}
          </span>
        )}
      </div>

      <div className="relative h-16">
        {/* Background bar */}
        <div className="absolute top-7 left-0 right-0 h-1.5 bg-muted/30 rounded-sm" />

        {/* Runway extent */}
        {monthlyBurn > 0 && cashOnHand > 0 && (
          <div
            className="absolute top-7 left-0 h-1.5 rounded-sm"
            style={{
              width: `${pctOf(runwayEnd)}%`,
              background: `linear-gradient(to right, hsl(142 71% 45%), ${
                runwayCoversNextRound ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)"
              })`,
            }}
          />
        )}

        {/* Markers */}
        {markers.map((m, i) => (
          <div
            key={`${m.label}-${i}`}
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${pctOf(m.date)}%` }}
          >
            <span className={`text-[9.5px] uppercase tracking-[0.14em] font-bold whitespace-nowrap ${m.textColor}`}>
              {m.label}
            </span>
            <span className="text-[9.5px] text-muted-foreground/70 tabular-nums whitespace-nowrap">
              {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            <div className={`w-0.5 h-3 ${m.color} mt-1`} />
            <div className={`w-2 h-2 rounded-full ${m.color} -mt-0.5 z-10`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Burn entry composer ───────────────────────────────────────

function BurnComposer({ plan }: { plan: CapitalPlanData }) {
  const upsert = useUpsertActual();
  const [form, setForm] = useState<Partial<CapitalActual>>({
    amount: 0,
    occurred_on: new Date().toISOString().slice(0, 10),
    vendor: "",
    description: "",
    source: "manual",
    allocation_id: null,
    round_id: null,
  });

  function patch<K extends keyof CapitalActual>(key: K, value: CapitalActual[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.amount || form.amount <= 0) return;
    await upsert.mutateAsync(form as any);
    setForm({
      amount: 0,
      occurred_on: new Date().toISOString().slice(0, 10),
      vendor: "",
      description: "",
      source: "manual",
      allocation_id: form.allocation_id ?? null,
      round_id: form.round_id ?? null,
    });
  }

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Log a spend
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <input
              type="number"
              value={form.amount ?? 0}
              onChange={(e) => patch("amount", Number(e.target.value))}
              step="50"
              placeholder="0"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[14px] text-emerald-200 font-bold tabular-nums focus:outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.occurred_on ?? ""}
              onChange={(e) => patch("occurred_on", e.target.value)}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </Field>
        </div>

        <Field label="Vendor">
          <input
            type="text"
            value={form.vendor ?? ""}
            onChange={(e) => patch("vendor", e.target.value || null)}
            placeholder="e.g. Vercel, Mercury, OpenAI"
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
          />
        </Field>

        <Field label="Description">
          <input
            type="text"
            value={form.description ?? ""}
            onChange={(e) => patch("description", e.target.value || null)}
            placeholder="What did this spend cover?"
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
          />
        </Field>

        <Field label="Allocation bucket (optional)">
          <select
            value={form.allocation_id ?? ""}
            onChange={(e) => {
              const allocId = e.target.value || null;
              const alloc = plan.allocations.find((a) => a.id === allocId);
              patch("allocation_id", allocId);
              patch("round_id", alloc?.round_id ?? null);
            }}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
          >
            <option value="">— Unassigned —</option>
            {plan.allocations.map((a) => {
              const round = plan.rounds.find((r) => r.id === a.round_id);
              return (
                <option key={a.id} value={a.id}>
                  {a.bucket_name}{round ? ` (${round.name})` : ""}
                </option>
              );
            })}
          </select>
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={!form.amount || form.amount <= 0}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-sm bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Log spend
        </button>

        <p className="text-[10.5px] text-muted-foreground/70 italic text-center pt-1 border-t border-border/40">
          Mercury / Brex / Ramp / QBO auto-import lands when the MCP connector is available.
        </p>
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

// ─── Recent actuals list ───────────────────────────────────────

function ActualsList({ plan }: { plan: CapitalPlanData }) {
  const remove = useDeleteActual();
  const recent = useMemo(
    () => [...plan.actuals].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 20),
    [plan.actuals],
  );

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Recent actuals ({plan.actuals.length})
        </span>
        {plan.actuals.length > 0 && (
          <span className="text-[10.5px] text-muted-foreground/70 tabular-nums">
            Total: {formatDollars(plan.actuals.reduce((s, a) => s + a.amount, 0))}
          </span>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/70 italic">
          No actuals logged yet. Use "Log a spend" to start tracking.
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-card/80 backdrop-blur-sm">
              <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-semibold">
                <th className="text-left px-3 py-2 font-semibold">Date</th>
                <th className="text-left px-2 py-2 font-semibold">Vendor</th>
                <th className="text-left px-2 py-2 font-semibold">Bucket</th>
                <th className="text-right px-2 py-2 font-semibold">Amount</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recent.map((a) => {
                const alloc = a.allocation_id ? plan.allocations.find((x) => x.id === a.allocation_id) : null;
                return (
                  <tr key={a.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {new Date(a.occurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-2 py-2 text-foreground/85 truncate max-w-[140px]">
                      {a.vendor || <span className="text-muted-foreground/50 italic">—</span>}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground truncate max-w-[140px]">
                      {alloc ? alloc.bucket_name : <span className="italic">unassigned</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-amber-200 font-semibold tabular-nums">
                      {formatDollars(a.amount)}
                    </td>
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Delete this $${a.amount} spend?`)) remove.mutateAsync(a.id); }}
                        className="p-1 text-muted-foreground/40 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Delete actual"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Variance chart (planned vs actual per bucket) ─────────────

function VarianceChart({ plan }: { plan: CapitalPlanData }) {
  const [collapsed, setCollapsed] = useState(false);

  const rows = useMemo(() => {
    return plan.allocations.map((alloc) => {
      const spent = plan.actuals
        .filter((a) => a.allocation_id === alloc.id)
        .reduce((s, a) => s + a.amount, 0);
      const variance = spent - alloc.planned_amount;
      const pctSpent = alloc.planned_amount > 0 ? spent / alloc.planned_amount : 0;
      return { ...alloc, spent, variance, pctSpent };
    }).sort((a, b) => b.pctSpent - a.pctSpent);
  }, [plan.allocations, plan.actuals]);

  if (rows.length === 0) return null;

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 border-b border-border/60 flex items-center justify-between hover:bg-muted/10 transition-colors"
      >
        <span className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Planned vs actual
        </span>
        <span className="text-[10.5px] text-muted-foreground/70">
          {rows.length} bucket{rows.length === 1 ? "" : "s"}
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {rows.map((r) => {
                const overspent = r.variance > 0;
                return (
                  <div key={r.id}>
                    <div className="flex items-baseline justify-between mb-1 gap-2">
                      <span className="text-[12px] font-semibold text-foreground truncate">
                        {r.bucket_name}
                      </span>
                      <span className={`text-[11px] tabular-nums shrink-0 ${
                        overspent ? "text-red-300" : r.pctSpent > 0.85 ? "text-amber-200" : "text-muted-foreground"
                      }`}>
                        {formatDollars(r.spent)} / {formatDollars(r.planned_amount)}
                        {Math.abs(r.variance) > 1 && (
                          <span className={`ml-1 ${overspent ? "text-red-300" : "text-emerald-300/80"}`}>
                            {overspent ? "+" : ""}{formatDollars(r.variance)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted/30 rounded-sm overflow-hidden relative">
                      <div
                        className={`h-full transition-all ${
                          overspent ? "bg-red-500" :
                          r.pctSpent > 0.85 ? "bg-amber-500" :
                          "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, r.pctSpent * 100)}%` }}
                      />
                      {/* Overspend overflow indicator */}
                      {overspent && (
                        <div className="absolute right-0 top-0 h-full w-1 bg-red-300 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Format helpers ────────────────────────────────────────────

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// Suppress unused imports referenced via icons in markup-only paths
export { AlertTriangle, Activity, X };
