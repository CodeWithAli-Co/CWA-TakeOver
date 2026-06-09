/**
 * WelcomeModal.tsx — first-sign-in welcome for new hires.
 *
 * Fires once per user (tracked via localStorage key
 * `cwa-welcomed-<supa_id>`). Shown when:
 *   1. The user is signed in
 *   2. Either (a) they have an active onboarding_instance — meaning
 *      leadership has explicitly assigned them a checklist — OR (b)
 *      their app_users row was created recently (14-day fallback for
 *      hires whose onboarding hasn't been provisioned yet).
 *   3. They haven't been welcomed on this device
 *
 * Gating by onboarding_instance rather than created_at alone means
 * admins testing the flow with their own account won't be blocked
 * just because their account is old — as long as someone assigned
 * them an onboarding to rehearse, they'll see the modal.
 *
 * Content: greeting, pointers to what to do next, CTA to their
 * onboarding checklist. No pep-talk, no corporate "Your journey
 * starts here" copy — concise orientation for working adults.
 *
 * Mounted from __root.tsx so every first-time sign-in sees it
 * regardless of where they land after auth.
 */

import { useEffect, useState } from "react";
import {
  ClipboardCheck, MessageSquare, User, X, ArrowRight, Sparkles,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { companySupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { whyWelcomeGated } from "./onboardingDebug";

const RECENT_USER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DEBUG_WELCOME = import.meta.env.DEV;

export function WelcomeModal() {
  const { data: activeUser } = ActiveUser();
  const me = activeUser?.[0];
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me?.supa_id) return;
    const key = `cwa-welcomed-${me.supa_id}`;

    // Dev-only diagnostic: log every gate decision so it's obvious
    // why the modal didn't fire. Open the console after sign-in to
    // see a structured report flagged with [welcome-modal].
    if (DEBUG_WELCOME) {
      whyWelcomeGated({ supaId: me.supa_id, createdAt: me.created_at })
        // eslint-disable-next-line no-console
        .then((report) => console.info("[welcome-modal] gate report:", report))
        .catch(() => {});
    }

    try {
      if (window.localStorage.getItem(key) === "1") {
        if (DEBUG_WELCOME) {
          // eslint-disable-next-line no-console
          console.info(
            "[welcome-modal] suppressed - cwa-welcomed-<supaId> is '1'. " +
              "Click 'Reset welcome (this device)' on the Onboarding page to retest.",
          );
        }
        return;
      }
    } catch { /* noop */ }

    let cancelled = false;

    (async () => {
      // Primary gate: does this user have an ACTIVE onboarding
      // instance? RLS narrows the query to the caller's own rows.
      // If yes, they're clearly a hire in progress — welcome them.
      const { data: inst, error } = await companySupabase
  .from("onboarding_instances")
        .select("id")
        .eq("employee_user_id", me.supa_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      const hasActiveOnboarding = !error && !!inst;

      if (hasActiveOnboarding) {
        setOpen(true);
        return;
      }

      // Fallback: recently-created account without a provisioned
      // onboarding yet. Keeps the welcome reachable on day one while
      // leadership is still wiring up their checklist.
      const createdAt = me.created_at ? Date.parse(me.created_at) : 0;
      if (createdAt && Date.now() - createdAt <= RECENT_USER_WINDOW_MS) {
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [me?.supa_id, me?.created_at]);

  const dismiss = (gotoOnboarding: boolean) => {
    try {
      window.localStorage.setItem(`cwa-welcomed-${me?.supa_id}`, "1");
    } catch { /* noop */ }
    setOpen(false);
    if (gotoOnboarding) {
      navigate({ to: "/onboarding" }).catch(() => {});
    }
  };

  if (!open || !me) return null;

  const firstName = (me.username ?? "").split(" ")[0] || me.username || "there";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop — click outside to dismiss without nav */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => dismiss(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[540px] rounded-lg border border-border bg-card shadow-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={() => dismiss(false)}
          className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss welcome"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary mb-3">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-[18px] font-semibold text-foreground tracking-tight">
            Welcome, {firstName}.
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Your account is set up. Here's where to start.
          </p>
        </div>

        {/* Orientation list */}
        <div className="p-6 pt-5 space-y-4">
          <StepRow
            icon={ClipboardCheck}
            label="Onboarding checklist"
            body="Tasks to get you fully set up — email, tooling, paperwork. Some are on you, some are on leadership."
            accent="primary"
          />
          <StepRow
            icon={User}
            label="Profile"
            body="Add your avatar and a short bio from Settings → Profile. Your teammates see this when they hover your name."
          />
          <StepRow
            icon={MessageSquare}
            label="Chat"
            body="Your team channels live in the sidebar. Jump in and say hi."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-card/50">
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            I'll look around
          </button>
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-3.5 py-1.5 text-[11.5px] font-semibold text-background hover:bg-foreground/90 transition-colors"
          >
            Go to onboarding
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  icon: Icon, label, body, accent,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  body: string;
  accent?: "primary";
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          accent === "primary"
            ? "bg-primary/15 text-primary"
            : "bg-muted/70 text-muted-foreground",
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}
