// TimeTrackingPage - Main dashboard combining all time tracking components
import { useState, Suspense } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  FileText,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Layout,
  List,
  Grid3X3,
  Settings,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";

import { TimeEntryForm } from "./TimeEntryForm";
import { TimeEntryList } from "./TimeEntryList";
import { TimeStatsCards, TimeStatsCompact } from "./TimeStats";
import {
  WeeklyBarChart,
  CompanyPieChart,
  CategoryBarChart,
  CalendarHeatmap,
  YearlyTrendChart,
} from "./TimeChart";
import { TimeReportGenerator, ExportButtons } from "./ReportGenerator";

import { type ViewMode, type TimeEntryWithRelations, formatHours } from "@/stores/timeTrackingTypes";
import { useWeeklyStats, useTimeEntriesByDateRange } from "@/stores/timeTrackingQueries";

// Loading fallback component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-red-500" />
  </div>
);

// View mode tabs
type ViewTab = "dashboard" | "entries" | "reports";

export const TimeTrackingPage = () => {
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithRelations | null>(null);

  // Date range for monthly view
  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-50 flex items-center gap-3">
            <Clock className="h-7 w-7 text-red-500" />
            Time Tracking
          </h1>
          <p className="text-amber-50/60 mt-1">Track your work hours and generate proof of work reports</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Entry Button */}
          <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="bg-red-900 hover:bg-red-800 text-amber-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Time
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-red-900/30 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-amber-50">Log Time Entry</DialogTitle>
              </DialogHeader>
              <TimeEntryForm
                onSuccess={() => setShowAddEntry(false)}
                defaultDate={format(new Date(), "yyyy-MM-dd")}
              />
            </DialogContent>
          </Dialog>

          {/* Export Dropdown */}
          <Suspense fallback={<Button disabled className="bg-black/40"><Loader2 className="h-4 w-4 animate-spin" /></Button>}>
            <ExportButtons />
          </Suspense>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)} className="w-full">
        <TabsList className="bg-black/40 border border-red-900/30 p-1">
          <TabsTrigger
            value="dashboard"
            className="data-[state=active]:bg-red-900/50 data-[state=active]:text-amber-50 text-amber-50/70"
          >
            <Layout className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="entries"
            className="data-[state=active]:bg-red-900/50 data-[state=active]:text-amber-50 text-amber-50/70"
          >
            <List className="h-4 w-4 mr-2" />
            Entries
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-red-900/50 data-[state=active]:text-amber-50 text-amber-50/70"
          >
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {/* Stats Cards */}
          <Suspense fallback={<LoadingSpinner />}>
            <TimeStatsCards showAllStats={true} />
          </Suspense>

          {/* View Mode Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-black/40 border border-red-900/30 rounded-lg p-1">
              {(["daily", "weekly", "monthly", "yearly"] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewMode(mode)}
                  className={`capitalize ${
                    viewMode === mode
                      ? "bg-red-900/50 text-amber-50"
                      : "text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20"
                  }`}
                >
                  {mode}
                </Button>
              ))}
            </div>

            {/* Month Navigation for Monthly View */}
            {viewMode === "monthly" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))}
                  className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-amber-50/70 min-w-[120px] text-center">
                  {format(selectedMonth, "MMMM yyyy")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))}
                  className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Charts Grid */}
          <Suspense fallback={<LoadingSpinner />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly/Daily View */}
              {(viewMode === "weekly" || viewMode === "daily") && (
                <>
                  <WeeklyBarChart />
                  <WeeklyStatsCharts />
                </>
              )}

              {/* Monthly View */}
              {viewMode === "monthly" && (
                <>
                  <MonthlyHeatmapWrapper month={selectedMonth} />
                  <WeeklyStatsCharts />
                </>
              )}

              {/* Yearly View */}
              {viewMode === "yearly" && (
                <>
                  <YearlyStats />
                  <WeeklyStatsCharts />
                </>
              )}
            </div>
          </Suspense>

          {/* Recent Entries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Suspense fallback={<LoadingSpinner />}>
                <TimeEntryList maxEntries={5} showFilters={false} onEditEntry={setEditingEntry} />
              </Suspense>
            </div>
            <div>
              <Suspense fallback={<LoadingSpinner />}>
                <TimeStatsCompact />
              </Suspense>
            </div>
          </div>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Suspense fallback={<LoadingSpinner />}>
                <TimeEntryList showFilters={true} onEditEntry={setEditingEntry} />
              </Suspense>
            </div>
            <div className="space-y-6">
              <TimeEntryForm compact />
              <Suspense fallback={<LoadingSpinner />}>
                <TimeStatsCompact />
              </Suspense>
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <TimeReportGenerator />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="bg-zinc-950 border-red-900/30 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-50">Edit Time Entry</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <TimeEntryForm
              onSuccess={() => setEditingEntry(null)}
              defaultDate={editingEntry.date}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper component for weekly stats charts
const WeeklyStatsCharts = () => {
  const { data: stats } = useWeeklyStats(0);

  return (
    <div className="space-y-6">
      {stats.by_company.length > 0 && <CompanyPieChart data={stats.by_company} />}
      {stats.by_category.length > 0 && <CategoryBarChart data={stats.by_category} />}
    </div>
  );
};

// Helper component for monthly heatmap
const MonthlyHeatmapWrapper = ({ month }: { month: Date }) => {
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
  const { data: entries } = useTimeEntriesByDateRange(monthStart, monthEnd);

  // Aggregate hours by date
  const dailyData: Record<string, number> = {};
  entries.forEach((entry) => {
    dailyData[entry.date] = (dailyData[entry.date] || 0) + entry.duration_minutes / 60;
  });

  const heatmapData = Object.entries(dailyData).map(([date, hours]) => ({ date, hours }));

  return <CalendarHeatmap data={heatmapData} month={month} />;
};

// Helper component for yearly stats
const YearlyStats = () => {
  // This would need a yearly query - for now showing placeholder
  const currentYear = new Date().getFullYear();
  const months = [];
  for (let i = 0; i < 12; i++) {
    months.push({
      month: `${currentYear}-${String(i + 1).padStart(2, "0")}`,
      hours: Math.random() * 160 + 40, // Placeholder
      billable_hours: Math.random() * 120 + 30,
    });
  }

  return <YearlyTrendChart data={months} />;
};

export default TimeTrackingPage;
