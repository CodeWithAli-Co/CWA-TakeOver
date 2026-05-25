// TimeStats - Modern statistics cards for time tracking.
//
// History: originally rendered 8 stat cards (Today / Week / Month /
// Year / Current Streak / Best Streak / Billable Rate / Avg-per-Day).
// Felt overbearing. Now collapsed to 3:
//   1. Period card — single card with a Today/Week/Month/Year toggle
//      that swaps the hours total in place. One card, four pieces of
//      info, far less visual noise.
//   2. Billable rate.
//   3. Avg per day.
//
// Streak moved entirely to the top-right pill (QuickStatsBar). Both
// streak cards were redundant with the pill and added no signal.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Flame,
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours } from "@/stores/timeTrackingTypes";
import { useTimeStats } from "@/stores/timeTrackingQueries";

// Period toggle — single card replaces the old 4-card Today/Week/Month/Year row.
export type StatPeriod = "today" | "week" | "month" | "year";

const PERIOD_OPTIONS: { id: StatPeriod; letter: string; title: string }[] = [
  { id: "today", letter: "T", title: "Today" },
  { id: "week",  letter: "W", title: "This Week" },
  { id: "month", letter: "M", title: "This Month" },
  { id: "year",  letter: "Y", title: "This Year" },
];

const PERIOD_META: Record<
  StatPeriod,
  { icon: React.ReactNode; gradient: string; title: string }
> = {
  today: {
    icon: <Clock className="h-3.5 w-3.5 text-foreground" />,
    gradient: "bg-gradient-to-br from-red-500/20 to-orange-500/20",
    title: "Today",
  },
  week: {
    icon: <Calendar className="h-3.5 w-3.5 text-foreground" />,
    gradient: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
    title: "This Week",
  },
  month: {
    icon: <Target className="h-3.5 w-3.5 text-foreground" />,
    gradient: "bg-gradient-to-br from-purple-500/20 to-pink-500/20",
    title: "This Month",
  },
  year: {
    icon: <TrendingUp className="h-3.5 w-3.5 text-foreground" />,
    gradient: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
    title: "This Year",
  },
};

interface TimeStatsCardsProps {
  /** Optional controlled period — when provided, the toggle is driven
   *  by the parent so other components (e.g. the area chart) can stay
   *  in sync with the headline number. */
  period?: StatPeriod;
  onPeriodChange?: (p: StatPeriod) => void;
}

export const TimeStatsCards = ({ period: controlledPeriod, onPeriodChange }: TimeStatsCardsProps = {}) => {
  const { data: stats } = useTimeStats();
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<StatPeriod>("today");

  const period = controlledPeriod ?? uncontrolledPeriod;
  const setPeriod = (p: StatPeriod) => {
    if (onPeriodChange) onPeriodChange(p);
    else setUncontrolledPeriod(p);
  };

  const periodValue =
    period === "today" ? stats.total_hours_today    :
    period === "week"  ? stats.total_hours_this_week :
    period === "month" ? stats.total_hours_this_month :
                         stats.total_hours_this_year;

  const periodSubtitle =
    period === "today" ? "Logged today" :
    period === "week"  ? "Week-to-date" :
    period === "month" ? `${formatHours(stats.billable_hours_this_month)} billable` :
                         "Year-to-date";

  const periodMeta = PERIOD_META[period];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── 1. Period card with compact T/W/M/Y toggle ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden bg-muted/30 backdrop-blur-sm border border-border rounded-xl p-3.5"
      >
        <div className={cn("absolute inset-0 opacity-15", periodMeta.gradient)} />

        <div className="relative flex items-center justify-between gap-3">
          {/* Left side: icon + value + subtitle stacked */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("p-1.5 rounded-md shrink-0", periodMeta.gradient)}>
              {periodMeta.icon}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={period}
                initial={{ opacity: 0, x: 3 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -3 }}
                transition={{ duration: 0.12 }}
                className="min-w-0"
              >
                <p className="text-[20px] font-bold text-foreground tracking-tight tabular-nums leading-none">
                  {formatHours(periodValue)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-1 truncate">
                  {periodMeta.title} · {periodSubtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right side: tiny T/W/M/Y pill */}
          <div className="flex items-center gap-0.5 bg-background/20 rounded-md p-0.5 border border-border shrink-0">
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = opt.id === period;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPeriod(opt.id)}
                  title={opt.title}
                  className={cn(
                    "w-6 h-6 text-[10.5px] font-bold rounded-sm transition-colors tabular-nums",
                    isActive
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground/80"
                  )}
                >
                  {opt.letter}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── 2. Billable rate (this month) ── */}
      <CompactStatCard
        title="Billable Rate"
        value={
          stats.total_hours_this_month > 0
            ? `${Math.round((stats.billable_hours_this_month / stats.total_hours_this_month) * 100)}%`
            : "—"
        }
        subtitle="this month"
        icon={<DollarSign className="h-3.5 w-3.5 text-foreground" />}
        gradient="bg-gradient-to-br from-emerald-500/20 to-green-500/20"
        delay={0.05}
      />

      {/* ── 3. Average hours per day ── */}
      <CompactStatCard
        title="Avg / Day"
        value={formatHours(stats.average_hours_per_day)}
        subtitle={`best: ${stats.most_productive_day.slice(0, 3).toLowerCase()}`}
        icon={<Zap className="h-3.5 w-3.5 text-foreground" />}
        gradient="bg-gradient-to-br from-indigo-500/20 to-violet-500/20"
        delay={0.1}
      />
    </div>
  );
};

// ── Compact horizontal stat card (icon + value + label inline, no big stack) ──
interface CompactStatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}

const CompactStatCard = ({ title, value, subtitle, icon, gradient, delay = 0 }: CompactStatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: "easeOut" }}
    className="relative overflow-hidden bg-muted/30 backdrop-blur-sm border border-border rounded-xl p-3.5 hover:bg-muted/50 transition-colors"
  >
    <div className={cn("absolute inset-0 opacity-15", gradient)} />
    <div className="relative flex items-center gap-3">
      <div className={cn("p-1.5 rounded-md shrink-0", gradient)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[20px] font-bold text-foreground tracking-tight tabular-nums leading-none">
          {value}
        </p>
        <p className="text-[10.5px] text-muted-foreground mt-1 truncate">
          {title} · {subtitle}
        </p>
      </div>
    </div>
  </motion.div>
);

// Quick stats bar for header
export const QuickStatsBar = () => {
  const { data: stats } = useTimeStats();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-6 px-5 py-3 rounded-2xl bg-muted/40 border border-border backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        <span className="text-muted-foreground/80 text-xs">Today</span>
        <span className="text-foreground font-semibold text-sm">{formatHours(stats.total_hours_today)}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/80 text-xs">Week</span>
        <span className="text-foreground font-semibold text-sm">{formatHours(stats.total_hours_this_week)}</span>
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
        <h3 className="text-sm font-medium text-foreground/70 uppercase tracking-wider flex items-center gap-2">
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
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/30 border border-border"
          >
            <span className="text-muted-foreground/80 text-sm">{item.label}</span>
            <span className={cn(
              "font-medium",
              item.highlight ? "text-emerald-400" : "text-foreground"
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
