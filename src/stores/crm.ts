/**
 * crm.ts — Supabase query + mutation hooks for /sales.
 *
 * Mirrors the conventions of `projects.ts`:
 *   · One key-tree for everything (crmKeys)
 *   · Read hooks return raw rows; the component owns presentation
 *   · Write hooks invalidate the right slice(s)
 *   · A single useCrmRealtime() subscriber that any mounted
 *     /sales page can call.
 *
 * Schema lives in migrations/sales_crm_schema.sql. Architectural
 * decisions are documented in docs/SALES_CRM_ARCHITECTURE.md.
 *
 * RLS is currently "authenticated read + write" across all four
 * tables — see the proposal for the open question on owner-scoped
 * writes.
 */

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

// ============================================================
// Tables
// ============================================================
const COMPANIES_TABLE  = "crm_companies";
const CONTACTS_TABLE   = "crm_contacts";
const DEALS_TABLE      = "crm_deals";
const ACTIVITIES_TABLE = "crm_activities";

// ============================================================
// Enums (mirrored from CHECK constraints in SQL)
// ============================================================
export type LifecycleStage =
  | "lead"
  | "mql"
  | "sql"
  | "opportunity"
  | "customer"
  | "churned";

export type DealStage =
  | "interested"
  | "demo"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "task"
  | "demo"
  | "sms";

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  "lead", "mql", "sql", "opportunity", "customer", "churned",
];

export const DEAL_STAGES: DealStage[] = [
  "interested", "demo", "proposal", "negotiation", "won", "lost",
];

export const DEAL_OPEN_STAGES: DealStage[] = [
  "interested", "demo", "proposal", "negotiation",
];

export const ACTIVITY_TYPES: ActivityType[] = [
  "call", "email", "meeting", "note", "task", "demo", "sms",
];

// ============================================================
// Types
// ============================================================
export interface CrmCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size_employees: number | null;
  arr_estimate_cents: number | null;
  website: string | null;
  linkedin_url: string | null;
  owner_supa_id: string | null;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  owner_supa_id: string | null;
  lifecycle_stage: LifecycleStage;
  source: string | null;
  score: number;
  tags: string[];
  stripe_customer_id: string | null;
  first_touched_at: string;
  last_contacted_at: string | null;
  next_step_at: string | null;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDeal {
  id: string;
  name: string;
  contact_id: string | null;
  company_id: string | null;
  owner_supa_id: string | null;
  stage: DealStage;
  amount_cents: number;
  currency: string;
  probability: number;
  source: string | null;
  close_date_expected: string | null;  // ISO date
  close_date_actual: string | null;
  lost_reason: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
}

/** Metadata blob attached to email activities by the Gmail
 *  send/sync routes. Inbound rows carry `direction: "inbound"`,
 *  the original sender, subject, and Gmail thread/message IDs so
 *  the desktop can render a Reply button. Outbound rows carry
 *  `direction: "outbound"`. Other activity types may use
 *  metadata for their own purposes — keep this loose. */
export interface CrmActivityMetadata {
  direction?: "inbound" | "outbound";
  gmail_id?: string;
  thread_id?: string;
  from?: string;
  subject?: string;
  [key: string]: unknown;
}

export interface CrmActivity {
  id: string;
  type: ActivityType;
  title: string | null;
  body_md: string | null;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  actor_supa_id: string | null;
  happened_at: string;
  duration_minutes: number | null;
  outcome: string | null;
  meeting_id: string | null;
  created_at: string;
  metadata?: CrmActivityMetadata | null;
}

