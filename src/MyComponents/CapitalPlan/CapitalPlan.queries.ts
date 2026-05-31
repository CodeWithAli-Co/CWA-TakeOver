/**
 * CapitalPlan.queries.ts — React Query layer for the Capital Plan
 * module (Admin → Capital Plan, gated to CEO/COO/CFO).
 *
 * Pattern matches Funding.queries.ts: one combined fetcher pulls
 * every Capital Plan table in parallel under a single queryKey;
 * mutations invalidate that key; a realtime subscription drops in
 * via useCapitalPlanRealtime() so multi-user edits sync live.
 *
 * Tables (see migrations/capital_plan_schema.sql):
 *   capital_rounds              · planned/closed rounds
 *   capital_checks              · investor commitments per round
 *   capital_check_touchpoints   · interaction log per check
 *   capital_allocations         · budget buckets per round
 *   capital_line_items          · drill-down rows per bucket
 *   capital_actuals             · recorded spend
 *   capital_scenarios           · saved what-if models
 */

import { takeOversupabase } from "@/MyComponents/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// ─── Enum types (mirror Postgres) ────────────────────────────────

export type CapitalRoundType =
  | "angel" | "pre-seed" | "seed" | "series-a" | "series-b" | "series-c" | "bridge" | "extension";

export type CapitalInstrument = "safe" | "priced" | "note" | "equity-grant";

export type CapitalRoundStatus =
  | "planning" | "raising" | "closed" | "on-hold" | "skipped";

export type CapitalCheckStatus =
  | "lead" | "intro" | "meeting" | "diligence" | "verbal" | "term-sheet" | "signed" | "wired" | "passed" | "ghosted";

export type CapitalConfidence = "low" | "medium" | "high";

export type CapitalCategory =
  | "people" | "infra" | "marketing" | "legal" | "ops" | "reserve" | "tooling" | "research" | "other";

export type CapitalActualSource =
  | "manual" | "mercury" | "brex" | "ramp" | "qbo";

export type CapitalTouchpointKind =
  | "email" | "meeting" | "call" | "note" | "demo";

// ─── Row types ───────────────────────────────────────────────────

