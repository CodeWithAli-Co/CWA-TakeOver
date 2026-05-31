/**
 * Funding.queries.ts — React Query hooks for the Funding Strategy page.
 *
 * Same pattern as GraduationPlan.queries.ts: one fetcher pulls all
 * three tables in parallel under a single queryKey, mutations
 * invalidate that key. Keeps cache management trivial and lets a
 * realtime subscription drop in cleanly.
 */

import { takeOversupabase } from "@/MyComponents/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Types (mirror Postgres enums + columns) ──────────────────────
export type FundingRoundType = "pre-seed" | "seed" | "series-a" | "series-b" | "series-c" | "bridge";
export type FundingInstrument = "safe" | "priced" | "note" | "equity-grant";
export type FundingRoundStatus = "planned" | "raising" | "closed" | "skipped";
export type EquityHolderType = "founder" | "employee" | "employee_pool" | "investor" | "business" | "advisor";

/** Scenario toggle on the Funding page header. Maps to a multiplier
 *  on round caps/post-money. Lives client-side only. */
export type FundingScenario = "conservative" | "base" | "aggressive";

export interface FundingCompany {
  id: string;
  name: string;
  parent_company_id: string | null;
  color: string;
  founded_at: string | null;
  position: number;
  notes: string | null;
  is_active_raise: boolean;
}

export interface FundingRound {
  id: string;
  company_id: string;
  round_type: FundingRoundType;
  instrument: FundingInstrument;
  target_raise: number;
  raised: number | null;
  valuation_cap: number | null;
  post_money: number;
  discount: number;
  date_planned: string | null;
  date_closed: string | null;
  status: FundingRoundStatus;
  lead_investor: string | null;
  notes: string | null;
  position: number;
}

export interface EquityHolder {
  id: string;
  company_id: string;
  holder_type: EquityHolderType;
  holder_name: string;
  holder_business_id: string | null;
  initial_percentage: number;
  granted_at: string | null;
  notes: string | null;
  position: number;
}

export interface FundingData {
  companies: FundingCompany[];
  rounds: FundingRound[];
  holders: EquityHolder[];
}

// ─── Combined fetcher ─────────────────────────────────────────────
async function fetchFunding(): Promise<FundingData> {
  const [companiesRes, roundsRes, holdersRes] = await Promise.all([
    takeOversupabase.from("funding_companies").select("*").order("position", { ascending: true }),
    takeOversupabase.from("funding_rounds").select("*").order("position", { ascending: true }),
    takeOversupabase.from("equity_holders").select("*").order("position", { ascending: true }),
  ]);

  if (companiesRes.error) throw companiesRes.error;
  if (roundsRes.error) throw roundsRes.error;
  if (holdersRes.error) throw holdersRes.error;

  return {
    companies: (companiesRes.data ?? []) as FundingCompany[],
    rounds: (roundsRes.data ?? []) as FundingRound[],
    holders: (holdersRes.data ?? []) as EquityHolder[],
  };
}

export const FUNDING_QUERY_KEY = ["funding"] as const;

export function useFunding() {
  return useQuery({
    queryKey: FUNDING_QUERY_KEY,
    queryFn: fetchFunding,
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: FUNDING_QUERY_KEY });
}

// ── Companies ──
export function useAddCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      parent_company_id?: string;
      color?: string;
      founded_at?: string;
      notes?: string;
    }) => {
      const { data: existing } = await takeOversupabase
  .from("funding_companies")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.position ?? 0) + 1;
      const { error } = await takeOversupabase.from("funding_companies").insert({
        name: input.name,
        parent_company_id: input.parent_company_id ?? null,
        color: input.color ?? "#3b82f6",
        founded_at: input.founded_at ?? null,
        notes: input.notes ?? null,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Omit<FundingCompany, "id">> }) => {
      const { error } = await takeOversupabase
  .from("funding_companies")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCompany() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("funding_companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ── Rounds ──
export function useAddRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      round_type: FundingRoundType;
      instrument: FundingInstrument;
      target_raise: number;
      post_money: number;
      valuation_cap?: number;
      discount?: number;
      date_planned?: string;
      status?: FundingRoundStatus;
      lead_investor?: string;
      notes?: string;
    }) => {
      const { data: existing } = await takeOversupabase
  .from("funding_rounds")
        .select("position")
        .eq("company_id", input.company_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.position ?? 0) + 1;

      const { error } = await takeOversupabase.from("funding_rounds").insert({
        company_id: input.company_id,
        round_type: input.round_type,
        instrument: input.instrument,
        target_raise: input.target_raise,
        post_money: input.post_money,
        valuation_cap: input.valuation_cap ?? null,
        discount: input.discount ?? 0,
        date_planned: input.date_planned ?? null,
        status: input.status ?? "planned",
        lead_investor: input.lead_investor ?? null,
        notes: input.notes ?? null,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Omit<FundingRound, "id">> }) => {
      const { error } = await takeOversupabase
  .from("funding_rounds")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("funding_rounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ── Holders ──
export function useAddHolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      holder_type: EquityHolderType;
      holder_name: string;
      initial_percentage: number;
      holder_business_id?: string;
      granted_at?: string;
      notes?: string;
    }) => {
      const { data: existing } = await takeOversupabase
  .from("equity_holders")
        .select("position")
        .eq("company_id", input.company_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.position ?? 0) + 1;
      const { error } = await takeOversupabase.from("equity_holders").insert({
        company_id: input.company_id,
        holder_type: input.holder_type,
        holder_name: input.holder_name,
        initial_percentage: input.initial_percentage,
        holder_business_id: input.holder_business_id ?? null,
        granted_at: input.granted_at ?? null,
        notes: input.notes ?? null,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateHolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Omit<EquityHolder, "id">> }) => {
      const { error } = await takeOversupabase
  .from("equity_holders")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteHolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await takeOversupabase.from("equity_holders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
