/**
 * useStripeDashboard — single-hook entry point for every Stripe
 * widget on the financial dashboard.
 *
 * Pulls the connected Stripe restricted key off the connectors
 * cache, fans out FIVE parallel queries to the takeover-B2B proxy,
 * and returns the unified bundle with loading + error states.
 *
 * Each underlying TanStack query is keyed independently so the
 * dashboard widgets can subscribe to just the slices they render —
 * the catalog tile's summarizeStripe call dedupes with the
 * snapshot slice here, so we get one network round-trip serving
 * both the Settings tile and the dashboard's MRR card.
 *
 *   · snapshot     — MRR, MTD, active subs, new/churned this month
 *   · timeseries   — last 6 months net revenue per month
 *   · products     — MRR by Stripe Product (pie source)
 *   · balance      — Stripe-side available + pending balance
 *   · recent       — last 10 paid charges (transactions list)
 *   · outstanding  — open + past-due invoices
 *
 * Refresh: invalidate the queries via the returned `refetch` fn.
 * Stale time is 2 minutes — the dashboard is glance-able, not
 * real-time, and Stripe's pagination cost adds up if we refetch
 * on every focus.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnectors } from "@/stores/connectors";
import {
  stripeBalance,
  stripeOutstanding,
  stripeProducts,
  stripeRecentCharges,
  stripeSnapshot,
  stripeTimeseries,
  type StripeBalance,
  type StripeOutstanding,
  type StripeProducts,
  type StripeRecent,
  type StripeSnapshot,
  type StripeTimeseries,
} from "@/lib/stripe";

const STALE_MS = 2 * 60 * 1000;

interface StripeDashboardBundle {
  /** True when the user has connected a Stripe key. False blocks
   *  every widget from fetching and surfaces an empty-state CTA
   *  instead. */
  connected: boolean;
  /** Aggregated loading state — true while ANY slice is still
   *  loading on first paint. */
  loading: boolean;
  /** First slice that errored, if any. UI can surface this banner
   *  without needing to inspect each slice. */
  error: Error | null;

  snapshot: StripeSnapshot | null;
  timeseries: StripeTimeseries | null;
  products: StripeProducts | null;
  balance: StripeBalance | null;
  recent: StripeRecent | null;
  outstanding: StripeOutstanding | null;

  /** Re-pull everything. Each slice independently invalidates. */
  refetchAll: () => Promise<void>;
}

export function useStripeDashboard(
  opts?: { timeseriesMonths?: number; recentLimit?: number },
): StripeDashboardBundle {
  const months = opts?.timeseriesMonths ?? 6;
  const limit = opts?.recentLimit ?? 10;

  const { data: connectors = [] } = useConnectors();
  const stripeConn = useMemo(
    () => connectors.find((c) => c.kind === "stripe"),
    [connectors],
  );
  const key = (stripeConn?.credentials?.secret_key as string | undefined) ?? "";
  const connected = !!key;

  // Each query is enabled only when we have a key. queryKey is
  // ["stripe", <slice>, <key-fingerprint>] so a key change wipes
  // the cache cleanly — we hash off the last 6 chars to avoid
  // ever putting the actual key into the cache key. This also
  // means switching from rk_live_ABC123 to rk_live_ABC123 (same
  // key) keeps the cache.
  const keyFp = key ? `…${key.slice(-6)}` : "none";

  const snapQ = useQuery({
    queryKey: ["stripe", "snapshot", keyFp],
    queryFn: () => stripeSnapshot(key),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const tsQ = useQuery({
    queryKey: ["stripe", "timeseries", keyFp, months],
    queryFn: () => stripeTimeseries(key, months),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const prodQ = useQuery({
    queryKey: ["stripe", "products", keyFp],
    queryFn: () => stripeProducts(key),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const balQ = useQuery({
    queryKey: ["stripe", "balance", keyFp],
    queryFn: () => stripeBalance(key),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const recentQ = useQuery({
    queryKey: ["stripe", "recent", keyFp, limit],
    queryFn: () => stripeRecentCharges(key, limit),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const outQ = useQuery({
    queryKey: ["stripe", "outstanding", keyFp],
    queryFn: () => stripeOutstanding(key),
    enabled: connected,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const queries = [snapQ, tsQ, prodQ, balQ, recentQ, outQ];
  const loading = connected && queries.some((q) => q.isLoading);
  const error =
    (queries.find((q) => q.error)?.error as Error | undefined) ?? null;

  const refetchAll = async () => {
    await Promise.all(queries.map((q) => q.refetch()));
  };

  return {
    connected,
    loading,
    error,
    snapshot: snapQ.data ?? null,
    timeseries: tsQ.data ?? null,
    products: prodQ.data ?? null,
    balance: balQ.data ?? null,
    recent: recentQ.data ?? null,
    outstanding: outQ.data ?? null,
    refetchAll,
  };
}
