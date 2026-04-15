/**
 * s-finance-ops.lazy.tsx — Simplicity Financial Operations
 * Revenue metrics, subscription health, and financial analytics.
 */

import { useState, useMemo } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  TrendingUp,
  Search,
  ChevronUp,
  ChevronDown,
  DollarSign,
  Users,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  useSimplicityMetrics,
  useSimplicitySubscriptions,
  useSimplicityCashflow,
  useSimplicityUsers,
} from "@/MyComponents/Simplicity/api/simplicityQueries";

// Simple AreaChart replacement (since Recharts might not be available)
interface ChartDataPoint {
  date: string;
  amount: number;
}

function SimpleAreaChart({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="w-full h-64 bg-muted/20 rounded-sm flex items-center justify-center">
        <p className="text-xs text-muted-foreground">No data available</p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount));
  const minAmount = Math.min(...data.map((d) => d.amount));
  const range = maxAmount - minAmount || 1;

  return (
    <div className="w-full h-64 bg-muted/20 rounded-sm p-4 flex flex-col">
      <div className="flex-1 flex items-end justify-between gap-1">
        {data.slice(-30).map((point, i) => {
          const height = ((point.amount - minAmount) / range) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group">
              <div
                className="w-full bg-primary/60 hover:bg-primary rounded-t-sm transition-all group-hover:opacity-100 opacity-75"
                style={{ height: `${Math.max(height, 5)}%` }}
              />
              <span className="text-[8px] text-muted-foreground/50 group-hover:text-muted-foreground text-center truncate w-full">
                {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Finance Ops Page ────────────────────────────────────────────
function SimplicityFinanceOpsPage() {
  const { data: subscriptions = [], isLoading: subsLoading } = useSimplicitySubscriptions();
  const { data: cashflow = [], isLoading: cfLoading } = useSimplicityCashflow();
  const { data: users = [] } = useSimplicityUsers();
  const metrics = useSimplicityMetrics();
  const [activeTab, setActiveTab] = useState<"overview" | "subscriptions">("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"status" | "plan" | "started">("started");
  const [sortAsc, setSortAsc] = useState(false);

  // Calculate MRR and ARR
  const tideUsers = users.filter((u) => u.plan === "Tide" || u.plan === "premium");
  const tidePrice = 9.99; // Example price per month
  const mrr = tideUsers.length * tidePrice;
  const arr = mrr * 12;

  // Calculate LTV and Churn (placeholder calculations)
  const ltv = tideUsers.length > 0 ? arr / tideUsers.length : 0;
  const churnRate = 5; // Placeholder

  // Filter and sort subscriptions
  const filtered = subscriptions
    .filter((sub) => {
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return sub.id?.toString().includes(q) || sub.customer_id?.includes(q);
    })
    .sort((a, b) => {
      if (sortField === "status") {
        return sortAsc
          ? (a.status || "").localeCompare(b.status || "")
          : (b.status || "").localeCompare(a.status || "");
      } else if (sortField === "plan") {
        return sortAsc
          ? (a.plan || "").localeCompare(b.plan || "")
          : (b.plan || "").localeCompare(a.plan || "");
      } else {
        const aDate = new Date(a.created_at || "").getTime();
        const bDate = new Date(b.created_at || "").getTime();
        return sortAsc ? aDate - bDate : bDate - aDate;
      }
    });

  const toggleSort = (field: "status" | "plan" | "started") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: "status" | "plan" | "started" }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    );
  };

  // Prepare chart data
  const chartData: ChartDataPoint[] = useMemo(() => {
    const grouped: Record<string, number> = {};
    cashflow.forEach((cf: any) => {
      const dateStr = new Date(cf.date * 1000).toISOString().split("T")[0];
      grouped[dateStr] = (grouped[dateStr] || 0) + (cf.amount || 0);
    });
    return Object.entries(grouped)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [cashflow]);

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length;

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Financial Operations
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Revenue, metrics, and subscription health
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "overview"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "subscriptions"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Subscription Health
        </button>
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Revenue Metrics */}
          <div className="grid grid-cols-5 gap-4">
            {[
              {
                label: "MRR",
                value: `$${mrr.toFixed(2)}`,
                icon: <DollarSign className="h-4 w-4 text-primary" />,
              },
              {
                label: "ARR",
                value: `$${arr.toFixed(2)}`,
                icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
              },
              {
                label: "Total Users",
                value: users.length,
                icon: <Users className="h-4 w-4 text-blue-400" />,
              },
              {
                label: "Churn Rate",
                value: `${churnRate}%`,
                icon: <TrendingDown className="h-4 w-4 text-amber-400" />,
              },
              {
                label: "LTV",
                value: `$${ltv.toFixed(2)}`,
                icon: <Zap className="h-4 w-4 text-purple-400" />,
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-sm p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    {card.label}
                  </span>
                  {card.icon}
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {card.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-card border border-border rounded-sm p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Revenue Trend (Last 30 Days)
            </h3>
            {cfLoading ? (
              <div className="w-full h-64 bg-muted/20 rounded-sm flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <SimpleAreaChart data={chartData} />
            )}
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              {["all", "active", "trialing", "past_due", "canceled"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-2 text-xs font-medium rounded-sm transition-colors ${
                    statusFilter === status
                      ? "bg-primary text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {status === "all"
                    ? "All"
                    : status === "past_due"
                      ? "Past Due"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3.5 border-b border-border">
              <button
                onClick={() => toggleSort("status")}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
              >
                Status <SortIcon field="status" />
              </button>
              <button
                onClick={() => toggleSort("plan")}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
              >
                Plan <SortIcon field="plan" />
              </button>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                Amount
              </span>
              <button
                onClick={() => toggleSort("started")}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
              >
                Started <SortIcon field="started" />
              </button>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium text-right">
                Current Period End
              </span>
            </div>

            {/* Body */}
            {subsLoading ? (
              <div className="p-12 text-center">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No subscriptions found</p>
              </div>
            ) : (
              <div>
                {filtered.map((sub, i) => {
                  const statusColor =
                    sub.status === "active"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : sub.status === "trialing"
                        ? "text-blue-400 bg-blue-500/10"
                        : sub.status === "past_due"
                          ? "text-amber-400 bg-amber-500/10"
                          : "text-red-400 bg-red-500/10";

                  return (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <Badge className={`w-fit text-[10px] rounded-sm ${statusColor}`}>
                        {sub.status || "Unknown"}
                      </Badge>
                      <span className="text-sm text-foreground">
                        {sub.plan || "—"}
                      </span>
                      <span className="text-sm text-foreground font-medium">
                        ${(sub.amount || 0).toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {sub.created_at
                          ? new Date(sub.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                      <span className="text-sm text-muted-foreground text-right">
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : "—"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/10">
                <span className="text-[11px] text-muted-foreground">
                  {filtered.length} of {subscriptions.length} subscriptions
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {activeSubscriptions} active
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createLazyFileRoute("/s-finance-ops")({
  component: SimplicityFinanceOpsPage,
});
