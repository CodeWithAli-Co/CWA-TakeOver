/**
 * WelcomeModal.tsx — first-sign-in welcome for new hires.
 *
 * Fires once per user (tracked via localStorage key
 * `cwa-welcomed-<supa_id>`). Shown when:
 *   1. The user is signed in
 *   2. Their app_users row was created recently (within 14 days)
 *   3. They haven't been welcomed on this device
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
import { ActiveUser } from "@/stores/query";

const RECENT_USER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function WelcomeModal() {
  const { data: activeUser } = ActiveUser();
  const me = activeUser?.[0];
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me?.supa_id) return;
    const key = `cwa-welcomed-${me.supa_id}`;
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch { /* noop */ }

    // Only show for recently-created accounts. Prevents existing
    // users from seeing the welcome if they clear localStorage on
    // some future device — they're clearly not new hires.
    const createdAt = me.created_at ? Date.parse(me.created_at) : 0;
    if (!createdAt || Date.now() - createdAt > RECENT_USER_WINDOW_MS) return;

    setOpen(true);
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
