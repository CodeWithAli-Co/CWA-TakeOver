/**
 * FinancialModeler.tsx — Financial scenario input form.
 *
 * Replaces the old calculatorTab.tsx (775 lines) by consuming state via
 * FinancialContext instead of receiving 21 props.
 *
 * Sections (4 sub-tabs):
 *   1. Base       — capital, tax, inflation, projection years
 *   2. Expenses   — dynamic expense items + category breakdown chart
 *   3. Revenue    — dynamic revenue items + category breakdown chart
 *   4. Personnel  — salary, employee count, growth + projection chart
 */

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, Percent, TrendingUp, Users, Plus, BarChart3,
  CreditCard, Sparkles, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  EXPENSE_CATEGORIES, REVENUE_CATEGORIES,
} from "@/stores/FinancialConstants";
import { calculateAnnualAmount, getCategoryColor } from "@/stores/FinancialUtils";
import { useFinancialState } from "./FinancialContext";
import {
  NumericField, GrowthRateField, YearSelector,
  SectionHeader, CustomTooltip, DynamicItem,
} from "./FinancialComponents";

// ── Empty state for item lists ──
const EmptyItems: React.FC<{ type: "expense" | "revenue"; onAdd: () => void }> = ({ type, onAdd }) => (
  <div className="text-center py-12 border border-dashed border-white/[0.06] rounded-sm">
    <p className="text-[13px] text-white/15 mb-3">No {type}s yet</p>
    <button
      onClick={onAdd}
      className="text-[12px] text-red-400 hover:text-red-300 transition-colors"
    >
      + Add your first {type}
    </button>
  </div>
);

// ── Quick metric card ──
const MetricCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`bg-white/[0.015] border border-white/[0.04] rounded-sm p-3 ${accent ? "border-l-2 border-l-red-500" : ""}`}>
    <p className="text-[10px] text-white/20 uppercase tracking-wider">{label}</p>
    <p className="text-lg font-bold text-white/80 tracking-tight mt-1">{value}</p>
  </div>
);

