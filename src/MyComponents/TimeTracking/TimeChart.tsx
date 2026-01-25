// TimeChart - Visual representations of time tracking data
import { useState } from "react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/button";
import {
  COMPANIES,
  CATEGORY_COLORS,
  type TimeCategory,
  type WeeklyStats,
  formatHours,
} from "@/stores/timeTrackingTypes";
import { useWeeklyStats } from "@/stores/timeTrackingQueries";

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-red-900/30 rounded-lg p-3 shadow-lg">
        <p className="text-amber-50 font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatHours(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Weekly bar chart showing hours per day
interface WeeklyChartProps {
  weekOffset?: number;
  onWeekChange?: (offset: number) => void;
}

export const WeeklyBarChart = ({ weekOffset = 0, onWeekChange }: WeeklyChartProps) => {
  const [offset, setOffset] = useState(weekOffset);
  const { data: stats } = useWeeklyStats(offset);

  const chartData = stats.daily_hours.map((day) => ({
    day: format(parseISO(day.date), "EEE"),
    date: format(parseISO(day.date), "MMM d"),
    hours: day.total_minutes / 60,
    billable: day.billable_minutes / 60,
  }));

  const handlePrevWeek = () => {
    const newOffset = offset + 1;
    setOffset(newOffset);
    onWeekChange?.(newOffset);
  };

  const handleNextWeek = () => {
    const newOffset = Math.max(0, offset - 1);
    setOffset(newOffset);
    onWeekChange?.(newOffset);
  };

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-500" />
            Weekly Hours
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrevWeek}
              className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-amber-50/70 min-w-[120px] text-center">
              {format(parseISO(stats.week_start), "MMM d")} - {format(parseISO(stats.week_end), "MMM d")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNextWeek}
              disabled={offset === 0}
              className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 h-8 w-8 p-0 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Badge className="bg-red-900/30 text-red-400">{formatHours(stats.total_hours)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a0000" opacity={0.3} />
              <XAxis
                dataKey="day"
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 12 }}
                axisLine={{ stroke: "#4a0000" }}
              />
              <YAxis
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 12 }}
                axisLine={{ stroke: "#4a0000" }}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" name="Total Hours" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="billable" name="Billable" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day labels with dates */}
        <div className="flex justify-between mt-2 px-4">
          {chartData.map((day) => (
            <span key={day.day} className="text-amber-50/40 text-xs">
              {day.date}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Company distribution pie chart
interface CompanyPieChartProps {
  data: { company_id: string; company_name: string; hours: number; color: string }[];
}

export const CompanyPieChart = ({ data }: CompanyPieChartProps) => {
  const chartData = data.map((item) => ({
    name: item.company_name,
    value: item.hours,
    color: item.color,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-50 flex items-center gap-2">
          <div
            className="h-5 w-5 rounded-full"
            style={{ background: "linear-gradient(135deg, #ef4444, #3b82f6)" }}
          />
          Hours by Company
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ stroke: "#fef3c7", strokeOpacity: 0.3 }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-amber-50/70 text-sm">
                {item.name}: <span className="text-amber-50">{formatHours(item.value)}</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Category distribution chart
interface CategoryChartProps {
  data: { category: TimeCategory; hours: number }[];
}

export const CategoryBarChart = ({ data }: CategoryChartProps) => {
  const chartData = data
    .map((item) => ({
      category: item.category,
      hours: item.hours,
      color: getCategoryColor(item.category),
    }))
    .sort((a, b) => b.hours - a.hours);

  function getCategoryColor(category: TimeCategory): string {
    const colors: Record<TimeCategory, string> = {
      Development: "#3b82f6",
      Design: "#8b5cf6",
      Business: "#22c55e",
      Marketing: "#f97316",
      Meetings: "#eab308",
      Research: "#06b6d4",
      Planning: "#6366f1",
      Documentation: "#14b8a6",
      Testing: "#ec4899",
      Deployment: "#ef4444",
      Support: "#f59e0b",
      Other: "#6b7280",
    };
    return colors[category] || "#6b7280";
  }

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-50 flex items-center gap-2">
          Hours by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a0000" opacity={0.3} horizontal={false} />
              <XAxis
                type="number"
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 11 }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" name="Hours" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Calendar heatmap for monthly view
interface CalendarHeatmapProps {
  data: { date: string; hours: number }[];
  month: Date;
}

export const CalendarHeatmap = ({ data, month }: CalendarHeatmapProps) => {
  const getIntensity = (hours: number): string => {
    if (hours === 0) return "bg-black/40";
    if (hours < 2) return "bg-red-900/30";
    if (hours < 4) return "bg-red-900/50";
    if (hours < 6) return "bg-red-800/60";
    if (hours < 8) return "bg-red-700/70";
    return "bg-red-600/80";
  };

  // Generate calendar grid
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = format(new Date(month.getFullYear(), month.getMonth(), i), "yyyy-MM-dd");
    const dayData = data.find((d) => d.date === dateStr);
    days.push({
      day: i,
      date: dateStr,
      hours: dayData?.hours || 0,
    });
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-50">{format(month, "MMMM yyyy")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-amber-50/50 text-xs text-center py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01 }}
              className={`aspect-square rounded-sm flex flex-col items-center justify-center ${
                day ? getIntensity(day.hours) : ""
              } ${day ? "border border-red-900/20 cursor-pointer hover:border-red-500/50" : ""}`}
              title={day ? `${day.date}: ${formatHours(day.hours)}` : ""}
            >
              {day && (
                <>
                  <span className="text-amber-50/70 text-xs">{day.day}</span>
                  {day.hours > 0 && <span className="text-amber-50 text-[10px]">{day.hours.toFixed(1)}h</span>}
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-amber-50/50 text-xs">Less</span>
          <div className="flex gap-1">
            {["bg-black/40", "bg-red-900/30", "bg-red-900/50", "bg-red-800/60", "bg-red-700/70", "bg-red-600/80"].map(
              (color, i) => (
                <div key={i} className={`h-3 w-3 rounded-sm ${color}`} />
              )
            )}
          </div>
          <span className="text-amber-50/50 text-xs">More</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Trend area chart for yearly view
interface YearlyTrendChartProps {
  data: { month: string; hours: number; billable_hours: number }[];
}

export const YearlyTrendChart = ({ data }: YearlyTrendChartProps) => {
  const chartData = data.map((item) => ({
    month: format(parseISO(item.month + "-01"), "MMM"),
    total: item.hours,
    billable: item.billable_hours,
  }));

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-50">Yearly Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBillable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a0000" opacity={0.3} />
              <XAxis
                dataKey="month"
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 12 }}
              />
              <YAxis
                stroke="#fef3c7"
                strokeOpacity={0.5}
                tick={{ fill: "#fef3c7", fillOpacity: 0.7, fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Hours"
                stroke="#dc2626"
                fillOpacity={1}
                fill="url(#colorTotal)"
              />
              <Area
                type="monotone"
                dataKey="billable"
                name="Billable"
                stroke="#22c55e"
                fillOpacity={1}
                fill="url(#colorBillable)"
              />
              <Legend
                wrapperStyle={{ color: "#fef3c7" }}
                formatter={(value) => <span className="text-amber-50/70">{value}</span>}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyBarChart;
