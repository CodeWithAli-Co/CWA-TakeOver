/**
 * useOutreachStats.ts -- deliverability + accuracy stats for the
 * Fundraise Outreach tab.
 *
 * Queries crm_activities for outbound emails the operator has sent
 * over a given window (default 30 days), then calls the gmail/bounces
 * route to count how many of those bounced. Returns:
 *   - totalSent / totalBounced / deliveryRate
 *   - byPattern (per-pattern accuracy bars)
 *   - byDay (day-by-day series for the area chart)
 *   - recentBounces (last 10 bounced for the bounce log)
 *
 * Backed by TanStack Query so the result survives tab-switches
 * (OutreachTab unmounts when the operator flips to Pipeline) and
 * doesn't refetch on every remount -- which was producing visibly
 * different numbers between mounts because `checkBounces` samples
 * Gmail's bounce stream non-deterministically.
 *
 * staleTime: 60s. The "Refresh" button calls refetch() to force.
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkBounces, type BounceRecord } from "./checkBounces";
import { companySupabase } from "@/MyComponents/supabase";

export interface OutreachStats {
  totalSent: number;
  totalBounced: number;
  deliveryRate: number; // 0..1
  byPattern: PatternStat[];
  recentBounces: BounceRecord[];
  byDay: DayStat[];
}

export interface PatternStat {
  pattern: string;
  sent: number;
  bounced: number;
  rate: number; // delivery rate 0..1
}

export interface DayStat {
  day: string; // YYYY-MM-DD UTC
  sent: number;
  bounced: number;
  delivered: number;
}

export interface UseOutreachStatsState {
  data: OutreachStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface ActivityRow {
  id: string;
  happened_at: string;
  created_at: string;
  metadata: {
    direction?: string;
    to?: string;
    pattern?: string;
    [k: string]: any;
  } | null;
}

// How many bounce records to pull. Gmail's stream is ordered most-
// recent-first; if total bounces > limit we'd cap the sample and
// risk missing rows for outbound that bounced earlier in the window.
// 500 covers the realistic upper bound for a single fundraise round
// without paginating, and is well under the Gmail API's per-call
// soft limits.
const BOUNCE_FETCH_LIMIT = 500;

async function loadStats(windowDays: number): Promise<OutreachStats> {
  const sinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString();
  })();

  // 1. All outbound emails sent in the window.
  const { data: rows, error: queryErr } = await companySupabase
    .from("crm_activities")
    .select("id, happened_at, created_at, metadata")
    .eq("type", "email")
    .gte("happened_at", sinceIso)
    .order("happened_at", { ascending: false });
  if (queryErr) throw queryErr;

  const outbound = ((rows ?? []) as ActivityRow[]).filter(
    (r) => r.metadata?.direction === "outbound",
  );

  // 2. Bounces in the same window.
  const bounceRes = await checkBounces({
    sinceIso,
    limit: BOUNCE_FETCH_LIMIT,
  });

  const bouncedSet = new Set(
    bounceRes.bounces.map((b) => b.failed_email.toLowerCase()),
  );

  // 3. Per-pattern stats.
  const patternMap = new Map<string, { sent: number; bounced: number }>();
  for (const row of outbound) {
    const pat = row.metadata?.pattern ?? "unknown";
    const to = (row.metadata?.to ?? "").toLowerCase();
    const cur = patternMap.get(pat) ?? { sent: 0, bounced: 0 };
    cur.sent += 1;
    if (to && bouncedSet.has(to)) cur.bounced += 1;
    patternMap.set(pat, cur);
  }
  const byPattern: PatternStat[] = Array.from(patternMap.entries())
    .map(([pattern, v]) => ({
      pattern,
      sent: v.sent,
      bounced: v.bounced,
      rate: v.sent === 0 ? 0 : (v.sent - v.bounced) / v.sent,
    }))
    .sort((a, b) => {
      if (a.pattern === "verified") return -1;
      if (b.pattern === "verified") return 1;
      return b.sent - a.sent;
    });

  // 4. Day-by-day series.
  const byDayMap = new Map<string, { sent: number; bounced: number }>();
  for (const row of outbound) {
    const day = row.happened_at.slice(0, 10); // YYYY-MM-DD
    const to = (row.metadata?.to ?? "").toLowerCase();
    const cur = byDayMap.get(day) ?? { sent: 0, bounced: 0 };
    cur.sent += 1;
    if (to && bouncedSet.has(to)) cur.bounced += 1;
    byDayMap.set(day, cur);
  }
  const byDay: DayStat[] = [];
  const start = new Date(sinceIso);
  const end = new Date();
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    const v = byDayMap.get(key) ?? { sent: 0, bounced: 0 };
    byDay.push({
      day: key,
      sent: v.sent,
      bounced: v.bounced,
      delivered: Math.max(0, v.sent - v.bounced),
    });
  }

  const recentBounces = bounceRes.bounces.slice(0, 10);
  const totalSent = outbound.length;
  const totalBounced = Array.from(bouncedSet).filter((email) =>
    outbound.some((r) => (r.metadata?.to ?? "").toLowerCase() === email),
  ).length;

  return {
    totalSent,
    totalBounced,
    deliveryRate:
      totalSent === 0 ? 0 : (totalSent - totalBounced) / totalSent,
    byPattern,
    recentBounces,
    byDay,
  };
}

/** Hook backing the Outreach tab + Deliverability panel. windowDays
 *  defaults to 30. Cached for 60s -- tab switches return the cached
 *  result instead of refetching. Refresh button forces a refetch. */
export function useOutreachStats(
  windowDays: number = 30,
): UseOutreachStatsState {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["fundraise", "outreach-stats", windowDays] as const,
    [windowDays],
  );

  const q = useQuery<OutreachStats, Error>({
    queryKey,
    queryFn: () => loadStats(windowDays),
    // 60s staleTime -- the operator clicking around tabs shouldn't
    // re-run this. The Refresh button is the explicit refresh path.
    staleTime: 60_000,
    // gcTime preserves the cache for 5 minutes after the last
    // subscriber unmounts. Tab-switch + come-back-later still gets
    // the cached number with no flicker.
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    data: q.data ?? null,
    loading: q.isLoading || q.isFetching,
    error: q.error ? q.error.message : null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}
