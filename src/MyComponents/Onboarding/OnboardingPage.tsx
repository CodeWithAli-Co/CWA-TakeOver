/**
 * OnboardingPage.tsx — root of the onboarding wizard.
 *
 * Reads `useOnboardingState` to decide which flow runs:
 *   · loading            → spinner
 *   · done               → soft-redirect to dashboard
 *   · not-authenticated  → soft-redirect to login
 *   · new-user           → IdentityFork → founder OR employee
 *   · pre-provisioned-employee → lightweight employee flow
 *   · founder-pending    → full founder flow (resumes from
 *                          onboarding_state if present)
 *
 * Within each branch this owns the step machine (`step` state)
 * and persists progress to `onboarding_state` after each
 * meaningful step so closing the app doesn't lose work.
 *
 * Founder + employee step screens are stubbed in this pass —
 * they're built out in the next pass. The identity fork and
 * branch routing are live now so we can verify the wiring.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  useOnboardingState,
  useMarkOnboarded,
  type OnboardingBranch,
} from "@/stores/onboarding";
import { IdentityFork, type IdentityChoice } from "./IdentityFork";
import { FounderFlow, type FounderData } from "./FounderFlow";

export function OnboardingPage() {
  const { data: realBranch = { kind: "loading" } as OnboardingBranch } =
    useOnboardingState();
  const navigate = useNavigate();
  const markOnboarded = useMarkOnboarded();
  // `?debug=1` — set by the dashboard header's Welcome pill.
  // Lets you walk through the wizard even if you're already
  // onboarded, without resetting your account.
  const search = useSearch({ strict: false }) as
    | { debug?: string }
    | undefined;
  const isDebug = search?.debug === "1";

  // In debug mode, pretend we're a new user so the identity
  // fork renders. The real branch is preserved for terminal
  // states only (loading / not-auth).
  const branch: OnboardingBranch = isDebug
    ? realBranch.kind === "loading" ||
      realBranch.kind === "not-authenticated"
      ? realBranch
      : { kind: "new-user" }
    : realBranch;

  // Soft redirects for terminal branches. `/` is the dashboard
  // home. Suppressed in debug mode so the wizard stays open.
  useEffect(() => {
    if (isDebug) return;
    if (branch.kind === "done") {
      navigate({ to: "/" as any, replace: true });
    }
    // not-authenticated handled by AuthGate higher up the tree.
  }, [branch.kind, navigate, isDebug]);

  // ─── Local wizard state ─────────────────────────────────────
  // After the identity fork picks a side, this drives which
  // flow renders. `null` means "still on the fork".
  const [identity, setIdentity] = useState<IdentityChoice | null>(null);

  if (branch.kind === "loading") {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[12.5px]">Setting things up…</span>
        </div>
      </Shell>
    );
  }

  if (branch.kind === "done" || branch.kind === "not-authenticated") {
    // Render a soft loading frame while the redirect fires.
    return (
      <Shell>
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
      </Shell>
    );
  }

  // Pre-provisioned employee — skip the identity fork.
  if (branch.kind === "pre-provisioned-employee") {
    return (
      <Shell>
        <EmployeeFlowStub
          row={branch.row}
          onComplete={() => markOnboarded.mutate(branch.row.supa_id)}
        />
      </Shell>
    );
  }

  // Founder-pending or brand-new user — both flow through the
  // identity fork. Founder-pending users who pick "employee"
  // get the no-invite block screen since they don't have a
  // role/company assigned to them.
  return (
    <Shell>
      <AnimatePresence mode="wait">
        {identity === null && (
          <motion.div
            key="fork"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <IdentityFork onPick={setIdentity} />
          </motion.div>
        )}

        {identity === "founder" && (
          <motion.div
            key="founder"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <FounderFlow
              // In debug mode we pass null supaId so the Done
              // step no-ops on the DB — exploring the wizard
              // doesn't overwrite your real role / username.
              supaId={
                isDebug
                  ? null
                  : realBranch.kind === "founder-pending"
                    ? realBranch.row.supa_id
                    : null
              }
              initialState={
                !isDebug && realBranch.kind === "founder-pending"
                  ? ((realBranch.row.onboarding_state as FounderData | null) ??
                    undefined)
                  : undefined
              }
              onBackToFork={() => setIdentity(null)}
              onComplete={() => {
                // In normal mode FounderFlow runs markOnboarded
                // and the root redirect bounces to /. In debug
                // mode supaId is null so no DB writes — just
                // navigate manually.
                if (isDebug) navigate({ to: "/" as any });
              }}
            />
          </motion.div>
        )}

        {identity === "employee" && (
          <motion.div
            key="employee-blocked"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <EmployeeBlocked onBack={() => setIdentity(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shell — page chrome
// ─────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-screen bg-background text-foreground flex items-center justify-center overflow-y-auto">
      {/* Subtle primary wash bleeding in from top-left, same
       *  motif as the Operations header. Anchors the whole
       *  onboarding feel to the rest of the app. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          background:
            "radial-gradient(60% 70% at 0% 0%, hsl(var(--primary)) 0%, transparent 60%)",
        }}
      />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EmployeeBlocked — no-invite hard block
// ─────────────────────────────────────────────────────────────────

function EmployeeBlocked({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full max-w-md mx-auto px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-warning/12 border border-warning/30 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle className="h-5 w-5 text-warning" strokeWidth={2.2} />
      </div>
      <h2 className="text-[20px] font-bold text-foreground leading-tight mb-2">
        You need an invite
      </h2>
      <p className="text-[13px] text-text-tertiary leading-relaxed mb-6">
        Takeover joins are invite-only. Ask your admin to send you a link from
        Settings → Team. Once they do, click the link in your email and you'll
        be brought back here automatically.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-semibold text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.04] transition-colors"
      >
        <ArrowLeft size={12} />
        Back
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FounderFlowStub + EmployeeFlowStub — placeholders
// ─────────────────────────────────────────────────────────────────
// Real screens land in the next pass. The stubs prove the routing
// works end-to-end and give us a hook for `mark-onboarded`.
// ─────────────────────────────────────────────────────────────────

function EmployeeFlowStub({
  row,
  onComplete,
}: {
  row: { username: string | null; company: string | null; role: string | null };
  onComplete: () => void;
}) {
  return (
    <div className="w-full max-w-md mx-auto px-6 py-10 text-center">
      <h2 className="text-[20px] font-bold text-foreground mb-2">
        Welcome{row.username ? `, ${row.username}` : ""} 👋
      </h2>
      <p className="text-[13px] text-text-tertiary leading-relaxed mb-6">
        You've been invited to{" "}
        <span className="font-semibold text-foreground">
          {row.company ?? "your team"}
        </span>{" "}
        as a{" "}
        <span className="font-semibold text-foreground">
          {row.role ?? "team member"}
        </span>
        . Your admin has already set everything up — you just need to confirm
        your profile.
      </p>
      <p className="text-[11.5px] text-text-tertiary/80 italic mb-6">
        Full profile-confirmation screen lands in the next pass.
      </p>
      <button
        type="button"
        onClick={onComplete}
        className="h-9 px-4 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue to dashboard
      </button>
    </div>
  );
}
