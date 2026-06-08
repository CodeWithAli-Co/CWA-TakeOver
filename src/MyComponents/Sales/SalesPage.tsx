/**
 * SalesPage — landing page for /sales.
 *
 * Day 3 scope: route shell + editorial bento skeleton + sub-nav
 * tab strip that swaps between Dashboard / Pipeline / Contacts /
 * Companies / Activities. Real data wires up over the next 4 days.
 *
 * Visual grammar matches the financial dashboard:
 *   · Editorial masthead — Newsreader serif + mono eyebrow + live
 *     status pill on the right
 *   · Underline-style tab strip (red active underline)
 *   · Tile chrome / eyebrow / serifTitle / monoNum constants
 *
 * The page calls useCrmRealtime() once so every child component
 * that mounts gets live-invalidated query data without each one
 * managing its own subscription.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TrendingUp,
  Users,
  Building2,
  Activity,
  KanbanSquare,
  Sparkles,
  RefreshCcw,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle2,
  MessageSquare,
  Video,
  StickyNote,
  CreditCard,
} from "lucide-react";
import {
  useCrmContacts,
  useCrmDeals,
  useCrmCompanies,
  useRecentActivities,
  useCrmRealtime,
  useSyncStripeCustomers,
  weightedForecastCents,
  bookedRevenueCents,
  formatCrmAmount,
  DEAL_STAGES,
  DEAL_OPEN_STAGES,
  type CrmDeal,
  type CrmActivity,
  type DealStage,
  type ActivityType,
} from "@/stores/crm";
import { useQueryClient } from "@tanstack/react-query";
import { PipelineView } from "./PipelineView";
import { ContactsView, ContactDetailDrawer } from "./ContactsView";
import { CompaniesView, CompanyDetailDrawer } from "./CompaniesView";
import { DealDetailDrawer } from "./DealDetailDrawer";
import { useSalesDrawerUrl } from "./salesDrawerStore";
import { useStripeDashboard } from "@/lib/useStripeDashboard";

// ════════════════════════════════════════════
// Shared editorial chrome — same tokens as the financial dashboard
// so all of Takeover's "data destinations" read as one design system.
// ════════════════════════════════════════════
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const serifTitle = "ed-serif text-[20px] mt-1.5 text-zinc-100";
const monoNum = "font-mono tabular-nums";

// ────────────────────────────────────────────────
// Sub-nav tab definitions — single source of truth so the tab
// strip and the content panels can't drift.
// ────────────────────────────────────────────────
const SALES_TABS = [
  { value: "dashboard", label: "Dashboard", icon: TrendingUp },
  { value: "pipeline",  label: "Pipeline",  icon: KanbanSquare },
  { value: "contacts",  label: "Contacts",  icon: Users },
  { value: "companies", label: "Companies", icon: Building2 },
  { value: "activity",  label: "Activity",  icon: Activity },
  // Fundraise was briefly a tab here -- promoted to its own
  // /fundraise route since the motion (raising money) is
  // sufficiently distinct from regular sales. The underlying
  // investor_profiles table still references crm_companies + crm_contacts.
] as const;

export const SalesPage: React.FC = () => {
  // Realtime subscription mounts once for the whole /sales surface.
  useCrmRealtime();

  // Two-way URL sync for the active drawer. Lets users share links
  // like /sales?deal=abc and gets the back button doing the obvious
  // thing (close the drawer / pop to prior drawer state).
  useSalesDrawerUrl();

  const qc = useQueryClient();
  const [tab, setTab] = useState<typeof SALES_TABS[number]["value"]>("dashboard");

  // Stripe sync — pulls the customer list off useStripeDashboard()
  // (already cached by the financial dashboard) and pushes a one-shot
  // import into crm_contacts. The status pill below shows the last
  // sync result for ~6 seconds, then fades.
  const stripeDash = useStripeDashboard();
  const syncStripe = useSyncStripeCustomers();
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const stripeConnected =
    !!stripeDash.connected && (stripeDash.customers?.items?.length ?? 0) > 0;
  const stripeCustomerCount = stripeDash.customers?.items?.length ?? 0;

  // Keep the latest handler in a ref so the cwa-sales-stripe-sync
  // event listener (registered once on mount) always invokes the
  // current closure — otherwise it captures stale `stripeDash`.
  const handlerRef = useRef<() => void>(() => {});

  const handleStripeSync = async () => {
    if (!stripeConnected) {
      setSyncToast("Stripe not connected");
      window.setTimeout(() => setSyncToast(null), 4_000);
      return;
    }
    try {
      const result = await syncStripe.mutateAsync({
        customers: (stripeDash.customers?.items ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          status: c.status,
          mrr_cents: c.mrr_cents,
          ltv_cents: c.ltv_cents,
          last_activity_at: c.last_activity_at,
        })),
      });
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      if (result.errors.length) parts.push(`${result.errors.length} errors`);
      setSyncToast(parts.length ? parts.join(" · ") : "Already in sync");
      window.setTimeout(() => setSyncToast(null), 6_000);
    } catch (e) {
      setSyncToast(e instanceof Error ? e.message : "Sync failed");
      window.setTimeout(() => setSyncToast(null), 6_000);
    }
  };

  // Update the ref every render so the listener sees latest closure.
  handlerRef.current = handleStripeSync;

  // Listen for the Cmd+K "Sync Stripe customers" verb.
  useEffect(() => {
    const onSyncReq = () => { void handlerRef.current(); };
    window.addEventListener("cwa-sales-stripe-sync", onSyncReq);
    return () => window.removeEventListener("cwa-sales-stripe-sync", onSyncReq);
  }, []);

  // Pull the four headline slices for the masthead status + KPI strip.
  const { data: contacts = [] } = useCrmContacts({});
  const { data: deals = [] }    = useCrmDeals();
  const { data: companies = [] } = useCrmCompanies();
  const { data: recentActivity = [] } = useRecentActivities(20);

  // Derived KPIs for the landing dashboard. Memoized because they
  // re-run on every realtime invalidation otherwise.
  const kpis = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - 7);

    return {
      contactCount: contacts.length,
      customerCount: contacts.filter((c) => c.lifecycle_stage === "customer").length,
      leadsThisWeek: contacts.filter((c) => {
        const t = Date.parse(c.first_touched_at);
        return !isNaN(t) && t >= startWeek.getTime();
      }).length,
      companyCount: companies.length,
      openDeals: deals.filter((d) =>
        DEAL_OPEN_STAGES.includes(d.stage),
      ).length,
      pipelineCents: weightedForecastCents(deals),
      bookedThisMonthCents: bookedRevenueCents(deals, startMonth, now),
    };
  }, [contacts, deals, companies]);

  const lastUpdatedLabel = useMemo(() => {
    if (recentActivity.length === 0) return null;
    const latest = recentActivity[0];
    return new Date(latest.happened_at)
      .toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
  }, [recentActivity]);

  const hasData = contacts.length + deals.length + companies.length > 0;

  return (
    <div className="min-h-screen bg-background overflow-y-auto transition-colors duration-500">
      {/* Newsreader serif loaded inline once for the editorial header. */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap');.ed-serif{font-family:'Newsreader',Georgia,serif}`}</style>

      {/* ════════════════════════════════════════════
          Editorial masthead — mirrors /financialDashboard so the two
          "business OS" routes read as siblings. */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2 min-w-0 max-w-[60%]">
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              </span>
              CodeWithAli · Revenue stack
            </p>
            <h1 className="ed-serif text-[44px] leading-[1.02] text-foreground tracking-tight">
              Sales{" "}
              <span className="italic font-normal text-foreground/80">
                &amp; pipeline
              </span>
            </h1>
            <p className="text-[12.5px] text-muted-foreground/70 leading-snug pt-1">
              Contacts, companies, deals, and the activity timeline that
              connects them. Stripe customers live in the same table —
              one source of truth from lead to renewal.
            </p>
          </div>

          {/* Right rail — refresh + updated stamp. We don't show the
              Stripe pill here (that's the financial dashboard's home).
              Recent-activity timestamp doubles as the freshness signal. */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Stripe sync button — backfills Stripe customers into
                  crm_contacts as one row each. Disabled when Stripe
                  isn't connected. Pending state + result toast next to
                  the button keep operator feedback inline. */}
              <button
                onClick={handleStripeSync}
                disabled={!stripeConnected || syncStripe.isPending}
                title={
                  stripeConnected
                    ? `Pull ${stripeCustomerCount} Stripe customers into CRM`
                    : "Connect Stripe on the financial dashboard first"
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.16em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-zinc-300 hover:text-emerald-300"
              >
                <CreditCard className="h-3 w-3" />
                {syncStripe.isPending ? "Syncing…" : "Sync · Stripe"}
              </button>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300 text-[10px] font-mono uppercase tracking-[0.16em]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                </span>
                Live · CRM
              </div>
            </div>
            {syncToast && (
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-300 self-end">
                {syncToast}
              </div>
            )}
            <button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["crm"] });
              }}
              className="group flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Refetch all CRM data"
            >
              <RefreshCcw className="h-3 w-3 transition-transform group-hover:rotate-180" />
              {lastUpdatedLabel ? (
                <span>Updated {lastUpdatedLabel}</span>
              ) : (
                <span>Refresh</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          Underline tab strip — same chrome as the financial dashboard. */}
      <div className="px-8 pt-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="relative bg-transparent border-0 rounded-none h-auto p-0 w-full justify-start gap-8 border-b border-border/60">
            {SALES_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground/70 hover:text-foreground rounded-none px-0 pb-3 pt-0 h-auto text-[11px] font-mono uppercase tracking-[0.18em] transition-colors"
              >
                <t.icon className="h-3 w-3 mr-1.5 opacity-80" />
                {t.label}
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="pt-4 pb-10 space-y-4">
            <TabsContent value="dashboard">
              <DashboardTab
                kpis={kpis}
                deals={deals}
                recentActivity={recentActivity}
                hasData={hasData}
              />
            </TabsContent>

            <TabsContent value="pipeline">
              <PipelineView />
            </TabsContent>

            <TabsContent value="contacts">
              <ContactsView />
            </TabsContent>

            <TabsContent value="companies">
              <CompaniesView />
            </TabsContent>

            <TabsContent value="activity">
              <ActivityTab activities={recentActivity} hasData={hasData} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* All three detail drawers mount once at the root of /sales so
          they survive tab switches and cross-drawer hot-swaps work.
          State is owned by salesDrawerStore — only one drawer is open
          at a time (opening one closes the other two), and the drawer
          components themselves read activeXId off the store. */}
      <DealDetailDrawer />
      <ContactDetailDrawer />
      <CompanyDetailDrawer />
    </div>
  );
};

