/**
 * StrategyPage.tsx — /strategy destination shell.
 *
 * Wraps the existing Row3Section ("Intelligence · Revenue ·
 * Mission Control · Daily Briefing" tabbed panel) in proper page
 * chrome: editorial title, subtle role badge, and a small "mock
 * data" notice until the backing tables (cwa_clients, cwa_pipeline,
 * cwa_initiatives) land in Supabase.
 *
 * Role gating: re-checks C-level on render so a non-C-level user
 * who navigates here directly via URL gets a friendly "not your
 * page" empty state instead of the executive panel.
 */

import { Navigate } from "@tanstack/react-router";
import { ActiveUser } from "@/stores/query";
import { Row3Section } from "@/MyComponents/Dashboard/Row3Section";
import { ShieldAlert } from "lucide-react";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO", "Admin"]);

export function StrategyPage() {
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const role: string | undefined = me?.role ?? undefined;
  const isCLevel = !!role && C_LEVEL_ROLES.has(role);

  if (!isCLevel) {
    return <NotForYou />;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      {/* ── Page header ────────────────────────────────────────── */}
      <header className="border-b border-xs border-border-soft bg-background">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-6">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary mb-2 inline-flex items-center gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            C-level workspace · Strategic intelligence
          </p>
          <h1 className="text-[28px] font-bold text-foreground leading-tight tracking-tight">
            Strategy
          </h1>
          <p className="text-[13px] text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Revenue, accounts, pipeline, and the morning briefing — the
            slower-cadence view of the business. Tabs swap the focus
            without leaving the page.
          </p>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1600px] px-6 pt-4 pb-10">
        {/* The Row3Section is grid-aware (col-span-12 inside a 12-col
         *  grid). Wrap in the same grid container the dashboard uses
         *  so its layout intent carries over here without any
         *  internal refactoring. */}
        <div className="grid grid-cols-12 gap-3">
          <Row3Section />
        </div>
      </div>
    </div>
  );
}

/**
 * Non-C-level safety net. Rather than 403'ing or silently failing,
 * give the operator a clear "this isn't your surface" message and
 * a way back to home.
 */
function NotForYou() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground px-6">
      <div className="max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-foreground/[0.05] text-text-tertiary mb-4">
          <ShieldAlert size={18} />
        </div>
        <h1 className="text-[16px] font-semibold text-foreground mb-1.5">
          C-level only
        </h1>
        <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
          Strategic intelligence is gated to CEO / COO / CFO / Admin.
          Ask your team lead if you think you should have access.
        </p>
        <Navigate to="/" />
      </div>
    </div>
  );
}
