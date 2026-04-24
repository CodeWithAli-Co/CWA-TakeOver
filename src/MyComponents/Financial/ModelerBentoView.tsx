/**
 * ModelerBentoView.tsx — Bento layout for the Financial Modeler tab.
 *
 * Replaces the two huge stacked cards (FinancialModeler + FinancialProjections)
 * with a single multi-tile bento that pulls pieces out of each and arranges
 * them side-by-side.
 *
 * Layout (12-col, lg+):
 *   Row 1 (col-12):  Unified KPI strip — 6 tiles
 *                    Runway · Break-even · CAGR · ROI · Profit Margin · Final Cash
 *   Row 2:           Configure tile (col-5, tabbed inputs) · Revenue vs Expenses chart (col-7)
 *   Row 3:           Expenses by Category pie (col-4) · Revenue by Category pie (col-4)
 *                    · Cumulative Profit area chart (col-4)
 *
 * Everything is driven by useFinancialState so edits in the Configure tile
 * reflect instantly in the charts and KPI strip. Uses the same NumericField,
 * GrowthRateField, YearSelector, DynamicItem, and CustomTooltip helpers as
 * the original components so input styling stays consistent.
 */

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Percent,
  TrendingUp,
  Users,
  Plus,
  CreditCard,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useFinancialState } from "./FinancialContext";
import {
  NumericField,
  GrowthRateField,
  YearSelector,
  CustomTooltip,
  DynamicItem,
} from "./FinancialComponents";
import {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "@/stores/FinancialConstants";
import {
  calculateAnnualAmount,
  getCategoryColor,
} from "@/stores/FinancialUtils";

// ─────────────────────────────────────────────────────────────────────────
// Small KPI tile used in the top strip. Variants match the original Void
// palette: `accent` draws a left-border accent in red.
// ─────────────────────────────────────────────────────────────────────────
const KpiTile: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
}> = ({ label, value, accent }) => (
  <div
    className={`bg-card border border-border rounded-sm p-4 ${
      accent ? "border-l-2 border-l-red-500" : ""
    }`}
  >
    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">
      {label}
    </p>
    <p className="text-xl font-bold text-foreground tracking-tight mt-1">
      {value}
    </p>
  </div>
);