// ────────────────────────────────────────────────
// KPI shape — extracted so DashboardTab's prop type stays honest
// without a hacky useDerivedKpis trick.
// ────────────────────────────────────────────────
interface SalesKpis {
  contactCount: number;
  customerCount: number;
  leadsThisWeek: number;
  companyCount: number;
  openDeals: number;
  pipelineCents: number;
  bookedThisMonthCents: number;
}

// ────────────────────────────────────────────────
// Dashboard tab — KPI strip + pipeline-by-stage chart + recent
// activity feed. All three widgets are now live.
// ────────────────────────────────────────────────
const DashboardTab: React.FC<{
  kpis: SalesKpis;
  deals: CrmDeal[];
  recentActivity: CrmActivity[];
  hasData: boolean;
}> = ({ kpis, deals, recentActivity, hasData }) => {
  return (
    <div className="grid grid-cols-12 gap-3.5">
      {/* KPI strip — 6 compact tiles (col-2 each = 12) */}
      <KpiTile label="Pipeline" value={formatCrmAmount(kpis.pipelineCents, "usd", { compact: true })} sub="weighted forecast" accent />
      <KpiTile label="Won · MTD" value={formatCrmAmount(kpis.bookedThisMonthCents, "usd", { compact: true })} sub="closed-won this month" />
      <KpiTile label="Open deals" value={String(kpis.openDeals)} sub={`${kpis.contactCount > 0 ? Math.round((kpis.openDeals / Math.max(kpis.contactCount, 1)) * 100) : 0}% of contacts`} />
      <KpiTile label="Customers" value={String(kpis.customerCount)} sub={`of ${kpis.contactCount} contacts`} />
      <KpiTile label="New · 7d" value={String(kpis.leadsThisWeek)} sub="new leads this week" />
      <KpiTile label="Companies" value={String(kpis.companyCount)} sub="accounts tracked" />

      {/* Pipeline-by-stage (col-8) + Recent activity (col-4) */}
      <PipelineByStageCard deals={deals} hasData={hasData} />
      <RecentActivityCard activities={recentActivity} hasData={hasData} />

      {/* Row 3 — Top deals + At-risk + Win-rate by source. Three
          col-4 tiles balance the row visually with the col-8 +
          col-4 above. */}
      <TopDealsCard deals={deals} />
      <AtRiskDealsCard deals={deals} />
      <WinRateBySourceCard deals={deals} />
    </div>
  );
};

