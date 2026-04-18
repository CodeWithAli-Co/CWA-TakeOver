/**
 * CWA Dashboard — Black & Red bento grid for CodeWithAli.
 * Shows agency metrics, projects, revenue, team, and an area chart.
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
  FolderGit2,
  DollarSign,
  TrendingUp,
  Clock,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { ActiveUser, Employees, Todos } from "@/stores/query";
import { Suspense } from "react";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import Meetings from "@/MyComponents/HomeDashboard/meetings";

// ── Revenue chart data (static for now — can be wired to financial context later) ──
const revenueData = [
  { month: "Sep", revenue: 320, expenses: 280 },
  { month: "Oct", revenue: 580, expenses: 310 },
  { month: "Nov", revenue: 420, expenses: 290 },
  { month: "Dec", revenue: 610, expenses: 350 },
  { month: "Jan", revenue: 490, expenses: 320 },
  { month: "Feb", revenue: 671, expenses: 380 },
  { month: "Mar", revenue: 720, expenses: 400 },
  { month: "Apr", revenue: 850, expenses: 420 },
];

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

function CWADashboardContent() {
  const { data: employees } = Employees();
  const { data: todos } = Todos("all");

  const totalEmployees = employees?.length ?? 0;
  const openTasks = todos?.filter((t: any) => t.status !== "done")?.length ?? 0;
  const completedTasks = todos?.filter((t: any) => t.status === "done")?.length ?? 0;

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* ── Row 1: Stat Cards ── */}
      <div className="col-span-3">
        <StatCard icon={Users} label="Team Members" value={String(totalEmployees)} change="+2 this quarter" positive delay={0.05} />
      </div>
      <div className="col-span-3">
        <StatCard icon={FolderGit2} label="Active Projects" value="4" change="+1 new" positive delay={0.1} />
      </div>
      <div className="col-span-3">
        <StatCard icon={DollarSign} label="Monthly Revenue" value="$850" change="+26.7%" positive delay={0.15} />
      </div>
      <div className="col-span-3">
        <StatCard icon={TrendingUp} label="Growth Rate" value="34%" change="+8.2% MoM" positive delay={0.2} />
      </div>

      {/* ── Row 2: Area Chart (8 cols) + Tasks (4 cols) ── */}
      <BentoCard span="col-span-8 row-span-2" delay={0.25} noPadding>
        <div className="px-4 pt-4 pb-2">
          <BentoLabel>Revenue vs Expenses</BentoLabel>
          <p className="text-[11px] text-muted-foreground mt-0.5">Last 8 months</p>
        </div>
        <div className="h-[280px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="cwa-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="cwa-expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Area type="monotone" dataKey="expenses" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} fill="url(#cwa-expenses)" />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cwa-revenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      <BentoCard span="col-span-4 row-span-2" delay={0.3}>
        <BentoLabel>Tasks Overview</BentoLabel>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Open Tasks</span>
            <span className="text-sm font-bold text-primary tabular-nums">{openTasks}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{
                width: `${
                  openTasks + completedTasks > 0
                    ? (openTasks / (openTasks + completedTasks)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Completed</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">{completedTasks}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{
                width: `${
                  openTasks + completedTasks > 0
                    ? (completedTasks / (openTasks + completedTasks)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Total: {openTasks + completedTasks} tasks</span>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* ── Row 3: Quick Links ── */}
      <BentoCard span="col-span-4" delay={0.35}>
        <BentoLabel>Quick Stats</BentoLabel>
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Chat Messages</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">1,247</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Git Commits</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">342</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground">Hours Tracked</span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">186h</span>
          </div>
        </div>
      </BentoCard>

      <BentoCard span="col-span-8" delay={0.4}>
        <BentoLabel>Active Projects</BentoLabel>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {[
            { name: "Simplicity", status: "In Progress", progress: 72 },
            { name: "CWA Invoicer", status: "Active", progress: 85 },
            { name: "Mario Hauling", status: "Active", progress: 60 },
            { name: "Registry Site", status: "Planning", progress: 20 },
          ].map((project, i) => (
            <div key={i} className="p-3 rounded-md bg-muted/30 border border-border-subtle">
              <p className="text-sm font-medium text-foreground">{project.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{project.status}</p>
              <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </BentoCard>

      {/* ── Row 4: Full Tasks + Meetings widgets ── */}
      <div className="col-span-7">
        <TasksComponent />
      </div>
      <div className="col-span-5">
        <Meetings />
      </div>
    </div>
  );
}

export function CWADashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-12 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="col-span-3 h-24 rounded-lg bg-card animate-pulse" />
          ))}
          <div className="col-span-8 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
          <div className="col-span-4 row-span-2 h-[340px] rounded-lg bg-card animate-pulse" />
        </div>
      }
    >
      <CWADashboardContent />
    </Suspense>
  );
}
