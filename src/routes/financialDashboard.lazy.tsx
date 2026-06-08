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
import { companySupabase } from "@/routes/index.lazy";
import { FinancialProvider } from "@/MyComponents/Financial/FinancialContext";
import ModelerBentoView from "@/MyComponents/Financial/ModelerBentoView";
import { EXPENSE_COLORS, REVENUE_COLORS } from "@/stores/FinancialConstants";
import { useStripeDashboard } from "@/lib/useStripeDashboard";
import { formatStripeAmount, type CustomerStatus } from "@/lib/stripe";
import {
  Plug, Users, Search, ArrowDownUp, Banknote, Calendar, Tag,
  CheckCircle, XCircle, Clock, ArrowDownToLine, Crown, Mail,
} from "lucide-react";

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

  // Shared editorial chrome — kept in sync with CustomersTab so both
  // tabs read as one design system. Same gradient surface, hairline
  // border, mono eyebrows, Newsreader serif titles, mono numerics.
  const tile = "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
  const eyebrow = "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
  const serifTitle = "ed-serif text-[20px] mt-1.5 text-zinc-100";
  const monoNum = "font-mono tabular-nums";

  if (!connected) return <StripeEmptyState />;

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
    // EDITORIAL BENTO — same chrome + density as the Customers tab.
    //
    //   Row 1: 6 compact KPI tiles (col-2 each = 12)
    //   Row 2: Net revenue area chart (8×2) + Revenue mix (4) + Charge volume (4)
    //   Row 3: Recent transactions (6) + Outstanding invoices (6)
    //   Row 4: Failed payments (6) + Top customers (6)
    // ════════════════════════════════════════════
    <div className="grid grid-cols-12 gap-3.5">
      {/* ── KPI strip (6 compact tiles at col-2 each = 12) ─── */}
      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={eyebrow}>Stripe balance</p>
        <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
          {formatStripeAmount(balance?.available_cents ?? 0, balance?.primary_currency ?? currency, { compact: true })}
        </div>
        {balance && balance.pending_cents > 0 && (
          <div className="text-[10px] font-mono text-zinc-500 leading-none">
            + {formatStripeAmount(balance.pending_cents, balance.primary_currency ?? currency, { compact: true })} pending
          </div>
        )}
      </div>

      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={eyebrow}>MRR</p>
        <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
          {formatStripeAmount(mrrCents, currency, { compact: true })}
        </div>
      </div>

      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={eyebrow}>ARR</p>
        <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
          {formatStripeAmount(arrCents, currency, { compact: true })}
        </div>
      </div>

      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={`${eyebrow} flex items-center gap-2`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          Active subs
        </p>
        <div className={`text-[20px] font-medium tracking-tight leading-none text-emerald-400 ${monoNum}`}>
          {activeSubs}
        </div>
        {(newSubs > 0 || churnedSubs > 0) && (
          <div className={`text-[10px] font-mono leading-none ${netSubDelta >= 0 ? "text-emerald-400/70" : "text-amber-400/70"}`}>
            {netSubDelta >= 0 ? "+" : ""}{netSubDelta} this month
          </div>
        )}
      </div>

      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={eyebrow}>Outstanding</p>
        <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
          {formatStripeAmount(outstanding?.total_cents ?? 0, outstanding?.currency ?? currency, { compact: true })}
        </div>
        {outstanding && outstanding.count > 0 && (
          <div className="text-[10px] font-mono text-zinc-500 leading-none">
            {outstanding.count} unpaid
          </div>
        )}
      </div>

      <div className={`col-span-6 sm:col-span-4 lg:col-span-2 ${tile} p-4 flex flex-col gap-1.5`}>
        <p className={eyebrow}>Failed · 30d</p>
        <div className={`text-[20px] font-medium tracking-tight leading-none ${failed && failed.count > 0 ? "text-amber-400" : "text-zinc-100"} ${monoNum}`}>
          {formatStripeAmount(failed?.total_cents ?? 0, failed?.currency ?? currency, { compact: true })}
        </div>
        {failed && failed.count > 0 && (
          <div className="text-[10px] font-mono text-zinc-500 leading-none">
            {failed.count} · {failed.retryable_count} retryable
          </div>
        )}
      </div>

      {/* ── Net revenue area chart (8 cols × 2 rows) ──────── */}
      <div className={`col-span-12 lg:col-span-8 lg:row-span-2 ${tile} p-5 flex flex-col`}>
        <div className="flex items-baseline gap-3 mb-4">
          <div>
            <p className={eyebrow}>Net revenue</p>
            <h3 className={serifTitle}>Last {timeseries?.months ?? 6} months</h3>
          </div>
          <span className={`ml-auto text-[18px] text-zinc-100 ${monoNum}`}>
            {formatStripeAmount(
              (timeseries?.series ?? []).reduce((s, p) => s + p.net_cents, 0),
              currency,
            )}
          </span>
        </div>
        <div className="flex-1 min-h-[260px]">
          {revenueSeries.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="overviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "ui-monospace, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "ui-monospace, monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : Number(v)}`} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} itemStyle={{ color: "#fafafa" }} formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#3ecf8e" strokeWidth={1.5} fill="url(#overviewRevGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No revenue in window</p></div>
          )}
        </div>
      </div>

      {/* ── Revenue mix pie (4 cols, top of right column) ──── */}
      <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
        <p className={eyebrow}>Revenue mix</p>
        <h3 className={serifTitle}>By product</h3>
        {productPie.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={productPie} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={56} stroke="none">
                    {productPie.map((entry, i) => <Cell key={i} fill={REVENUE_COLORS[entry.name] || `hsl(${(i * 60) % 360} 65% 55%)`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 self-center">
              {productPie.slice(0, 5).map((r, i) => (
                <div key={r.name} className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: REVENUE_COLORS[r.name] || `hsl(${(i * 60) % 360} 65% 55%)` }} />
                    <span className="text-zinc-400 truncate">{r.name}</span>
                  </div>
                  <span className={`text-zinc-300 shrink-0 ml-2 ${monoNum}`}>${r.value >= 1000 ? `${(r.value / 1000).toFixed(1)}k` : r.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center mt-4"><p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No active subs</p></div>
        )}
      </div>

      {/* ── Charge volume bar chart (4 cols, bottom of right) ──── */}
      <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
        <div className="flex items-baseline gap-3">
          <div>
            <p className={eyebrow}>Volume</p>
            <h3 className={serifTitle}>Charges</h3>
          </div>
          <span className={`ml-auto text-[16px] text-zinc-100 ${monoNum}`}>
            {revenueSeries.reduce((s, p) => s + p.count, 0)}
          </span>
        </div>
        <div className="h-40 mt-4">
          {revenueSeries.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "ui-monospace, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "ui-monospace, monospace" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} />
                <Bar dataKey="count" fill="#3ecf8e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No charge data</p></div>
          )}
        </div>
      </div>

      {/* ── Recent transactions list (6 cols) ──────────────── */}
      <div className={`col-span-12 lg:col-span-6 ${tile} overflow-hidden flex flex-col`}>
        <div className="px-5 pt-5 flex items-baseline gap-3">
          <div>
            <p className={eyebrow}>Recent transactions</p>
            <h3 className={serifTitle}>Last {recent?.count ?? 0} charges</h3>
          </div>
          <span className={`ml-auto text-[14px] text-zinc-100 ${monoNum}`}>
            {formatStripeAmount(
              (recent?.charges ?? []).reduce((s, c) => s + c.amount_cents, 0),
              recent?.charges[0]?.currency ?? currency,
            )}
          </span>
        </div>
        <div className="mt-3">
          {!recent || recent.charges.length === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No paid charges yet</div>
          ) : (
            recent.charges.slice(0, 6).map((ch) => (
              <div key={ch.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
                    {ch.customer_name ?? ch.customer_email ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                    {ch.description ?? new Date(ch.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-[13.5px] font-medium text-zinc-100 ${monoNum}`}>
                    {formatStripeAmount(ch.amount_cents, ch.currency)}
                  </span>
                  <StatusPill kind="paid" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Outstanding invoices list (6 cols) ─────────────── */}
      <div className={`col-span-12 lg:col-span-6 ${tile} overflow-hidden flex flex-col`}>
        <div className="px-5 pt-5 flex items-baseline gap-3">
          <div>
            <p className={eyebrow}>Outstanding</p>
            <h3 className={serifTitle}>Unpaid invoices</h3>
          </div>
          <span className={`ml-auto text-[14px] text-zinc-100 ${monoNum}`}>
            {formatStripeAmount(outstanding?.total_cents ?? 0, outstanding?.currency ?? currency)}
          </span>
        </div>
        <div className="mt-3">
          {!outstanding || outstanding.count === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">All invoices paid · clean slate</div>
          ) : (
            outstanding.invoices.slice(0, 6).map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
                    {inv.customer_name ?? inv.customer_email ?? inv.number ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                    {inv.days_overdue > 0
                      ? `${inv.days_overdue} day${inv.days_overdue === 1 ? "" : "s"} overdue`
                      : `Due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "soon"}`}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-[13.5px] font-medium text-zinc-100 ${monoNum}`}>
                    {formatStripeAmount(inv.amount_due_cents, inv.currency)}
                  </span>
                  <StatusPill kind={inv.days_overdue > 0 ? "past_due" : "pending"} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Failed payments list (6 cols) ──────────────────── */}
      <div className={`col-span-12 lg:col-span-6 ${tile} overflow-hidden flex flex-col`}>
        <div className="px-5 pt-5 flex items-baseline gap-3">
          <div>
            <p className={eyebrow}>Failed payments</p>
            <h3 className={serifTitle}>Last 30 days</h3>
          </div>
          <span className={`ml-auto text-[14px] ${failed && failed.count > 0 ? "text-amber-400" : "text-zinc-100"} ${monoNum}`}>
            {formatStripeAmount(failed?.total_cents ?? 0, failed?.currency ?? currency)}
          </span>
        </div>
        <div className="mt-3">
          {!failed || failed.count === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No failed payments</div>
          ) : (
            failed.items.slice(0, 6).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
                    {f.customer_name ?? f.customer_email ?? "Anonymous"}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                    {f.failure_message ?? f.failure_code ?? "Payment failed"}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-[13.5px] font-medium text-zinc-100 ${monoNum}`}>
                    {formatStripeAmount(f.amount_cents, f.currency)}
                  </span>
                  <StatusPill kind={f.retryable ? "pending" : "failed"} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Top customers by LTV (6 cols) ──────────────────── */}
      <div className={`col-span-12 lg:col-span-6 ${tile} overflow-hidden flex flex-col`}>
        <div className="px-5 pt-5 flex items-baseline gap-3">
          <div>
            <p className={eyebrow}>Top customers</p>
            <h3 className={serifTitle}>By lifetime value</h3>
          </div>
          <span className="ml-auto text-[10px] font-mono text-zinc-500">
            {topCustomers.length} of {customerItems.length}
          </span>
        </div>
        <div className="mt-3">
          {topCustomers.length === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No paying customers yet</div>
          ) : (
            topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                <span className={`text-[10px] text-zinc-600 w-5 ${monoNum}`}>{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
                    {c.name ?? c.email ?? "Anonymous customer"}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                    {c.mrr_cents > 0 ? `${formatStripeAmount(c.mrr_cents, c.currency)}/mo` : "One-time"}
                  </div>
                </div>
                <span className={`text-[13.5px] font-medium text-zinc-100 shrink-0 ${monoNum}`}>
                  {formatStripeAmount(c.ltv_cents, c.currency)}
                </span>
              </div>
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
// Shared empty / not-connected state for Stripe-backed tabs.
// ════════════════════════════════════════════
const StripeEmptyState: React.FC<{ message?: string }> = ({
  message = "Connect Stripe to see live data",
}) => (
  <div className="bg-card border border-border rounded-sm p-10 flex flex-col items-center text-center gap-3">
    <div className="p-3 rounded-sm bg-primary/[0.08] border border-primary/15">
      <Plug className="h-5 w-5 text-primary" />
    </div>
    <p className="text-[13px] text-foreground">{message}</p>
    <p className="text-[11px] text-muted-foreground/70 max-w-md">
      Add a restricted key in Settings → Connectors. Once connected, this tab populates with your real Stripe data.
    </p>
  </div>
);

// ════════════════════════════════════════════
// CUSTOMERS TAB — full customer list w/ search, filter, sort.
// Replaces the old Companies tab.
// ════════════════════════════════════════════
const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  past_customer: "Past",
  one_time: "One-time",
  free: "Free",
};

const STATUS_PILL: Record<CustomerStatus, string> = {
  active: "bg-emerald-500/[0.08] text-emerald-500 border-emerald-500/15",
  past_customer: "bg-muted text-muted-foreground border-border",
  one_time: "bg-blue-500/[0.08] text-blue-500 border-blue-500/15",
  free: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
};

// SUB_STATUS_PILL is referenced by the combined view below; declaring it
// here means the dead-code SubscriptionsTab further down also still has
// it in scope for as long as we keep that component around.
const SUB_STATUS_PILL_INLINE: Record<string, string> = {
  active: "bg-emerald-500/[0.08] text-emerald-500 border-emerald-500/15",
  trialing: "bg-blue-500/[0.08] text-blue-500 border-blue-500/15",
  past_due: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
  unpaid: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
  paused: "bg-muted text-muted-foreground border-border",
  canceled: "bg-muted text-muted-foreground border-border",
  incomplete: "bg-primary/[0.08] text-primary border-primary/15",
  incomplete_expired: "bg-primary/[0.08] text-primary border-primary/15",
};

// Small status pill — dot + uppercase mono label, used across the
// bento for customer / sub / payout rows. Green = healthy, amber =
// attention, blue = non-recurring, zinc = terminal/neutral.
const StatusPill: React.FC<{ kind: string }> = ({ kind }) => {
  const map: Record<string, { wrap: string; dot: string; label: string }> = {
    active: { wrap: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20", dot: "bg-emerald-400", label: "Active" },
    past_customer: { wrap: "bg-amber-500/10 text-amber-300 border-amber-500/20", dot: "bg-amber-400", label: "Past" },
    past_due: { wrap: "bg-amber-500/10 text-amber-300 border-amber-500/20", dot: "bg-amber-400", label: "Past due" },
    canceled: { wrap: "bg-white/[0.04] text-zinc-500 border-white/[0.08]", dot: "bg-zinc-500", label: "Canceled" },
    one_time: { wrap: "bg-blue-500/10 text-blue-300 border-blue-500/20", dot: "bg-blue-400", label: "One-time" },
    free: { wrap: "bg-white/[0.04] text-zinc-500 border-white/[0.08]", dot: "bg-zinc-500", label: "Free" },
    paid: { wrap: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20", dot: "bg-emerald-400", label: "Paid" },
    trialing: { wrap: "bg-blue-500/10 text-blue-300 border-blue-500/20", dot: "bg-blue-400", label: "Trialing" },
    pending: { wrap: "bg-amber-500/10 text-amber-300 border-amber-500/20", dot: "bg-amber-400", label: "Pending" },
    in_transit: { wrap: "bg-blue-500/10 text-blue-300 border-blue-500/20", dot: "bg-blue-400", label: "In transit" },
    failed: { wrap: "bg-rose-500/10 text-rose-300 border-rose-500/20", dot: "bg-rose-400", label: "Failed" },
  };
  const s = map[kind] ?? { wrap: "bg-white/[0.04] text-zinc-500 border-white/[0.08]", dot: "bg-zinc-500", label: kind.replace("_", " ") };
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider rounded border ${s.wrap}`}>
      <span className={`h-1 w-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const CustomersTab: React.FC<{ stripe: StripeBundle }> = ({ stripe }) => {
  const { connected, customers, subscriptions, payouts } = stripe;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerStatus>("all");
  const [subStatusFilter, setSubStatusFilter] = useState<string>("all");

  const summary = customers?.summary;
  const subSummary = subscriptions?.summary;
  const allCustomers = customers?.items ?? [];
  const allSubs = subscriptions?.items ?? [];

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allCustomers;
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (q) {
      list = list.filter(
        (c) =>
          (c.name?.toLowerCase().includes(q) ?? false) ||
          (c.email?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [allCustomers, search, statusFilter]);

  const filteredSubs = useMemo(
    () => (subStatusFilter === "all" ? allSubs : allSubs.filter((s) => s.status === subStatusFilter)),
    [allSubs, subStatusFilter],
  );

  // Aggregate paid payouts into monthly buckets for the cadence chart.
  // Last 8 months, sorted oldest → newest. Failed/pending payouts
  // excluded so the chart reflects actual cash in.
  const chartData = useMemo(() => {
    if (!payouts) return [];
    const buckets = new Map<string, { month: string; label: string; v: number }>();
    for (const p of payouts.items) {
      if (p.status !== "paid") continue;
      const d = new Date(p.arrival_date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
      const existing = buckets.get(key) ?? { month: key, label, v: 0 };
      existing.v += p.amount_cents / 100;
      buckets.set(key, existing);
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-8);
  }, [payouts]);
  const peak = useMemo(() => Math.max(...chartData.map((c) => c.v), 1), [chartData]);

  // Tab definitions with live counts.
  const cTabs: Array<{ key: "all" | CustomerStatus; label: string; count: number }> = [
    { key: "all", label: "All", count: summary?.total ?? 0 },
    { key: "active", label: "Active", count: summary?.active ?? 0 },
    { key: "past_customer", label: "Past", count: summary?.past_customer ?? 0 },
    { key: "one_time", label: "One-time", count: summary?.one_time ?? 0 },
    { key: "free", label: "Free", count: summary?.free ?? 0 },
  ];
  const sTabs: Array<{ key: string; label: string; count: number }> = [
    { key: "all", label: "All", count: subSummary?.total ?? 0 },
    { key: "active", label: "Active", count: subSummary?.by_status?.active ?? 0 },
    { key: "trialing", label: "Trialing", count: subSummary?.by_status?.trialing ?? 0 },
    { key: "past_due", label: "Past due", count: subSummary?.by_status?.past_due ?? 0 },
    { key: "canceled", label: "Canceled", count: subSummary?.by_status?.canceled ?? 0 },
  ];

  // Suppress unused-warning on the vestigial selection state that the
  // previous master-detail used; keeping the var around lets a future
  // pass re-introduce row-click drill-down without rewiring data.
  const [, setSelectedCustomerId] = useState<string | null>(null);
  void setSelectedCustomerId;

  if (!connected) return <StripeEmptyState />;

  // Shared tile chrome — gradient surface + hairline border, used by
  // every cell of the bento so they all share the same depth.
  const tile = "bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/[0.07] rounded-xl hover:border-white/[0.13] transition-colors";
  const eyebrow = "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-medium";
  const serifTitle = "ed-serif text-[20px] mt-1.5 text-zinc-100";
  const monoNum = "font-mono tabular-nums";

  // KPI tiles share a layout — eyebrow on top, big mono number below.
  // Defined inline as data so the four payout KPIs can map cleanly.
  const payoutKpis = [
    { eyebrow: "YTD paid", v: formatStripeAmount(payouts?.summary.total_paid_ytd_cents ?? 0, payouts?.currency ?? "usd") },
    { eyebrow: "YTD payouts", v: String(payouts?.summary.count_ytd ?? 0) },
    { eyebrow: "Avg payout", v: formatStripeAmount(payouts?.summary.average_payout_cents ?? 0, payouts?.currency ?? "usd") },
    {
      eyebrow: "Last payout",
      v: payouts?.summary.last_payout
        ? formatStripeAmount(payouts.summary.last_payout.amount_cents, payouts.summary.last_payout.currency)
        : "—",
      sub: payouts?.summary.last_payout
        ? new Date(payouts.summary.last_payout.arrival_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : null,
    },
  ];

  return (
    <div className="space-y-3">
      {/* One-off serif font for tile titles. Loaded inline so this tab
          doesn't depend on a global font registration. */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&display=swap');.ed-serif{font-family:'Newsreader',Georgia,serif}`}</style>

      <div className="grid grid-cols-12 gap-3.5">
        {/* ── Customers directory (4 cols × 2 rows) ─────────── */}
        <div className={`col-span-12 lg:col-span-4 lg:row-span-2 ${tile} overflow-hidden flex flex-col`}>
          <div className="px-5 pt-5">
            <p className={eyebrow}>Directory</p>
            <h3 className={serifTitle}>Customers</h3>
          </div>
          <div className="flex mx-5 mt-3 border-b border-white/[0.07] flex-wrap">
            {cTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-2.5 py-2 text-[10.5px] font-mono uppercase tracking-wider transition-colors relative ${statusFilter === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {t.label}{" "}
                <span className={statusFilter === t.key ? "text-emerald-400 ml-1" : "text-zinc-700 ml-1"}>{t.count}</span>
                {statusFilter === t.key && <span className="absolute -bottom-px left-2.5 right-2.5 h-0.5 bg-emerald-400" />}
              </button>
            ))}
          </div>
          <div className="px-5 mt-3">
            <div className="flex items-center gap-2 border border-white/[0.07] rounded-lg px-3 py-2 bg-black/30">
              <Search className="h-3.5 w-3.5 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full bg-transparent outline-none text-[12px] text-zinc-100 placeholder:text-zinc-700"
              />
            </div>
          </div>
          <div className="mt-2 overflow-y-auto max-h-[520px]">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No customers</div>
            ) : (
              filteredCustomers.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-zinc-100 truncate">{c.name ?? "No name"}</div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">{c.email ?? "—"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                    <span className={`text-[13.5px] font-medium text-zinc-100 ${monoNum}`}>{formatStripeAmount(c.ltv_cents, c.currency)}</span>
                    <StatusPill kind={c.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Subscriptions directory (4 cols × 2 rows) ─────── */}
        <div className={`col-span-12 lg:col-span-4 lg:row-span-2 ${tile} overflow-hidden flex flex-col`}>
          <div className="px-5 pt-5">
            <p className={eyebrow}>Recurring</p>
            <h3 className={serifTitle}>Subscriptions</h3>
          </div>
          <div className="flex mx-5 mt-3 border-b border-white/[0.07] flex-wrap">
            {sTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSubStatusFilter(t.key)}
                className={`px-2.5 py-2 text-[10.5px] font-mono uppercase tracking-wider transition-colors relative ${subStatusFilter === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {t.label}{" "}
                <span className={subStatusFilter === t.key ? "text-emerald-400 ml-1" : "text-zinc-700 ml-1"}>{t.count}</span>
                {subStatusFilter === t.key && <span className="absolute -bottom-px left-2.5 right-2.5 h-0.5 bg-emerald-400" />}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-y-auto max-h-[600px]">
            {filteredSubs.length === 0 ? (
              <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No subscriptions</div>
            ) : (
              filteredSubs.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-zinc-100 truncate">{s.customer_name ?? "Anonymous"}</div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">{s.product_name ?? "—"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                    <span className={`text-[13.5px] font-medium text-zinc-100 ${monoNum}`}>
                      {formatStripeAmount(s.mrr_cents, s.currency)}
                      <span className="text-zinc-600 text-[10px]">/mo</span>
                    </span>
                    <StatusPill kind={s.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Hero KPI: gross volume YTD with mini sparkline ── */}
        <div className={`col-span-12 sm:col-span-6 lg:col-span-4 ${tile} p-5 flex flex-col justify-between gap-4 min-h-[148px]`}>
          <p className={eyebrow}>Gross volume · YTD</p>
          <div className={`text-[36px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
            {formatStripeAmount(summary?.total_ltv_cents ?? 0, customers?.currency ?? "usd")}
          </div>
          <div className="flex items-end gap-1 h-11">
            {chartData.length === 0 ? (
              <div className="text-[10.5px] font-mono text-zinc-600 self-center">No payout data yet</div>
            ) : (
              chartData.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-gradient-to-b from-emerald-400 to-emerald-500/30"
                  style={{ height: `${Math.max((d.v / peak) * 100, 4)}%` }}
                />
              ))
            )}
          </div>
        </div>

        {/* ── MRR mini ───────────────────────────────────────── */}
        <div className={`col-span-6 sm:col-span-3 lg:col-span-2 ${tile} p-5 flex flex-col justify-between gap-3 min-h-[148px]`}>
          <p className={eyebrow}>MRR</p>
          <div className={`text-[26px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
            {formatStripeAmount(subSummary?.total_mrr_cents ?? 0, subscriptions?.currency ?? "usd")}
          </div>
        </div>

        {/* ── Active subs mini ───────────────────────────────── */}
        <div className={`col-span-6 sm:col-span-3 lg:col-span-2 ${tile} p-5 flex flex-col justify-between gap-3 min-h-[148px]`}>
          <p className={`${eyebrow} flex items-center gap-2`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            Active
          </p>
          <div>
            <div className={`text-[26px] font-medium tracking-tight leading-none text-emerald-400 ${monoNum}`}>
              {subSummary?.by_status?.active ?? 0}
            </div>
            <div className="text-[11px] font-mono text-zinc-600 mt-1">of {subSummary?.total ?? 0} subs</div>
          </div>
        </div>

        {/* ── Payout cadence chart (8 cols × 2 rows) ────────── */}
        <div className={`col-span-12 lg:col-span-8 lg:row-span-2 ${tile} p-5 flex flex-col`}>
          <div className="flex items-baseline gap-3 mb-4">
            <div>
              <p className={eyebrow}>Payout cadence</p>
              <h3 className={serifTitle}>Monthly totals</h3>
            </div>
            <span className="ml-auto text-[11px] font-mono text-zinc-500">paid only</span>
          </div>
          <div className="flex items-end gap-3 flex-1 pl-12 relative border-b border-white/[0.13] min-h-[200px]">
            {[100, 75, 50, 25, 0].map((g) => (
              <div key={g} className="absolute left-12 right-0 border-t border-dashed border-white/[0.07]" style={{ bottom: `${g}%` }}>
                <span className="absolute -left-12 -top-1.5 text-[10px] font-mono text-zinc-700 w-10 text-right">
                  ${Math.round((g / 100) * peak).toLocaleString()}
                </span>
              </div>
            ))}
            {chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No payouts yet</div>
            ) : (
              chartData.map((d) => (
                <div key={d.month} className="flex-1 flex items-end justify-center h-full">
                  <div
                    className={`w-full max-w-[60px] rounded-t-md relative ${d.v === peak ? "bg-gradient-to-b from-emerald-300 to-emerald-400" : "bg-gradient-to-b from-emerald-500 to-emerald-500/50"}`}
                    style={{ height: `${(d.v / peak) * 100}%` }}
                  >
                    {d.v === peak && (
                      <span className={`absolute -top-5 left-0 right-0 text-center text-[10.5px] text-emerald-300 ${monoNum}`}>
                        ${d.v.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {chartData.length > 0 && (
            <div className="flex gap-3 pl-12 mt-3">
              {chartData.map((d) => (
                <span key={d.month} className="flex-1 text-center text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  {d.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Four payout KPI tiles (2 cols each) ────────────── */}
        {payoutKpis.map((k) => (
          <div
            key={k.eyebrow}
            className={`col-span-6 sm:col-span-3 lg:col-span-2 ${tile} p-5 flex flex-col justify-between gap-3 min-h-[148px]`}
          >
            <p className={eyebrow}>{k.eyebrow}</p>
            <div>
              <div className={`text-[26px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>{k.v}</div>
              {k.sub && <div className="text-[11px] font-mono text-zinc-600 mt-1">{k.sub}</div>}
            </div>
          </div>
        ))}

        {/* ── Payout history table (full width) ──────────────── */}
        <div className={`col-span-12 ${tile} overflow-hidden`}>
          <div className="px-6 pt-5 flex items-baseline gap-3">
            <div>
              <p className={eyebrow}>Payouts to your bank</p>
              <h3 className={serifTitle}>Payout history</h3>
            </div>
            <span className="ml-auto text-[11px] font-mono text-zinc-500">Stripe · Standard</span>
          </div>
          <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_1fr] gap-3 px-6 py-3.5 mt-4 border-b border-white/[0.13] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
            <span>Arrived</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Method</span>
            <span>Description</span>
          </div>
          {(payouts?.items ?? []).length === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No payouts yet</div>
          ) : (
            (payouts?.items ?? []).map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_1fr] gap-3 px-6 py-4 border-b border-white/[0.07] items-center hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <div className="text-[13.5px] font-semibold text-zinc-100">
                    {new Date(p.arrival_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    Initiated {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <span className={`text-[13px] font-medium text-zinc-100 ${monoNum}`}>{formatStripeAmount(p.amount_cents, p.currency)}</span>
                <div><StatusPill kind={p.status} /></div>
                <span className="text-[13px] font-mono text-zinc-400 capitalize">{p.method ?? "—"}</span>
                <span className="text-[13px] font-mono text-zinc-400 truncate">{p.statement_descriptor ?? p.description ?? "—"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// SUBSCRIPTIONS TAB — full subscription list w/ status filters.
// ════════════════════════════════════════════
const SUB_STATUS_PILL: Record<string, string> = {
  active: "bg-emerald-500/[0.08] text-emerald-500 border-emerald-500/15",
  trialing: "bg-blue-500/[0.08] text-blue-500 border-blue-500/15",
  past_due: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
  unpaid: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
  paused: "bg-muted text-muted-foreground border-border",
  canceled: "bg-muted text-muted-foreground border-border",
  incomplete: "bg-primary/[0.08] text-primary border-primary/15",
  incomplete_expired: "bg-primary/[0.08] text-primary border-primary/15",
};

const SubscriptionsTab: React.FC<{ stripe: StripeBundle }> = ({ stripe }) => {
  const { connected, subscriptions } = stripe;
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const summary = subscriptions?.summary;
  const allItems = subscriptions?.items ?? [];
  const byStatus = summary?.by_status ?? {};

  const filtered = useMemo(() => {
    if (statusFilter === "all") return allItems;
    return allItems.filter((s) => s.status === statusFilter);
  }, [allItems, statusFilter]);

  if (!connected) return <StripeEmptyState />;

  // Build the status pill list dynamically from what's actually in
  // the data. Active + Trialing always show even at 0 since they're
  // the headline metrics.
  const statusOptions: Array<{ key: string; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "trialing", label: "Trialing" },
    { key: "past_due", label: "Past due" },
    { key: "canceled", label: "Canceled" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary strip — counts per major status + total MRR. */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="flex">
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Total subs</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-1">{summary?.total ?? 0}</p>
          </div>
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Active</p>
            <p className="text-xl font-bold text-emerald-500 tracking-tight mt-1">{byStatus.active ?? 0}</p>
          </div>
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Trialing</p>
            <p className="text-xl font-bold text-blue-500 tracking-tight mt-1">{byStatus.trialing ?? 0}</p>
          </div>
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Past due</p>
            <p className="text-xl font-bold text-amber-500 tracking-tight mt-1">{byStatus.past_due ?? 0}</p>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Total MRR</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-1 tabular-nums">
              {formatStripeAmount(summary?.total_mrr_cents ?? 0, subscriptions?.currency ?? "usd", { compact: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter pills. */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-sm p-0.5 w-fit">
          {statusOptions.map((opt) => {
            const count = opt.key === "all" ? summary?.total ?? 0 : byStatus[opt.key] ?? 0;
            return (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all ${
                  statusFilter === opt.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table. */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1.2fr_0.8fr] gap-4 px-5 py-2.5 border-b border-border text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em]">
          <span>Customer</span>
          <span>Product</span>
          <span>Status</span>
          <span className="text-right">MRR</span>
          <span className="text-right">Renews</span>
          <span className="text-right">Auto-renew</span>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-muted-foreground/40">
                {subscriptions ? "No subscriptions match your filter" : "Loading subscriptions…"}
              </p>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1.2fr_0.8fr] gap-4 items-center px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground/80 truncate">
                    {s.customer_name ?? s.customer_email ?? "Anonymous"}
                  </div>
                  {s.customer_name && s.customer_email && (
                    <div className="text-[11px] text-muted-foreground/60 truncate">{s.customer_email}</div>
                  )}
                </div>
                <span className="text-[12px] text-foreground/70 truncate">{s.product_name ?? "—"}</span>
                <div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${SUB_STATUS_PILL[s.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-right text-foreground tabular-nums">
                  {formatStripeAmount(s.mrr_cents, s.currency)}
                </span>
                <div className="text-right">
                  <div className="text-[12px] text-foreground/80">
                    {new Date(s.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                  </div>
                  {s.days_until_renewal > 0 && (
                    <div className="text-[10px] text-muted-foreground/60">in {s.days_until_renewal}d</div>
                  )}
                </div>
                <div className="text-right">
                  {s.cancel_at_period_end ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary uppercase tracking-wider">
                      <XCircle className="h-3 w-3" /> No
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 uppercase tracking-wider">
                      <CheckCircle className="h-3 w-3" /> Yes
                    </span>
                  )}
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
// (Old CompaniesTab removed — replaced by CustomersTab + SubscriptionsTab.)
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
// PAYOUTS TAB — when money actually hit the bank.
// Replaces the old Cash Flow tab.
// ════════════════════════════════════════════
const PAYOUT_STATUS_PILL: Record<string, string> = {
  paid: "bg-emerald-500/[0.08] text-emerald-500 border-emerald-500/15",
  in_transit: "bg-blue-500/[0.08] text-blue-500 border-blue-500/15",
  pending: "bg-amber-500/[0.08] text-amber-500 border-amber-500/15",
  failed: "bg-primary/[0.08] text-primary border-primary/15",
  canceled: "bg-muted text-muted-foreground border-border",
};

// PayoutsSection — the body of the old PayoutsTab, extracted so it
// can render both as a standalone tab AND folded inline at the bottom
// of the combined Customers tab without duplicating chart + table
// markup. Caller is responsible for the not-connected gate.
const PayoutsSection: React.FC<{ stripe: StripeBundle }> = ({ stripe }) => {
  const { payouts } = stripe;

  // Aggregate payouts into monthly buckets for the cadence chart.
  const monthlyPayouts = useMemo(() => {
    if (!payouts) return [];
    const buckets = new Map<string, { label: string; amount_cents: number; count: number }>();
    for (const p of payouts.items) {
      // Bucket by arrival date YYYY-MM. Failed payouts excluded
      // so the chart shows actual cash-in, not attempts.
      if (p.status !== "paid") continue;
      const d = new Date(p.arrival_date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
      const existing = buckets.get(key) ?? { label, amount_cents: 0, count: 0 };
      existing.amount_cents += p.amount_cents;
      existing.count += 1;
      buckets.set(key, existing);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, amount: v.amount_cents / 100 }));
  }, [payouts]);

  const summary = payouts?.summary;
  const items = payouts?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Summary strip — YTD total + count + average + last payout. */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="flex">
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">YTD paid</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-1 tabular-nums">
              {formatStripeAmount(summary?.total_paid_ytd_cents ?? 0, payouts?.currency ?? "usd", { compact: true })}
            </p>
          </div>
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">YTD payouts</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-1">{summary?.count_ytd ?? 0}</p>
          </div>
          <div className="flex-1 px-5 py-4 border-r border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Avg payout</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-1 tabular-nums">
              {formatStripeAmount(summary?.average_payout_cents ?? 0, payouts?.currency ?? "usd", { compact: true })}
            </p>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">Last payout</p>
            {summary?.last_payout ? (
              <>
                <p className="text-xl font-bold text-foreground tracking-tight mt-1 tabular-nums">
                  {formatStripeAmount(summary.last_payout.amount_cents, summary.last_payout.currency, { compact: true })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(summary.last_payout.arrival_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-muted-foreground tracking-tight mt-1">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Cadence chart — monthly payout totals (paid only). */}
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">Payout cadence</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Monthly totals · paid only</p>
          </div>
        </div>
        <div className="h-56">
          {monthlyPayouts.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={monthlyPayouts}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "currentColor", fontSize: 11 }} className="text-muted-foreground/60" axisLine={false} tickLine={false} tickFormatter={(v) => `$${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : Number(v)}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "2px", fontSize: "12px", color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Paid"]} />
                <Bar dataKey="amount" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[12px] text-muted-foreground/40">No payouts yet</p></div>
          )}
        </div>
      </div>

      {/* Payouts table. */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_2fr] gap-4 px-5 py-2.5 border-b border-border text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em]">
          <span>Arrived</span>
          <span className="text-right">Amount</span>
          <span>Status</span>
          <span>Method</span>
          <span>Description</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-muted-foreground/40">No payouts yet</p>
            </div>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr_2fr] gap-4 items-center px-5 py-3 border-b border-white/[0.025] last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div>
                  <div className="text-[13px] font-medium text-foreground/80">
                    {new Date(p.arrival_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    Initiated {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-right text-foreground tabular-nums">
                  {formatStripeAmount(p.amount_cents, p.currency)}
                </span>
                <div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${PAYOUT_STATUS_PILL[p.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <span className="text-[12px] text-foreground/70 capitalize">
                  {p.method ?? "—"}
                </span>
                <span className="text-[11px] text-muted-foreground/70 truncate">
                  {p.statement_descriptor ?? p.description ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// (Old CashFlowTab below — kept as dead code until tab strip rewire.)
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
const ReportsTab: React.FC<{ invoices: InvoiceType[]; stripe: StripeBundle }> = ({ invoices, stripe }) => {
  const { failed: failedSlice } = stripe;
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Shared editorial chrome — same tokens as Overview + Customers.
  const tile = "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
  const eyebrow = "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
  const serifTitle = "ed-serif text-[20px] mt-1.5 text-zinc-100";
  const monoNum = "font-mono tabular-nums";

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchSearch = !searchQuery ||
      inv.invoice_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const paidCount = invoices.filter(i => i.status === "paid").length;
  const pendingCount = invoices.filter(i => i.status === "pending").length;

  const totalValue = filtered.reduce((s, i) => s + Number(i.outcome), 0);
  const avgInvoice = filtered.length > 0 ? totalValue / filtered.length : 0;

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

  // Invoice filter tab definitions with live counts.
  const iTabs: Array<{ key: typeof statusFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: invoices.length },
    { key: "paid", label: "Paid", count: paidCount },
    { key: "pending", label: "Pending", count: pendingCount },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3.5">
        {/* ── KPI strip — 4 compact tiles (col-3 each = 12) ──── */}
        <div className={`col-span-6 lg:col-span-3 ${tile} p-4 flex flex-col gap-1.5`}>
          <p className={eyebrow}>Showing</p>
          <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
            {filtered.length}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 leading-none">of {invoices.length} invoices</div>
        </div>

        <div className={`col-span-6 lg:col-span-3 ${tile} p-4 flex flex-col gap-1.5`}>
          <p className={eyebrow}>Total value</p>
          <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
            ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue.toFixed(0)}
          </div>
        </div>

        <div className={`col-span-6 lg:col-span-3 ${tile} p-4 flex flex-col gap-1.5`}>
          <p className={eyebrow}>Avg invoice</p>
          <div className={`text-[20px] font-medium tracking-tight leading-none text-zinc-100 ${monoNum}`}>
            ${avgInvoice >= 1000 ? `${(avgInvoice / 1000).toFixed(1)}k` : avgInvoice.toFixed(0)}
          </div>
        </div>

        <div className={`col-span-6 lg:col-span-3 ${tile} p-4 flex flex-col gap-1.5`}>
          <p className={`${eyebrow} flex items-center gap-2`}>
            {failedSlice && failedSlice.count > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.55)]" />
            )}
            Dunning · 30d
          </p>
          <div className={`text-[20px] font-medium tracking-tight leading-none ${failedSlice && failedSlice.count > 0 ? "text-amber-400" : "text-zinc-100"} ${monoNum}`}>
            {failedSlice ? formatStripeAmount(failedSlice.total_cents, failedSlice.currency, { compact: true }) : "$0"}
          </div>
          {failedSlice && failedSlice.count > 0 && (
            <div className="text-[10px] font-mono text-zinc-500 leading-none">
              {failedSlice.count} · {failedSlice.retryable_count} retryable
            </div>
          )}
        </div>

        {/* ── Failed payments / dunning queue (12 cols) ────────
            Sits above the invoice table since at-risk revenue is
            the more urgent surface. Tile is hidden entirely when
            count = 0 so clean accounts don't see an empty card. */}
        {failedSlice && failedSlice.count > 0 && (
          <div className={`col-span-12 ${tile} overflow-hidden flex flex-col`}>
            <div className="px-5 pt-5 flex items-baseline gap-3">
              <div>
                <p className={`${eyebrow} flex items-center gap-2`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.55)]" />
                  Failed payments
                </p>
                <h3 className={serifTitle}>Dunning queue</h3>
              </div>
              <span className={`ml-auto text-[16px] text-amber-400 ${monoNum}`}>
                {formatStripeAmount(failedSlice.total_cents, failedSlice.currency)}
              </span>
            </div>
            <div className="grid grid-cols-[2fr_2fr_1fr_0.9fr_0.7fr] gap-4 px-5 py-2.5 mt-4 border-b border-white/[0.13] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
              <span>Customer</span>
              <span>Reason</span>
              <span>Attempted</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Action</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {failedSlice.items.map((f) => (
                <div
                  key={f.id}
                  className="grid grid-cols-[2fr_2fr_1fr_0.9fr_0.7fr] gap-4 items-center px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
                      {f.customer_name ?? f.customer_email ?? "Anonymous"}
                    </div>
                    {f.customer_name && f.customer_email && (
                      <div className="text-[11px] font-mono text-zinc-500 truncate">{f.customer_email}</div>
                    )}
                  </div>
                  <span className="text-[12px] text-zinc-400 truncate">
                    {f.failure_message ?? f.failure_code ?? "—"}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {new Date(f.attempted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <span className={`text-[13px] font-medium text-right text-zinc-100 ${monoNum}`}>
                    {formatStripeAmount(f.amount_cents, f.currency)}
                  </span>
                  <div className="flex justify-end">
                    <StatusPill kind={f.retryable ? "pending" : "failed"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invoice table (12 cols, full width) ──────────────
            Header is editorial: eyebrow + serif title on the left,
            mono-uppercase filter tabs in the middle, search field +
            export button on the right. The table body inherits the
            same row styling as the other lists across the dashboard. */}
        <div className={`col-span-12 ${tile} overflow-hidden flex flex-col`}>
          <div className="px-5 pt-5 flex items-baseline gap-3 flex-wrap">
            <div>
              <p className={eyebrow}>CWA accounts receivable</p>
              <h3 className={serifTitle}>Invoices</h3>
            </div>
            <span className={`ml-auto text-[14px] text-zinc-100 ${monoNum}`}>
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Filter strip — same tab pattern as the Customers tab
              directory (mono caps, count chip, emerald underline on
              the active item). Search input + export button are
              right-aligned. */}
          <div className="px-5 mt-4 flex items-end justify-between gap-4 border-b border-white/[0.07] flex-wrap">
            <div className="flex flex-wrap">
              {iTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={`relative px-2.5 py-2 text-[10.5px] font-mono uppercase tracking-wider transition-colors ${statusFilter === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t.label}{" "}
                  <span className={statusFilter === t.key ? "text-emerald-400 ml-1" : "text-zinc-700 ml-1"}>{t.count}</span>
                  {statusFilter === t.key && <span className="absolute -bottom-px left-2.5 right-2.5 h-0.5 bg-emerald-400" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2 border border-white/[0.07] rounded-lg px-3 py-1.5 bg-black/30 w-64">
                <Search className="h-3.5 w-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title or client…"
                  className="w-full bg-transparent outline-none text-[12px] text-zinc-100 placeholder:text-zinc-700"
                />
              </div>
              <button
                onClick={exportCSV}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download className="h-3 w-3" /> Export CSV
              </button>
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.9fr] gap-4 px-5 py-2.5 border-b border-white/[0.07] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
            <span>Invoice</span>
            <span>Client</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
          </div>

          {/* Table rows */}
          <div className="max-h-[540px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">No invoices match</div>
            ) : (
              filtered.map((inv) => (
                <div
                  key={inv.invoice_id}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.9fr] gap-4 items-center px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[13.5px] font-semibold text-zinc-100 truncate">{inv.invoice_title}</span>
                  <span className="text-[12px] text-zinc-400 truncate">{inv.client_name}</span>
                  <span className="text-[11px] font-mono text-zinc-500">{new Date(inv.creation_date).toLocaleDateString()}</span>
                  <span className={`text-[13px] font-medium text-right text-zinc-100 ${monoNum}`}>
                    ${Number(inv.outcome).toFixed(2)}
                  </span>
                  <div className="flex justify-end">
                    <StatusPill kind={inv.status === "paid" ? "paid" : "pending"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// StripeStatusPill — real connection indicator for the masthead.
//
// Three visual states, all driven by props that originate in the
// useStripeDashboard hook (which itself reads the stored restricted
// key from the connectors store + the live query state):
//
//   1. connected + no error          → emerald, pulsing dot, "Live · Stripe connected"
//   2. connected but a query errored → amber,   solid  dot, "Stripe error"
//   3. not connected                 → zinc,    static dot, "Stripe not connected"
//
// IMPORTANT: this is NOT a frontend ornament — `connected` is true
// only when the user has saved a Stripe connector and that connector
// has a non-empty restricted key. The verify() call gates whether
// the key gets saved in the first place, so a `connected=true` state
// here means an actual Stripe round-trip succeeded at some point.
const StripeStatusPill: React.FC<{
  connected: boolean;
  loading: boolean;
  error: boolean;
}> = ({ connected, loading, error }) => {
  let wrap: string;
  let dotColor: string;
  let label: string;
  let pulsing = false;

  if (!connected) {
    wrap = "bg-zinc-500/[0.06] border-zinc-500/20 text-zinc-500";
    dotColor = "bg-zinc-500";
    label = "Stripe not connected";
  } else if (error) {
    wrap = "bg-amber-500/[0.07] border-amber-500/25 text-amber-300/85";
    dotColor = "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]";
    label = "Stripe · sync error";
  } else {
    wrap = "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300";
    dotColor = "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]";
    label = loading ? "Live · syncing" : "Live · Stripe connected";
    pulsing = !loading;
  }

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.16em] transition-colors ${wrap}`}>
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </span>
      {label}
    </div>
  );
};

const FinancialDashboardContent: React.FC = () => {
  const { data: invoices = [], isLoading, refetch } = AllInvoices();
  const stripe = useStripeDashboard();
  const [bankBalance, setBankBalance] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [revenueByCategory, setRevenueByCategory] = useState<{ name: string; value: number }[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<{ name: string; value: number }[]>([]);
  const [tab, setTab] = useState("overview");

  // Last-updated stamp for the masthead — sourced from whichever Stripe
  // slice last computed (snapshot is the cheapest + fastest, so it's
  // usually the freshest one). Falls back to null when not connected.
  const lastUpdatedLabel = useMemo(() => {
    const ts = stripe.snapshot?.computed_at;
    if (!ts) return null;
    return new Date(ts)
      .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase();
  }, [stripe.snapshot?.computed_at]);

  // Load Supabase aggregates
  useEffect(() => {
    async function loadAggregates() {
      const [propsRes, expRes, revRes] = await Promise.all([
        companySupabase.from("cwa_calculatorProps").select("initialCapital").single(),
        companySupabase.from("cwa_expenses").select("amount, frequency, category"),
        companySupabase.from("cwa_revenues").select("amount, frequency, category, clients, revenueType"),
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
      {/* Newsreader serif loaded inline once for the editorial header. */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap');.fd-serif{font-family:'Newsreader',Georgia,serif}`}</style>

      {/* ════════════════════════════════════════════
          Editorial masthead — serif title, mono eyebrow on
          the left; live connection pill + last-updated stamp
          on the right. The pill's emerald-vs-zinc state is
          driven by stripe.connected (real connection check,
          not a frontend ornament). */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2 min-w-0 max-w-[60%]">
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              </span>
              CodeWithAli · Portfolio
            </p>
            <h1 className="fd-serif text-[44px] leading-[1.02] text-foreground tracking-tight">
              Finance{" "}
              <span className="italic font-normal text-foreground/80">&amp; strategy</span>
            </h1>
            <p className="text-[12.5px] text-muted-foreground/70 leading-snug pt-1">
              Portfolio overview across{" "}
              <span className="text-foreground/85 font-medium">CodeWithAli</span>{" "}
              <span className="text-muted-foreground/40">&amp;</span>{" "}
              <span className="text-foreground/85 font-medium">Simplicity</span>
            </p>
          </div>

          {/* Right rail — connection state + updated stamp. The
              pill ONLY goes emerald when stripe.connected is true
              (which comes from useConnectors → an actual stored
              restricted key + a verify() round-trip at connect time).
              Without a key, it shows the muted "not connected"
              state and links to the connector settings page. */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StripeStatusPill
              connected={stripe.connected}
              loading={stripe.loading}
              error={!!stripe.error}
            />
            <button
              onClick={() => {
                refetch();
                void stripe.refetchAll();
              }}
              className="group flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Refetch all dashboard data"
            >
              <RefreshCcw className={`h-3 w-3 transition-transform group-hover:rotate-180 ${stripe.loading ? "animate-spin" : ""}`} />
              {lastUpdatedLabel ? (
                <span>Updated {lastUpdatedLabel}</span>
              ) : (
                <span>{stripe.loading ? "Syncing" : "Refresh"}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          Underline tab strip. Replaces the chrome-y pill bar
          with flat mono uppercase labels + a hairline rule
          across the page. Active gets a 2px primary underline
          riding the page's bottom-border so the tab "owns"
          its section visually. */}
      <div className="px-8 pt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="relative bg-transparent border-0 rounded-none h-auto p-0 w-full justify-start gap-8 border-b border-border/60">
            <TabsTrigger value="overview" className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground/70 hover:text-foreground rounded-none px-0 pb-3 pt-0 h-auto text-[11px] font-mono uppercase tracking-[0.18em] transition-colors">
              <BarChart3 className="h-3 w-3 mr-1.5 opacity-80" /> Overview
              <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
            </TabsTrigger>
            <TabsTrigger value="customers" className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground/70 hover:text-foreground rounded-none px-0 pb-3 pt-0 h-auto text-[11px] font-mono uppercase tracking-[0.18em] transition-colors">
              <Users className="h-3 w-3 mr-1.5 opacity-80" /> Customers
              <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
            </TabsTrigger>
            <TabsTrigger value="reports" className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground/70 hover:text-foreground rounded-none px-0 pb-3 pt-0 h-auto text-[11px] font-mono uppercase tracking-[0.18em] transition-colors">
              <FileBarChart className="h-3 w-3 mr-1.5 opacity-80" /> Reports
              <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
            </TabsTrigger>
            <TabsTrigger value="modeler" className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground/70 hover:text-foreground rounded-none px-0 pb-3 pt-0 h-auto text-[11px] font-mono uppercase tracking-[0.18em] transition-colors">
              <Sparkles className="h-3 w-3 mr-1.5 opacity-80" /> Modeler
              <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
            </TabsTrigger>
          </TabsList>

          <div className="pt-4 pb-10 space-y-4">
            <TabsContent value="overview">
              <OverviewTab stripe={stripe} />
            </TabsContent>

            <TabsContent value="customers">
              <CustomersTab stripe={stripe} />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsTab invoices={invoices} stripe={stripe} />
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