// ────────────────────────────────────────────────
// PipelineByStageCard — horizontal bar chart showing total deal
// value per stage. Bars are rendered with native flex/width so we
// don't pull in recharts for a 6-row chart; matches the lightweight
// SVG-free pattern from the customer's bento payout chart.
//
// Stages render in the canonical pipeline order. The currently-
// leading open stage (highest $) gets the emerald accent; everyone
// else stays zinc to keep the visual hierarchy honest.
// ────────────────────────────────────────────────
const STAGE_LABELS: Record<DealStage, string> = {
  interested: "Interested",
  demo: "Demo",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const PipelineByStageCard: React.FC<{
  deals: CrmDeal[];
  hasData: boolean;
}> = ({ deals, hasData }) => {
  // Aggregate $ + count per stage. Done inline because the chart
  // re-renders on every realtime invalidation; trivially cheap with
  // ~hundreds of deals.
  const byStage = useMemo(() => {
    const init: Record<DealStage, { cents: number; count: number }> = {
      interested:  { cents: 0, count: 0 },
      demo:        { cents: 0, count: 0 },
      proposal:    { cents: 0, count: 0 },
      negotiation: { cents: 0, count: 0 },
      won:         { cents: 0, count: 0 },
      lost:        { cents: 0, count: 0 },
    };
    for (const d of deals) {
      init[d.stage].cents += d.amount_cents;
      init[d.stage].count += 1;
    }
    return init;
  }, [deals]);

  // Leading open stage gets the emerald accent — "where's the
  // pipeline most concentrated right now?"
  const peakOpenStage = useMemo<DealStage | null>(() => {
    let best: DealStage | null = null;
    let bestCents = 0;
    for (const s of DEAL_OPEN_STAGES) {
      if (byStage[s].cents > bestCents) {
        bestCents = byStage[s].cents;
        best = s;
      }
    }
    return best;
  }, [byStage]);

  // Scale denominator — the biggest single bar across ALL stages
  // (including won/lost) so every bar reads on the same axis.
  const peakAny = Math.max(...DEAL_STAGES.map((s) => byStage[s].cents), 1);

  return (
    <div className={`col-span-12 lg:col-span-8 ${tile} p-5 flex flex-col`}>
      <div className="flex items-baseline gap-3 mb-4">
        <div>
          <p className={eyebrow}>Pipeline</p>
          <h3 className={serifTitle}>By stage</h3>
        </div>
        <span className={`ml-auto text-[11px] font-mono text-zinc-500`}>
          {hasData ? `${deals.length} deal${deals.length === 1 ? "" : "s"}` : "no deals yet"}
        </span>
      </div>

      {!hasData ? (
        <div className="flex-1 min-h-[200px] flex items-center justify-center">
          <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
            Pipeline chart appears once you add deals
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {DEAL_STAGES.map((stage) => {
            const { cents, count } = byStage[stage];
            const widthPct = (cents / peakAny) * 100;
            const isPeak = stage === peakOpenStage;
            const isTerminal = stage === "won" || stage === "lost";

            // Color logic:
            //   peak open stage → emerald (where pipeline lives)
            //   won             → soft emerald (booked revenue)
            //   lost            → quiet zinc (don't dwell)
            //   other open      → zinc/70 (neutral pipeline depth)
            const barCls = isPeak
              ? "bg-emerald-500/70 group-hover:bg-emerald-400/80"
              : stage === "won"
                ? "bg-emerald-500/30 group-hover:bg-emerald-500/40"
                : stage === "lost"
                  ? "bg-zinc-700/50 group-hover:bg-zinc-600/60"
                  : "bg-zinc-700/70 group-hover:bg-zinc-600/80";

            return (
              <div key={stage} className="group">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-400">
                    {STAGE_LABELS[stage]}
                    <span className="text-zinc-700 ml-1.5">{count}</span>
                  </p>
                  <span className={`text-[12px] ${isTerminal && stage === "won" ? "text-emerald-400" : "text-zinc-200"} ${monoNum}`}>
                    {cents > 0 ? formatCrmAmount(cents, "usd", { compact: true }) : "—"}
                  </span>
                </div>
                <div className="h-2.5 rounded-sm bg-white/[0.03] overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all duration-300 ${barCls}`}
                    style={{ width: `${Math.max(widthPct, cents > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// RecentActivityCard — last 10 activity events across all entities,
// rendered with type-specific icons + relative timestamp. Mirrors
// the financial dashboard's "Recent transactions" row pattern.
// ────────────────────────────────────────────────
const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call:    Phone,
  email:   Mail,
  meeting: CalendarIcon,
  note:    StickyNote,
  task:    CheckCircle2,
  demo:    Video,
  sms:     MessageSquare,
};

/** Compact "2h ago" / "3d ago" relative formatter. Returns the
 *  absolute date when older than 30 days so the activity feed
 *  doesn't end up displaying "412d ago" for cold leads. */
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const RecentActivityCard: React.FC<{
  activities: CrmActivity[];
  hasData: boolean;
}> = ({ activities, hasData }) => {
  const items = activities.slice(0, 10);

  return (
    <div className={`col-span-12 lg:col-span-4 ${tile} overflow-hidden flex flex-col`}>
      <div className="px-5 pt-5 flex items-baseline gap-3">
        <div>
          <p className={eyebrow}>Recent activity</p>
          <h3 className={serifTitle}>Latest touchpoints</h3>
        </div>
        <span className="ml-auto text-[11px] font-mono text-zinc-500">
          {items.length === 0 ? "—" : `last ${items.length}`}
        </span>
      </div>

      <div className="mt-3 max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
            {hasData
              ? "Log activities to populate this feed"
              : "No activity yet"}
          </div>
        ) : (
          items.map((a) => {
            const Icon = ACTIVITY_ICON[a.type] ?? FileText;
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="mt-0.5 p-1.5 rounded-md bg-white/[0.04] border border-white/[0.05] shrink-0">
                  <Icon className="h-3 w-3 text-zinc-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-zinc-100 truncate">
                      {a.title ?? a.type[0].toUpperCase() + a.type.slice(1)}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {relTime(a.happened_at)}
                    </span>
                  </div>
                  {a.body_md && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                      {a.body_md}
                    </p>
                  )}
                  {a.outcome && (
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mt-1">
                      {a.outcome}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// KpiTile — same compact density as the financial dashboard's KPIs.
// ────────────────────────────────────────────────
const KpiTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}> = ({ label, value, sub, accent }) => (
  <div
    className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}
  >
    <p className={`${eyebrow} ${accent ? "flex items-center gap-2" : ""}`}>
      {accent && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      )}
      {label}
    </p>
    <div
      className={`text-[20px] font-medium tracking-tight leading-none ${
        accent ? "text-emerald-400" : "text-zinc-100"
      } ${monoNum}`}
    >
      {value}
    </div>
    {sub && (
      <div className="text-[10px] font-mono text-zinc-500 leading-none">
        {sub}
      </div>
    )}
  </div>
);

// ════════════════════════════════════════════
// ActivityTab — full timeline view (dedicated tab). The dashboard tile
// shows the last 10; this view fetches up to 100 and renders them
// with day-grouped headers. The composer is the global Cmd+K verb
// or any drawer's "+ Log" button — no inline composer needed here
// since those entry points are everywhere.
// ════════════════════════════════════════════
const ActivityTab: React.FC<{
  activities: CrmActivity[];
  hasData: boolean;
}> = ({ activities, hasData }) => {
  // Group by date (YYYY-MM-DD) for visual scanning. "Today" /
  // "Yesterday" headers when applicable.
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: CrmActivity[] }> = [];
    const byDay = new Map<string, CrmActivity[]>();
    for (const a of activities) {
      const d = new Date(a.happened_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(a);
    }
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const yKey = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;
    for (const [key, items] of byDay.entries()) {
      let label: string;
      if (key === todayKey) label = "Today";
      else if (key === yKey) label = "Yesterday";
      else {
        const sample = new Date(items[0].happened_at);
        label = sample.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      }
      groups.push({ label, items });
    }
    return groups;
  }, [activities]);

  if (!hasData || activities.length === 0) {
    return (
      <div className={`${tile} p-12 flex flex-col items-center justify-center text-center gap-3 min-h-[420px]`}>
        <div className="p-3 rounded-full bg-primary/[0.07] border border-primary/15">
          <Activity className="h-5 w-5 text-primary/80" />
        </div>
        <div>
          <p className={eyebrow}>Activity</p>
          <h3 className="ed-serif text-[24px] mt-1 text-zinc-100">
            No activity yet
          </h3>
          <p className="text-[12px] text-muted-foreground/70 mt-2 max-w-md">
            Log a call, email, or meeting from any drawer's "+ Log" button —
            or hit Cmd+K and type "log call".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${tile} p-5`}>
      <div className="flex items-baseline gap-3 mb-4">
        <div>
          <p className={eyebrow}>Timeline</p>
          <h3 className={serifTitle}>All activity</h3>
        </div>
        <span className="ml-auto text-[11px] font-mono text-zinc-500">
          {activities.length} {activities.length === 1 ? "event" : "events"}
        </span>
      </div>

      <div className="space-y-5">
        {grouped.map((g) => (
          <section key={g.label}>
            <p className={`${eyebrow} mb-2`}>{g.label}</p>
            <ul className="space-y-0 border border-white/[0.04] rounded-lg overflow-hidden">
              {g.items.map((a) => {
                const Icon = ACTIVITY_ICON[a.type] ?? FileText;
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 px-3 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="mt-0.5 p-1.5 rounded-md bg-white/[0.04] border border-white/[0.05] shrink-0">
                      <Icon className="h-3 w-3 text-zinc-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12.5px] font-semibold text-zinc-100 truncate">
                          {a.title ?? a.type[0].toUpperCase() + a.type.slice(1)}
                        </p>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {new Date(a.happened_at).toLocaleTimeString(
                            undefined,
                            { hour: "numeric", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                      {a.body_md && (
                        <p className="text-[11.5px] text-zinc-400 mt-0.5 whitespace-pre-wrap leading-relaxed">
                          {a.body_md}
                        </p>
                      )}
                      {a.outcome && (
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mt-1">
                          {a.outcome}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// Day 13 enrichment cards — Top Deals / At-Risk / Win Rate
// ════════════════════════════════════════════

// ────────────────────────────────────────────────
// TopDealsCard — top 5 open deals by amount. The "what should I focus
// on closing?" view. Sorted descending; clamps to 5 so the card stays
// scannable. Each row gets a stage chip + days-in-stage stamp so the
// list reads at a glance.
// ────────────────────────────────────────────────
const TopDealsCard: React.FC<{ deals: CrmDeal[] }> = ({ deals }) => {
  const top = useMemo(() => {
    return deals
      .filter((d) => DEAL_OPEN_STAGES.includes(d.stage))
      .sort((a, b) => b.amount_cents - a.amount_cents)
      .slice(0, 5);
  }, [deals]);

  return (
    <div className={`col-span-12 lg:col-span-4 ${tile} p-5 flex flex-col`}>
      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <p className={eyebrow}>Top deals</p>
          <h3 className={serifTitle}>By value</h3>
        </div>
        <span className="ml-auto text-[11px] font-mono text-zinc-500">
          {top.length === 0 ? "—" : `top ${top.length}`}
        </span>
      </div>
      {top.length === 0 ? (
        <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600 py-6 text-center">
          No open deals yet
        </p>
      ) : (
        <ul className="space-y-0">
          {top.map((d) => {
            const days = Math.max(
              0,
              Math.floor(
                (Date.now() - Date.parse(d.updated_at ?? d.created_at)) /
                  86_400_000,
              ),
            );
            return (
              <li
                key={d.id}
                className="flex items-baseline gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
              >
                <span className="flex-1 text-[12.5px] text-zinc-100 truncate">
                  {d.name}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {d.stage}
                </span>
                <span className={`text-[12px] text-emerald-400 ${monoNum}`}>
                  {formatCrmAmount(d.amount_cents, d.currency, { compact: true })}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 w-8 text-right">
                  {days}d
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// AtRiskDealsCard — open deals that have been sitting untouched for 7+
// days. The implicit assumption is updated_at moves whenever an
// activity logs against the deal (because useLogActivity touches the
// deal row's updated_at downstream via realtime, AND inline drawer
// edits touch it), so it's a fair proxy for "no one's done anything
// here in a while."
// ────────────────────────────────────────────────
const AtRiskDealsCard: React.FC<{ deals: CrmDeal[] }> = ({ deals }) => {
  const stale = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return deals
      .filter((d) => {
        if (!DEAL_OPEN_STAGES.includes(d.stage)) return false;
        const t = Date.parse(d.updated_at ?? d.created_at);
        return !isNaN(t) && t < cutoff;
      })
      .sort((a, b) => b.amount_cents - a.amount_cents)
      .slice(0, 5);
  }, [deals]);

  return (
    <div className={`col-span-12 lg:col-span-4 ${tile} p-5 flex flex-col`}>
      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <p className={eyebrow}>At risk</p>
          <h3 className={serifTitle}>Silent 7d+</h3>
        </div>
        <span className={`ml-auto text-[11px] font-mono ${stale.length > 0 ? "text-amber-400/80" : "text-zinc-500"}`}>
          {stale.length === 0 ? "all warm" : `${stale.length} stale`}
        </span>
      </div>
      {stale.length === 0 ? (
        <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600 py-6 text-center">
          No deals going cold
        </p>
      ) : (
        <ul className="space-y-0">
          {stale.map((d) => {
            const days = Math.floor(
              (Date.now() - Date.parse(d.updated_at ?? d.created_at)) /
                86_400_000,
            );
            return (
              <li
                key={d.id}
                className="flex items-baseline gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
              >
                <span className="flex-1 text-[12.5px] text-zinc-100 truncate">
                  {d.name}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {d.stage}
                </span>
                <span className={`text-[11px] text-amber-400/80 ${monoNum}`}>
                  {days}d
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// WinRateBySourceCard — groups won + lost deals by their source,
// renders win % as a horizontal bar. Sources with under 2 closed
// deals are bucketed into "Other" so a single-deal source can't
// claim "100% win rate".
// ────────────────────────────────────────────────
const WinRateBySourceCard: React.FC<{ deals: CrmDeal[] }> = ({ deals }) => {
  const rows = useMemo(() => {
    const buckets = new Map<string, { won: number; lost: number }>();
    for (const d of deals) {
      if (d.stage !== "won" && d.stage !== "lost") continue;
      const key = (d.source ?? "unspecified").toLowerCase();
      const row = buckets.get(key) ?? { won: 0, lost: 0 };
      if (d.stage === "won") row.won += 1; else row.lost += 1;
      buckets.set(key, row);
    }
    const all = Array.from(buckets.entries()).map(([source, v]) => ({
      source,
      total: v.won + v.lost,
      won: v.won,
      winPct: v.won + v.lost > 0 ? Math.round((v.won / (v.won + v.lost)) * 100) : 0,
    }));
    // Sources with under 2 deals → "Other" to dampen noise.
    const named = all.filter((r) => r.total >= 2);
    const otherDeals = all.filter((r) => r.total < 2);
    if (otherDeals.length > 0) {
      const won = otherDeals.reduce((s, r) => s + r.won, 0);
      const total = otherDeals.reduce((s, r) => s + r.total, 0);
      named.push({
        source: "other",
        total,
        won,
        winPct: total > 0 ? Math.round((won / total) * 100) : 0,
      });
    }
    return named.sort((a, b) => b.total - a.total).slice(0, 5);
  }, [deals]);

  return (
    <div className={`col-span-12 lg:col-span-4 ${tile} p-5 flex flex-col`}>
      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <p className={eyebrow}>Win rate</p>
          <h3 className={serifTitle}>By source</h3>
        </div>
        <span className="ml-auto text-[11px] font-mono text-zinc-500">
          {rows.reduce((s, r) => s + r.total, 0)} closed
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600 py-6 text-center">
          Close some deals to see win rate
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.source}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-400">
                  {r.source}
                  <span className="text-zinc-700 ml-1.5">{r.total}</span>
                </p>
                <span className={`text-[12px] ${monoNum} ${r.winPct >= 50 ? "text-emerald-400" : "text-zinc-300"}`}>
                  {r.winPct}%
                </span>
              </div>
              <div className="h-2 rounded-sm bg-white/[0.03] overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all duration-300 ${r.winPct >= 50 ? "bg-emerald-500/70" : "bg-zinc-700/70"}`}
                  style={{ width: `${Math.max(r.winPct, r.total > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// PlaceholderTab — used by the four upcoming tabs so the route shell
// is fully clickable end-to-end even though only the dashboard slice
// has real data wired up. Editorial-styled so it doesn't look like a
// broken page.
// ────────────────────────────────────────────────
const PlaceholderTab: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => (
  <div className={`${tile} p-12 flex flex-col items-center justify-center text-center gap-3 min-h-[420px]`}>
    <div className="p-3 rounded-full bg-primary/[0.07] border border-primary/15">
      <Sparkles className="h-5 w-5 text-primary/80" />
    </div>
    <div>
      <p className={`${eyebrow}`}>Coming soon</p>
      <h3 className="ed-serif text-[24px] mt-1 text-zinc-100">{title}</h3>
      <p className="text-[12px] text-muted-foreground/70 mt-2 max-w-md">
        {subtitle}
      </p>
    </div>
  </div>
);

export default SalesPage;
