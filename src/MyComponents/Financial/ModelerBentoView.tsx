/**
 * ModelerBentoView.tsx — Editorial bento for the Financial Modeler tab.
 *
 * Replaces the two huge stacked cards (FinancialModeler + FinancialProjections)
 * with a single multi-tile bento, and brings the design in line with the rest
 * of the dashboard: gradient tile chrome, mono eyebrows, Newsreader serif
 * titles, mono numerics, emerald accent.
 *
 * Layout (12-col, lg+):
 *   Row 1 (col-12): KPI strip — 6 tiles (Runway · Break-even · CAGR · ROI ·
 *                                        Profit margin · Final cash)
 *   Row 2: Configure (col-5, mono-uppercase tabbed inputs) · Rev vs Exp (col-7)
 *   Row 3: Expense mix (col-4) · Revenue mix (col-4) · Cumulative profit (col-4)
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

// ════════════════════════════════════════════
// Shared editorial chrome — same tokens used by Overview / Customers /
// Reports so all four tabs read as one design system.
// ════════════════════════════════════════════
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const serifTitle = "ed-serif text-[20px] mt-1.5 text-zinc-100";
const monoNum = "font-mono tabular-nums";

// Compact KPI tile — eyebrow + mono number stacked tight. `accent` swaps
// the value color to emerald and adds a pulsing dot in the eyebrow (used
// for the headline metric on the strip: Runway).
const KpiTile: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
  sub?: string;
}> = ({ label, value, accent, sub }) => (
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

  // Configure tabs definition — same mono-caps underline pattern as the
  // Customers directory and Reports filter strip.
  const mTabs: Array<{
    key: string;
    label: string;
    icon: typeof DollarSign;
    count?: number;
  }> = [
    { key: "base", label: "Base", icon: DollarSign },
    {
      key: "expenses",
      label: "Expenses",
      icon: CreditCard,
      count: state.expenses.length,
    },
    {
      key: "revenue",
      label: "Revenue",
      icon: TrendingUp,
      count: state.revenues.length,
    },
    { key: "personnel", label: "Personnel", icon: Users },
  ];

  return (
    <div className="space-y-3">
      {/* Newsreader serif loaded inline once so the modeler tab renders
          its editorial titles without relying on a global registration. */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&display=swap');.ed-serif{font-family:'Newsreader',Georgia,serif}`}</style>

      <div className="grid grid-cols-12 gap-3.5">
        {/* ── KPI strip (6 compact tiles · col-2 each = 12) ──── */}
        <KpiTile
          label="Runway"
          value={`${metrics.runwayMonths.toFixed(1)} mo`}
          accent
        />
        <KpiTile
          label="Break-even"
          value={metrics.breakEvenYear ? `Yr ${metrics.breakEvenYear}` : "—"}
        />
        <KpiTile label="CAGR" value={`${metrics.cagr.toFixed(1)}%`} />
        <KpiTile label="ROI" value={`${metrics.roi.toFixed(1)}%`} />
        <KpiTile
          label="Profit margin"
          value={`${metrics.profitMargin.toFixed(1)}%`}
        />
        <KpiTile
          label="Final cash"
          value={`$${(metrics.finalCashFlow / 1000).toFixed(1)}k`}
          sub={`${state.years}-yr horizon`}
        />

        {/* ── Configure tile (5 cols) ────────────────────────────
            Underline-style mono-caps tab strip replaces the chrome-y
            pill bar. Each tab carries its live count chip so the
            tab strip doubles as a quick summary at a glance. */}
        <div
          className={`col-span-12 lg:col-span-5 ${tile} overflow-hidden flex flex-col`}
        >
          <div className="px-5 pt-5">
            <p className={eyebrow}>Model inputs</p>
            <h3 className={serifTitle}>Configure</h3>
          </div>

          <Tabs
            value={configTab}
            onValueChange={setConfigTab}
            className="flex flex-col flex-1 mt-3"
          >
            <TabsList className="bg-transparent border-0 rounded-none h-auto p-0 w-full justify-start gap-0 mx-5 border-b border-white/[0.07]">
              {mTabs.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="group relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-zinc-100 text-zinc-500 hover:text-zinc-300 rounded-none px-2.5 pb-2 pt-2 h-auto text-[10.5px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <t.icon className="h-3 w-3 opacity-80" />
                  {t.label}
                  {t.count !== undefined && (
                    <span className="text-zinc-700 group-data-[state=active]:text-emerald-400 ml-0.5">
                      {t.count}
                    </span>
                  )}
                  <span className="absolute -bottom-px left-2.5 right-2.5 h-0.5 bg-emerald-400 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-left" />
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-5 flex-1">
              {/* Base parameters — 2x2 input grid */}
              <TabsContent value="base" className="space-y-4 mt-0">
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

              {/* Expenses — dynamic list, scrollable */}
              <TabsContent value="expenses" className="space-y-3 mt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-[15px] text-zinc-100 font-medium ${monoNum}`}
                    >
                      ${totalAnnualExpenses.toLocaleString()}
                      <span className="text-zinc-500 text-[10px] ml-1.5 font-mono uppercase tracking-wider">
                        /year
                      </span>
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                      {state.expenses.length} items
                    </p>
                  </div>
                  <button
                    onClick={actions.addExpense}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] rounded-lg transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add expense
                  </button>
                </div>
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {state.expenses.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/[0.08] rounded-lg">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 mb-2">
                        No expenses yet
                      </p>
                      <button
                        onClick={actions.addExpense}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono uppercase tracking-wider"
                      >
                        + Add first
                      </button>
                    </div>
                  ) : (
                    state.expenses.map((e) => (
                      <DynamicItem
                        key={e.id}
                        item={e}
                        onChange={(item) =>
                          actions.updateExpense(item as any)
                        }
                        onDelete={() => actions.deleteExpense(e.id)}
                        type="expense"
                        categories={EXPENSE_CATEGORIES}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Revenue — same shape, emerald accent on total */}
              <TabsContent value="revenue" className="space-y-3 mt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-[15px] text-emerald-400 font-medium ${monoNum}`}
                    >
                      ${totalAnnualRevenue.toLocaleString()}
                      <span className="text-zinc-500 text-[10px] ml-1.5 font-mono uppercase tracking-wider">
                        /year
                      </span>
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                      {state.revenues.length} streams
                    </p>
                  </div>
                  <button
                    onClick={actions.addRevenue}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] rounded-lg transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add stream
                  </button>
                </div>
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {state.revenues.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/[0.08] rounded-lg">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 mb-2">
                        No revenue streams
                      </p>
                      <button
                        onClick={actions.addRevenue}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono uppercase tracking-wider"
                      >
                        + Add first
                      </button>
                    </div>
                  ) : (
                    state.revenues.map((r) => (
                      <DynamicItem
                        key={r.id}
                        item={r}
                        onChange={(item) =>
                          actions.updateRevenue(item as any)
                        }
                        onDelete={() => actions.deleteRevenue(r.id)}
                        type="revenue"
                        categories={REVENUE_CATEGORIES}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Personnel — 3 simple fields */}
              <TabsContent value="personnel" className="space-y-4 mt-0">
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
            </div>
          </Tabs>
        </div>

        {/* ── Revenue vs Expenses composed chart (7 cols) ─────
            Emerald bars for revenue, neutral zinc bars for expenses,
            light emerald line for profit. Same color logic as the rest
            of the dashboard. */}
        <div
          className={`col-span-12 lg:col-span-7 ${tile} p-5 flex flex-col`}
        >
          <div className="flex items-baseline gap-3 mb-4">
            <div>
              <p className={eyebrow}>Projection</p>
              <h3 className={serifTitle}>Revenue vs expenses</h3>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-zinc-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-500">Expenses</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span className="text-zinc-500">Profit</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            {hasProjections ? (
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#71717a",
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: "#71717a",
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="Revenue"
                    fill="#3ecf8e"
                    radius={[2, 2, 0, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="Expenses"
                    fill="rgba(161,161,170,0.4)"
                    radius={[2, 2, 0, 0]}
                    barSize={20}
                  />
                  <Line
                    type="monotone"
                    dataKey="Profit"
                    stroke="#a7f3d0"
                    strokeWidth={2}
                    dot={{ fill: "#a7f3d0", r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
                  Configure inputs to see projections
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Expense mix (4 cols) ───────────────────────────── */}
        <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
          <p className={eyebrow}>Expense mix</p>
          <h3 className={serifTitle}>By category</h3>
          {expensePieData.length > 0 ? (
            <>
              <div className="h-40 mt-4">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
                      stroke="none"
                    >
                      {expensePieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={getCategoryColor(entry.name, true)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#fafafa",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      formatter={(v: any) => [
                        `$${Number(v).toLocaleString()}`,
                        "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {expensePieData.slice(0, 4).map((e) => (
                  <div
                    key={e.name}
                    className="flex items-center justify-between text-[10.5px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: getCategoryColor(e.name, true) }}
                      />
                      <span className="text-zinc-400 truncate">{e.name}</span>
                    </div>
                    <span
                      className={`text-zinc-300 shrink-0 ml-2 ${monoNum}`}
                    >
                      ${(e.value / 1000).toFixed(1)}k
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
                No expenses yet
              </p>
            </div>
          )}
        </div>

        {/* ── Revenue mix (4 cols) ───────────────────────────── */}
        <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
          <p className={eyebrow}>Revenue mix</p>
          <h3 className={serifTitle}>By category</h3>
          {revenuePieData.length > 0 ? (
            <>
              <div className="h-40 mt-4">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={revenuePieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
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
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#fafafa",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      formatter={(v: any) => [
                        `$${Number(v).toLocaleString()}`,
                        "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {revenuePieData.slice(0, 4).map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between text-[10.5px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{
                          background: getCategoryColor(r.name, false),
                        }}
                      />
                      <span className="text-zinc-400 truncate">{r.name}</span>
                    </div>
                    <span
                      className={`text-zinc-300 shrink-0 ml-2 ${monoNum}`}
                    >
                      ${(r.value / 1000).toFixed(1)}k
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
                No revenue yet
              </p>
            </div>
          )}
        </div>

        {/* ── Cumulative profit area chart (4 cols) ──────────── */}
        <div className={`col-span-12 lg:col-span-4 ${tile} p-5`}>
          <p className={eyebrow}>Cumulative profit</p>
          <h3 className={serifTitle}>{state.years}-year trend</h3>
          {hasProjections ? (
            <div className="h-48 mt-4">
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="modCumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#71717a",
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: "#71717a",
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                    }}
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
                    stroke="#3ecf8e"
                    strokeWidth={1.5}
                    fill="url(#modCumGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center mt-4">
              <p className="text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
                No projections yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelerBentoView;
