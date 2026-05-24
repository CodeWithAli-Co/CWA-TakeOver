// ───────────────────────────────────────────────────────────────────
// Recruiting Queries
//
// TanStack Query hooks + small helpers for the Hiring page. Reads from
// the public.candidates / public.job_postings tables that the /apply
// form on takeover-B2B writes into.
//
// Why this module exists separately from the Axon recruiting actions:
//   - The UI is independent of Axon being mounted. Non-admin users
//     could still see the inbox (today they can't — role-gated — but
//     this keeps it possible).
//   - The Axon action handlers expect an ActionContext. The UI does
//     NOT have one. The wrappers in this file run the same logic
//     against a no-op context so buttons in the drawer "Just Work".
// ───────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import type { CompanyFilter } from "@/stores/store";
import {
  parseResumeAction,
  rateCandidateAction,
  rateAllPendingAction,
  updateCandidateStatusAction,
} from "@/Axon/actions/recruiting";
import type { ActionContext } from "@/Axon/types";

// ── Types (mirror schema; intentionally narrow) ────────────────────

export type CandidateStatus =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export type VerdictTier = "TOP" | "STRONG" | "GOOD" | "OK" | "WEAK" | "MISMATCH";

export interface ParsedResume {
  summary: string;
  current_title?: string;
  current_company?: string;
  years_experience?: number;
  employment_history: Array<{
    company: string;
    title: string;
    start: string;
    end: string;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    graduation?: string;
  }>;
  skills: string[];
  certifications?: string[];
  languages?: string[];
  notes?: string[];
}

export interface AxonAssessment {
  scores: Array<{ label: string; score: number; note: string }>;
  strengths: string[];
  concerns: string[];
  recommended_next_step: string;
}

export interface CandidateRow {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_slug: string;
  job_posting_id: string | null;
  current_title: string | null;
  current_company: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  location: string | null;
  why_role: string | null;
  why_takeover: string | null;
  expected_compensation: string | null;
  available_start_date: string | null;
  authorized_to_work: boolean | null;
  requires_sponsorship: boolean | null;
  resume_storage_path: string | null;
  resume_filename: string | null;
  resume_size_bytes: number | null;
  resume_content_type: string | null;
  parsed_resume: ParsedResume | null;
  parse_status: "pending" | "processing" | "done" | "failed";
  parse_error: string | null;
  fit_score: number | null;
  verdict_tier: VerdictTier | null;
  verdict_summary: string | null;
  axon_assessment: AxonAssessment | null;
  assessed_at: string | null;
  status: CandidateStatus;
  status_reason: string | null;
  scheduled_interview_at: string | null;
  calendly_event_url: string | null;
}

export interface JobPostingRow {
  id: string;
  slug: string;
  title: string;
  team: string;
  status: "draft" | "open" | "paused" | "closed";
}

// ── Headless action context ────────────────────────────────────────
// The Axon action handlers expect an ActionContext rich enough to
// log activity, push undo, speak, etc. From the UI we only need the
// core logic to run; activity logging happens in the React Query
// optimistic / invalidation cycle. So we hand the handlers a quiet
// stub.

function makeHeadlessCtx(): ActionContext {
  const noop = () => {};
  return {
    operator: { username: "ui", role: "Admin", supa_id: "ui" },
    activeCompany: "all" as CompanyFilter,
    currentPath: window.location.pathname,
    dryRun: false,
    navigate: noop,
    setActiveCompany: noop,
    speak: noop,
    note: noop,
    logActivity: noop,
    requestConfirmation: async () => true,
    pushUndo: noop,
  };
}

// ── Query hooks ────────────────────────────────────────────────────

export interface CandidateListFilters {
  roleSlug?: string;
  status?: CandidateStatus | "all";
  minScore?: number;
  sortBy?: "fit_score" | "created_at";
  limit?: number;
}

const CANDIDATES_KEY = ["candidates"] as const;

export function useCandidates(filters: CandidateListFilters = {}) {
  const { roleSlug, status = "all", minScore, sortBy = "fit_score", limit = 100 } = filters;

  return useQuery({
    queryKey: [...CANDIDATES_KEY, "list", { roleSlug, status, minScore, sortBy, limit }],
    queryFn: async () => {
      let q = supabase.from("candidates").select("*").limit(limit);

      if (roleSlug) q = q.eq("role_slug", roleSlug);
      if (status !== "all") q = q.eq("status", status);
      if (typeof minScore === "number") q = q.gte("fit_score", minScore);

      if (sortBy === "fit_score") {
        q = q.order("fit_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CandidateRow[];
    },
    staleTime: 15_000,
  });
}

export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: [...CANDIDATES_KEY, "one", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CandidateRow | null;
    },
  });
}

