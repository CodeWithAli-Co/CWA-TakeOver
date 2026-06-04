/**
 * financialDashboard.lazy.tsx — Top-level financial dashboard page.
 *
 * Multi-tab portfolio management view for CodeWithAli + Simplicity.
 *
 * Tabs:
 *   1. Overview   — Bento dashboard: metrics + revenue/expense charts + transactions
 *   2. Companies  — Side-by-side comparison (red=CWA, blue=Simplicity)
 *   3. Cash Flow  — Burn rate, runway gauge, monthly trend, date range selector
 *   4. Reports    — Filterable invoice export + downloadable summaries
 *
 * Modeler section (collapsible) is always visible at the bottom.
 * Wraps the entire page in <FinancialProvider> so modeler/projections work.
 */

import React, { useState, useEffect, useMemo } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  RefreshCcw, TrendingUp, TrendingDown, DollarSign, Wallet,
  CreditCard, Receipt, Activity,
  BarChart3, Building2, FileBarChart, Download,
  Flame, Gauge, AlertTriangle, Sparkles,
} from "lucide-react";
import { AllInvoices, InvoiceType } from "@/stores/invoiceQuery";
import { takeOversupabase } from "@/MyComponents/supabase";
import { FinancialProvider } from "@/MyComponents/Financial/FinancialContext";
import ModelerBentoView from "@/MyComponents/Financial/ModelerBentoView";
import { EXPENSE_COLORS, REVENUE_COLORS } from "@/stores/FinancialConstants";
import { useStripeDashboard } from "@/lib/useStripeDashboard";
import { formatStripeAmount } from "@/lib/stripe";
import { Plug, Users } from "lucide-react";

// ════════════════════════════════════════════
// Shared utilities
// ════════════════════════════════════════════

// Aggregate invoice data into monthly buckets
function aggregateMonthly(invoices: InvoiceType[], months = 6) {
  const buckets: Record<string, { revenue: number; count: number; pending: number }> = {};
  invoices.forEach((inv) => {
    const date = new Date(inv.creation_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets[key]) buckets[key] = { revenue: 0, count: 0, pending: 0 };
    if (inv.status === "paid") {
      buckets[key].revenue += Number(inv.outcome) || 0;
    } else {
      buckets[key].pending += Number(inv.outcome) || 0;
    }
    buckets[key].count += 1;
  });

  return Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([key, val]) => ({
      month: new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      revenue: Math.round(val.revenue),
      pending: Math.round(val.pending),
      count: val.count,
    }));
}

// ════════════════════════════════════════════
// Reusable cell components
// ════════════════════════════════════════════

const MetricCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: { value: number; positive: boolean };
  borderRight?: boolean;
  accent?: "red" | "blue";
}> = ({ icon, label, value, trend, borderRight = true, accent = "red" }) => {
  const accentBar = accent === "blue" ? "bg-blue-500/40" : "bg-primary/40";
  const accentColor = accent === "blue" ? "text-blue-500/60" : "text-primary/60";

  return (
    <div className={`flex-1 px-5 py-4 ${borderRight ? "border-r border-border" : ""} relative`}>
      <div className={`absolute left-0 top-3 bottom-3 w-[2px] ${accentBar}`} />
      <div className="flex items-center gap-1.5 mb-2">
        <span className={accentColor}>{icon}</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
        {trend && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${trend.positive ? "text-emerald-400/80" : "text-primary"}`}>
            {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// OVERVIEW TAB
// ════════════════════════════════════════════
// PERF: OverviewTab does a non-trivial amount of per-invoice aggregation and
// chart rendering. Without memoization, every sibling tab-switch on the
// parent's <Tabs> re-renders this tree (Tabs keep all TabsContent mounted).
// Wrapping the impl with React.memo means the heavy Recharts trees only
// re-render when one of the props actually changes reference.
type StripeBundle = ReturnType<typeof useStripeDashboard>;

const OverviewTabImpl: React.FC<{
  stripe: StripeBundle;
}> = ({ stripe }) => {
  const {
    connected,
    snapshot,
    timeseries,
    products,
    balance,
    recent,
    outstanding,
    customers,
    failed,
    payouts,
  } = stripe;

  // Empty state — user hasn't connected Stripe yet. Show the same
  // bento skeleton so the layout doesn't jump when they connect.
  if (!connected) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="col-span-1 lg:col-span-12 bg-card border border-border rounded-sm p-10 flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-sm bg-primary/[0.08] border border-primary/15">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">Connect Stripe to see live revenue</p>
            <p className="text-[12px] text-muted-foreground/70 mt-1">
              MRR, MTD revenue, outstanding invoices, and recent charges land here once you paste a restricted key in Settings → Connectors.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Derive ARR + WoW-style net activity deltas from the snapshot.
  const mrrCents = snapshot?.mrr_cents ?? 0;
  const arrCents = mrrCents * 12;
  const currency = snapshot?.currency ?? "usd";
  const activeSubs = snapshot?.active_subscriptions ?? 0;
  const newSubs = snapshot?.new_subscriptions_this_month ?? 0;
  const churnedSubs = snapshot?.churned_this_month ?? 0;
  const netSubDelta = newSubs - churnedSubs;

  // Chart data shapes for Recharts. The timeseries route already
  // hands us pre-bucketed { label, net_cents, charge_count } rows.
  const revenueSeries = (timeseries?.series ?? []).map((p) => ({
    month: p.label,
    revenue: p.net_cents / 100,
    count: p.charge_count,
  }));

  // Revenue-by-product pie — value in dollars for nicer tooltips.
  const productPie = (products?.items ?? []).map((p) => ({
    name: p.name,
    value: p.value_cents / 100,
  }));

  // New-customer counts. Bucket created_at into "last 30 days" and
  // the prior 30 days so the card can show a delta pill alongside
  // the headline count. Same pattern as the timeseries window
  // delta but for headcount instead of dollars.
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const customerItems = customers?.items ?? [];
  const newCustomersThisPeriod = customerItems.filter((c) => {
    const t = Date.parse(c.created_at);
    return now - t <= thirtyDaysMs;
  }).length;
  const newCustomersPriorPeriod = customerItems.filter((c) => {
    const t = Date.parse(c.created_at);
    const age = now - t;
    return age > thirtyDaysMs && age <= 2 * thirtyDaysMs;
  }).length;
  const newCustomersDelta = newCustomersThisPeriod - newCustomersPriorPeriod;
  const newCustomersDeltaPct = newCustomersPriorPeriod > 0
    ? (newCustomersDelta / newCustomersPriorPeriod) * 100
    : newCustomersThisPeriod > 0
      ? 100
      : 0;

  // Top customers by spend — server-side already sorted by LTV DESC.
  const topCustomers = customerItems.slice(0, 5);

  // Latest payout for the small inline summary at the top of Row 4.
  const latestPayout = payouts?.summary.last_payout ?? null;

  return (
    // ════════════════════════════════════════════
    // BENTO LAYOUT — 12-col grid with varied row splits so each tile earns
    // its real estate. Row heights are not forced, but h-full on each tile
    // keeps siblings within a row aligned.
    //
    //   Row 1 (12): KPI strip (single card, 5 metric cells)
    //   Row 2:      Invoice Revenue (8) · Invoice Volume (4)
    //   Row 3:      Revenue Sources (4) · Expense Breakdown (4) · Recent Transactions (4)
    // ════════════════════════════════════════════
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
      {/* ROW 1 — KPI strip: Stripe-driven financials.
          Bank → Stripe-side balance (available + pending).
          Revenue → MRR (the metric every SaaS investor opens with).
          Expenses → ARR (MRR × 12 — the demo-friendly forward number).
          Net Profit → Active Subs count + net delta this month.
          Invoice Growth → Outstanding invoices count + total. */}
      <div className="col-span-1 md:col-span-2 lg:col-span-12 bg-card border border-border rounded-sm overflow-hidden">
        <div className="flex">
          <MetricCell
            icon={<Wallet className="h-3 w-3" />}
            label="Stripe balance"
            value={formatStripeAmount(balance?.available_cents ?? 0, balance?.primary_currency ?? currency, { compact: true })}
            trend={
              balance && balance.pending_cents > 0
                ? { value: balance.pending_cents / 100, positive: true }
                : undefined
            }
          />
          <MetricCell
            icon={<TrendingUp className="h-3 w-3" />}
            label="MRR"
            value={formatStripeAmount(mrrCents, currency, { compact: true })}
          />
          <MetricCell
            icon={<DollarSign className="h-3 w-3" />}
            label="ARR"
            value={formatStripeAmount(arrCents, currency, { compact: true })}
          />
          <MetricCell
            icon={<Users className="h-3 w-3" />}
            label="Active subs"
            value={String(activeSubs)}
            trend={
              newSubs > 0 || churnedSubs > 0
                ? { value: netSubDelta, positive: netSubDelta >= 0 }
                : undefined
            }
          />
          <MetricCell
            icon={<Receipt className="h-3 w-3" />}
            label="Outstanding"
            value={formatStripeAmount(outstanding?.total_cents ?? 0, outstanding?.currency ?? currency, { compact: true })}
            trend={
              outstanding && outstanding.count > 0
                ? { value: outstanding.count, positive: false }
                : undefined
            }
            borderRight={false}
          />
        </div>
      </div>

      {/* ROW 2 — Net Revenue chart (8) + Charge Volume (4).
          Both feed off the same /api/stripe/timeseries result, so
          the network round-trip is shared. */}
      <div className="col-span-1 md:col-span-2 lg:col-span-8 bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Net revenue</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last {timeseries?.months ?? 6} months · paid minus refunds</p>
          </div>
          <span className="text-[18px] font-bold text-foreground">
            {formatStripeAmount(
              (timeseries?.series ?? []).reduce((s, p) => s + p.net_cents, 0),
              currency,
            )}
          </span>
        </div>
        <div className="h-56">
          {revenueSeries.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={revenueSeries}>
                <defs>
                  {/* Green for revenue — standard dashboard convention.
                      Red on a revenue chart reads as losses to anyone
                      glancing (especially investors). */}
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} tickFormatter={(v) => `$${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : Number(v)}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px", fontSize: "12px", color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[12px] text-muted-foreground/40">No revenue in this window yet</p></div>
          )}
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Charge volume</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last {timeseries?.months ?? 6} months · count</p>
          </div>
          <span className="text-[18px] font-bold text-foreground">
            {revenueSeries.reduce((s, p) => s + p.count, 0)}
          </span>
        </div>
        <div className="h-56">
          {revenueSeries.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px", fontSize: "12px", color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[12px] text-muted-foreground/40">No charge data yet</p></div>
          )}
        </div>
      </div>

      {/* ROW 3 — Revenue by Product (4) + Recent Transactions (4) + Outstanding (4) */}
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium mb-4">Revenue by product</p>
          {productPie.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={productPie} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={70} stroke="none">
                      {productPie.map((entry, i) => <Cell key={i} fill={REVENUE_COLORS[entry.name] || `hsl(${(i * 60) % 360} 65% 55%)`} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", fontSize: "12px" }} itemStyle={{ color: "#fff" }} formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 self-center">
                {productPie.slice(0, 6).map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: REVENUE_COLORS[r.name] || `hsl(${(i * 60) % 360} 65% 55%)` }} />
                      <span className="text-muted-foreground/70 truncate">{r.name}</span>
                    </div>
                    <span className="text-foreground/60 tabular-nums shrink-0 ml-2">${r.value >= 1000 ? `${(r.value / 1000).toFixed(1)}k` : r.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center"><p className="text-[12px] text-muted-foreground/40">No active subscriptions yet</p></div>
          )}
        </div>

      {/* Recent Transactions — Stripe charges, last 10. The CWA invoice
          table moved to the Reports tab as a customer-tracking surface. */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-sm bg-muted/40"><Receipt className="h-3.5 w-3.5 text-primary/70" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Recent transactions</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Last {recent?.count ?? 0} paid charges</p>
            </div>
          </div>
          <span className="text-[14px] font-bold text-foreground tabular-nums">
            {formatStripeAmount(
              (recent?.charges ?? []).reduce((s, c) => s + c.amount_cents, 0),
              recent?.charges[0]?.currency ?? currency,
            )}
          </span>
        </div>
        <div>
          {!recent || recent.charges.length === 0 ? (
            <div className="py-12 text-center"><p className="text-[13px] text-muted-foreground/40">No paid charges yet</p></div>
          ) : (
            recent.charges.slice(0, 5).map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white/80 truncate">
                    {ch.customer_name ?? ch.customer_email ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 truncate">
                    {ch.description ?? new Date(ch.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground/80 tabular-nums">
                    {formatStripeAmount(ch.amount_cents, ch.currency)}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15">
                    paid
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Outstanding Invoices — replaces Expense Breakdown. Top 5
          unpaid invoices ranked by amount × age, with a hero total. */}
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-sm bg-muted/40"><AlertTriangle className="h-3.5 w-3.5 text-primary/70" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Outstanding</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{outstanding?.count ?? 0} unpaid invoices</p>
            </div>
          </div>
          <span className="text-[14px] font-bold text-foreground tabular-nums">
            {formatStripeAmount(outstanding?.total_cents ?? 0, outstanding?.currency ?? currency)}
          </span>
        </div>
        <div>
          {!outstanding || outstanding.count === 0 ? (
            <div className="py-12 text-center"><p className="text-[13px] text-muted-foreground/40">All invoices paid · clean slate</p></div>
          ) : (
            outstanding.invoices.slice(0, 5).map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white/80 truncate">
                    {inv.customer_name ?? inv.customer_email ?? inv.number ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 truncate">
                    {inv.days_overdue > 0
                      ? `${inv.days_overdue} day${inv.days_overdue === 1 ? "" : "s"} overdue`
                      : `Due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "soon"}`}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground/80 tabular-nums">
                    {formatStripeAmount(inv.amount_due_cents, inv.currency)}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                    inv.days_overdue > 0
                      ? "bg-primary/[0.08] text-primary border-primary/15"
                      : "bg-amber-500/[0.08] text-amber-400 border-amber-500/15"
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ROW 4 — Failed Payments (4) + New Customers (4) + Top Customers by Spend (4).
          Three independent data slices, all stitched off the same hook fetch.
          Failed-payments callout is amber/red since it represents at-risk
          revenue; New Customers is green when growing; Top Customers is
          neutral chrome with revenue values on the right. */}
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-sm bg-muted/40"><AlertTriangle className="h-3.5 w-3.5 text-amber-500/80" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Failed payments</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {failed?.count ?? 0} in last 30 days
                {failed && failed.retryable_count > 0 ? ` · ${failed.retryable_count} retryable` : ""}
              </p>
            </div>
          </div>
          <span className="text-[14px] font-bold text-foreground tabular-nums">
            {formatStripeAmount(failed?.total_cents ?? 0, failed?.currency ?? currency)}
          </span>
        </div>
        <div>
          {!failed || failed.count === 0 ? (
            <div className="py-12 text-center"><p className="text-[13px] text-muted-foreground/40">No failed payments · clean</p></div>
          ) : (
            failed.items.slice(0, 5).map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground/80 truncate">
                    {f.customer_name ?? f.customer_email ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 truncate">
                    {f.failure_message ?? f.failure_code ?? "Payment failed"}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground/80 tabular-nums">
                    {formatStripeAmount(f.amount_cents, f.currency)}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                    f.retryable
                      ? "bg-amber-500/[0.08] text-amber-500 border-amber-500/15"
                      : "bg-primary/[0.08] text-primary border-primary/15"
                  }`}>
                    {f.retryable ? "retry" : "action"}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">New customers</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last 30 days</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-foreground tabular-nums">{newCustomersThisPeriod}</span>
            {(newCustomersThisPeriod > 0 || newCustomersPriorPeriod > 0) && (
              <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                newCustomersDelta >= 0 ? "text-emerald-500" : "text-primary"
              }`}>
                {newCustomersDelta >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {Math.abs(newCustomersDeltaPct).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mb-3">
          {newCustomersPriorPeriod} in previous 30 days
        </p>
        {/* Latest payout strip — the small "money actually hit the bank"
            anchor that complements the count card above it. */}
        {latestPayout && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em]">Latest payout</p>
              <p className="text-[12px] text-foreground/70 mt-0.5">
                {new Date(latestPayout.arrival_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {" · "}
                <span className={`text-[10px] uppercase ${
                  latestPayout.status === "paid" ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {latestPayout.status}
                </span>
              </p>
            </div>
            <span className="text-[16px] font-semibold text-foreground tabular-nums">
              {formatStripeAmount(latestPayout.amount_cents, latestPayout.currency)}
            </span>
          </div>
        )}
        {!latestPayout && payouts && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground/40">No payouts yet</p>
          </div>
        )}
      </div>

      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-sm bg-muted/40"><Users className="h-3.5 w-3.5 text-emerald-500/80" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Top customers by spend</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">All time · by LTV</p>
            </div>
          </div>
        </div>
        <div>
          {topCustomers.length === 0 ? (
            <div className="py-12 text-center"><p className="text-[13px] text-muted-foreground/40">No paying customers yet</p></div>
          ) : (
            topCustomers.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground/80 truncate">
                    {c.name ?? c.email ?? "Anonymous customer"}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 truncate">
                    {c.name && c.email ? c.email : c.mrr_cents > 0 ? `${formatStripeAmount(c.mrr_cents, c.currency)}/mo` : "One-time"}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-foreground tabular-nums shrink-0">
                  {formatStripeAmount(c.ltv_cents, c.currency)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Memoized export — renders only when props change reference, not on every
// parent tab-switch.
const OverviewTab = React.memo(OverviewTabImpl);

// ════════════════════════════════════════════
// COMPANIES TAB — side-by-side comparison
// ════════════════════════════════════════════
const CompaniesTab: React.FC<{
  totalRevenueFromCategories: number;
  expenseTotal: number;
  bankBalance: number;
  invoices: InvoiceType[];
}> = ({ totalRevenueFromCategories, expenseTotal, bankBalance, invoices }) => {
  // Heuristic split: distribute revenue/expenses by company
  // CWA gets 70% (more mature), Simplicity gets 30% (growing)
  // In future: filter by company_id when DB schema supports it
  const cwaShare = 0.7;
  const smpShare = 0.3;

  const cwa = {
    revenue: totalRevenueFromCategories * cwaShare,
    expenses: expenseTotal * cwaShare,
    bank: bankBalance * cwaShare,
    invoices: Math.round(invoices.length * cwaShare),
    color: "#ef4444",
    bgColor: "bg-primary/[0.06]",
    borderColor: "border-primary/15",
    textColor: "text-primary",
    accentBar: "bg-red-500",
  };
  const smp = {
    revenue: totalRevenueFromCategories * smpShare,
    expenses: expenseTotal * smpShare,
    bank: bankBalance * smpShare,
    invoices: Math.round(invoices.length * smpShare),
    color: "#3b82f6",
    bgColor: "bg-blue-500/[0.06]",
    borderColor: "border-blue-500/15",
    textColor: "text-blue-400",
    accentBar: "bg-blue-500",
  };

  const comparisonData = [
    { metric: "Revenue", CodeWithAli: cwa.revenue, Simplicity: smp.revenue },
    { metric: "Expenses", CodeWithAli: cwa.expenses, Simplicity: smp.expenses },
    { metric: "Bank", CodeWithAli: cwa.bank, Simplicity: smp.bank },
    { metric: "Profit", CodeWithAli: cwa.revenue - cwa.expenses, Simplicity: smp.revenue - smp.expenses },
  ];

  const CompanyCard: React.FC<{
    name: string;
    description: string;
    data: typeof cwa;
  }> = ({ name, description, data }) => {
    const profit = data.revenue - data.expenses;
    const profitPositive = profit >= 0;
    const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

    return (
      <div className="relative bg-card border border-border rounded-sm overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${data.accentBar}`} />
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-sm ${data.bgColor} border ${data.borderColor}`}>
                <Building2 className={`h-4 w-4 ${data.textColor}`} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">{name}</h3>
                <p className="text-[11px] text-muted-foreground/50">{description}</p>
              </div>
            </div>
          </div>

          {/* Big numbers */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Revenue</p>
              <p className={`text-3xl font-bold tracking-tight ${data.textColor}`}>${data.revenue.toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-sm p-3">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Expenses</p>
                <p className="text-lg font-bold text-foreground/80 tracking-tight mt-1">${data.expenses.toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-sm p-3">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Bank</p>
                <p className="text-lg font-bold text-foreground/80 tracking-tight mt-1">${data.bank.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Profit + margin */}
          <div className={`p-4 rounded-sm border ${profitPositive ? "bg-emerald-500/[0.04] border-emerald-500/10" : "bg-red-500/[0.04] border-red-500/10"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Net Profit</span>
              <span className={`text-[11px] font-medium ${profitPositive ? "text-emerald-400" : "text-primary"}`}>
                {margin.toFixed(1)}% margin
              </span>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${profitPositive ? "text-emerald-400" : "text-primary"}`}>
              {profitPositive ? "+" : ""}${profit.toLocaleString()}
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Invoices</p>
              <p className="text-base font-semibold text-foreground/70 mt-0.5">{data.invoices}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Avg Invoice</p>
              <p className="text-base font-semibold text-foreground/70 mt-0.5">${data.invoices > 0 ? Math.round(data.revenue / data.invoices).toLocaleString() : "0"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Note about heuristic */}
      <div className="bg-amber-500/[0.04] border border-amber-500/10 rounded-sm px-4 py-2.5 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400/70 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-400/70">
          Per-company breakdown uses an estimated 70/30 split until the database schema includes a <code className="text-amber-400/90">company_id</code> column on revenue and expense tables.
        </p>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompanyCard name="CodeWithAli" description="Software agency & media" data={cwa} />
        <CompanyCard name="Simplicity" description="Fintech budgeting platform" data={smp} />
      </div>

      {/* Comparison chart */}
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Side-by-Side Comparison</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Annual financial metrics</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground/70">CodeWithAli</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground/70">Simplicity</span>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", fontSize: "12px" }} itemStyle={{ color: "#fff" }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]} />
              <Bar dataKey="CodeWithAli" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={28} />
              <Bar dataKey="Simplicity" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// CASH FLOW TAB — burn rate, runway gauge, monthly trend
// ════════════════════════════════════════════
const CashFlowTab: React.FC<{
  bankBalance: number;
  expenseTotal: number;
  totalRevenueFromCategories: number;
  invoices: InvoiceType[];
}> = ({ bankBalance, expenseTotal, totalRevenueFromCategories, invoices }) => {
  // Burn rate = monthly expenses
  const monthlyBurn = expenseTotal / 12;
  // Runway in months
  const runwayMonths = monthlyBurn > 0 ? bankBalance / monthlyBurn : 0;
  // Runway color: red if <3, amber if <6, emerald if more
  const runwayColor = runwayMonths < 3 ? "#ef4444" : runwayMonths < 6 ? "#f59e0b" : "#10b981";
  const runwayLabel = runwayMonths < 3 ? "Critical" : runwayMonths < 6 ? "Caution" : "Healthy";

  // Gauge data (max 24 months for the chart visualization)
  const gaugeMax = 24;
  const gaugeData = [
    { name: "Runway", value: Math.min(runwayMonths, gaugeMax), fill: runwayColor },
  ];

  const monthly = aggregateMonthly(invoices, 6);

  return (
    <div className="space-y-4">
      {/* Top row: Runway gauge + Burn metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Runway gauge */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="h-4 w-4 text-primary/70" />
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Runway</p>
          </div>
          <div className="h-44 relative">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
                <RadialBar background={{ fill: "rgba(255,255,255,0.04)" }} dataKey="value" cornerRadius={4} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mb-8">
              <p className="text-3xl font-bold text-foreground tracking-tight">{runwayMonths.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">months</p>
              <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: runwayColor }}>{runwayLabel}</p>
            </div>
          </div>
        </div>

        {/* Burn rate */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-primary/70" />
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Burn Rate</p>
          </div>
          <p className="text-3xl font-bold text-primary tracking-tight">${monthlyBurn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-muted-foreground mt-1">per month</p>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Daily</span>
              <span className="text-foreground/70">${(monthlyBurn / 30).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Quarterly</span>
              <span className="text-foreground/70">${(monthlyBurn * 3).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Annual</span>
              <span className="text-foreground/70">${expenseTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Profitability */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary/70" />
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Income vs Burn</p>
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">${(totalRevenueFromCategories / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-muted-foreground mt-1">monthly revenue</p>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Net monthly</span>
              <span className={(totalRevenueFromCategories - expenseTotal) >= 0 ? "text-emerald-400" : "text-primary"}>
                ${((totalRevenueFromCategories - expenseTotal) / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Coverage</span>
              <span className="text-foreground/70">
                {monthlyBurn > 0 ? `${((totalRevenueFromCategories / 12) / monthlyBurn * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly cash flow chart */}
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Cash Flow Trend</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last 6 months — paid invoices vs estimated burn</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={monthly.map(m => ({ ...m, burn: Math.round(monthlyBurn) }))}>
              <defs>
                <linearGradient id="cfRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cfBurn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", fontSize: "12px" }} itemStyle={{ color: "#fff" }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]} />
              <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={2} fill="url(#cfRev)" name="Revenue" />
              <Area type="monotone" dataKey="burn" stroke="rgba(255,255,255,0.4)" strokeWidth={2} fill="url(#cfBurn)" name="Burn" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// REPORTS TAB — filterable invoice list + export
// ════════════════════════════════════════════
const ReportsTab: React.FC<{ invoices: InvoiceType[] }> = ({ invoices }) => {
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchSearch = !searchQuery ||
      inv.invoice_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const paidCount = invoices.filter(i => i.status === "paid").length;
  const pendingCount = invoices.filter(i => i.status === "pending").length;

  const exportCSV = () => {
    const rows = [
      ["Invoice ID", "Title", "Client", "Email", "Date", "Amount", "Status"],
      ...filtered.map(inv => [
        inv.invoice_id,
        inv.invoice_title,
        inv.client_name,
        inv.client_email,
        new Date(inv.creation_date).toLocaleDateString(),
        inv.outcome,
        inv.status,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters + export */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-sm p-0.5">
            {(["all", "paid", "pending"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all ${
                  statusFilter === s
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/50 hover:text-muted-foreground/70"
                }`}
              >
                {s === "all" ? `All (${invoices.length})` : s === "paid" ? `Paid (${paidCount})` : `Pending (${pendingCount})`}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by title or client..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/60 placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/[0.08] hover:bg-red-500/[0.12] border border-primary/15 text-primary text-[11px] rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Showing</p>
          <p className="text-2xl font-bold text-foreground tracking-tight mt-1">{filtered.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">of {invoices.length} invoices</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Total Value</p>
          <p className="text-2xl font-bold text-primary tracking-tight mt-1">${filtered.reduce((s, i) => s + Number(i.outcome), 0).toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Avg Invoice</p>
          <p className="text-2xl font-bold text-foreground tracking-tight mt-1">${filtered.length > 0 ? Math.round(filtered.reduce((s, i) => s + Number(i.outcome), 0) / filtered.length).toLocaleString() : "0"}</p>
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-border text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em]">
          <span>Invoice</span><span>Client</span><span>Date</span><span className="text-right">Amount</span><span className="text-right">Status</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center"><p className="text-[13px] text-muted-foreground/40">No invoices match your filters</p></div>
          ) : (
            filtered.map((inv) => (
              <div key={inv.invoice_id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 items-center px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-card transition-colors">
                <span className="text-[13px] font-medium text-white/75 truncate">{inv.invoice_title}</span>
                <span className="text-[12px] text-muted-foreground/70 truncate">{inv.client_name}</span>
                <span className="text-[11px] text-muted-foreground">{new Date(inv.creation_date).toLocaleDateString()}</span>
                <span className="text-[13px] font-medium text-right text-foreground/80">${Number(inv.outcome).toFixed(2)}</span>
                <div className="flex justify-end">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${inv.status === "paid" ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15" : "bg-primary/[0.08] text-primary border-primary/15"}`}>{inv.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════
const FinancialDashboardContent: React.FC = () => {
  const { data: invoices = [], isLoading, refetch } = AllInvoices();
  const stripe = useStripeDashboard();
  const [bankBalance, setBankBalance] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [revenueByCategory, setRevenueByCategory] = useState<{ name: string; value: number }[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<{ name: string; value: number }[]>([]);
  const [tab, setTab] = useState("overview");

  // Load Supabase aggregates
  useEffect(() => {
    async function loadAggregates() {
      const [propsRes, expRes, revRes] = await Promise.all([
        takeOversupabase.from("cwa_calculatorProps").select("initialCapital").single(),
        takeOversupabase.from("cwa_expenses").select("amount, frequency, category"),
        takeOversupabase.from("cwa_revenues").select("amount, frequency, category, clients, revenueType"),
      ]);

      if (propsRes.data) setBankBalance(propsRes.data.initialCapital || 0);

      if (expRes.data) {
        const byCategory: Record<string, number> = {};
        let total = 0;
        expRes.data.forEach((e: any) => {
          let annual = e.amount;
          if (e.frequency === "monthly") annual *= 12;
          else if (e.frequency === "quarterly") annual *= 4;
          const cat = e.category || "Other";
          byCategory[cat] = (byCategory[cat] || 0) + annual;
          total += annual;
        });
        setExpenseTotal(total);
        setExpenseByCategory(Object.entries(byCategory).map(([name, value]) => ({ name, value })));
      }

      if (revRes.data) {
        const byCategory: Record<string, number> = {};
        revRes.data.forEach((r: any) => {
          let annual = r.amount;
          if (r.frequency === "monthly") annual *= 12;
          else if (r.frequency === "quarterly") annual *= 4;
          if (r.revenueType === "subscription" || r.revenueType === "recurring") {
            annual *= r.clients || 1;
          }
          const cat = r.category || "Other";
          byCategory[cat] = (byCategory[cat] || 0) + annual;
        });
        setRevenueByCategory(Object.entries(byCategory).map(([name, value]) => ({ name, value })));
      }
    }
    loadAggregates();
  }, []);

  const totalRevenueFromCategories = revenueByCategory.reduce((s, r) => s + r.value, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-[12px] text-muted-foreground">Loading financial data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto transition-colors duration-500">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-foreground tracking-tight">Finance</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-0.5">Portfolio overview across CodeWithAli & Simplicity</p>
            </div>
          </div>
          <button
            onClick={() => {
              refetch();
              void stripe.refetchAll();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 hover:bg-primary/[0.06] border border-border hover:border-primary/15 text-muted-foreground hover:text-primary rounded-sm text-[12px] transition-colors"
          >
            <RefreshCcw className={`h-3 w-3 ${stripe.loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Top-level tabs */}
      <div className="px-8 pt-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/30 border border-border rounded-sm h-9 p-0.5">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground rounded-sm text-[12px] h-7 px-4">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="companies" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground rounded-sm text-[12px] h-7 px-4">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Companies
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground rounded-sm text-[12px] h-7 px-4">
              <Flame className="h-3.5 w-3.5 mr-1.5" /> Cash Flow
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground rounded-sm text-[12px] h-7 px-4">
              <FileBarChart className="h-3.5 w-3.5 mr-1.5" /> Reports
            </TabsTrigger>
            <TabsTrigger value="modeler" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground rounded-sm text-[12px] h-7 px-4">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Modeler
            </TabsTrigger>
          </TabsList>

          <div className="pt-4 pb-10 space-y-4">
            <TabsContent value="overview">
              <OverviewTab stripe={stripe} />
            </TabsContent>

            <TabsContent value="companies">
              <CompaniesTab
                totalRevenueFromCategories={totalRevenueFromCategories}
                expenseTotal={expenseTotal}
                bankBalance={bankBalance}
                invoices={invoices}
              />
            </TabsContent>

            <TabsContent value="cashflow">
              <CashFlowTab
                bankBalance={bankBalance}
                expenseTotal={expenseTotal}
                totalRevenueFromCategories={totalRevenueFromCategories}
                invoices={invoices}
              />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsTab invoices={invoices} />
            </TabsContent>

            {/* Scenario modeler lives in its own tab and is rendered as a
                true bento grid — config inputs, KPI strip, charts, and
                category breakdowns are all separate tiles instead of the
                two giant stacked cards the old FinancialModeler +
                FinancialProjections produced. */}
            <TabsContent value="modeler">
              <ModelerBentoView />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

const FinancialDashboard: React.FC = () => (
  <FinancialProvider>
    <FinancialDashboardContent />
  </FinancialProvider>
);

export const Route = createLazyFileRoute("/financialDashboard")({
  component: FinancialDashboard,
});
