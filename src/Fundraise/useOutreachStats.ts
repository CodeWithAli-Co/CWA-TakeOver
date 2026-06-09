/**
 * useOutreachStats.ts — deliverability + accuracy stats for the
 * Fundraise module.
 *
 * Queries crm_activities for outbound emails the operator has sent
 * over a given window (default 30 days), then calls the gmail/bounces
 * route to count how many of those bounced. Returns a small struct
 * the Deliverability panel can render directly.
 *
 * Per-pattern accuracy is included when the sent email has a
 * metadata.pattern field on its activity row (set by shotgun mode in
 * the Gmail send route — backfills as "verified" for older sends).
 *
 * Not real-time: we re-fetch on demand via the panel's Refresh
 * button. Bouncing is also re-checked at that moment so a freshly-
 * sent batch can be evaluated as soon as the operator wants.
 */

import { useEffect, useMemo, useState } from "react";
import { companySupabase } from "@/routes/index.lazy";
import { checkBounces, type BounceRecord } from "./checkBounces";

export interface OutreachStats {
  totalSent: number;
  totalBounced: number;
  deliveryRate: number; // 0..1
  /** Per-pattern accuracy. Each row: pattern, sent, bounced, rate.
   *  Patterns: 'verified', 'first', 'first.last', 'flast',
   *  'firstlast', 'first_last', 'unknown'. */
  byPattern: PatternStat[];
  /** Recent bounced addresses + reason for the operator to scan. */
  recentBounces: BounceRecord[];
}

export interface PatternStat {
  pattern: string;
  sent: number;
  bounced: number;
  rate: number; // delivery rate 0..1
}

export interface UseOutreachStatsState {
  data: OutreachStats | null;
  loading: boolean;
  error: string | null;
  /** Re-run query + bounce check. */
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

/** Hook backing the Deliverability panel. windowDays defaults to 30. */
export function useOutreachStats(
  windowDays: number = 30,
): UseOutreachStatsState {
  const [data, setData] = useState<OutreachStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString();
  }, [windowDays]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
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
        limit: 50,
      });

      const bouncedSet = new Set(
        bounceRes.bounces.map((b) => b.failed_email.toLowerCase()),
      );

      // 3. Compute per-pattern stats. Activities without
      //    metadata.pattern get bucketed as "unknown" so older sends
      //    aren't dropped from the totals.
      const patternMap = new Map<
        string,
        { sent: number; bounced: number }
      >();
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
        // Sort with verified first, then patterns ranked by sample
        // size (more sends -> more reliable signal).
        .sort((a, b) => {
          if (a.pattern === "verified") return -1;
          if (b.pattern === "verified") return 1;
          return b.sent - a.sent;
        });

      // Cap recentBounces at 10 for the panel render.
      const recentBounces = bounceRes.bounces.slice(0, 10);

      const totalSent = outbound.length;
      const totalBounced = Array.from(bouncedSet).filter((email) =>
        outbound.some((r) => (r.metadata?.to ?? "").toLowerCase() === email),
      ).length;

      setData({
        totalSent,
        totalBounced,
        deliveryRate:
          totalSent === 0 ? 0 : (totalSent - totalBounced) / totalSent,
        byPattern,
        recentBounces,
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load outreach stats.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount + when window changes.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinceIso]);

  return { data, loading, error, refresh: load };
}
