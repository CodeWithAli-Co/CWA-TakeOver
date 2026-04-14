/**
 * Simplicity Dashboard — Zinc & Teal bento grid with live Supabase data.
 * Shows user metrics, expenses, subscriptions, revenue, and an area chart.
 */
import { BentoCard, BentoLabel, BentoValue } from "./BentoCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Wallet,
  CreditCard,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
  PiggyBank,
  Activity,
} from "lucide-react";
import {
  useSimplicityMetrics,
  useSimplicityExpenses,
  useSimplicitySubscriptions,
  useSimplicityFinancialDetails,
  useSimplicityCashflow,
  useSimplicityUsers,
} from "../Simplicity/api/simplicityQueries";
import { Suspense, useMemo } from "react";

// ── helpers ──
const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  positive,
  delay = 0,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  delay?: number;
}) {
  return (
    <BentoCard delay={delay}>
      <div className="flex items-start justify-between">
        <div>
          <BentoLabel>{label}</BentoLabel>
          <div className="mt-1">
            <BentoValue>{value}</BentoValue>
          </div>
          {change && (
            <div className="flex items-center gap-1 mt-1.5">
              {positive ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-primary" />
              )}
              <span
                className={`text-[10px] font-medium ${
                  positive ? "text-emerald-400" : "text-primary"
                }`}
              >
                {change}
              </span>
            </div>
          )}
        </div>
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </BentoCard>
  );
}

