/**
 * SecuritySettings.tsx — real security actions, replacing the
 * previously-empty Security tab.
 *
 * Sections:
 *   · Password — trigger a reset email (reuses the same flow as
 *     login's "Forgot password?", sending a Supabase recovery
 *     email to the user's own address)
 *   · Active session — show when the current session started,
 *     "sign out everywhere" action (revokes all sessions across
 *     devices via Supabase signOut({ scope: 'global' }))
 *   · Account info — Supabase user id, email-verified state,
 *     MFA-enabled state (read-only info, useful for support)
 *
 * Deliberately doesn't include "change email" yet because
 * Supabase email changes require a two-sided confirmation flow
 * (confirm on old email + new email) that needs its own UI.
 * Listed as a TODO in the UI.
 */

import { useEffect, useState } from "react";
import {
  Shield, KeyRound, Monitor, LogOut, Check, AlertCircle, Loader2,
  Mail, Fingerprint, Clock,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";

type ResetState = "idle" | "sending" | "sent" | "error";
type SignoutState = "idle" | "signing" | "error";

export function SecuritySettings() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [signoutState, setSignoutState] = useState<SignoutState>("idle");
  const [signoutError, setSignoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, s] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      if (cancelled) return;
      setAuthUser(u.data.user);
      setSession(s.data.session);
    })();
    return () => { cancelled = true; };
  }, []);

  const email = authUser?.email as string | undefined;
  const emailVerified = Boolean(
    authUser?.user_metadata?.email_verified ?? authUser?.email_confirmed_at,
  );
  const mfaEnabled = (authUser?.factors?.length ?? 0) > 0;
  const lastSignIn = authUser?.last_sign_in_at as string | undefined;
  const sessionStarted = session?.user?.last_sign_in_at as string | undefined;
  const userId = authUser?.id as string | undefined;

  const sendPasswordReset = async () => {
    if (!email) {
      setResetError("No email on this account — can't send a reset link.");
      setResetState("error");
      return;
    }
    setResetState("sending");
    setResetError(null);
    const siteUrl =
      (import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
    const redirectTo = siteUrl ? `${siteUrl}/auth/set-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      setResetError(error.message);
      setResetState("error");
      return;
    }
    setResetState("sent");
    setTimeout(() => setResetState("idle"), 5000);
  };

  const signOutEverywhere = async () => {
    if (!confirm(
      "Sign out from every device where you're currently logged in? You'll need to sign back in with your password on each one.",
    )) return;
    setSignoutState("signing");
    setSignoutError(null);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setSignoutError(error.message);
      setSignoutState("error");
      return;
    }
    localStorage.removeItem("isLoggedIn");
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Password */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
        <SectionHeader icon={KeyRound} label="Password" />
        <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
          We'll email you a secure reset link. The link expires after one hour
          and can only be used once.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={resetState === "sending" || !email}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resetState === "sending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            {resetState === "sending" ? "Sending…" : "Send password reset email"}
          </button>

          {resetState === "sent" && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              Link sent to {email}
            </span>
          )}
          {resetState === "error" && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-red-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {resetError ?? "Failed to send"}
            </span>
          )}
        </div>

        <p className="mt-3 text-[10.5px] text-muted-foreground">
          Prefer to change your email? That flow isn't wired yet —
          we'll surface it here once it is.
        </p>
      </div>

      {/* Sessions */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
        <SectionHeader icon={Monitor} label="Active session" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoRow
            icon={Clock}
            label="This session started"
            value={sessionStarted ? new Date(sessionStarted).toLocaleString() : "—"}
          />
          <InfoRow
            icon={Clock}
            label="Last sign-in"
            value={lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
          />
        </div>

        <div className="mt-5 rounded-md border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-start gap-2">
            <LogOut className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-red-200">
                Sign out from all devices
              </p>
              <p className="mt-0.5 text-[11px] text-red-200/80 leading-snug">
                If you've lost a device or suspect someone else has access,
                revoking all sessions forces you to sign back in everywhere.
              </p>
            </div>
            <button
              type="button"
              onClick={signOutEverywhere}
              disabled={signoutState === "signing"}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/20 hover:border-red-500/60 disabled:opacity-50 transition-colors"
            >
              {signoutState === "signing" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LogOut className="h-3 w-3" />
              )}
              {signoutState === "signing" ? "Signing out…" : "Sign out everywhere"}
            </button>
          </div>
          {signoutState === "error" && (
            <p className="mt-2 text-[11px] text-red-300">{signoutError}</p>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
        <SectionHeader icon={Shield} label="Account info" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoRow
            icon={Mail}
            label="Email"
            value={email ?? "—"}
            badge={
              emailVerified
                ? { label: "Verified", tone: "good" }
                : { label: "Unverified", tone: "warn" }
            }
          />
          <InfoRow
            icon={Fingerprint}
            label="Two-factor auth"
            value={mfaEnabled ? "Enabled" : "Disabled"}
            badge={
              mfaEnabled
                ? { label: "On", tone: "good" }
                : { label: "Not set up", tone: "muted" }
            }
          />
          <InfoRow
            icon={Shield}
            label="User ID"
            value={userId ?? "—"}
            mono
          />
        </div>

        {!mfaEnabled && (
          <p className="mt-4 text-[10.5px] text-muted-foreground leading-relaxed">
            Two-factor auth isn't set up yet on this account. We'll surface
            setup here once it's wired — for now, strong unique passwords are
            the primary defense.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function SectionHeader({
  icon: Icon, label,
}: {
  icon: typeof Shield;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </h2>
    </div>
  );
}

function InfoRow({
  icon: Icon, label, value, badge, mono,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  badge?: { label: string; tone: "good" | "warn" | "muted" };
  mono?: boolean;
}) {
  const tones = {
    good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    muted: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
  };
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-background/30 px-3 py-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {badge && (
            <span
              className={[
                "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                tones[badge.tone],
              ].join(" ")}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p
          className={[
            "mt-0.5 text-[12px] text-foreground/90 truncate",
            mono ? "font-mono" : "",
          ].join(" ")}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