const FinancialModeler: React.FC = () => {
  const { state, projections, metrics, actions } = useFinancialState();
  const [tab, setTab] = useState("base");

  // ── Personnel projections data ──
  const personnelData = projections.slice(1).map((p) => ({
    year: p.year,
    "Personnel Cost": Math.round(p.employeeCost),
  }));

  // ── Category breakdowns for charts ──
  const expenseByCategory = state.expenses.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "Other";
    acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(e);
    return acc;
  }, {});

  const revenueByCategory = state.revenues.reduce<Record<string, number>>((acc, r) => {
    const cat = r.category || "Other";
    acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(r);
    return acc;
  }, {});

  const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));
  const revenuePieData = Object.entries(revenueByCategory).map(([name, value]) => ({ name, value }));

  const totalAnnualExpenses = expensePieData.reduce((sum, e) => sum + e.value, 0);
  const totalAnnualRevenue = revenuePieData.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-red-500/[0.08] border border-red-500/15">
            <Sparkles className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-white/85">Financial Modeler</h2>
            <p className="text-[11px] text-white/20">Configure inputs to model business scenarios</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.02] border border-white/[0.04] rounded-sm h-8 mb-5">
            <TabsTrigger value="base" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <DollarSign className="h-3 w-3 mr-1.5" /> Base
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <CreditCard className="h-3 w-3 mr-1.5" /> Expenses ({state.expenses.length})
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <TrendingUp className="h-3 w-3 mr-1.5" /> Revenue ({state.revenues.length})
            </TabsTrigger>
            <TabsTrigger value="personnel" className="data-[state=active]:bg-red-500/[0.08] data-[state=active]:text-red-400 text-white/25 rounded-sm text-[11px] h-6">
              <Users className="h-3 w-3 mr-1.5" /> Personnel
            </TabsTrigger>
          </TabsList>

          {/* ── BASE PARAMETERS ── */}
          <TabsContent value="base" className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumericField
                label="Initial Capital"
                value={state.initialCapital}
                onChange={actions.setInitialCapital}
                icon={DollarSign}
                prefix="$"
                description="Starting cash position"
              />
              <NumericField
                label="Tax Rate"
                value={state.taxRate}
                onChange={actions.setTaxRate}
                icon={Percent}
                suffix="%"
                description="Effective tax on profits"
                min={0}
                max={50}
              />
              <NumericField
                label="Inflation Rate"
                value={state.inflationRate}
                onChange={actions.setInflationRate}
                icon={TrendingUp}
                suffix="%"
                description="Annual inflation adjustment"
                min={0}
                max={20}
              />
              <YearSelector years={state.years} setYears={actions.setYears} />
            </div>

            {/* Quick metrics */}
            <div>
              <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Snapshot" subtitle="Computed from current inputs" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Runway" value={`${metrics.runwayMonths.toFixed(1)} mo`} accent />
                <MetricCard label="Break-even" value={metrics.breakEvenYear ? `Year ${metrics.breakEvenYear}` : "N/A"} accent />
                <MetricCard label="ROI" value={`${metrics.roi.toFixed(1)}%`} />
                <MetricCard label="Final Cash" value={`$${(metrics.finalCashFlow / 1000).toFixed(1)}k`} />
              </div>
            </div>
          </TabsContent>

          {/* ── EXPENSES ── */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/60 font-medium">
                  ${totalAnnualExpenses.toLocaleString()}<span className="text-white/20 text-[11px] ml-1">/year</span>
                </p>
                <p className="text-[11px] text-white/20">{state.expenses.length} expense items</p>
              </div>
              <button
                onClick={actions.addExpense}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.08] hover:bg-red-500/[0.12] border border-red-500/15 text-red-400 text-[11px] rounded-sm transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Expense
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Item list */}
              <div className="lg:col-span-2 space-y-2">
                {state.expenses.length === 0 ? (
                  <EmptyItems type="expense" onAdd={actions.addExpense} />
                ) : (
                  state.expenses.map((e) => (
                    <DynamicItem
                      key={e.id}
                      item={e}
                      onChange={(item) => actions.updateExpense(item as any)}
                      onDelete={() => actions.deleteExpense(e.id)}
                      type="expense"
                      categories={EXPENSE_CATEGORIES}
                    />
                  ))
                )}
              </div>

              {/* Category pie */}
              {expensePieData.length > 0 && (
                <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mb-3">By Category</p>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          dataKey="value"
                          cx="50%" cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          stroke="none"
                        >
                          {expensePieData.map((entry, i) => (
                            <Cell key={i} fill={getCategoryColor(entry.name, true)} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0a0a0a",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "2px",
                            fontSize: "12px",
                          }}
                          itemStyle={{ color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2">
                    {expensePieData.slice(0, 5).map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: getCategoryColor(e.name, true) }} />
                          <span className="text-white/40">{e.name}</span>
                        </div>
                        <span className="text-white/60">${(e.value / 1000).toFixed(1)}k</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── REVENUE ── */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-red-400 font-medium">
                  ${totalAnnualRevenue.toLocaleString()}<span className="text-white/20 text-[11px] ml-1">/year</span>
                </p>
                <p className="text-[11px] text-white/20">{state.revenues.length} revenue streams</p>
              </div>
              <button
                onClick={actions.addRevenue}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.08] hover:bg-red-500/[0.12] border border-red-500/15 text-red-400 text-[11px] rounded-sm transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Revenue
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-2">
                {state.revenues.length === 0 ? (
                  <EmptyItems type="revenue" onAdd={actions.addRevenue} />
                ) : (
                  state.revenues.map((r) => (
                    <DynamicItem
                      key={r.id}
                      item={r}
                      onChange={(item) => actions.updateRevenue(item as any)}
                      onDelete={() => actions.deleteRevenue(r.id)}
                      type="revenue"
                      categories={REVENUE_CATEGORIES}
                    />
                  ))
                )}
              </div>

              {revenuePieData.length > 0 && (
                <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mb-3">By Category</p>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={revenuePieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} stroke="none">
                          {revenuePieData.map((entry, i) => (
                            <Cell key={i} fill={getCategoryColor(entry.name, false)} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0a0a0a",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "2px",
                            fontSize: "12px",
                          }}
                          itemStyle={{ color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2">
                    {revenuePieData.slice(0, 5).map((r) => (
                      <div key={r.name} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: getCategoryColor(r.name, false) }} />
                          <span className="text-white/40">{r.name}</span>
                        </div>
                        <span className="text-white/60">${(r.value / 1000).toFixed(1)}k</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── PERSONNEL ── */}
          <TabsContent value="personnel" className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumericField
                label="Avg Salary"
                value={state.avgSalary}
                onChange={actions.setAvgSalary}
                icon={DollarSign}
                prefix="$"
                description="Yearly per employee"
              />
              <NumericField
                label="Employee Count"
                value={state.employeeCount}
                onChange={actions.setEmployeeCount}
                icon={Users}
                description="Total team size"
                min={0}
              />
              <GrowthRateField
                label="Salary Growth"
                value={state.salaryGrowth}
                onChange={actions.setSalaryGrowth}
                icon={TrendingUp}
                description="Yearly raise rate"
              />
            </div>

            {personnelData.length > 0 && (
              <div className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4">
                <SectionHeader icon={<Clock className="h-4 w-4" />} title="Personnel Cost Projection" subtitle={`Over ${state.years} year${state.years !== 1 ? "s" : ""}`} />
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={personnelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="Personnel Cost" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FinancialModeler;
