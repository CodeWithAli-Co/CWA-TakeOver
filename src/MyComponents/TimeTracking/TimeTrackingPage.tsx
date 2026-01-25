// TimeTrackingPage - Modern bento-grid dashboard for time tracking
import { useState, Suspense } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Zap,
  BarChart2,
  FileText,
  Timer,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcnComponents/dialog";

import { TimeEntryForm } from "./TimeEntryForm";
import { TimeEntryList } from "./TimeEntryList";
import { TimeStatsCards, QuickStatsBar } from "./TimeStats";
import {
  WeeklyBarChart,
  CompanyPieChart,
  CategoryBarChart,
  CalendarHeatmap,
} from "./TimeChart";
import { TimeReportGenerator, ExportButtons } from "./ReportGenerator";

import { type TimeEntryWithRelations } from "@/stores/timeTrackingTypes";
import { useWeeklyStats, useTimeEntriesByDateRange } from "@/stores/timeTrackingQueries";

// Loading component
const LoadingState = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-center", className)}>
    <Loader2 className="h-6 w-6 animate-spin text-white/30" />
  </div>
);

// Bento grid card wrapper
const BentoCard = ({
  children,
  className,
  gradient,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
  onClick?: () => void;
}) => (
  <motion.div
    whileHover={{ scale: 1.01, y: -2 }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl",
      "hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-300",
      onClick && "cursor-pointer",
      className
    )}
  >
    {gradient && (
      <div className={cn("absolute inset-0 opacity-30", gradient)} />
    )}
    <div className="relative z-10 h-full">{children}</div>
  </motion.div>
);