export interface CapitalRound {
  id: string;
  name: string;
  round_type: CapitalRoundType;
  instrument: CapitalInstrument;
  status: CapitalRoundStatus;
  target_amount: number;
  valuation_cap: number | null;
  post_money_safe: boolean;
  discount: number;
  mfn: boolean;
  open_date: string | null;
  target_close_date: string | null;
  closed_date: string | null;
  lead_investor: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CapitalCheck {
  id: string;
  round_id: string;
  investor_name: string;
  firm: string | null;
  status: CapitalCheckStatus;
  check_amount: number;
  committed_amount: number | null;
  wired_amount: number | null;
  intro_source: string | null;
  contact_email: string | null;
  contact_linkedin: string | null;
  contact_phone: string | null;
  last_touch_at: string | null;
  next_step: string | null;
  next_step_due: string | null;
  meeting_count: number;
  priority: number;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CapitalCheckTouchpoint {
  id: string;
  check_id: string;
  occurred_at: string;
  kind: CapitalTouchpointKind;
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  drafted_by_axon: boolean;
  created_at: string;
}

export interface CapitalAllocation {
  id: string;
  round_id: string;
  bucket_name: string;
  category: CapitalCategory;
  planned_amount: number;
  period_months: number;
  color: string;
  icon: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CapitalLineItem {
  id: string;
  allocation_id: string;
  label: string;
  planned_amount: number;
  monthly_amount: number | null;
  vendor: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CapitalActual {
  id: string;
  round_id: string | null;
  allocation_id: string | null;
  line_item_id: string | null;
  amount: number;
  occurred_on: string;
  vendor: string | null;
  description: string | null;
  source: CapitalActualSource;
  external_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CapitalScenario {
  id: string;
  name: string;
  description: string | null;
  state: Record<string, unknown>;
  candidate_label: string | null;
  candidate_cost: number | null;
  duration_months: number | null;
  expected_impact: string | null;
  confidence: CapitalConfidence | null;
  axon_verdict: string | null;
  is_promoted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Aggregate fetcher ───────────────────────────────────────────

export interface CapitalPlanData {
  rounds: CapitalRound[];
  checks: CapitalCheck[];
  touchpoints: CapitalCheckTouchpoint[];
  allocations: CapitalAllocation[];
  lineItems: CapitalLineItem[];
  actuals: CapitalActual[];
  scenarios: CapitalScenario[];
}

async function fetchCapitalPlan(): Promise<CapitalPlanData> {
  const [
    roundsRes, checksRes, touchpointsRes, allocsRes, lineItemsRes, actualsRes, scenariosRes,
  ] = await Promise.all([
    takeOversupabase.from("capital_rounds").select("*").order("position", { ascending: true }),
    takeOversupabase.from("capital_checks").select("*").order("position", { ascending: true }),
    takeOversupabase.from("capital_check_touchpoints").select("*").order("occurred_at", { ascending: false }),
    takeOversupabase.from("capital_allocations").select("*").order("position", { ascending: true }),
    takeOversupabase.from("capital_line_items").select("*").order("position", { ascending: true }),
    takeOversupabase.from("capital_actuals").select("*").order("occurred_on", { ascending: false }),
    takeOversupabase.from("capital_scenarios").select("*").order("created_at", { ascending: false }),
  ]);

  if (roundsRes.error) throw roundsRes.error;
  if (checksRes.error) throw checksRes.error;
  if (touchpointsRes.error) throw touchpointsRes.error;
  if (allocsRes.error) throw allocsRes.error;
  if (lineItemsRes.error) throw lineItemsRes.error;
  if (actualsRes.error) throw actualsRes.error;
  if (scenariosRes.error) throw scenariosRes.error;

  return {
    rounds: (roundsRes.data ?? []) as CapitalRound[],
    checks: (checksRes.data ?? []) as CapitalCheck[],
    touchpoints: (touchpointsRes.data ?? []) as CapitalCheckTouchpoint[],
    allocations: (allocsRes.data ?? []) as CapitalAllocation[],
    lineItems: (lineItemsRes.data ?? []) as CapitalLineItem[],
    actuals: (actualsRes.data ?? []) as CapitalActual[],
    scenarios: (scenariosRes.data ?? []) as CapitalScenario[],
  };
}

export const CAPITAL_PLAN_QUERY_KEY = ["capital-plan"] as const;

export function useCapitalPlan() {
  return useQuery({
    queryKey: CAPITAL_PLAN_QUERY_KEY,
    queryFn: fetchCapitalPlan,
    staleTime: 30_000,
  });
}

// ─── Realtime sync ───────────────────────────────────────────────
/**
 * Subscribes to all Capital Plan tables and invalidates the combined
 * query on any change. Mount this once at the top of CapitalPlanPage.
 */
export function useCapitalPlanRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = takeOversupabase
      .channel("capital-plan-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_rounds" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_checks" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_check_touchpoints" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_allocations" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_line_items" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_actuals" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .on("postgres_changes", { event: "*", schema: "public", table: "capital_scenarios" },
        () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY }))
      .subscribe();
    return () => { takeOversupabase.removeChannel(channel); };
  }, [qc]);
}

// ─── Mutations ───────────────────────────────────────────────────

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CAPITAL_PLAN_QUERY_KEY });
}

// Rounds
export function useUpsertRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalRound> & { name: string; round_type: CapitalRoundType }) => {
      const { data, error } = await takeOversupabase.from("capital_rounds").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalRound;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_rounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// Checks
export function useUpsertCheck() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalCheck> & { round_id: string; investor_name: string }) => {
      const { data, error } = await takeOversupabase.from("capital_checks").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalCheck;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteCheck() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_checks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
export function useMoveCheckStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CapitalCheckStatus }) => {
      const patch: Partial<CapitalCheck> = { status, last_touch_at: new Date().toISOString() };
      const { data, error } = await takeOversupabase.from("capital_checks").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as CapitalCheck;
    },
    onSuccess: invalidate,
  });
}