export function useJobPostings() {
  return useQuery({
    queryKey: ["job_postings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("id, slug, title, team, status")
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as JobPostingRow[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Signs a short-lived URL for the resume PDF so the embedded
 *  viewer can render it. The bucket is private (per RLS) so we
 *  re-sign every time the drawer opens — 5min is plenty. */
export async function getResumeSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(storagePath, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── Mutations ──────────────────────────────────────────────────────

/** Parses one candidate's resume via Claude. Wraps the Axon action
 *  so the same logic powers both voice commands and button clicks. */
export function useParseResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const out = await parseResumeAction.handler({ candidate_id: candidateId }, makeHeadlessCtx());
      if (out.data?.failed && out.data.failed > 0 && (out.data.parsed ?? 0) === 0) {
        throw new Error(out.summary);
      }
      return out;
    },
    onSuccess: (_, candidateId) => {
      qc.invalidateQueries({ queryKey: CANDIDATES_KEY });
      qc.invalidateQueries({ queryKey: [...CANDIDATES_KEY, "one", candidateId] });
    },
  });
}

export function useParseAllPending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return parseResumeAction.handler({ all_pending: true, max_to_parse: 10 }, makeHeadlessCtx());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
  });
}

export function useRateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, force }: { candidateId: string; force?: boolean }) => {
      const out = await rateCandidateAction.handler({ candidate_id: candidateId, force }, makeHeadlessCtx());
      if (out.data?.fit_score == null) throw new Error(out.summary);
      return out;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: CANDIDATES_KEY });
      qc.invalidateQueries({ queryKey: [...CANDIDATES_KEY, "one", vars.candidateId] });
    },
  });
}

export function useRateAllPending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roleSlug?: string) => {
      return rateAllPendingAction.handler({ role_slug: roleSlug, max_to_rate: 20 }, makeHeadlessCtx());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      candidateId,
      status,
      reason,
    }: {
      candidateId: string;
      status: CandidateStatus;
      reason?: string;
    }) => {
      return updateCandidateStatusAction.handler(
        { candidate_id: candidateId, status, reason },
        makeHeadlessCtx(),
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: CANDIDATES_KEY });
      qc.invalidateQueries({ queryKey: [...CANDIDATES_KEY, "one", vars.candidateId] });
    },
  });
}

// ── Display helpers ────────────────────────────────────────────────

export const TIER_COLORS: Record<VerdictTier, { bg: string; text: string; border: string }> = {
  TOP:      { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  STRONG:   { bg: "bg-green-500/15",   text: "text-green-400",   border: "border-green-500/30" },
  GOOD:     { bg: "bg-sky-500/15",     text: "text-sky-400",     border: "border-sky-500/30" },
  OK:       { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/30" },
  WEAK:     { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/30" },
  MISMATCH: { bg: "bg-red-500/15",     text: "text-red-400",     border: "border-red-500/30" },
};

export const STATUS_COLORS: Record<CandidateStatus, string> = {
  applied:    "bg-white/[0.06] text-white/60",
  screening:  "bg-sky-500/10 text-sky-400",
  interview:  "bg-amber-500/10 text-amber-400",
  offer:      "bg-violet-500/10 text-violet-400",
  hired:      "bg-emerald-500/15 text-emerald-400",
  rejected:   "bg-red-500/10 text-red-400",
  withdrawn:  "bg-white/[0.04] text-white/40",
};

/** Stable color for the candidate's avatar gradient (deterministic
 *  from the id so the same person gets the same colors every render). */
export function avatarGradient(id: string): [string, string] {
  const palettes: Array<[string, string]> = [
    ["from-rose-400",    "to-red-700"],
    ["from-sky-400",     "to-indigo-700"],
    ["from-emerald-400", "to-teal-700"],
    ["from-amber-400",   "to-orange-700"],
    ["from-violet-400",  "to-purple-700"],
    ["from-fuchsia-400", "to-pink-700"],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
