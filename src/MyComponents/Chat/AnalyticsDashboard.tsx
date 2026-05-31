/**
 * AnalyticsDashboard.tsx — Owner/CEO-only view of chat activity.
 * Gives leadership visibility into team communication patterns without
 * having to read every message.
 *
 * Metrics shown:
 *   · Total messages (this week, last week, delta)
 *   · Active channels (count)
 *   · Top senders (top 5 by message count, with counts + share)
 *   · Messages per day (last 14 days, mini bar chart)
 *   · Response-time p50 (median reply time across threads)
 *
 * Queries the last 14 days of rows from both chat tables and aggregates
 * client-side. Plenty fast for a team of ~20; if we ever scale past
 * that we can push the aggregates into a SQL view.
 */

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Hash, MessageSquare, TrendingUp, TrendingDown,
  Loader2, Users, Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { takeOversupabase } from "@/MyComponents/supabase";
import { format, startOfDay, subDays } from "date-fns";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface Row {
  sent_by: string;
  created_at: string;
  dm_group?: string | null;
  thread_root_id?: number | null;
  msg_id: number;
}

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fourteenDaysAgo = subDays(new Date(), 14).toISOString();
      const [g, d] = await Promise.all([
        takeOversupabase
          .from("cwa_chat")
          .select("sent_by, created_at, msg_id, thread_root_id")
          .gte("created_at", fourteenDaysAgo),
        takeOversupabase
          .from("cwa_dm_chat")
          .select("sent_by, created_at, msg_id, thread_root_id, dm_group")
          .gte("created_at", fourteenDaysAgo),
      ]);
      if (cancelled) return;
      setRows([...(g.data ?? []), ...(d.data ?? [])] as Row[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const oneWeek = subDays(now, 7);
    const twoWeeks = subDays(now, 14);

    const thisWeek = rows.filter((r) => new Date(r.created_at) >= oneWeek);
    const lastWeek = rows.filter(
      (r) =>
        new Date(r.created_at) >= twoWeeks &&
        new Date(r.created_at) < oneWeek,
    );

    const activeChannels = new Set<string>();
    for (const r of rows) {
      activeChannels.add(r.dm_group || "General");
    }

    const senderCounts = new Map<string, number>();
    for (const r of thisWeek) {
      senderCounts.set(r.sent_by, (senderCounts.get(r.sent_by) ?? 0) + 1);
    }
    const topSenders = [...senderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Messages per day (last 14 days)
    const perDay = new Array(14).fill(0) as number[];
    for (const r of rows) {
      const d = startOfDay(new Date(r.created_at));
      const idx =
        Math.floor((startOfDay(now).getTime() - d.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 14) perDay[13 - idx] += 1;
    }

    // Response-time p50 — for each thread, measure gap between root and
    // first reply. Percentile across all threads.
    const rootsByKey = new Map<string, number>(); // key: "t:msgid" → created_at ms
    const firstReplyByKey = new Map<string, number>();
    for (const r of rows) {
      if (r.thread_root_id == null) {
        // This row might be a root — record created_at.
        rootsByKey.set(`t:${r.msg_id}`, new Date(r.created_at).getTime());
      } else {
        const k = `t:${r.thread_root_id}`;
        const t = new Date(r.created_at).getTime();
        const existing = firstReplyByKey.get(k);
        if (!existing || t < existing) firstReplyByKey.set(k, t);
      }
    }
    const gaps: number[] = [];
    for (const [k, rootT] of rootsByKey) {
      const repT = firstReplyByKey.get(k);
      if (repT && repT > rootT) gaps.push(repT - rootT);
    }
    gaps.sort((a, b) => a - b);
    const p50Ms = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

    return {
      totalThisWeek: thisWeek.length,
      totalLastWeek: lastWeek.length,
      activeChannels: activeChannels.size,
      topSenders,
      perDay,
      p50Ms,
    };
  }, [rows]);

  const delta = stats.totalThisWeek - stats.totalLastWeek;
  const deltaPct =
    stats.totalLastWeek > 0
      ? Math.round((delta / stats.totalLastWeek) * 100)
      : 0;

  const now = new Date();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-[13px]">Crunching 14 days of messages…</span>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-[1040px] p-6">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Chat analytics
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Last 14 days · this-week vs last-week delta
          </p>
        </header>

        {/* Headline cards */}
        <div className="grid grid-cols-12 gap-3 mb-6">
          <StatCard
            className="col-span-12 md:col-span-4"
            label="Messages this week"
            value={stats.totalThisWeek.toLocaleString()}
            footer={
              <span className={`flex items-center gap-1 text-[11px] ${delta >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta >= 0 ? "+" : ""}{delta} ({deltaPct >= 0 ? "+" : ""}{deltaPct}%) vs last week
              </span>
            }
            icon={MessageSquare}
          />
          <StatCard
            className="col-span-6 md:col-span-4"
            label="Active channels"
            value={stats.activeChannels.toLocaleString()}
            footer={<span className="text-[11px] text-muted-foreground">with messages in 14d</span>}
            icon={Hash}
          />
          <StatCard
            className="col-span-6 md:col-span-4"
            label="Median reply time"
            value={stats.p50Ms != null ? humanDuration(stats.p50Ms) : "—"}
            footer={<span className="text-[11px] text-muted-foreground">root → first reply</span>}
            icon={Clock}
          />
        </div>

        {/* Per-day area graph */}
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-semibold">Messages per day</h2>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              14d
            </span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.perDay.map((n, i) => ({
                  day: format(subDays(now, 13 - i), "MMM d"),
                  short: format(subDays(now, 13 - i), "EEEEE"),
                  messages: n,
                }))}
                margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="short"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--primary))",
                    strokeDasharray: "4 4",
                    strokeOpacity: 0.5,
                  }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={(v, payload) =>
                    payload?.[0]?.payload?.day ?? v
                  }
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#analyticsArea)"
                  activeDot={{
                    r: 4,
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                    fill: "hsl(var(--primary))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top senders */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-semibold">Top senders this week</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {stats.topSenders.length === 0 && (
              <li className="text-[12px] text-muted-foreground">No messages yet.</li>
            )}
            {stats.topSenders.map(([user, count], i) => {
              const share = stats.totalThisWeek
                ? (count / stats.totalThisWeek) * 100
                : 0;
              return (
                <li key={user} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[10px] text-primary">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {user}
                      </span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {count} msgs · {share.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </ScrollArea>
  );
}

function StatCard({
  className = "", label, value, footer, icon: Icon,
}: {
  className?: string;
  label: string;
  value: string;
  footer: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[9.5px] uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
        {value}
      </div>
      <div className="mt-0.5">{footer}</div>
    </div>
  );
}

function humanDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
