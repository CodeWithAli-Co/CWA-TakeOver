/**
 * SimplicityPayments.tsx — Replaces the invoicer 3-pane layout when
 * the company toggle is set to "simplicityFunds".
 *
 * Shows subscription payment data from Simplicity's stripe_subscriptions
 * table, plus user/revenue metrics. No client sidebar needed — Simplicity
 * is a B2C product, so we show aggregated subscription analytics.
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  CreditCard,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Crown,
  Droplets,
  RefreshCcw,
  Filter,
} from "lucide-react";
import {
  useSimplicitySubscriptions,
  useSimplicityUsers,
  useSimplicityMetrics,
  SimplicityUser,
} from "../Simplicity/api/simplicityQueries";

// ── Status badge styling ──
const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15",
  trialing: "bg-blue-500/[0.08] text-blue-400 border-blue-500/15",
  past_due: "bg-amber-500/[0.08] text-amber-400 border-amber-500/15",
  canceled: "bg-red-500/[0.08] text-red-400 border-red-500/15",
  incomplete: "bg-muted/50 text-muted-foreground/70 border-border",
};

const getStatusStyle = (status: string) =>
  statusStyles[status] || statusStyles.incomplete;

// ── Plan badge styling ──
const planBadge = (plan: string) => {
  if (plan === "Tide" || plan === "premium")
    return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
};

export function SimplicityPayments() {
  const { data: subscriptions = [], refetch, isLoading } = useSimplicitySubscriptions();
  const { data: users = [] } = useSimplicityUsers();
  const metrics = useSimplicityMetrics();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Build a user lookup map for enriching subscription rows
  const userMap = useMemo(() => {
    const map = new Map<string, SimplicityUser>();
    users.forEach((u) => {
      if (u.supa_id) map.set(u.supa_id, u);
      map.set(String(u.id), u);
    });
    return map;
  }, [users]);

  // Filter subscriptions
  const filtered = useMemo(() => {
    return subscriptions.filter((sub: any) => {
      // Status filter
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;

      // Search filter (by user email/name or subscription ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const user = userMap.get(sub.user_id);
        const matchesUser =
          user?.email?.toLowerCase().includes(q) ||
          user?.first_name?.toLowerCase().includes(q) ||
          user?.last_name?.toLowerCase().includes(q);
        const matchesSub = sub.stripe_subscription_id?.toLowerCase().includes(q);
        if (!matchesUser && !matchesSub) return false;
      }

      return true;
    });
  }, [subscriptions, statusFilter, searchQuery, userMap]);

  // Revenue calculations
  const activeSubCount = subscriptions.filter(
    (s: any) => s.status === "active"
  ).length;
  const monthlyRevenue = activeSubCount * 4.99; // Tide monthly price
  const statuses = ["all", "active", "trialing", "past_due", "canceled"];

  return (
    <div className="min-h-screen bg-background overflow-hidden flex flex-col transition-colors duration-500">
      {/* Page header */}
      <div className="px-8 pt-6 pb-3 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-foreground tracking-tight">
              Subscription Payments
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Simplicity Funds — Stripe subscriptions & user billing
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-sm bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border transition-colors"
          title="Refresh"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Metrics strip */}
      <div className="px-8 pb-4">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-border">
            <MetricCell
              icon={<Users className="h-4 w-4 text-primary" />}
              label="Total Users"
              value={String(metrics.totalUsers)}
            />
            <MetricCell
              icon={<Crown className="h-4 w-4 text-primary" />}
              label="Tide (Paid)"
              value={String(metrics.tideUsers)}
            />
            <MetricCell
              icon={<Droplets className="h-4 w-4 text-muted-foreground" />}
              label="Ripple (Free)"
              value={String(metrics.rippleUsers)}
            />
            <MetricCell
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              label="Est. MRR"
              value={`$${monthlyRevenue.toFixed(2)}`}
            />
            <MetricCell
              icon={<CreditCard className="h-4 w-4 text-primary" />}
              label="Conversion"
              value={`${metrics.totalUsers > 0 ? Math.round((metrics.tideUsers / metrics.totalUsers) * 100) : 0}%`}
            />
          </div>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="px-8 pb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search by user, email, or subscription ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-sm text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-sm text-[10px] font-medium capitalize transition-all duration-200 ${
                statusFilter === s
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription table */}
      <div className="px-8 pb-10 flex-1">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.8fr] gap-4 px-6 py-3 border-b border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              User
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Subscription ID
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Plan
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Status
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Started
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium text-right">
              Billing
            </span>
          </div>

          {/* Table body */}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground/60">
                {subscriptions.length === 0
                  ? "No subscriptions yet"
                  : "No matching subscriptions"}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((sub: any, i: number) => {
                const user = userMap.get(sub.user_id);
                return (
                  <motion.div
                    key={sub.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_0.8fr] gap-4 items-center px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors group"
                  >
                    {/* User */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-primary font-medium">
                          {user
                            ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()
                            : "??"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground/80 truncate">
                          {user
                            ? `${user.first_name} ${user.last_name}`
                            : "Unknown User"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {user?.email || sub.user_id}
                        </p>
                      </div>
                    </div>

                    {/* Subscription ID */}
                    <span className="text-[11px] text-muted-foreground font-mono truncate">
                      {sub.stripe_subscription_id
                        ? `sub_...${sub.stripe_subscription_id.slice(-8)}`
                        : "—"}
                    </span>

                    {/* Plan */}
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border w-fit ${planBadge(
                        user?.plan || "free"
                      )}`}
                    >
                      {user?.plan || "Free"}
                    </span>

                    {/* Status */}
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border w-fit ${getStatusStyle(
                        sub.status
                      )}`}
                    >
                      {sub.status || "unknown"}
                    </span>

                    {/* Started */}
                    <span className="text-[11px] text-muted-foreground">
                      {sub.created_at
                        ? new Date(sub.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })
                        : "—"}
                    </span>

                    {/* Billing */}
                    <span className="text-[13px] font-semibold text-primary text-right tabular-nums">
                      {sub.status === "active" ? "$4.99/mo" : "—"}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} of {subscriptions.length} subscriptions
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Live from Simplicity DB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable metric cell ──
function MetricCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground tracking-tight">
        {value}
      </p>
    </div>
  );
}