function SimplicityDashboardContent() {
  const metrics = useSimplicityMetrics();
  const { data: expenses } = useSimplicityExpenses();
  const { data: subscriptions } = useSimplicitySubscriptions();
  const { data: financials } = useSimplicityFinancialDetails();
  const { data: cashflow } = useSimplicityCashflow();
  const { data: users } = useSimplicityUsers();

  // ── Build monthly cashflow chart from real data ──
  const chartData = useMemo(() => {
    if (!cashflow || cashflow.length === 0) {
      // Fallback static data if no cashflow yet
      return [
        { month: "Sep", income: 0, expenses: 0 },
        { month: "Oct", income: 0, expenses: 0 },
        { month: "Nov", income: 0, expenses: 0 },
        { month: "Dec", income: 0, expenses: 0 },
        { month: "Jan", income: 0, expenses: 0 },
        { month: "Feb", income: 0, expenses: 0 },
        { month: "Mar", income: 0, expenses: 0 },
        { month: "Apr", income: 0, expenses: 0 },
      ];
    }

    const monthMap: Record<string, { income: number; expenses: number }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const entry of cashflow) {
      const d = new Date(entry.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = monthNames[d.getMonth()];
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 };
      const amount = Math.abs(entry.amount ?? 0);
      if (entry.type === "income") monthMap[key].income += amount;
      else monthMap[key].expenses += amount;
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, vals]) => {
        const [, monthIdx] = key.split("-");
        return {
          month: monthNames[parseInt(monthIdx)],
          income: Math.round(vals.income),
          expenses: Math.round(vals.expenses),
        };
      });
  }, [cashflow]);

  // ── Compute aggregated financial totals ──
  const totalMonthlyIncome =
    financials?.reduce((s: number, f: any) => s + (f.total_monthly_income ?? 0), 0) ?? 0;
  const totalMonthlyExpense =
    financials?.reduce((s: number, f: any) => s + (f.total_monthly_expense ?? 0), 0) ?? 0;

  // ── Subscription stats ──
  const activeSubs = subscriptions?.filter((s: any) => s.status === "active")?.length ?? 0;

  // ── Recent sign-ups (last 30 days) ──
  const recentSignups = useMemo(() => {
    if (!users) return 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return users.filter((u) => new Date(u.joined_at).getTime() > cutoff).length;
  }, [users]);

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* ── Row 1: Stat Cards ── */}
      <div className="col-span-3">
        <StatCard
          icon={Users}
          label="Total Users"
          value={String(metrics.totalUsers)}
          change={`+${recentSignups} this month`}
          positive={recentSignups > 0}
          delay={0.05}
        />
      </div>
      <div className="col-span-3">
        <StatCard
          icon={Activity}
          label="Active Users"
          value={String(metrics.activeUsers)}
          change={`${metrics.totalUsers > 0 ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0}% active`}
          positive
          delay={0.1}
        />
      </div>
      <div className="col-span-3">
        <StatCard
          icon={CreditCard}
          label="Subscriptions"
          value={String(activeSubs)}
          change={`${metrics.tideUsers} Tide users`}
          positive={metrics.tideUsers > 0}
          delay={0.15}
        />
      </div>
      <div className="col-span-3">
        <StatCard
          icon={Wallet}
          label="Tracked Expenses"
          value={fmt(metrics.totalExpenseAmount)}
          change={`${metrics.totalExpenses} entries`}
          positive
          delay={0.2}
        />
      </div>

      {/* ── Row 2: Area Chart (8 cols) + User Breakdown (4 cols) ── */}
      <BentoCard span="col-span-8 row-span-2" delay={0.25} noPadding>
        <div className="px-4 pt-4 pb-2">
          <BentoLabel>User Cashflow Overview</BentoLabel>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Aggregated income vs expenses
          </p>
        </div>
        <div className="h-[280px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="simp-income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="simp-expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                fill="url(#simp-expenses)"
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#simp-income)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      <BentoCard span="col-span-4 row-span-2" delay={0.3}>
        <BentoLabel>User Breakdown</BentoLabel>
        <div className="mt-3 space-y-3">
          {/* Ripple (free) users */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">Ripple (Free)</span>
            </div>
            <span className="text-sm font-bold text-muted-foreground tabular-nums">
              {metrics.rippleUsers}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-muted-foreground/50 transition-all duration-700"
              style={{
                width: `${
                  metrics.totalUsers > 0
                    ? (metrics.rippleUsers / metrics.totalUsers) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Tide (paid) users */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Tide (Paid)</span>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">
              {metrics.tideUsers}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{
                width: `${
                  metrics.totalUsers > 0
                    ? (metrics.tideUsers / metrics.totalUsers) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Bank accounts linked */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-sm text-foreground">Bank Accounts</span>
              </div>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">
                {metrics.totalBankAccounts}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {metrics.uniqueUsersWithExpenses} users tracking expenses
              </span>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* ── Row 3: Financial Summary + Platform Stats ── */}
      <BentoCard span="col-span-4" delay={0.35}>
        <BentoLabel>Financial Summary</BentoLabel>
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm text-foreground">Total Income</span>
            </div>
            <span className="text-sm font-semibold text-emerald-400 tabular-nums">
              {fmt(totalMonthlyIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Total Expenses</span>
            </div>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {fmt(totalMonthlyExpense)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Net Cashflow</span>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                totalMonthlyIncome - totalMonthlyExpense >= 0
                  ? "text-emerald-400"
                  : "text-primary"
              }`}
            >
              {fmt(Math.abs(totalMonthlyIncome - totalMonthlyExpense))}
            </span>
          </div>
        </div>
      </BentoCard>

      <BentoCard span="col-span-8" delay={0.4}>
        <BentoLabel>Platform Metrics</BentoLabel>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {[
            {
              label: "Expenses Logged",
              value: String(metrics.totalExpenses),
              sub: "All time",
            },
            {
              label: "Bank Accounts",
              value: String(metrics.totalBankAccounts),
              sub: "Linked via Plaid",
            },
            {
              label: "Active Subs",
              value: String(activeSubs),
              sub: "Stripe billing",
            },
            {
              label: "Conversion",
              value:
                metrics.totalUsers > 0
                  ? `${Math.round((metrics.tideUsers / metrics.totalUsers) * 100)}%`
                  : "0%",
              sub: "Free → Tide",
            },
          ].map((metric, i) => (
            <div
              key={i}
              className="p-3 rounded-md bg-muted/30 border border-border-subtle"
            >
              <p className="text-sm font-medium text-foreground">
                {metric.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {metric.label}
              </p>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                {metric.sub}
              </p>
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}

export function SimplicityDashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-12 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="col-span-3 h-24 rounded-lg bg-card animate-pulse"
            />
          ))}
          <div className="col-span-8 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
          <div className="col-span-4 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
        </div>
      }
    >
      <SimplicityDashboardContent />
    </Suspense>
  );
}
