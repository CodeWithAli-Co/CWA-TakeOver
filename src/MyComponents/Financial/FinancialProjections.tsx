/**
 * FinancialProjections.tsx — Multi-year projection visualizations.
 *
 * Replaces the old VisualizerTab.tsx (1004 lines) — consumes state from
 * FinancialContext, displays projections with charts using Void palette.
 *
 * Sections (3 sub-tabs, simplified from 5):
 *   1. Overview   — Revenue vs Expenses + Profit trend + Key metrics
 *   2. Cash Flow  — Cumulative cash + ROI over time
 *   3. Detail     — Year-by-year data table
 */

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, Table as TableIcon, LineChart as LineIcon,
} from "lucide-react";
import {
  AreaChart, Area, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, ReferenceLine,
} from "recharts";
import { useFinancialState } from "./FinancialContext";
import { CustomTooltip } from "./FinancialComponents";

// ── Single metric tile ──
const MetricTile: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`bg-white/[0.015] border border-white/[0.04] rounded-sm p-4 ${accent ? "border-l-2 border-l-red-500" : ""}`}>
    <p className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium">{label}</p>
    <p className="text-xl font-bold text-white tracking-tight mt-1">{value}</p>
  </div>
);

const FinancialProjections: React.FC = () => {
  const { state, projections, metrics } = useFinancialState();
  const [tab, setTab] = useState("overview");

  // Skip year 0 for charts (initial state)
  const chartData = projections.slice(1).map((p) => ({
    year: p.year,
    Revenue: Math.round(p.totalRevenue),
    Expenses: Math.round(p.totalExpenses),
    Profit: Math.round(p.netProfit),
    Cash: Math.round(p.cashFlow),
    Cumulative: Math.round(p.cumulativeProfit),
    ROI: Number((p.roi || 0).toFixed(1)),
  }));

  if (projections.length <= 1) {
    return (
      <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm p-12 text-center">
        <p className="text-[13px] text-white/15">No projections yet — configure the modeler above</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-red-500/[0.08] border border-red-500/15">
            <LineIcon className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-white/85">Projections</h2>
            <p className="text-[11px] text-white/20">
              {state.years}-year financial outlook
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Top metrics row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricTile label="CAGR" value={`${metrics.cagr.toFixed(1)}%`} accent />
          <MetricTile label="Break-even" value={metrics.breakEvenYear ? `Yr ${metrics.breakEvenYear}` : "N/A"} accent />
          <MetricTile label="ROI" value={`${metrics.roi.toFixed(1)}%`} />
          <MetricTile label="Final Cash" value={`$${(metrics.finalCashFlow / 1000).toFixed(1)}k`} />
          <MetricTile label="Profit Margin" value={`${metrics.profitMargin.toFixed(1)}%`} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.02] border border-white/[0.04] rounded-sm h-8">
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <BarChart3 className="h-3 w-3 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <TrendingUp className="h-3 w-3 mr-1.5" /> Cash Flow
            </TabsTrigger>
            <TabsTrigger value="detail" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <TableIcon className="h-3 w-3 mr-1.5" /> Detail
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Revenue vs Expenses */}
            <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] text-white/60 font-medium">Revenue vs Expenses</p>
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span className="text-white/30">Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    <span className="text-white/30">Expenses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
                    <span className="text-white/30">Profit</span>
                  </div>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Revenue" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={20} />
                    <Bar dataKey="Expenses" fill="rgba(255,255,255,0.4)" radius={[2, 2, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="Profit" stroke="#fca5a5" strokeWidth={2} dot={{ fill: "#fca5a5", r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cumulative profit */}
            <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
              <p className="text-[12px] text-white/60 font-medium mb-3">Cumulative Profit Trend</p>
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                    <Area type="monotone" dataKey="Cumulative" stroke="#ef4444" strokeWidth={2} fill="url(#cumGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ── CASH FLOW ── */}
          <TabsContent value="cashflow" className="space-y-4 mt-4">
            <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
              <p className="text-[12px] text-white/60 font-medium mb-3">Cash Position Over Time</p>
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Cash" stroke="#ef4444" strokeWidth={2} fill="url(#cashGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
              <p className="text-[12px] text-white/60 font-medium mb-3">ROI Growth</p>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                    <Line type="monotone" dataKey="ROI" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ── DETAIL TABLE ── */}
          <TabsContent value="detail" className="mt-4">
            <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm overflow-hidden">
              <div className="grid grid-cols-7 gap-2 px-4 py-2.5 border-b border-white/[0.04] text-[10px] text-white/20 uppercase tracking-wider">
                <span>Year</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Expenses</span>
                <span className="text-right">Profit</span>
                <span className="text-right">Tax</span>
                <span className="text-right">Cash</span>
                <span className="text-right">ROI</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {chartData.map((row) => (
                  <div key={row.year} className="grid grid-cols-7 gap-2 px-4 py-2.5 border-b border-white/[0.025] text-[12px] hover:bg-white/[0.015] transition-colors">
                    <span className="text-red-400 font-medium">Year {row.year}</span>
                    <span className="text-right text-white/70">${row.Revenue.toLocaleString()}</span>
                    <span className="text-right text-white/40">${row.Expenses.toLocaleString()}</span>
                    <span className={`text-right font-medium ${row.Profit >= 0 ? "text-red-400" : "text-white/30"}`}>
                      ${row.Profit.toLocaleString()}
                    </span>
                    <span className="text-right text-white/30">${Math.round(projections[row.year].taxAmount).toLocaleString()}</span>
                    <span className="text-right text-white/70">${row.Cash.toLocaleString()}</span>
                    <span className="text-right text-white/40">{row.ROI}%</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FinancialProjections;
