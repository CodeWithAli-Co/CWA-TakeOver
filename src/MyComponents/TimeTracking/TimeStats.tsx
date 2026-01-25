// TimeStats - Modern statistics cards for time tracking
import { motion } from "framer-motion";
import {
  Clock,
  Flame,
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Zap,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours, type TimeStats as TimeStatsType } from "@/stores/timeTrackingTypes";
import { useTimeStats } from "@/stores/timeTrackingQueries";

// Modern stat card with gradient border
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}

const StatCard = ({ title, value, subtitle, icon, gradient, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: "easeOut" }}
    className="group relative"
  >
    {/* Gradient border effect */}
    <div className={cn("absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500", gradient)} />

    <div className="relative bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 h-full hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-xl", gradient.replace("bg-gradient-to-r", "bg-gradient-to-br").replace("via-", "to-"))}>
          {icon}
        </div>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
            {subtitle}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-white/40">{title}</p>
      </div>
    </div>
  </motion.div>
);

// Large featured stat card
interface FeaturedStatProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  metric?: { label: string; value: string; positive?: boolean };
}

const FeaturedStat = ({ title, value, subtitle, icon, gradient, metric }: FeaturedStatProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
    className="relative overflow-hidden"
  >
    {/* Background gradient */}
    <div className={cn("absolute inset-0 opacity-20", gradient)} />

    <div className="relative bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-xl", gradient.replace("bg-gradient-to-r", "bg-gradient-to-br"))}>
          {icon}
        </div>
        {metric && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            metric.positive ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/50"
          )}>
            <TrendingUp className={cn("h-3 w-3", !metric.positive && "rotate-180")} />
            {metric.value}
          </div>
        )}
      </div>

      <div>
        <p className="text-4xl font-bold text-white tracking-tight mb-1">{value}</p>
        <p className="text-sm text-white/50">{title}</p>
        <p className="text-xs text-white/30 mt-2">{subtitle}</p>
      </div>
    </div>
  </motion.div>
);

export const TimeStatsCards = () => {
  const { data: stats } = useTimeStats();

  const statCards = [
    {
      title: "Today",
      value: formatHours(stats.total_hours_today),
      subtitle: "HOURS",
      icon: <Clock className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-red-500/20 to-orange-500/20",
    },
    {
      title: "This Week",
      value: formatHours(stats.total_hours_this_week),
      subtitle: "TOTAL",
      icon: <Calendar className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20",
    },
    {
      title: "This Month",
      value: formatHours(stats.total_hours_this_month),
      subtitle: `${formatHours(stats.billable_hours_this_month)} billable`,
      icon: <Target className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-purple-500/20 to-pink-500/20",
    },
    {
      title: "This Year",
      value: formatHours(stats.total_hours_this_year),
      subtitle: "TRACKED",
      icon: <TrendingUp className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-emerald-500/20 to-teal-500/20",
    },
    {
      title: "Current Streak",
      value: `${stats.current_streak}d`,
      subtitle: stats.current_streak > 0 ? "ACTIVE" : "START NOW",
      icon: <Flame className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-orange-500/20 to-amber-500/20",
    },
    {
      title: "Best Streak",
      value: `${stats.longest_streak}d`,
      subtitle: "RECORD",
      icon: <Award className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20",
    },
    {
      title: "Billable Rate",
      value: stats.total_hours_this_month > 0
        ? `${Math.round((stats.billable_hours_this_month / stats.total_hours_this_month) * 100)}%`
        : "—",
      subtitle: "THIS MONTH",
      icon: <DollarSign className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-emerald-500/20 to-green-500/20",
    },
    {
      title: "Avg/Day",
      value: formatHours(stats.average_hours_per_day),
      subtitle: stats.most_productive_day.toUpperCase().slice(0, 3),
      icon: <Zap className="h-4 w-4 text-white" />,
      gradient: "bg-gradient-to-r from-indigo-500/20 to-violet-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {statCards.map((stat, index) => (
        <StatCard key={stat.title} {...stat} delay={index * 0.05} />
      ))}
    </div>
  );
};

// Quick stats bar for header
export const QuickStatsBar = () => {
  const { data: stats } = useTimeStats();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-6 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        <span className="text-white/50 text-xs">Today</span>
        <span className="text-white font-semibold text-sm">{formatHours(stats.total_hours_today)}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <span className="text-white/50 text-xs">Week</span>
        <span className="text-white font-semibold text-sm">{formatHours(stats.total_hours_this_week)}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {stats.current_streak > 0 && (
        <div className="flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-orange-400 font-medium text-sm">{stats.current_streak}d</span>
        </div>
      )}
    </motion.div>
  );
};

// Compact stats for sidebar
export const TimeStatsCompact = () => {
  const { data: stats } = useTimeStats();

  const items = [
    { label: "Today", value: formatHours(stats.total_hours_today) },
    { label: "This Week", value: formatHours(stats.total_hours_this_week) },
    { label: "This Month", value: formatHours(stats.total_hours_this_month) },
    { label: "Year Total", value: formatHours(stats.total_hours_this_year), highlight: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Stats
        </h3>
        {stats.current_streak > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10">
            <Flame className="h-3 w-3 text-orange-400" />
            <span className="text-orange-400 text-xs font-medium">{stats.current_streak}d</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <span className="text-white/50 text-sm">{item.label}</span>
            <span className={cn(
              "font-medium",
              item.highlight ? "text-emerald-400" : "text-white"
            )}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeStatsCards;
