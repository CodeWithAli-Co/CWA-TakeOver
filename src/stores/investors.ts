/**
 * investors.ts — Supabase query + mutation hooks for /fundraise.
 *
 * Wraps the investor_profiles table (1:1 with crm_companies via
 * company_id) and joins crm_contacts (partners) + crm_activities
 * (emails/calls/DMs) on the read side so the UI doesn't have to
 * stitch them together itself.
 *
 * Architectural choice: investor profiles are an OVERLAY on the
 * regular CRM company table — not a parallel universe. That means:
 *   - Adding an investor creates a row in crm_companies AND
 *     investor_profiles atomically.
 *   - Partners are managed via the existing CRM contact hooks.
 *   - Activities (Gmail send, sync replies, calls) flow through
 *     the existing CRM activity hooks unchanged.
 *
 * Schema lives in migrations/investor_profiles.sql.
 */

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { takeOversupabase } from "@/MyComponents/supabase";
import type { CrmCompany, CrmContact, CrmActivity } from "./crm";

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const INVESTOR_PROFILES_TABLE = "investor_profiles";
const COMPANIES_TABLE = "crm_companies";
const CONTACTS_TABLE = "crm_contacts";
const ACTIVITIES_TABLE = "crm_activities";

export const INVESTOR_PIPELINE_STAGES = [
  "prospected",
  "researched",
  "reaching_out",
  "replied",
  "meeting_scheduled",
  "met",
  "considering",
  "passed",
  "closed",
] as const;

export type InvestorPipelineStage =
  (typeof INVESTOR_PIPELINE_STAGES)[number];

/** Human-facing copy for each pipeline stage. Used by chips, kanban
 *  column headers, and the detail drawer. */
export const PIPELINE_STAGE_LABEL: Record<InvestorPipelineStage, string> =
  {
    prospected: "Prospected",
    researched: "Researched",
    reaching_out: "Reaching out",
    replied: "Replied",
    meeting_scheduled: "Meeting scheduled",
    met: "Met",
    considering: "Considering",
    passed: "Passed",
    closed: "Closed",
  };

/** Loose source taxonomy. Free-form so a new entry channel (eg a new
 *  Twitter list) doesn't require a schema change; the UI offers the
 *  known set as quick picks but accepts any string. */
export const INVESTOR_SOURCES = [
  "claude_research",
  "twitter",
  "linkedin",
  "referral",
  "cold_inbound",
  "warm_intro",
  "manual",
] as const;
export type InvestorSource = (typeof INVESTOR_SOURCES)[number] | string;

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface InvestorProfile {
  id: string;
  company_id: string;
  // Their side
  thesis_md: string | null;
  stage_focus: string[];
  check_size_min_cents: number | null;
  check_size_max_cents: number | null;
  portfolio_md: string | null;
  website: string | null;
  twitter_handle: string | null;
  hq_location: string | null;
  // Our side
  fit_score: number;
  fit_score_notes_md: string | null;
  source: InvestorSource;
  priority: 0 | 1 | 2 | 3;
  pipeline_stage: InvestorPipelineStage;
  // Cadence
  last_outreach_at: string | null;
  next_followup_at: string | null;
  /** Phase 4 cadence engine: how many follow-up nudges have been
   *  sent in the current outreach cycle. 0 = cold email sent, no
   *  follow-ups yet. 1-3 = N follow-ups sent. Caps at 3 -- the
   *  cadence engine stops scheduling after the third nudge. Reset
   *  to 0 by the reply-detection trigger whenever an inbound email
   *  lands. */
  followup_count: number;
  created_at: string;
  updated_at: string;
}

/** What the list / grid view actually consumes — flat join of company
 *  + investor row. Saves the UI from joining client-side. */
export interface InvestorListEntry extends InvestorProfile {
  company_name: string;
  company_domain: string | null;
  company_linkedin: string | null;
  partner_count: number;
}

/** Full payload for the detail drawer — joins partners + recent
 *  activity. Lazily loaded on drawer open. */
export interface InvestorDetail extends InvestorListEntry {
  company: CrmCompany;
  partners: CrmContact[];
  activities: CrmActivity[];
}

// ─────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────
export const investorKeys = {
  all: ["investors"] as const,
  list: () => ["investors", "list"] as const,
  byStage: (stage: InvestorPipelineStage) =>
    ["investors", "byStage", stage] as const,
  detail: (id: string) => ["investors", "detail", id] as const,
  followupsDue: () => ["investors", "followupsDue"] as const,
};

// ─────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────

/** List view — every investor sorted by priority + fit. The grid
 *  paginates client-side for now; if we cross ~1000 investors we'll
 *  add server-side ranges. */
