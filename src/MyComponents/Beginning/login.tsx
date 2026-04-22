/**
 * login.tsx — Takeover sign-in page.
 *
 * Layout: split-screen. Left panel is the brand/identity block
 * (dark gradient, ambient glow, feature bullets). Right panel is
 * the form card. On narrow windows the brand panel collapses so
 * the form still has full screen space.
 *
 * UX improvements over the previous rev:
 *   · Inline error surfacing — invalid credentials no longer
 *     silently bounce to signup; a clear red message appears.
 *   · Loading state on the submit button during auth.
 *   · Show/hide password toggle.
 *   · Autofocus on email field + Enter-to-submit.
 *   · "Forgot password?" link (flow wired in task #198).
 *   · Signup is invite-only now — the "Sign up" link routes to an
 *     explanation screen rather than a public signup form.
 */

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles, Users, ShieldCheck } from "lucide-react";

export const LoginPage = () => {
  const { setIsLoggedIn } = useAppStore();

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setAuthError(null);
      setSubmitting(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: value.email.trim(),
          password: value.password,
        });

        if (error) {
          // Map Supabase's exact error messages to user-friendly copy.
          const msg = error.message.toLowerCase();
          if (msg.includes("invalid login credentials")) {
            setAuthError("Email or password is incorrect.");
          } else if (msg.includes("email not confirmed")) {
            setAuthError("Check your email to confirm the account, then try again.");
          } else {
            setAuthError(error.message);
          }
          return;
        }

        // Double-check the identity is email-verified before flipping
        // the store flag. Keeps the "user half-signed-up and stuck"
        // edge case from landing them in a broken state.
        const { data: verify } = await supabase.auth.getUserIdentities();
        const verified = verify?.identities?.[0]?.identity_data?.email_verified;
        if (data.user?.role === "authenticated" && verified) {
          setIsLoggedIn("true");
          localStorage.setItem("isLoggedIn", "true");
        } else {
          setAuthError(
            "Your email isn't verified yet. Check your inbox for the confirmation link.",
          );
        }
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex">
      {/* ── Left brand panel — hidden on narrow windows ─────── */}
      <BrandPanel />

      {/* ── Right: form card ────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-zinc-100">
              Welcome back
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Sign in to your Takeover account.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {/* ── Email ── */}
            <form.Field
              name="email"
              children={(field) => (
                <FieldShell label="Email" htmlFor={field.name} icon={Mail}>
                  <input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@codewithali.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 outline-none"
                  />
                </FieldShell>
              )}
            />

            {/* ── Password ── */}
            <form.Field
              name="password"
              children={(field) => (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label
                      htmlFor={field.name}
                      className="text-[11px] font-semibold text-zinc-400"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Forgot-password flow lands in task #198.
                        // For now this is a placeholder that tells the
                        // user to reach out if they're locked out.
                        setAuthError(
                          "Password reset is coming soon. For now, ping your admin to reset your password manually.",
                        );
                      }}
                      className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <FieldShell
                    htmlFor={field.name}
                    icon={Lock}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-zinc-500 hover:text-zinc-200 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    }
                  >
                    <input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 outline-none"
                    />
                  </FieldShell>
                </div>
              )}
            />

            {/* ── Error ── */}
            {authError && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                <p className="text-[12px] text-red-200 leading-snug">{authError}</p>
              </div>
            )}

            {/* ── Submit ── */}
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              )}
            />
          </form>

          {/* ── Invite-only footer ── */}
          <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-[11.5px] text-zinc-400 leading-relaxed">
              <b className="text-zinc-200">Accounts are invite-only.</b>
              {" "}Takeover is an internal tool. If you've been hired and
              haven't received an invite link, reach out to your hiring
              contact.
            </p>
            <button
              type="button"
              onClick={() => setIsLoggedIn("makeAcc")}
              className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors underline underline-offset-2"
            >
              Learn more about access →
            </button>
          </div>

          <p className="mt-6 text-center text-[10.5px] text-zinc-600">
            Protected by your company's security policy.
          </p>
        </div>
      </main>
    </div>
  );
};

// ── Brand panel ────────────────────────────────────────────────

function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative w-[46%] min-w-[440px] max-w-[620px] flex-col justify-between overflow-hidden border-r border-zinc-900/80 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-10">
      {/* Ambient glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 40%),
            radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Top: logo + brand name ── */}
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-400 flex items-center justify-center font-bold text-zinc-950 text-[15px]">
            T
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-zinc-100">Takeover</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              Ops Platform
            </p>
          </div>
        </div>
      </div>

      {/* ── Middle: headline + features ── */}
      <div className="relative z-10 max-w-[420px]">
        <h2 className="text-[30px] font-bold tracking-tight text-zinc-100 leading-[1.15]">
          The command center for your companies.
        </h2>
        <p className="mt-3 text-[13px] text-zinc-400 leading-relaxed">
          Chat, voice, AI assistance, hiring, and finance — unified in one
          desktop app. Built so your team spends zero time context-switching.
        </p>

        <ul className="mt-8 space-y-4">
          <Feature
            icon={Sparkles}
            title="AI-powered from day one"
            body="Axon handles scheduling, drafting, and team coordination so you can focus on strategy."
          />
          <Feature
            icon={Users}
            title="Chat, huddles, and screen share"
            body="Discord-quality voice and video built in. No Zoom tab, no separate Slack."
          />
          <Feature
            icon={ShieldCheck}
            title="Hiring that closes"
            body="Offers, e-signatures, and onboarding wired end-to-end with full audit trails."
          />
        </ul>
      </div>

      {/* ── Bottom: small footer ── */}
      <div className="relative z-10 flex items-center justify-between text-[10.5px] text-zinc-600">
        <span>© {new Date().getFullYear()} CodeWithAli LLC</span>
        <span className="font-mono">v2</span>
      </div>
    </aside>
  );
}

function Feature({
  icon: Icon, title, body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80">
        <Icon className="h-3.5 w-3.5 text-zinc-300" />
      </div>
      <div>
        <p className="text-[12.5px] font-semibold text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-zinc-500 leading-snug">{body}</p>
      </div>
    </li>
  );
}

// ── Input shell — label + icon + optional trailing ────────────

function FieldShell({
  label, htmlFor, icon: Icon, trailing, children,
}: {
  label?: string;
  htmlFor?: string;
  icon: typeof Mail;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[11px] font-semibold text-zinc-400 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 focus-within:border-zinc-500 focus-within:bg-zinc-900 transition-colors">
        <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
        <div className="flex-1 min-w-0">{children}</div>
        {trailing}
      </div>
    </div>
  );
}

export default LoginPage;