// Section header
const SectionHeader = ({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-white/[0.05]">
        <Icon className="h-4 w-4 text-white/70" />
      </div>
      <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">{title}</h3>
    </div>
    {action}
  </div>
);

// View tabs
type ViewTab = "overview" | "entries" | "reports";

export const TimeTrackingPage = () => {
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithRelations | null>(null);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20">
              <Timer className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Time Tracking</h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/40 text-sm"
          >
            Track work hours and generate proof of work for YC application
          </motion.p>
        </div>

        {/* Quick Stats Bar */}
        <Suspense fallback={<LoadingState className="h-12 w-64" />}>
          <QuickStatsBar />
        </Suspense>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: "overview", label: "Overview", icon: BarChart2 },
          { id: "entries", label: "Entries", icon: CalendarDays },
          { id: "reports", label: "Reports", icon: FileText },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.id as ViewTab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </motion.button>
        ))}

        <div className="flex-1" />

        {/* Export Button */}
        <Suspense fallback={null}>
          <ExportButtons />
        </Suspense>

        {/* Add Entry Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddEntry(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium shadow-lg shadow-red-500/20"
        >
          <Plus className="h-4 w-4" />
          Log Time
        </motion.button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <Suspense fallback={<LoadingState className="h-32" />}>
              <TimeStatsCards />
            </Suspense>

            {/* Bento Grid */}
            <div className="grid grid-cols-12 gap-4">
              {/* Weekly Chart - Large */}
              <BentoCard className="col-span-12 lg:col-span-8 p-6">
                <SectionHeader icon={BarChart2} title="This Week" />
                <Suspense fallback={<LoadingState className="h-64" />}>
                  <WeeklyBarChart />
                </Suspense>
              </BentoCard>

              {/* Company Distribution */}
              <BentoCard className="col-span-12 lg:col-span-4 p-6">
                <SectionHeader icon={TrendingUp} title="By Company" />
                <Suspense fallback={<LoadingState className="h-64" />}>
                  <WeeklyStatsCharts type="company" />
                </Suspense>
              </BentoCard>

              {/* Calendar Heatmap */}
              <BentoCard className="col-span-12 lg:col-span-6 p-6">
                <SectionHeader
                  icon={CalendarDays}
                  title={format(selectedMonth, "MMMM yyyy")}
                  action={
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />
                <Suspense fallback={<LoadingState className="h-48" />}>
                  <MonthlyHeatmapWrapper month={selectedMonth} />
                </Suspense>
              </BentoCard>

              {/* Category Breakdown */}
              <BentoCard className="col-span-12 lg:col-span-6 p-6">
                <SectionHeader icon={Zap} title="By Category" />
                <Suspense fallback={<LoadingState className="h-48" />}>
                  <WeeklyStatsCharts type="category" />
                </Suspense>
              </BentoCard>

              {/* Recent Entries */}
              <BentoCard className="col-span-12 p-6">
                <SectionHeader
                  icon={Clock}
                  title="Recent Entries"
                  action={
                    <button
                      onClick={() => setActiveTab("entries")}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      View All
                    </button>
                  }
                />
                <Suspense fallback={<LoadingState className="h-48" />}>
                  <TimeEntryList maxEntries={5} showFilters={false} onEditEntry={setEditingEntry} compact />
                </Suspense>
              </BentoCard>
            </div>
          </motion.div>
        )}

        {activeTab === "entries" && (
          <motion.div
            key="entries"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-12 gap-6"
          >
            {/* Entries List */}
            <div className="col-span-12 lg:col-span-8">
              <BentoCard className="p-6">
                <Suspense fallback={<LoadingState className="h-96" />}>
                  <TimeEntryList showFilters={true} onEditEntry={setEditingEntry} />
                </Suspense>
              </BentoCard>
            </div>

            {/* Quick Entry Form */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <BentoCard className="p-6" gradient="bg-gradient-to-br from-red-500/10 to-transparent">
                <TimeEntryForm compact onSuccess={() => {}} />
              </BentoCard>
            </div>
          </motion.div>
        )}

        {activeTab === "reports" && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <BentoCard className="p-6">
              <Suspense fallback={<LoadingState className="h-96" />}>
                <TimeReportGenerator />
              </Suspense>
            </BentoCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Timer className="h-5 w-5 text-red-400" />
              Log Time Entry
            </DialogTitle>
          </DialogHeader>
          <TimeEntryForm
            onSuccess={() => setShowAddEntry(false)}
            defaultDate={format(new Date(), "yyyy-MM-dd")}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="bg-zinc-950/95 backdrop-blur-xl border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Timer className="h-5 w-5 text-red-400" />
              Edit Time Entry
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <TimeEntryForm
              onSuccess={() => setEditingEntry(null)}
              defaultDate={editingEntry.date}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Quick Add Button (Mobile) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddEntry(true)}
        className="fixed bottom-6 right-6 lg:hidden p-4 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-2xl shadow-red-500/30"
      >
        <Plus className="h-6 w-6" />
      </motion.button>
    </div>
  );
};

// Helper component for weekly stats charts
const WeeklyStatsCharts = ({ type }: { type: "company" | "category" }) => {
  const { data: stats } = useWeeklyStats(0);

  if (type === "company") {
    return stats.by_company.length > 0 ? (
      <CompanyPieChart data={stats.by_company} />
    ) : (
      <div className="h-48 flex items-center justify-center text-white/30 text-sm">
        No data this week
      </div>
    );
  }

  return stats.by_category.length > 0 ? (
    <CategoryBarChart data={stats.by_category} />
  ) : (
    <div className="h-48 flex items-center justify-center text-white/30 text-sm">
      No data this week
    </div>
  );
};

// Helper component for monthly heatmap
const MonthlyHeatmapWrapper = ({ month }: { month: Date }) => {
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
  const { data: entries } = useTimeEntriesByDateRange(monthStart, monthEnd);

  const dailyData: Record<string, number> = {};
  entries.forEach((entry) => {
    dailyData[entry.date] = (dailyData[entry.date] || 0) + entry.duration_minutes / 60;
  });

  const heatmapData = Object.entries(dailyData).map(([date, hours]) => ({ date, hours }));

  return <CalendarHeatmap data={heatmapData} month={month} />;
};

export default TimeTrackingPage;
