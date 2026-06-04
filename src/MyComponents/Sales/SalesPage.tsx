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

import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import {
  useCrmContacts,
  useCrmDeals,
  useCrmCompanies,
  useRecentActivities,
  useCrmRealtime,
  weightedForecastCents,
  bookedRevenueCents,
  formatCrmAmount,
  DEAL_OPEN_STAGES,
  type CrmDeal,
} from "@/stores/crm";
import { useQueryClient } from "@tanstack/react-query";

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
] as const;

export const SalesPage: React.FC = () => {
  // Realtime subscription mounts once for the whole /sales surface.
  useCrmRealtime();

  const qc = useQueryClient();
  const [tab, setTab] = useState<typeof SALES_TABS[number]["value"]>("dashboard");

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
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300 text-[10px] font-mono uppercase tracking-[0.16em]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              </span>
              Live · CRM
            </div>
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
                hasData={hasData}
              />
            </TabsContent>

            <TabsContent value="pipeline">
              <PlaceholderTab
                title="Pipeline"
                subtitle="Drag-drop kanban — ships Day 5–6"
              />
            </TabsContent>

            <TabsContent value="contacts">
              <PlaceholderTab
                title="Contacts"
                subtitle="Searchable list + lifecycle filters — ships Day 8"
              />
            </TabsContent>

            <TabsContent value="companies">
              <PlaceholderTab
                title="Companies"
                subtitle="Account list + auto-attribution from email domain — ships Day 9"
              />
            </TabsContent>

            <TabsContent value="activity">
              <PlaceholderTab
                title="Activity"
                subtitle="Cross-entity timeline + composer — ships Day 10"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Dashboard tab — KPI strip + (placeholder) pipeline-by-stage chart
// + (placeholder) recent activity feed. Day 4 fills these in.
// ────────────────────────────────────────────────
const DashboardTab: React.FC<{
  kpis: ReturnType<typeof useDerivedKpis>;
  deals: CrmDeal[];
  hasData: boolean;
}> = ({ kpis, hasData }) => {
  return (
    <div className="grid grid-cols-12 gap-3.5">
      {/* KPI strip — 6 compact tiles (col-2 each = 12) */}
      <KpiTile label="Pipeline" value={formatCrmAmount(kpis.pipelineCents, "usd", { compact: true })} sub="weighted forecast" accent />
      <KpiTile label="Won · MTD" value={formatCrmAmount(kpis.bookedThisMonthCents, "usd", { compact: true })} sub="closed-won this month" />
      <KpiTile label="Open deals" value={String(kpis.openDeals)} sub={`${kpis.contactCount > 0 ? Math.round((kpis.openDeals / Math.max(kpis.contactCount, 1)) * 100) : 0}% of contacts`} />
      <KpiTile label="Customers" value={String(kpis.customerCount)} sub={`of ${kpis.contactCount} contacts`} />
      <KpiTile label="New · 7d" value={String(kpis.leadsThisWeek)} sub="new leads this week" />
      <KpiTile label="Companies" value={String(kpis.companyCount)} sub="accounts tracked" />

      {/* Pipeline-by-stage + activity placeholder row — wires Day 4 */}
      <div className={`col-span-12 lg:col-span-8 ${tile} p-5`}>
        <p className={eyebrow}>Pipeline</p>
        <h3 className={serifTitle}>By stage</h3>
        <div className="h-56 flex items-center justify-center mt-4">
          <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
            {hasData ? "Day 4 — wire pipeline-by-stage chart" : "Pipeline chart appears once you add deals"}
          </p>
        </div>
      </div>

      <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
        <p className={eyebrow}>Recent activity</p>
        <h3 className={serifTitle}>Latest touchpoints</h3>
        <div className="h-56 flex items-center justify-center mt-4">
          <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
            {hasData ? "Day 4 — wire activity feed" : "Log activities to populate this feed"}
          </p>
        </div>
      </div>
    </div>
  );
};

// Re-derived inside the tab so TypeScript can infer the shape for the
// prop type up above (avoids needing to export an extra interface).
function useDerivedKpis() {
  return {
    contactCount: 0,
    customerCount: 0,
    leadsThisWeek: 0,
    companyCount: 0,
    openDeals: 0,
    pipelineCents: 0,
    bookedThisMonthCents: 0,
  };
}

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