export function useInvestors() {
  return useQuery({
    queryKey: investorKeys.list(),
    queryFn: async (): Promise<InvestorListEntry[]> => {
      // One round-trip: profile row + nested company columns +
      // partner count (computed via a counted relation).
      const { data, error } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .select(
          `
          *,
          company:${COMPANIES_TABLE}!inner (
            id, name, domain, linkedin_url
          )
        `,
        )
        .order("priority", { ascending: true })
        .order("fit_score", { ascending: false });
      if (error) throw error;

      // Partner counts via a second query — Supabase's nested
      // count() requires the foreign table to define an FK, which
      // crm_contacts does (company_id → crm_companies). Cheap.
      const companyIds = (data ?? []).map(
        (r: any) => r.company.id,
      ) as string[];
      let partnerCounts = new Map<string, number>();
      if (companyIds.length > 0) {
        const { data: ctRows } = await takeOversupabase
          .from(CONTACTS_TABLE)
          .select("company_id")
          .in("company_id", companyIds);
        for (const row of (ctRows ?? []) as { company_id: string }[]) {
          partnerCounts.set(
            row.company_id,
            (partnerCounts.get(row.company_id) ?? 0) + 1,
          );
        }
      }

      return (data ?? []).map((r: any) => ({
        ...(r as InvestorProfile),
        company_name: r.company.name,
        company_domain: r.company.domain,
        company_linkedin: r.company.linkedin_url,
        partner_count: partnerCounts.get(r.company.id) ?? 0,
      }));
    },
  });
}

/** Full detail — used by the right-slide drawer. Joins partners +
 *  recent activities so the UI gets everything in one fetch. */
export function useInvestor(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? investorKeys.detail(id) : ["investors", "detail", "_"],
    enabled: !!id,
    queryFn: async (): Promise<InvestorDetail | null> => {
      if (!id) return null;
      const { data: profile, error: profileErr } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      if (profileErr) throw profileErr;
      if (!profile) return null;

      const companyId = (profile as InvestorProfile).company_id;
      const [companyRes, partnersRes, activitiesRes] = await Promise.all([
        takeOversupabase
          .from(COMPANIES_TABLE)
          .select("*")
          .eq("id", companyId)
          .single(),
        takeOversupabase
          .from(CONTACTS_TABLE)
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        // Activities scoped to any partner under this firm. We
        // pull the partner ids first then filter activities.
        (async () => {
          const partnerIds = await takeOversupabase
            .from(CONTACTS_TABLE)
            .select("id")
            .eq("company_id", companyId);
          const ids = (partnerIds.data ?? []).map((r: any) => r.id);
          if (ids.length === 0)
            return { data: [] as CrmActivity[], error: null };
          return takeOversupabase
            .from(ACTIVITIES_TABLE)
            .select("*")
            .in("contact_id", ids)
            .order("occurred_at", { ascending: false })
            .limit(50);
        })(),
      ]);

      if (companyRes.error) throw companyRes.error;

      const company = companyRes.data as CrmCompany;
      const partners = (partnersRes.data ?? []) as CrmContact[];
      const activities = (activitiesRes.data ?? []) as CrmActivity[];

      return {
        ...(profile as InvestorProfile),
        company_name: company.name,
        company_domain: company.domain,
        company_linkedin: company.linkedin_url,
        partner_count: partners.length,
        company,
        partners,
        activities,
      };
    },
  });
}

/** Follow-up queue for the home dashboard nudge widget. Returns
 *  investors whose next_followup_at is today or earlier. */