// Touchpoints
export function useAddTouchpoint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalCheckTouchpoint> & { check_id: string; summary: string }) => {
      const { data, error } = await takeOversupabase.from("capital_check_touchpoints").insert(row).select().single();
      if (error) throw error;
      // Also bump the check's last_touch_at
      await takeOversupabase.from("capital_checks").update({ last_touch_at: row.occurred_at ?? new Date().toISOString() }).eq("id", row.check_id);
      return data as CapitalCheckTouchpoint;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteTouchpoint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_check_touchpoints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// Allocations
export function useUpsertAllocation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalAllocation> & { round_id: string; bucket_name: string; category: CapitalCategory }) => {
      const { data, error } = await takeOversupabase.from("capital_allocations").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalAllocation;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteAllocation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// Line items
export function useUpsertLineItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalLineItem> & { allocation_id: string; label: string }) => {
      const { data, error } = await takeOversupabase.from("capital_line_items").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalLineItem;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteLineItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_line_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// Actuals
export function useUpsertActual() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalActual> & { amount: number }) => {
      const { data, error } = await takeOversupabase.from("capital_actuals").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalActual;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteActual() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_actuals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// Scenarios
export function useUpsertScenario() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<CapitalScenario> & { name: string }) => {
      const { data, error } = await takeOversupabase.from("capital_scenarios").upsert(row).select().single();
      if (error) throw error;
      return data as CapitalScenario;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteScenario() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("capital_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Derived helpers (used by all tabs) ──────────────────────────

export interface RoundProgress {
  round: CapitalRound;
  committed: number;
  wired: number;
  count: number;
  closedCount: number;
  pctOfTarget: number;
  daysUntilTargetClose: number | null;
}

export function summarizeRoundProgress(round: CapitalRound, checks: CapitalCheck[]): RoundProgress {
  const inRound = checks.filter((c) => c.round_id === round.id);
  let committed = 0, wired = 0, closedCount = 0;
  for (const c of inRound) {
    const isClosed = c.status === "signed" || c.status === "wired";
    if (isClosed) closedCount++;
    committed += c.committed_amount ?? c.check_amount;
    wired += c.wired_amount ?? (c.status === "wired" ? c.check_amount : 0);
  }
  const target = round.target_amount || 1;
  const pctOfTarget = Math.min(1, committed / target);
  const daysUntilTargetClose = round.target_close_date
    ? Math.ceil((new Date(round.target_close_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  return {
    round, committed, wired, count: inRound.length, closedCount, pctOfTarget, daysUntilTargetClose,
  };
}

export interface AllocationProgress {
  allocation: CapitalAllocation;
  spent: number;
  remaining: number;
  pctSpent: number;
  lineItemsTotal: number;
}

export function summarizeAllocationProgress(
  allocation: CapitalAllocation,
  lineItems: CapitalLineItem[],
  actuals: CapitalActual[],
): AllocationProgress {
  const items = lineItems.filter((l) => l.allocation_id === allocation.id);
  const lineItemsTotal = items.reduce((s, l) => s + (l.planned_amount ?? 0), 0);
  const spent = actuals
    .filter((a) => a.allocation_id === allocation.id)
    .reduce((s, a) => s + a.amount, 0);
  const planned = allocation.planned_amount || 1;
  return {
    allocation,
    spent,
    remaining: Math.max(0, allocation.planned_amount - spent),
    pctSpent: Math.min(1, spent / planned),
    lineItemsTotal,
  };
}

/** Total planned spend across all allocations of a round. */
export function totalPlannedForRound(roundId: string, allocations: CapitalAllocation[]): number {
  return allocations.filter((a) => a.round_id === roundId).reduce((s, a) => s + a.planned_amount, 0);
}

/** Sum of recorded actuals for a round. */
export function totalActualsForRound(roundId: string, actuals: CapitalActual[]): number {
  return actuals.filter((a) => a.round_id === roundId).reduce((s, a) => s + a.amount, 0);
}

/**
 * Monthly burn estimate from recent actuals (default last 90 days).
 * Falls back to planned-amount / 12 if no actuals exist.
 */
export function estimateMonthlyBurn(
  actuals: CapitalActual[],
  allocations: CapitalAllocation[],
  windowDays = 90,
): number {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const recent = actuals.filter((a) => new Date(a.occurred_on).getTime() >= cutoff);
  if (recent.length === 0) {
    const plannedYear = allocations.reduce((s, a) => s + a.planned_amount, 0);
    return plannedYear / 12;
  }
  const sum = recent.reduce((s, a) => s + a.amount, 0);
  return sum / (windowDays / 30);
}

/**
 * Project runway in months given current cash + monthly burn.
 * Returns Infinity if burn <= 0.
 */
export function projectRunwayMonths(cashOnHand: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return Infinity;
  return Math.max(0, cashOnHand / monthlyBurn);
}

/** Total committed (incl. wired) across all closed/in-flight rounds. */
export function totalRaisedToDate(rounds: CapitalRound[], checks: CapitalCheck[]): number {
  let raised = 0;
  for (const r of rounds) {
    for (const c of checks.filter((c) => c.round_id === r.id)) {
      if (c.status === "wired") raised += c.wired_amount ?? c.check_amount;
      else if (c.status === "signed") raised += c.committed_amount ?? c.check_amount;
    }
  }
  return raised;
}
