// ───────────────────────────────────────────────────────────────────
// Onboarding Queries — TanStack hooks for the OnboardingPipelinePanel
// + the UpcomingMeetings widget on the schedule page.
//
// Reads the candidates table (status in offer/hired) + the new
// candidate_meetings table. Mutations wrap the Axon onboarding
// actions with a headless context so the same logic backs voice
// commands AND button clicks (same pattern as recruitingQueries.ts).
// ───────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import type { CompanyFilter } from "@/stores/store";
import {
  generateOnboardingPlanAction,
  sendWelcomeMessageAction,
  scheduleOnboardingSessionAction,
  startFullOnboardingAction,
  type OnboardingPlan,
} from "@/Axon/actions/onboarding";
import type { ActionContext } from "@/Axon/types";
import type { CandidateRow } from "./recruitingQueries";

// Extended row shape — onboarding columns are added by
// candidate_onboarding.sql migration. They're optional so older
// rows without the migration applied still work in TS.
export interface OnboardingCandidate extends CandidateRow {
  onboarding_plan: OnboardingPlan | null;
  onboarding_plan_at: string | null;
  onboarding_started_at: string | null;
  welcome_sent_at: string | null;
  welcome_message_id: number | null;
  first_login_at: string | null;
  training_progress: Record<string, unknown>;
}

export interface CandidateMeeting {
  id: string;
  candidate_id: string;
  kind: "interview" | "onboarding_kickoff" | "check_in" | "training" | "other";
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_min: number;
  calendly_event_url: string | null;
  meeting_url: string | null;
  attendees: string[];
  organizer_email: string | null;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled" | "no_show";
  notes: string | null;
  // Optional joined candidate fields (when queried with a join)
  candidates?: { full_name: string; role_slug: string; email: string } | null;
}

const ONBOARDING_KEY = ["onboarding"] as const;
const MEETINGS_KEY = ["candidate_meetings"] as const;

// ── Headless action context ────────────────────────────────────────

function headlessCtx(): ActionContext {
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

// ── Queries ────────────────────────────────────────────────────────

/** All candidates in onboarding-relevant statuses: offer + hired.
 *  Ordered by status priority (hired first) then by recency. */
export function useOnboardingCandidates() {
  return useQuery({
    queryKey: [...ONBOARDING_KEY, "candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .in("status", ["offer", "hired"])
        .order("status", { ascending: true }) // 'hired' < 'offer' alphabetically — flip below
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as OnboardingCandidate[];
      // Re-sort so hired is first, then offer.
      return rows.sort((a, b) => {
        const order = { hired: 0, offer: 1 } as Record<string, number>;
        const ao = order[a.status] ?? 2;
        const bo = order[b.status] ?? 2;
        if (ao !== bo) return ao - bo;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    staleTime: 15_000,
  });
}

/** Meetings for one candidate. */
export function useCandidateMeetings(candidateId: string | null) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, "for", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("candidate_meetings")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CandidateMeeting[];
    },
  });
}

/** Upcoming meetings across all candidates — feeds the /schedule widget. */
export function useUpcomingHiringMeetings(withinDays: number = 14) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, "upcoming", withinDays],
    queryFn: async () => {
      const now = new Date();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + withinDays);
      const { data, error } = await supabase
        .from("candidate_meetings")
        .select("*, candidates ( full_name, role_slug, email )")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", horizon.toISOString())
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CandidateMeeting[];
    },
    staleTime: 60_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
  qc.invalidateQueries({ queryKey: MEETINGS_KEY });
  qc.invalidateQueries({ queryKey: ["candidates"] });
}

export function useGenerateOnboardingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, force }: { candidateId: string; force?: boolean }) => {
      const out = await generateOnboardingPlanAction.handler(
        { candidate_id: candidateId, force },
        headlessCtx(),
      );
      if (!out.data?.plan) throw new Error(out.summary);
      return out;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSendWelcomeMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, channel }: { candidateId: string; channel?: string }) => {
      const out = await sendWelcomeMessageAction.handler(
        { candidate_id: candidateId, channel },
        headlessCtx(),
      );
      if (!out.summary.toLowerCase().startsWith("posted") && !out.data?.message_id) {
        throw new Error(out.summary);
      }
      return out;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useScheduleOnboardingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      candidateId: string;
      when?: string;
      kind?: "interview" | "onboarding_kickoff" | "check_in" | "training";
      duration_min?: number;
      title?: string;
    }) => {
      const out = await scheduleOnboardingSessionAction.handler(
        {
          candidate_id: input.candidateId,
          when: input.when,
          kind: input.kind,
          duration_min: input.duration_min,
          title: input.title,
        },
        headlessCtx(),
      );
      if (!out.data?.meeting_id) throw new Error(out.summary);
      return out;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useStartFullOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, kickoffWhen }: { candidateId: string; kickoffWhen?: string }) => {
      return startFullOnboardingAction.handler(
        { candidate_id: candidateId, kickoff_when: kickoffWhen },
        headlessCtx(),
      );
    },
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Display helpers ────────────────────────────────────────────────

export function formatMeetingTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const KIND_LABELS: Record<CandidateMeeting["kind"], string> = {
  interview:          "Interview",
  onboarding_kickoff: "Day-One Welcome",
  check_in:           "Check-in",
  training:           "Training",
  other:              "Meeting",
};

export const KIND_COLORS: Record<CandidateMeeting["kind"], string> = {
  interview:          "bg-amber-500/15 text-amber-400 border-amber-500/30",
  onboarding_kickoff: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  check_in:           "bg-sky-500/15 text-sky-400 border-sky-500/30",
  training:           "bg-violet-500/15 text-violet-400 border-violet-500/30",
  other:              "bg-white/[0.06] text-white/60 border-white/10",
};