// ============================================================
// Query keys
// ============================================================
export const crmKeys = {
  all:                ["crm"] as const,

  // Companies
  companies:          ["crm", "companies"] as const,
  companiesList:      (opts: { search?: string } = {}) =>
                        ["crm", "companies", "list", opts.search ?? ""] as const,
  company:            (id: string) =>
                        ["crm", "companies", "byId", id] as const,

  // Contacts
  contacts:           ["crm", "contacts"] as const,
  contactsList:       (opts: {
                        lifecycle?: LifecycleStage | "all";
                        search?: string;
                        companyId?: string | null;
                      } = {}) => [
                        "crm", "contacts", "list",
                        opts.lifecycle ?? "all",
                        opts.search ?? "",
                        opts.companyId ?? "",
                      ] as const,
  contact:            (id: string) =>
                        ["crm", "contacts", "byId", id] as const,

  // Deals
  deals:              ["crm", "deals"] as const,
  dealsList:          (opts: { ownerId?: string | null } = {}) =>
                        ["crm", "deals", "list", opts.ownerId ?? ""] as const,
  dealsByStage:       (opts: { ownerId?: string | null } = {}) =>
                        ["crm", "deals", "byStage", opts.ownerId ?? ""] as const,
  deal:               (id: string) =>
                        ["crm", "deals", "byId", id] as const,

  // Activities
  activitiesForContact: (id: string) =>
                          ["crm", "activities", "contact", id] as const,
  activitiesForDeal:    (id: string) =>
                          ["crm", "activities", "deal", id] as const,
  activitiesForCompany: (id: string) =>
                          ["crm", "activities", "company", id] as const,
  activitiesRecent:     (limit: number) =>
                          ["crm", "activities", "recent", limit] as const,
};