export function useFollowupsDue() {
  return useQuery({
    queryKey: investorKeys.followupsDue(),
    queryFn: async (): Promise<InvestorListEntry[]> => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const { data, error } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .select(
          `
          *,
          company:${COMPANIES_TABLE}!inner (id, name, domain, linkedin_url)
        `,
        )
        .not("next_followup_at", "is", null)
        .lte("next_followup_at", today.toISOString())
        .order("next_followup_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...(r as InvestorProfile),
        company_name: r.company.name,
        company_domain: r.company.domain,
        company_linkedin: r.company.linkedin_url,
        partner_count: 0,
      }));
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────

/** Input for creating a brand-new investor. Mirrors the AddInvestor
 *  modal field names. firm_name is required; everything else
 *  optional + filled by the operator on a per-need basis. */
export interface CreateInvestorInput {
  firm_name: string;
  domain?: string;
  website?: string;
  twitter_handle?: string;
  hq_location?: string;
  thesis_md?: string;
  stage_focus?: string[];
  check_size_min_cents?: number;
  check_size_max_cents?: number;
  portfolio_md?: string;
  fit_score?: number;
  fit_score_notes_md?: string;
  source?: InvestorSource;
  priority?: 0 | 1 | 2 | 3;
  pipeline_stage?: InvestorPipelineStage;
  // Optional initial partner — common case: you found the firm via
  // a specific partner so you want to save them in one shot.
  partner_name?: string;
  partner_email?: string;
  partner_linkedin?: string;
  partner_title?: string;
}

/** Atomically creates a crm_companies row + investor_profiles row +
 *  optional initial partner. We don't have transactions over Supabase
 *  RPC from the client; we just do them in sequence and cleanup on
 *  partial failure. Acceptable since the table count is small and the
 *  worst case is a stray company row (which is also a valid CRM
 *  entity even without the investor overlay). */
export function useCreateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateInvestorInput,
    ): Promise<InvestorProfile> => {
      // 1) Create the company row.
      const { data: company, error: companyErr } = await takeOversupabase
        .from(COMPANIES_TABLE)
        .insert({
          name: input.firm_name,
          domain: input.domain ?? null,
          website: input.website ?? null,
          linkedin_url: input.partner_linkedin ?? null,
        })
        .select("*")
        .single();
      if (companyErr) throw companyErr;

      // 2) Create the investor profile.
      const { data: profile, error: profileErr } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .insert({
          company_id: (company as CrmCompany).id,
          thesis_md: input.thesis_md ?? null,
          stage_focus: input.stage_focus ?? [],
          check_size_min_cents: input.check_size_min_cents ?? null,
          check_size_max_cents: input.check_size_max_cents ?? null,
          portfolio_md: input.portfolio_md ?? null,
          website: input.website ?? null,
          twitter_handle: input.twitter_handle ?? null,
          hq_location: input.hq_location ?? null,
          fit_score: input.fit_score ?? 50,
          fit_score_notes_md: input.fit_score_notes_md ?? null,
          source: input.source ?? "manual",
          priority: input.priority ?? 2,
          pipeline_stage: input.pipeline_stage ?? "prospected",
        })
        .select("*")
        .single();
      if (profileErr) {
        // Roll back the company so we don't leave a stub.
        await takeOversupabase
          .from(COMPANIES_TABLE)
          .delete()
          .eq("id", (company as CrmCompany).id);
        throw profileErr;
      }

      // 3) Optional initial partner.
      if (input.partner_name || input.partner_email) {
        await takeOversupabase.from(CONTACTS_TABLE).insert({
          name: input.partner_name ?? null,
          email: input.partner_email ?? null,
          title: input.partner_title ?? "Partner",
          company_id: (company as CrmCompany).id,
          source: input.source ?? "manual",
        });
      }

      return profile as InvestorProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investorKeys.all });
    },
  });
}

/** Partial update — patches the investor_profiles row only. To edit
 *  the underlying company you'd use the CRM company hooks; we don't
 *  shadow those here. */
export function useUpdateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      patch: Partial<
        Omit<InvestorProfile, "id" | "company_id" | "created_at" | "updated_at">
      >;
    }): Promise<InvestorProfile> => {
      const { data, error } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .update(vars.patch)
        .eq("id", vars.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as InvestorProfile;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: investorKeys.all });
      qc.invalidateQueries({ queryKey: investorKeys.detail(row.id) });
    },
  });
}

/** Shortcut for the kanban drag-drop — just bumps the stage.
 *  Separate hook from useUpdateInvestor so the kanban can call
 *  optimistically without round-tripping the whole row. */
export function useMoveInvestorStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      stage: InvestorPipelineStage;
    }): Promise<void> => {
      const { error } = await takeOversupabase
        .from(INVESTOR_PROFILES_TABLE)
        .update({ pipeline_stage: vars.stage })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investorKeys.all });
    },
  });
}

/** Realtime subscription. Any /fundraise page mounts this once;
 *  list view auto-refreshes on inserts/updates. */
export function useInvestorsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = takeOversupabase
      .channel("investor_profiles_changes")
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: INVESTOR_PROFILES_TABLE,
        },
        () => {
          qc.invalidateQueries({ queryKey: investorKeys.all });
        },
      )
      .subscribe();
    return () => {
      takeOversupabase.removeChannel(channel);
    };
  }, [qc]);
}

// ─────────────────────────────────────────────────────────────────
// UI helpers (kept here so any view that imports the store gets them)
// ─────────────────────────────────────────────────────────────────

/** Returns "$50K-$2M" or "—" for the card / drawer header. */
export function formatCheckSize(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return "—";
  const fmt = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1_000_000)
      return `$${(dollars / 1_000_000).toFixed(dollars % 1_000_000 === 0 ? 0 : 1)}M`;
    if (dollars >= 1_000)
      return `$${(dollars / 1_000).toFixed(dollars % 1_000 === 0 ? 0 : 1)}K`;
    return `$${dollars}`;
  };
  if (min != null && max != null && min !== max)
    return `${fmt(min)}–${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}

/** P0/P1/P2/P3 string for chips. */
export function priorityLabel(p: 0 | 1 | 2 | 3): string {
  return `P${p}`;
}
