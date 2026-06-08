/**
 * stores/onboarding.ts — onboarding state machine + persistence.
 *
 * Single hook (`useOnboardingState`) the root layout calls to
 * decide whether to bounce the user into `/onboarding` or let
 * them through to the dashboard. Encapsulates the branching
 * defined in `migrations/onboarding_state.sql`.
 *
 * Two mutations:
 *   · `useUpdateOnboardingState` — persist partial wizard state
 *     after each step so refresh resumes from the last screen.
 *   · `useMarkOnboarded` — flip `onboarded_at = now()` when the
 *     final step completes. The root layout's bounce check
 *     stops firing for this user.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { companySupabase } from "@/routes/index.lazy";

const KEY = ["onboarding-state"] as const;

/**
 * Discriminated branch types. Drives which onboarding flow
 * runs (if any).
 *
 *   · `loading`       — auth + DB query still in flight
 *   · `done`          — onboarded_at IS NOT NULL → straight to dashboard
 *   · `new-user`      — no app_users row → identity fork
 *   · `pre-provisioned-employee` — admin invited them, just confirm + welcome
 *   · `founder-pending` — row exists but no role/company → fresh founder flow
 *   · `not-authenticated` — no auth session at all
 */
export type OnboardingBranch =
  | { kind: "loading" }
  | { kind: "done" }
  | { kind: "new-user" }
  | {
      kind: "pre-provisioned-employee";
      row: AppUserRow;
    }
  | { kind: "founder-pending"; row: AppUserRow }
  | { kind: "not-authenticated" };

interface AppUserRow {
  supa_id: string;
  username: string | null;
  role: string | null;
  company: string | null;
  onboarded_at: string | null;
  onboarding_state: Record<string, unknown> | null;
  [k: string]: unknown;
}

async function fetchOnboardingBranch(): Promise<OnboardingBranch> {
  const { data: authData } = await companySupabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { kind: "not-authenticated" };

  const { data, error } = await companySupabase    .from("employee")
    .select("*")
    .eq("supa_id", user.id)
    .limit(1);
  if (error) {
    // Surface as new-user — better to over-prompt than silently
    // skip onboarding for a real user.
    console.warn("[onboarding] app_users lookup failed", error);
    return { kind: "new-user" };
  }
  const row = (data as AppUserRow[] | null)?.[0];
  if (!row) return { kind: "new-user" };

  if (row.onboarded_at) return { kind: "done" };

  // Row exists but not yet onboarded. Branch on whether admin
  // pre-provisioned a role (employee invited by admin) or
  // whether this is a fresh founder (row created but role
  // still empty).
  //
  // We used to also check `row.company`, but app_users has no
  // company column in this schema — company membership lives
  // only in the client-side Zustand toggle. Until a proper
  // `companies` table lands, role alone is the signal.
  if (row.role) {
    return { kind: "pre-provisioned-employee", row };
  }
  return { kind: "founder-pending", row };
}

/** Resolves the current user's onboarding branch. The root
 *  layout uses this to bounce-or-pass each first paint. */
export function useOnboardingState() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchOnboardingBranch,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Persist partial wizard state (current step, collected fields)
 *  so closing or refreshing resumes from the last screen. The
 *  shape is intentionally loose — the wizard owns it. */
export function useUpdateOnboardingState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      supaId: string;
      patch: Record<string, unknown>;
    }) => {
      const { error } = await companySupabase
  .from("employee")
        .update({ onboarding_state: args.patch })
        .eq("supa_id", args.supaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Final-step completion — flip onboarded_at = now() so the
 *  root bounce check stops firing for this user. */
export function useMarkOnboarded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supaId: string) => {
      const { error } = await companySupabase
  .from("employee")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("supa_id", supaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Imperative branch lookup — for places that aren't React
 *  components (e.g. router beforeLoad guards). */
export async function getOnboardingBranch(): Promise<OnboardingBranch> {
  return fetchOnboardingBranch();
}

/**
 * Auto-redirect guard. Drop into the root layout (one line) and
 * it bounces the user to /welcome whenever their onboarding
 * branch isn't terminal AND they aren't already on /welcome.
 *
 * No-ops in three cases:
 *   · Still loading the branch (would cause a redirect flash)
 *   · Branch is `done` (user fully onboarded — pass through)
 *   · Branch is `not-authenticated` (auth flow owns this case)
 *   · Already on /welcome (avoid an infinite redirect loop)
 */
export function useOnboardingRedirect() {
  const { data: branch } = useOnboardingState();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!branch) return;
    if (
      branch.kind === "loading" ||
      branch.kind === "done" ||
      branch.kind === "not-authenticated"
    )
      return;
    if (location.pathname === "/welcome") return;
    navigate({ to: "/welcome" as any, replace: true });
  }, [branch?.kind, location.pathname, navigate]);
}
