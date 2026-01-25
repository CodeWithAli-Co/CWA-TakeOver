// TimeStats - Statistics dashboard cards for time tracking
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  Flame,
  TrendingUp,
  DollarSign,
  BarChart3,
  Target,
  Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { formatHours, type TimeStats as TimeStatsType } from "@/stores/timeTrackingTypes";
import { useTimeStats } from "@/stores/timeTrackingQueries";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
  delay?: number;
}

const StatCard = ({ title, value, subtitle, icon, trend, color = "red", delay = 0 }: StatCardProps) => {
  const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
    red: { bg: "bg-red-900/20", border: "border-red-900/30", icon: "text-red-500" },
    green: { bg: "bg-green-900/20", border: "border-green-900/30", icon: "text-green-500" },
    blue: { bg: "bg-blue-900/20", border: "border-blue-900/30", icon: "text-blue-500" },
    purple: { bg: "bg-purple-900/20", border: "border-purple-900/30", icon: "text-purple-500" },
    orange: { bg: "bg-orange-900/20", border: "border-orange-900/30", icon: "text-orange-500" },
    yellow: { bg: "bg-yellow-900/20", border: "border-yellow-900/30", icon: "text-yellow-500" },
  };

  const colors = colorClasses[color] || colorClasses.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -2 }}
    >
      <Card className={`${colors.bg} ${colors.border} border rounded-xs h-full`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-amber-50/60 text-sm mb-1">{title}</p>
              <p className="text-amber-50 text-2xl font-bold">{value}</p>
              {subtitle && <p className="text-amber-50/50 text-xs mt-1">{subtitle}</p>}
              {trend !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
                  <TrendingUp className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`} />
                  <span>{Math.abs(trend)}% vs last week</span>
                </div>
              )}
            </div>
            <div className={`${colors.icon} p-2 rounded-lg ${colors.bg}`}>{icon}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface TimeStatsProps {
  stats?: TimeStatsType;
  showAllStats?: boolean;
}

export const TimeStatsCards = ({ showAllStats = true }: TimeStatsProps) => {
  const { data: stats } = useTimeStats();

  const primaryStats = [
    {
      title: "Today",
      value: formatHours(stats.total_hours_today),
      subtitle: stats.total_hours_today > 0 ? "Keep it up!" : "No entries yet",
      icon: <Clock className="h-5 w-5" />,
      color: "red",
    },
    {
      title: "This Week",
      value: formatHours(stats.total_hours_this_week),
      subtitle: `${Math.round(stats.total_hours_this_week / 5)}h avg/day`,
      icon: <Calendar className="h-5 w-5" />,
      color: "blue",
    },
    {
      title: "This Month",
      value: formatHours(stats.total_hours_this_month),
      subtitle: `${formatHours(stats.billable_hours_this_month)} billable`,
      icon: <BarChart3 className="h-5 w-5" />,
      color: "purple",
    },
    {
      title: "This Year",
      value: formatHours(stats.total_hours_this_year),
      subtitle: `~${Math.round(stats.total_hours_this_year / 12)}h/month avg`,
      icon: <Target className="h-5 w-5" />,
      color: "green",
    },
  ];

  const secondaryStats = [
    {
      title: "Current Streak",
      value: `${stats.current_streak} days`,
      subtitle: stats.current_streak > 0 ? "Don't break it!" : "Start logging!",
      icon: <Flame className="h-5 w-5" />,
      color: "orange",
    },
    {
      title: "Longest Streak",
      value: `${stats.longest_streak} days`,
      subtitle: "Personal best",
      icon: <Award className="h-5 w-5" />,
      color: "yellow",
    },
    {
      title: "Billable Rate",
      value:
        stats.total_hours_this_month > 0
          ? `${Math.round((stats.billable_hours_this_month / stats.total_hours_this_month) * 100)}%`
          : "N/A",
      subtitle: formatHours(stats.non_billable_hours_this_month) + " non-billable",
      icon: <DollarSign className="h-5 w-5" />,
      color: "green",
    },
    {
      title: "Most Productive",
      value: stats.most_productive_day,
      subtitle: `${formatHours(stats.average_hours_per_day)} avg/day`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "blue",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {primaryStats.map((stat, index) => (
          <StatCard key={stat.title} {...stat} delay={index * 0.1} />
        ))}
      </div>

      {/* Secondary Stats */}
      {showAllStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secondaryStats.map((stat, index) => (
            <StatCard key={stat.title} {...stat} delay={0.4 + index * 0.1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Compact version for sidebar or smaller displays
export const TimeStatsCompact = () => {
  const { data: stats } = useTimeStats();

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-amber-50 font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-500" />
            Quick Stats
          </h3>
          {stats.current_streak > 0 && (
            <Badge className="bg-orange-900/30 text-orange-400 flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {stats.current_streak} day streak
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-amber-50/60 text-sm">Today</span>
            <span className="text-amber-50 font-medium">{formatHours(stats.total_hours_today)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-amber-50/60 text-sm">This Week</span>
            <span className="text-amber-50 font-medium">{formatHours(stats.total_hours_this_week)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-amber-50/60 text-sm">This Month</span>
            <span className="text-amber-50 font-medium">{formatHours(stats.total_hours_this_month)}</span>
          </div>
          <div className="h-px bg-red-900/20 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-amber-50/60 text-sm">Year Total</span>
            <span className="text-green-400 font-bold">{formatHours(stats.total_hours_this_year)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Large stat card for highlighting specific metrics
interface LargeStatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color?: string;
  chart?: React.ReactNode;
}

export const LargeStatCard = ({ title, value, subtitle, icon, color = "red", chart }: LargeStatCardProps) => {
  const colorClasses: Record<string, { bg: string; border: string; glow: string }> = {
    red: { bg: "bg-red-900/10", border: "border-red-900/30", glow: "shadow-red-500/10" },
    green: { bg: "bg-green-900/10", border: "border-green-900/30", glow: "shadow-green-500/10" },
    blue: { bg: "bg-blue-900/10", border: "border-blue-900/30", glow: "shadow-blue-500/10" },
  };

  const colors = colorClasses[color] || colorClasses.red;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
    >
      <Card className={`${colors.bg} ${colors.border} ${colors.glow} shadow-lg border rounded-xs overflow-hidden`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-amber-50/60 text-sm uppercase tracking-wider">{title}</p>
              <p className="text-amber-50 text-4xl font-bold mt-2">{value}</p>
              <p className="text-amber-50/50 text-sm mt-1">{subtitle}</p>
            </div>
            <div className="text-amber-50/30">{icon}</div>
          </div>
          {chart && <div className="mt-4">{chart}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TimeStatsCards;
