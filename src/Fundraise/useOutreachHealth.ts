/**
 * useOutreachHealth.ts — sending health monitor for Phase 11.3.
 *
 * Layered on top of useOutreachStats: pulls the same bounce records
 * and parses their reason snippets to classify what kind of failure
 * we're seeing. The OutreachDashboard surfaces this so the operator
 * can spot account suspensions, rate limits, and policy blocks
 * before they snowball.
 *
 * Why a separate hook: useOutreachStats already does the heavy
 * Gmail query. We just enrich its data here without re-fetching.
 *
 * Classification taxonomy (intentionally coarse — false positives
 * are cheap, false negatives can torch your sender reputation):
 *
 *   account_suspended   — sender's mail host suspended outbound
 *                          ('your account has been temporarily suspended',
 *                           'sending is disabled', 'mailbox is suspended')
 *   policy_block        — Gmail/Outlook flagged content as spam
 *                          ('our system has detected', '550 5.7.1',
 *                           'message content', 'unsolicited')
 *   rate_limit          — too many sends per host
 *                          ('rate limit', 'too many', 'try again later',
 *                           '421 4.7.0')
 *   misconfigured       — Send-As alias auth broken (very common when
 *                          the upstream host suspends)
 *                          ('misconfigured', 'send mail as', 'authentication')
 *   recipient_invalid   — the address doesn't exist (the normal,
 *                          healthy bounce shape from pattern guessing)
 *                          ('no such user', 'does not exist',
 *                           '550 5.1.1', 'recipient address rejected')
 *   domain_invalid      — firm's MX is bad
 *                          ('domain not found', 'no mx', '550 5.1.2')
 *   other               — couldn't classify; counted but not alarmed
 */

import { useMemo } from "react";
import { useOutreachStats, type OutreachStats } from "./useOutreachStats";
import type { BounceRecord } from "./checkBounces";

export type BounceCategory =
  | "account_suspended"
  | "policy_block"
  | "rate_limit"
  | "misconfigured"
  | "recipient_invalid"
  | "domain_invalid"
  | "other";

export interface BounceClassification {
  category: BounceCategory;
  bounce: BounceRecord;
}

export interface CategoryStat {
  category: BounceCategory;
  count: number;
  /** True when this category should raise an operator alert (red
   *  banner on the dashboard). recipient_invalid + domain_invalid
   *  are normal and NOT alarming -- they just mean the pattern
   *  was wrong, which is expected with shotgun mode. */
  alarming: boolean;
  /** Human-friendly label for the dashboard. */
  label: string;
}

export interface OutreachHealth {
  stats: OutreachStats | null;
  /** Per-bounce category for the recent bounce list. */
  classifications: BounceClassification[];
  /** Aggregated counts per category. */
  categoryStats: CategoryStat[];
  /** True if at least one alarming category showed up in the window
   *  (account_suspended / policy_block / rate_limit /
   *   misconfigured). Surface a red banner. */
  hasAlarmingBounces: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CATEGORY_LABEL: Record<BounceCategory, string> = {
  account_suspended: "Account suspended",
  policy_block: "Policy / spam block",
  rate_limit: "Rate limited",
  misconfigured: "Send-As misconfigured",
  recipient_invalid: "Bad recipient",
  domain_invalid: "Bad firm domain",
  other: "Other",
};

const ALARMING: ReadonlySet<BounceCategory> = new Set([
  "account_suspended",
  "policy_block",
  "rate_limit",
  "misconfigured",
]);

/** Categorize a bounce by inspecting its reason_snippet. */
export function classifyBounce(b: BounceRecord): BounceCategory {
  const text = (b.reason_snippet ?? "").toLowerCase();
  // Order matters -- check the loudest/most-actionable first.
  if (
    text.includes("suspended") ||
    text.includes("sending is disabled") ||
    text.includes("account has been temporarily")
  ) {
    return "account_suspended";
  }
  if (
    text.includes("policy") ||
    text.includes("our system has detected") ||
    text.includes("unsolicited") ||
    text.includes("550 5.7.1") ||
    text.includes("message content")
  ) {
    return "policy_block";
  }
  if (
    text.includes("rate limit") ||
    text.includes("too many") ||
    text.includes("try again later") ||
    text.includes("421 4.7.0")
  ) {
    return "rate_limit";
  }
  if (
    text.includes("misconfigured") ||
    text.includes("send mail as") ||
    text.includes("authentication")
  ) {
    return "misconfigured";
  }
  if (
    text.includes("no such user") ||
    text.includes("does not exist") ||
    text.includes("user unknown") ||
    text.includes("550 5.1.1") ||
    text.includes("recipient address rejected")
  ) {
    return "recipient_invalid";
  }
  if (
    text.includes("domain not found") ||
    text.includes("no mx") ||
    text.includes("550 5.1.2")
  ) {
    return "domain_invalid";
  }
  return "other";
}

export function useOutreachHealth(windowDays: number = 30): OutreachHealth {
  const inner = useOutreachStats(windowDays);

  const classifications = useMemo<BounceClassification[]>(() => {
    if (!inner.data) return [];
    return inner.data.recentBounces.map((b) => ({
      category: classifyBounce(b),
      bounce: b,
    }));
  }, [inner.data]);

  const categoryStats = useMemo<CategoryStat[]>(() => {
    const counts = new Map<BounceCategory, number>();
    for (const c of classifications) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([cat, count]) => ({
        category: cat,
        count,
        alarming: ALARMING.has(cat),
        label: CATEGORY_LABEL[cat],
      }))
      .sort((a, b) => {
        // Alarming first, then by count desc.
        if (a.alarming && !b.alarming) return -1;
        if (!a.alarming && b.alarming) return 1;
        return b.count - a.count;
      });
  }, [classifications]);

  const hasAlarmingBounces = categoryStats.some((c) => c.alarming);

  return {
    stats: inner.data,
    classifications,
    categoryStats,
    hasAlarmingBounces,
    loading: inner.loading,
    error: inner.error,
    refresh: inner.refresh,
  };
}
