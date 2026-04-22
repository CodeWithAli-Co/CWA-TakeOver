/**
 * signup.tsx — Invite-only access explainer.
 *
 * Takeover is an internal tool. Public signup was removed because
 * anyone on the internet could previously pick "Employee" or "Intern"
 * and create an account. Now accounts are created exclusively
 * through the hiring flow (Offer Letters → Convert to employee),
 * which spawns an app_users row with the right role.
 *
 * This page reuses the split-screen layout from login.tsx so the
 * two screens feel like siblings, and explains the new access
 * model so anyone who lands here understands why they can't just
 * make an account.
 */

import { useAppStore } from "@/stores/store";
import {
  Mail, ShieldCheck, ArrowLeft, FileSignature, UserPlus, ClipboardCheck,
  Sparkles, Users,
} from "lucide-react";

export const SignUpPage = () => {
  const { setIsLoggedIn } = useAppStore();

  const goToLogin = () => setIsLoggedIn("false");

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex">
      {/* ── Left brand panel (mirror of login's) ──────────────── */}
      <BrandPanel />

      {/* ── Right: the explainer ──────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[440px]">
          <button
            type="button"
            onClick={goToLogin}
            className="mb-6 inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </button>

          <div className="mb-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 mb-4">
              <ShieldCheck className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-[24px] font-bold tracking-tight text-zinc-100">
              Takeover is invite-only.
            </h1>
            <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">
              We don't have a public signup form. Accounts are created
              automatically when you're hired, through the Offer Letters
              → Convert workflow.
            </p>
          </div>

          {/* ── Access path ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
            <p className="text-[10.5px] font-mono uppercase tracking-widest text-zinc-500 mb-4">
              How access works
            </p>
            <ul className="space-y-4">
              <Step
                n={1}
                icon={FileSignature}
                title="Accept your offer"
                body="You receive a signed offer letter via email with a secure link to accept, counter-sign, and complete any companion agreements."
              />
              <Step
                n={2}
                icon={UserPlus}
                title="Account gets created"
                body="Your hiring contact clicks 'Create employee record' after you've signed. Your Takeover account is provisioned automatically with your role + company."
              />
              <Step
                n={3}
                icon={ClipboardCheck}
                title="Sign in + onboard"
                body="You receive a welcome email with your first-login details. Sign in, work through your onboarding checklist, and you're in."
              />
            </ul>
          </div>

          {/* ── Contact fallback ── */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <Mail className="h-4 w-4 mt-0.5 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-zinc-200">
                Think you should have access?
              </p>
              <p className="mt-1 text-[11.5px] text-zinc-500 leading-relaxed">
                If you've been hired and haven't received an invite, or
                your hiring contact says your account was created but
                you can't sign in, reach out to{" "}
                <a
                  href="mailto:hire@codewithali.com"
                  className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
                >
                  hire@codewithali.com
                </a>
                .
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={goToLogin}
            className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-950 hover:bg-white transition-colors shadow-lg"
          >
            Go to sign in
          </button>
        </div>
      </main>
    </div>
  );
};

// ── Brand panel (kept in-file to avoid cross-file coupling on a
// single-use component; login.tsx has a near-identical one) ────

function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative w-[46%] min-w-[440px] max-w-[620px] flex-col justify-between overflow-hidden border-r border-zinc-900/80 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-10">
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

      <div className="relative z-10 max-w-[420px]">
        <h2 className="text-[28px] font-bold tracking-tight text-zinc-100 leading-[1.15]">
          A tightly-scoped platform — earned access only.
        </h2>
        <p className="mt-3 text-[13px] text-zinc-400 leading-relaxed">
          Every Takeover account is tied to a real hiring event. That's how
          we keep the data clean, the audit trail intact, and the user
          directory from filling with strangers.
        </p>

        <ul className="mt-8 space-y-4">
          <Feature
            icon={ShieldCheck}
            title="Identity verified at source"
            body="Every user was vetted during hiring — no drive-by signups."
          />
          <Feature
            icon={Users}
            title="Role assigned on creation"
            body="Your permissions match your role. You see what you need and nothing else."
          />
          <Feature
            icon={Sparkles}
            title="Onboarding is built-in"
            body="New-hire checklist appears the moment you log in."
          />
        </ul>
      </div>

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

// ── Numbered step block ────────────────────────────────────────

function Step({
  n, icon: Icon, title, body,
}: {
  n: number;
  icon: typeof FileSignature;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-[11px] font-bold text-zinc-300">
          {n}
        </div>
      </div>
      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-zinc-400" />
          <p className="text-[12.5px] font-semibold text-zinc-200">{title}</p>
        </div>
        <p className="mt-1 text-[11.5px] text-zinc-500 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

export default SignUpPage;