const ModelerBentoView: React.FC = () => {
  const { state, projections, metrics, actions } = useFinancialState();
  const [configTab, setConfigTab] = useState("base");

  // Charts skip year 0 (the initial state — not a projected datapoint).
  const chartData = projections.slice(1).map((p) => ({
    year: p.year,
    Revenue: Math.round(p.totalRevenue),
    Expenses: Math.round(p.totalExpenses),
    Profit: Math.round(p.netProfit),
    Cumulative: Math.round(p.cumulativeProfit),
  }));

  // Category aggregations drive the two pies in row 3.
  const expenseByCategory = state.expenses.reduce<Record<string, number>>(
    (acc, e) => {
      const cat = e.category || "Other";
      acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(e);
      return acc;
    },
    {},
  );
  const revenueByCategory = state.revenues.reduce<Record<string, number>>(
    (acc, r) => {
      const cat = r.category || "Other";
      acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(r);
      return acc;
    },
    {},
  );
  const expensePieData = Object.entries(expenseByCategory).map(
    ([name, value]) => ({ name, value }),
  );
  const revenuePieData = Object.entries(revenueByCategory).map(
    ([name, value]) => ({ name, value }),
  );
  const totalAnnualExpenses = expensePieData.reduce((s, e) => s + e.value, 0);
  const totalAnnualRevenue = revenuePieData.reduce((s, r) => s + r.value, 0);

  const hasProjections = projections.length > 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
      {/* ══════════════ ROW 1 — KPI strip (col-span-12) ══════════════
          Six metrics in one horizontal band: Runway (current-state) on the
          left, forward-looking metrics in the middle, Final Cash on the
          right. Stays in sync with the live config below. */}
      <div className="col-span-1 md:col-span-2 lg:col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Runway"
          value={`${metrics.runwayMonths.toFixed(1)} mo`}
          accent
        />
        <KpiTile
          label="Break-even"
          value={metrics.breakEvenYear ? `Year ${metrics.breakEvenYear}` : "N/A"}
          accent
        />
        <KpiTile label="CAGR" value={`${metrics.cagr.toFixed(1)}%`} />
        <KpiTile label="ROI" value={`${metrics.roi.toFixed(1)}%`} />
        <KpiTile
          label="Profit Margin"
          value={`${metrics.profitMargin.toFixed(1)}%`}
        />
        <KpiTile
          label="Final Cash"
          value={`$${(metrics.finalCashFlow / 1000).toFixed(1)}k`}
        />
      </div>

      {/* ══════════════ ROW 2 — Configure (col-5) + Rev vs Exp (col-7) ══════════════
          Configure tile keeps the 4-tab structure from the original Modeler
          (Base / Expenses / Revenue / Personnel) but lives in a slimmer
          col-5 tile. Revenue vs Expenses composed chart takes col-7 so it
          reads well at typical widths. */}

      {/* Configure tile */}
      <div className="col-span-1 md:col-span-2 lg:col-span-5 bg-card border border-border rounded-sm overflow-hidden flex flex-col">
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border">
          <div className="p-1.5 rounded-sm bg-primary/[0.08] border border-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground/85">
              Configure
            </h3>
            <p className="text-[10px] text-muted-foreground/60">
              Model inputs &amp; scenarios
            </p>
          </div>
        </div>

        <div className="p-5 flex-1">
          <Tabs value={configTab} onValueChange={setConfigTab}>
            <TabsList className="bg-muted/30 border border-border rounded-sm h-8 mb-5">
              <TabsTrigger
                value="base"
                className="data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary text-muted-foreground/50 rounded-sm text-[11px] h-6"
              >
                <DollarSign className="h-3 w-3 mr-1.5" /> Base
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                className="data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary text-muted-foreground/50 rounded-sm text-[11px] h-6"
              >
                <CreditCard className="h-3 w-3 mr-1.5" /> Expenses (
                {state.expenses.length})
              </TabsTrigger>
              <TabsTrigger
                value="revenue"
                className="data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary text-muted-foreground/50 rounded-sm text-[11px] h-6"
              >
                <TrendingUp className="h-3 w-3 mr-1.5" /> Revenue (
                {state.revenues.length})
              </TabsTrigger>
              <TabsTrigger
                value="personnel"
                className="data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary text-muted-foreground/50 rounded-sm text-[11px] h-6"
              >
                <Users className="h-3 w-3 mr-1.5" /> Personnel
              </TabsTrigger>
            </TabsList>

            {/* Base parameters — 2x2 input grid */}
            <TabsContent value="base" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumericField
                  label="Initial Capital"
                  value={state.initialCapital}
                  onChange={actions.setInitialCapital}
                  icon={DollarSign}
                  prefix="$"
                  description="Starting cash"
                />
                <NumericField
                  label="Tax Rate"
                  value={state.taxRate}
                  onChange={actions.setTaxRate}
                  icon={Percent}
                  suffix="%"
                  description="Effective tax"
                  min={0}
                  max={50}
                />
                <NumericField
                  label="Inflation"
                  value={state.inflationRate}
                  onChange={actions.setInflationRate}
                  icon={TrendingUp}
                  suffix="%"
                  description="Annual rate"
                  min={0}
                  max={20}
                />
                <YearSelector
                  years={state.years}
                  setYears={actions.setYears}
                />
              </div>
            </TabsContent>

            {/* Expenses — dynamic list, scrollable inside the tile */}
            <TabsContent value="expenses" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-foreground/60 font-medium">
                    ${totalAnnualExpenses.toLocaleString()}
                    <span className="text-muted-foreground/60 text-[10px] ml-1">
                      /year
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {state.expenses.length} items
                  </p>
                </div>
                <button
                  onClick={actions.addExpense}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/[0.08] hover:bg-red-500/[0.12] border border-primary/15 text-primary text-[10px] rounded-sm transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {state.expenses.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-sm">
                    <p className="text-[11px] text-muted-foreground/40 mb-2">
                      No expenses yet
                    </p>
                    <button
                      onClick={actions.addExpense}
                      className="text-[11px] text-primary hover:text-red-300"
                    >
                      + Add your first expense
                    </button>
                  </div>
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
            </TabsContent>

            {/* Revenue — same structure as Expenses */}
            <TabsContent value="revenue" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-primary font-medium">
                    ${totalAnnualRevenue.toLocaleString()}
                    <span className="text-muted-foreground/60 text-[10px] ml-1">
                      /year
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {state.revenues.length} streams
                  </p>
                </div>
                <button
                  onClick={actions.addRevenue}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/[0.08] hover:bg-red-500/[0.12] border border-primary/15 text-primary text-[10px] rounded-sm transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {state.revenues.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-sm">
                    <p className="text-[11px] text-muted-foreground/40 mb-2">
                      No revenue streams yet
                    </p>
                    <button
                      onClick={actions.addRevenue}
                      className="text-[11px] text-primary hover:text-red-300"
                    >
                      + Add your first revenue stream
                    </button>
                  </div>
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
            </TabsContent>

            {/* Personnel — 3 simple fields */}
            <TabsContent value="personnel" className="space-y-4">
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
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Revenue vs Expenses composed chart (col-7) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-7 bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium">
              Revenue vs Expenses
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {state.years}-year projection
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="text-muted-foreground">Expenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              <span className="text-muted-foreground">Profit</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          {hasProjections ? (
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="Revenue"
                  fill="#ef4444"
                  radius={[2, 2, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="Expenses"
                  fill="rgba(255,255,255,0.4)"
                  radius={[2, 2, 0, 0]}
                  barSize={20}
                />
                <Line
                  type="monotone"
                  dataKey="Profit"
                  stroke="#fca5a5"
                  strokeWidth={2}
                  dot={{ fill: "#fca5a5", r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[12px] text-muted-foreground/40">
                Configure inputs to see projections
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ ROW 3 — Expense pie / Revenue pie / Cumulative profit ══════════════
          Three equal tiles (col-4 each) — visual rhythm after the tall row
          above. Each pie carries a short legend with the top 4 categories. */}

      {/* Expenses by Category */}
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium mb-4">
          Expenses by Category
        </p>
        {expensePieData.length > 0 ? (
          <>
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={62}
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
                    formatter={(v: any) => [
                      `$${Number(v).toLocaleString()}`,
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {expensePieData.slice(0, 4).map((e) => (
                <div
                  key={e.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: getCategoryColor(e.name, true) }}
                    />
                    <span className="text-muted-foreground/70 truncate">
                      {e.name}
                    </span>
                  </div>
                  <span className="text-foreground/60 shrink-0 ml-2">
                    ${(e.value / 1000).toFixed(1)}k
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40">
              No expenses yet
            </p>
          </div>
        )}
      </div>

      {/* Revenue by Category */}
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium mb-4">
          Revenue by Category
        </p>
        {revenuePieData.length > 0 ? (
          <>
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={revenuePieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={62}
                    stroke="none"
                  >
                    {revenuePieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={getCategoryColor(entry.name, false)}
                      />
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
                    formatter={(v: any) => [
                      `$${Number(v).toLocaleString()}`,
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {revenuePieData.slice(0, 4).map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: getCategoryColor(r.name, false) }}
                    />
                    <span className="text-muted-foreground/70 truncate">
                      {r.name}
                    </span>
                  </div>
                  <span className="text-foreground/60 shrink-0 ml-2">
                    ${(r.value / 1000).toFixed(1)}k
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40">
              No revenue yet
            </p>
          </div>
        )}
      </div>

      {/* Cumulative Profit trend */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium">
            Cumulative Profit
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            {state.years}-year trend
          </p>
        </div>
        {hasProjections ? (
          <div className="h-48">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="modCumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#ef4444"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="#ef4444"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={0}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="2 2"
                />
                <Area
                  type="monotone"
                  dataKey="Cumulative"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#modCumGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40">
              No projections yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelerBentoView;