// ============================================================
// Companies
// ============================================================
export function useCrmCompanies(opts: { search?: string } = {}) {
  return useQuery({
    queryKey: crmKeys.companiesList(opts),
    queryFn: async (): Promise<CrmCompany[]> => {
      let q = companySupabase
        .from(COMPANIES_TABLE)
        .select("*")
        .order("name", { ascending: true });
      if (opts.search) q = q.ilike("name", `%${opts.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CrmCompany[];
    },
  });
}

export function useCrmCompany(id: string | undefined) {
  return useQuery({
    queryKey: crmKeys.company(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<CrmCompany | null> => {
      const { data, error } = await companySupabase
        .from(COMPANIES_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmCompany | null;
    },
  });
}

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size_employees?: number | null;
  arr_estimate_cents?: number | null;
  website?: string | null;
  linkedin_url?: string | null;
  owner_supa_id?: string | null;
  notes_md?: string | null;
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCompanyInput): Promise<CrmCompany> => {
      const { data, error } = await companySupabase
        .from(COMPANIES_TABLE)
        .insert({
          name:                input.name,
          domain:              input.domain ?? null,
          industry:            input.industry ?? null,
          size_employees:      input.size_employees ?? null,
          arr_estimate_cents:  input.arr_estimate_cents ?? null,
          website:             input.website ?? null,
          linkedin_url:        input.linkedin_url ?? null,
          owner_supa_id:       input.owner_supa_id ?? null,
          notes_md:            input.notes_md ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CrmCompany;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: crmKeys.companies });
      if (row?.id) qc.setQueryData(crmKeys.company(row.id), row);
    },
  });
}

export type UpdateCompanyPatch = Partial<Omit<CrmCompany, "id" | "created_at" | "updated_at">>;

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdateCompanyPatch }) => {
      const { data, error } = await companySupabase
        .from(COMPANIES_TABLE)
        .update(args.patch)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmCompany;
    },
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(crmKeys.company(row.id), row);
      qc.invalidateQueries({ queryKey: crmKeys.companies });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await companySupabase
        .from(COMPANIES_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: crmKeys.company(id) });
      qc.invalidateQueries({ queryKey: crmKeys.companies });
      // Contacts + deals that referenced this company will have
      // their company_id nulled by ON DELETE SET NULL — invalidate
      // their lists too so the UI catches up.
      qc.invalidateQueries({ queryKey: crmKeys.contacts });
      qc.invalidateQueries({ queryKey: crmKeys.deals });
    },
  });
}

// ============================================================
// Contacts
// ============================================================
export function useCrmContacts(opts: {
  lifecycle?: LifecycleStage | "all";
  search?: string;
  companyId?: string | null;
} = {}) {
  return useQuery({
    queryKey: crmKeys.contactsList(opts),
    queryFn: async (): Promise<CrmContact[]> => {
      let q = companySupabase
        .from(CONTACTS_TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (opts.lifecycle && opts.lifecycle !== "all") {
        q = q.eq("lifecycle_stage", opts.lifecycle);
      }
      if (opts.companyId) {
        q = q.eq("company_id", opts.companyId);
      }
      if (opts.search) {
        const s = opts.search.toLowerCase();
        q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CrmContact[];
    },
  });
}

export function useCrmContact(id: string | undefined) {
  return useQuery({
    queryKey: crmKeys.contact(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<CrmContact | null> => {
      const { data, error } = await companySupabase
        .from(CONTACTS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmContact | null;
    },
  });
}

export interface CreateContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company_id?: string | null;
  owner_supa_id?: string | null;
  lifecycle_stage?: LifecycleStage;
  source?: string | null;
  tags?: string[];
  stripe_customer_id?: string | null;
  next_step_at?: string | null;
  notes_md?: string | null;
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContactInput): Promise<CrmContact> => {
      const { data, error } = await companySupabase
        .from(CONTACTS_TABLE)
        .insert({
          name:               input.name ?? null,
          email:              input.email ?? null,
          phone:              input.phone ?? null,
          title:              input.title ?? null,
          company_id:         input.company_id ?? null,
          owner_supa_id:      input.owner_supa_id ?? null,
          lifecycle_stage:    input.lifecycle_stage ?? "lead",
          source:             input.source ?? null,
          tags:               input.tags ?? [],
          stripe_customer_id: input.stripe_customer_id ?? null,
          next_step_at:       input.next_step_at ?? null,
          notes_md:           input.notes_md ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CrmContact;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: crmKeys.contacts });
      if (row?.id) qc.setQueryData(crmKeys.contact(row.id), row);
    },
  });
}

export type UpdateContactPatch = Partial<Omit<CrmContact, "id" | "created_at" | "updated_at" | "first_touched_at">>;

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdateContactPatch }) => {
      const { data, error } = await companySupabase
        .from(CONTACTS_TABLE)
        .update(args.patch)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmContact;
    },
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(crmKeys.contact(row.id), row);
      qc.invalidateQueries({ queryKey: crmKeys.contacts });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await companySupabase
        .from(CONTACTS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: crmKeys.contact(id) });
      qc.invalidateQueries({ queryKey: crmKeys.contacts });
      // Activities cascade-delete on the SQL side; deals just set
      // contact_id to NULL. Invalidate both so the UI stays honest.
      qc.invalidateQueries({ queryKey: crmKeys.deals });
    },
  });
}

// ============================================================
// Stripe ↔ CRM sync
// ============================================================
//
// Single direction for now: Stripe customer list → crm_contacts.
//
// Match strategy is `stripe_customer_id` first (already-synced rows),
// then `lower(email)` (rows the operator created manually before
// hooking up Stripe). Without the email fallback we'd dupe every
// real customer the first time the operator presses Sync.
//
// Lifecycle mapping:
//   · active         → customer (paying)
//   · past_customer  → churned
//   · one_time / free → customer  (they bought once; still "won")
//
// Everything is upserted server-side via individual update / insert
// calls. Could batch via `upsert()` with onConflict — kept as
// per-row writes so we can attribute counts ("created N, updated M")
// in the toast and so any one row's error doesn't kill the whole
// sync.

/**
 * Map a Stripe customer status string onto our lifecycle column.
 * Exported so other callers (Axon actions, demo seed) can stay
 * consistent with the same rule.
 */
export function stripeStatusToLifecycle(
  status: "active" | "past_customer" | "one_time" | "free" | string,
): LifecycleStage {
  switch (status) {
    case "active":        return "customer";
    case "past_customer": return "churned";
    case "one_time":      return "customer";
    case "free":          return "customer";
    default:              return "lead";
  }
}

export interface SyncStripeCustomersInput {
  /** Full StripeCustomerRow list from useStripeDashboard(). Caller
   *  owns the fetch so the sync hook stays pure. */
  customers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    status: string;
    mrr_cents: number;
    ltv_cents: number;
    last_activity_at: string;
  }>;
}

export interface SyncStripeCustomersResult {
  created: number;
  updated: number;
  skipped: number;   // customers with no email AND no existing match
  errors: Array<{ stripeId: string; message: string }>;
}

export function useSyncStripeCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: SyncStripeCustomersInput,
    ): Promise<SyncStripeCustomersResult> => {
      // Pull the whole contacts table once so we can do match lookups
      // in memory instead of hammering the API per row.
      const { data: existing, error: fetchErr } = await companySupabase
        .from(CONTACTS_TABLE)
        .select("id, email, stripe_customer_id");
      if (fetchErr) throw fetchErr;

      const byStripeId = new Map<string, { id: string }>();
      const byEmail = new Map<string, { id: string }>();
      for (const row of existing ?? []) {
        if (row.stripe_customer_id) {
          byStripeId.set(row.stripe_customer_id, { id: row.id });
        }
        if (row.email) {
          byEmail.set(row.email.toLowerCase(), { id: row.id });
        }
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: SyncStripeCustomersResult["errors"] = [];

      for (const cust of input.customers) {
        const lifecycle = stripeStatusToLifecycle(cust.status);
        const lastActivity = cust.last_activity_at || new Date().toISOString();

        // Match priority: stripe id → email
        const matchById = byStripeId.get(cust.id);
        const matchByEmail = cust.email
          ? byEmail.get(cust.email.toLowerCase())
          : undefined;
        const matched = matchById ?? matchByEmail;

        try {
          if (matched) {
            const { error } = await companySupabase
              .from(CONTACTS_TABLE)
              .update({
                name:               cust.name ?? undefined,
                email:              cust.email ?? undefined,
                lifecycle_stage:    lifecycle,
                source:             "stripe",
                stripe_customer_id: cust.id,
                last_contacted_at:  lastActivity,
              })
              .eq("id", matched.id);
            if (error) throw error;
            updated += 1;
          } else if (!cust.email && !cust.name) {
            // Stripe occasionally has guest-checkout customers with
            // neither name nor email. Skipping them rather than
            // creating a row that's just an opaque id.
            skipped += 1;
          } else {
            const { error } = await companySupabase
              .from(CONTACTS_TABLE)
              .insert({
                name:               cust.name,
                email:              cust.email,
                lifecycle_stage:    lifecycle,
                source:             "stripe",
                stripe_customer_id: cust.id,
                first_touched_at:   lastActivity,
                last_contacted_at:  lastActivity,
              });
            if (error) throw error;
            created += 1;
          }
        } catch (e) {
          errors.push({
            stripeId: cust.id,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return { created, updated, skipped, errors };
    },
    onSuccess: () => {
      // Touch every contacts slice — the lifecycle filters update,
      // the dashboard counts update, the kanban deal-contact
      // pickers re-fetch. Cheap because the cache invalidation
      // is server-side via the existing realtime channel anyway.
      qc.invalidateQueries({ queryKey: crmKeys.contacts });
    },
  });
}

// ============================================================
// Deals
// ============================================================
export function useCrmDeals(opts: { ownerId?: string | null } = {}) {
  return useQuery({
    queryKey: crmKeys.dealsList(opts),
    queryFn: async (): Promise<CrmDeal[]> => {
      let q = companySupabase
        .from(DEALS_TABLE)
        .select("*")
        .order("stage", { ascending: true })
        .order("position", { ascending: true, nullsFirst: false });
      if (opts.ownerId) q = q.eq("owner_supa_id", opts.ownerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CrmDeal[];
    },
  });
}

/**
 * useDealsByStage — same fetch as useCrmDeals, but pre-grouped into
 * a Record<DealStage, CrmDeal[]> for direct kanban rendering. Empty
 * stages get an empty array so the columns always show up.
 */
export function useDealsByStage(opts: { ownerId?: string | null } = {}) {
  const q = useQuery({
    queryKey: crmKeys.dealsByStage(opts),
    queryFn: async (): Promise<Record<DealStage, CrmDeal[]>> => {
      let req = companySupabase
        .from(DEALS_TABLE)
        .select("*")
        .order("position", { ascending: true, nullsFirst: false });
      if (opts.ownerId) req = req.eq("owner_supa_id", opts.ownerId);
      const { data, error } = await req;
      if (error) throw error;
      const empty: Record<DealStage, CrmDeal[]> = {
        interested: [], demo: [], proposal: [],
        negotiation: [], won: [], lost: [],
      };
      for (const row of (data ?? []) as CrmDeal[]) {
        (empty[row.stage] ??= []).push(row);
      }
      return empty;
    },
  });
  return q;
}

export function useCrmDeal(id: string | undefined) {
  return useQuery({
    queryKey: crmKeys.deal(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<CrmDeal | null> => {
      const { data, error } = await companySupabase
        .from(DEALS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmDeal | null;
    },
  });
}

export interface CreateDealInput {
  name: string;
  contact_id?: string | null;
  company_id?: string | null;
  owner_supa_id?: string | null;
  stage?: DealStage;
  amount_cents?: number;
  currency?: string;
  probability?: number;
  source?: string | null;
  close_date_expected?: string | null;
  position?: number | null;
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDealInput): Promise<CrmDeal> => {
      const { data, error } = await companySupabase
        .from(DEALS_TABLE)
        .insert({
          name:                input.name,
          contact_id:          input.contact_id ?? null,
          company_id:          input.company_id ?? null,
          owner_supa_id:       input.owner_supa_id ?? null,
          stage:               input.stage ?? "interested",
          amount_cents:        input.amount_cents ?? 0,
          currency:            input.currency ?? "usd",
          probability:         input.probability ?? 50,
          source:              input.source ?? null,
          close_date_expected: input.close_date_expected ?? null,
          position:            input.position ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CrmDeal;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: crmKeys.deals });
      if (row?.id) qc.setQueryData(crmKeys.deal(row.id), row);
    },
  });
}

export type UpdateDealPatch = Partial<Omit<CrmDeal, "id" | "created_at" | "updated_at">>;

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdateDealPatch }) => {
      const { data, error } = await companySupabase
        .from(DEALS_TABLE)
        .update(args.patch)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmDeal;
    },
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(crmKeys.deal(row.id), row);
      qc.invalidateQueries({ queryKey: crmKeys.deals });
    },
  });
}

/**
 * useMoveDeal — optimistic kanban move. Updates stage + position in
 * one mutation, snapshots the previous byStage cache so we can roll
 * back if Supabase rejects, and invalidates only the byStage slice
 * on success.
 *
 * `position` is numeric (not integer) — to splice between two
 * existing cards, pass (prev.position + next.position) / 2. To drop
 * at the end of a column, pass max(positions) + 1024.
 */
export function useMoveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; stage: DealStage; position: number }) => {
      const { data, error } = await companySupabase
        .from(DEALS_TABLE)
        .update({ stage: args.stage, position: args.position })
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmDeal;
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: crmKeys.deals });
      const prev = qc.getQueriesData<Record<DealStage, CrmDeal[]>>({
        queryKey: crmKeys.deals,
      });
      // Optimistically rewrite every cached byStage grouping.
      for (const [key, grouped] of prev) {
        if (!grouped) continue;
        const flat = Object.values(grouped).flat();
        const idx  = flat.findIndex((d) => d.id === args.id);
        if (idx === -1) continue;
        flat[idx] = { ...flat[idx], stage: args.stage, position: args.position };
        const next: Record<DealStage, CrmDeal[]> = {
          interested: [], demo: [], proposal: [],
          negotiation: [], won: [], lost: [],
        };
        for (const d of flat) (next[d.stage] ??= []).push(d);
        for (const stage of DEAL_STAGES) {
          next[stage].sort((a, b) =>
            (a.position ?? Infinity) - (b.position ?? Infinity)
          );
        }
        qc.setQueryData(key, next);
      }
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      if (!ctx) return;
      for (const [key, snapshot] of ctx.prev) qc.setQueryData(key, snapshot);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: crmKeys.deals });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await companySupabase
        .from(DEALS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: crmKeys.deal(id) });
      qc.invalidateQueries({ queryKey: crmKeys.deals });
    },
  });
}

// ============================================================
// Activities
// ============================================================
export function useActivitiesForContact(contactId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.activitiesForContact(contactId ?? ""),
    enabled: !!contactId,
    queryFn: async (): Promise<CrmActivity[]> => {
      const { data, error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .select("*")
        .eq("contact_id", contactId)
        .order("happened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CrmActivity[];
    },
  });
}

export function useActivitiesForDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.activitiesForDeal(dealId ?? ""),
    enabled: !!dealId,
    queryFn: async (): Promise<CrmActivity[]> => {
      const { data, error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .select("*")
        .eq("deal_id", dealId)
        .order("happened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CrmActivity[];
    },
  });
}

export function useActivitiesForCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.activitiesForCompany(companyId ?? ""),
    enabled: !!companyId,
    queryFn: async (): Promise<CrmActivity[]> => {
      const { data, error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .select("*")
        .eq("company_id", companyId)
        .order("happened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CrmActivity[];
    },
  });
}

export function useRecentActivities(limit = 20) {
  return useQuery({
    queryKey: crmKeys.activitiesRecent(limit),
    queryFn: async (): Promise<CrmActivity[]> => {
      const { data, error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .select("*")
        .order("happened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CrmActivity[];
    },
  });
}

export interface LogActivityInput {
  type: ActivityType;
  title?: string | null;
  body_md?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  company_id?: string | null;
  actor_supa_id?: string | null;
  happened_at?: string | null;     // defaults to now() on the server
  duration_minutes?: number | null;
  outcome?: string | null;
  meeting_id?: string | null;
}

export function useLogActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogActivityInput): Promise<CrmActivity> => {
      // The SQL CHECK constraint requires at least one of
      // contact_id / deal_id / company_id — surface that as a
      // local error so the caller gets a useful message rather
      // than a postgres CHECK violation.
      if (!input.contact_id && !input.deal_id && !input.company_id) {
        throw new Error(
          "Activity must attach to a contact, deal, or company.",
        );
      }
      const { data, error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .insert({
          type:              input.type,
          title:             input.title ?? null,
          body_md:           input.body_md ?? null,
          contact_id:        input.contact_id ?? null,
          deal_id:           input.deal_id ?? null,
          company_id:        input.company_id ?? null,
          actor_supa_id:     input.actor_supa_id ?? null,
          happened_at:       input.happened_at ?? new Date().toISOString(),
          duration_minutes:  input.duration_minutes ?? null,
          outcome:           input.outcome ?? null,
          meeting_id:        input.meeting_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CrmActivity;
    },
    onSuccess: (row) => {
      // Touch every per-entity slice this activity attaches to.
      if (row.contact_id) {
        qc.invalidateQueries({
          queryKey: crmKeys.activitiesForContact(row.contact_id),
        });
        // Also bump last_contacted_at on the contact card view —
        // the contact list sorts by updated_at so a re-fetch on the
        // list slice keeps ordering honest.
        qc.invalidateQueries({ queryKey: crmKeys.contacts });
      }
      if (row.deal_id) {
        qc.invalidateQueries({
          queryKey: crmKeys.activitiesForDeal(row.deal_id),
        });
      }
      if (row.company_id) {
        qc.invalidateQueries({
          queryKey: crmKeys.activitiesForCompany(row.company_id),
        });
      }
      qc.invalidateQueries({ queryKey: ["crm", "activities", "recent"] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await companySupabase
        .from(ACTIVITIES_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      // No way to know which entity this belonged to without a
      // pre-fetch; blanket-invalidate all activity slices.
      qc.invalidateQueries({ queryKey: ["crm", "activities"] });
    },
  });
}

// ============================================================
// Realtime — mount once from the page component.
// ============================================================
//
// One channel covers all four tables. Each table's change event
// invalidates only its own slice plus any cross-table slice that
// might have stale FK-joined data.
export function useCrmRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = companySupabase
      .channel("crm-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMPANIES_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as CrmCompany | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: crmKeys.company(row.id) });
          qc.invalidateQueries({ queryKey: crmKeys.companies });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CONTACTS_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as CrmContact | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: crmKeys.contact(row.id) });
          qc.invalidateQueries({ queryKey: crmKeys.contacts });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DEALS_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as CrmDeal | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: crmKeys.deal(row.id) });
          qc.invalidateQueries({ queryKey: crmKeys.deals });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: ACTIVITIES_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as CrmActivity | undefined;
          if (row?.contact_id) {
            qc.invalidateQueries({
              queryKey: crmKeys.activitiesForContact(row.contact_id),
            });
          }
          if (row?.deal_id) {
            qc.invalidateQueries({
              queryKey: crmKeys.activitiesForDeal(row.deal_id),
            });
          }
          if (row?.company_id) {
            qc.invalidateQueries({
              queryKey: crmKeys.activitiesForCompany(row.company_id),
            });
          }
          qc.invalidateQueries({ queryKey: ["crm", "activities", "recent"] });
        },
      )
      .subscribe();
    return () => {
      void companySupabase.removeChannel(ch);
    };
  }, [qc]);
}

// ============================================================
// Utilities — pure functions used by both UI and AXON actions
// ============================================================

/**
 * Weighted forecast across a list of deals — sums amount_cents *
 * (probability/100) but only across non-terminal stages so won/lost
 * don't double-count.
 */
export function weightedForecastCents(deals: CrmDeal[]): number {
  return deals
    .filter((d) => DEAL_OPEN_STAGES.includes(d.stage))
    .reduce((sum, d) => sum + Math.round(d.amount_cents * (d.probability / 100)), 0);
}

/**
 * Booked revenue this period — total amount of "won" deals with a
 * close_date_actual inside the window.
 */
export function bookedRevenueCents(
  deals: CrmDeal[],
  from: Date,
  to: Date,
): number {
  return deals
    .filter((d) => {
      if (d.stage !== "won" || !d.close_date_actual) return false;
      const t = Date.parse(d.close_date_actual);
      return t >= from.getTime() && t <= to.getTime();
    })
    .reduce((sum, d) => sum + d.amount_cents, 0);
}

/**
 * Average days-in-stage for a deal — how long it's been sitting in
 * its current stage. Uses updated_at as a proxy (the trigger touches
 * it on every change, so a deal that hasn't moved stages has
 * updated_at = first-arrival-in-stage). Returns whole days.
 */
export function daysInStage(deal: CrmDeal, now: Date = new Date()): number {
  const t = Date.parse(deal.updated_at);
  if (isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / (1000 * 60 * 60 * 24));
}

/**
 * extractEmailDomain — lowercased substring after the @, trimmed.
 * Returns null for malformed / empty inputs so callers can use it
 * as a simple guard. Strips common subdomains so "mail.acme.com"
 * matches "acme.com" without false-negative; we keep the public
 * suffix logic simple — anything past the last two dots stays.
 *
 * Examples:
 *   "Bob@Acme.com"        → "acme.com"
 *   "bob@mail.acme.com"   → "acme.com"
 *   "bob@acme.co.uk"      → "acme.co.uk" (last 3 segments when 2nd
 *                                          is a known short TLD)
 *   ""                    → null
 *   "no-at-sign"          → null
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  const raw = email.slice(at + 1).trim().toLowerCase();
  if (!raw.includes(".")) return null;
  const parts = raw.split(".");
  // Heuristic for ccTLDs like .co.uk, .com.au — keep 3 segments
  // when the 2nd-to-last is a known short TLD marker.
  const shortTlds = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
  if (parts.length >= 3 && shortTlds.has(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * findCompanyByEmailDomain — given a contact's email and a map of
 * companies (typically the result of useCrmCompanies()), returns
 * the company id whose domain matches. Used at contact-create time
 * to auto-attach contacts to their employer without making the user
 * pick from a dropdown.
 *
 * Match is case-insensitive on both sides; the schema's unique
 * index on lower(domain) makes this safe to rely on for 1:1 matches.
 */
export function findCompanyByEmailDomain(
  email: string | null | undefined,
  companies: CrmCompany[],
): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  for (const c of companies) {
    if (!c.domain) continue;
    if (c.domain.toLowerCase() === domain) return c.id;
  }
  return null;
}

/**
 * Format an amount + currency consistently. Tiny wrapper around
 * Intl.NumberFormat so every $ value in /sales reads the same way.
 */
export function formatCrmAmount(
  amountCents: number,
  currency = "usd",
  opts: { compact?: boolean } = {},
): string {
  const value = amountCents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(value);
}
