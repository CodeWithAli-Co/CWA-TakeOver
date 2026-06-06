/**
 * lib/unified/finance.ts — Provider-neutral finance layer.
 *
 * Second concrete instance of the unified-data-source pattern
 * (the first was lib/unified/meetings.ts). Every provider that
 * touches money — payments processors, banks, expense cards, POS
 * systems, accounting — produces UnifiedTransaction[] and
 * UnifiedBalance[] in this module's shape.
 *
 * The aggregated view powers:
 *
 *   · FinancePanel on /operations — headline cash + MRR + burn +
 *     runway, plus a recent-transactions list with source badges.
 *   · The unified AXON actions (finance_balance,
 *     finance_recent_transactions, finance_burn, finance_runway).
 *   · Capital Plan auto-feed: actuals stream from Stripe/Mercury/
 *     etc into capital_actuals so the operator doesn't have to
 *     hand-type spend.
 *
 * Adding a new finance provider:
 *   1. Build lib/<provider>.ts (e.g. lib/mercury.ts) with a
 *      typed client returning the provider's raw types.
 *   2. Add an adapter in this file: `from<Provider>(raw) =>
 *      UnifiedTransaction[]` and `from<Provider>Balance(raw) =>
 *      UnifiedBalance[]`.
 *   3. Add the provider to useUnifiedFinance() and
 *      fetchUnifiedFinance() (one block each).
 *   4. No UI changes. No AXON changes. The filter chip and badge
 *      appear automatically because the provider is registered in
 *      lib/unified/types.ts DATA_SOURCES.
 *
 * Mercury, Plaid, Brex, Toast, Ramp, QBO adapters are sketched as
 * commented stubs at the bottom — fill them in as those connectors
 * land.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnectors, fetchConnectorByKind } from "@/stores/connectors";
import {
  stripeBalance,
  stripeRecentCharges,
  stripeSnapshot,
  type StripeBalance,
  type StripeRecent,
  type StripeRecentCharge,
  type StripeSnapshot,
} from "@/lib/stripe";

// ────────────────────────────────────────────────
// Unified shapes
// ────────────────────────────────────────────────

/** The cross-provider transaction type every adapter must produce.
 *  Positive amount = inflow (income). Negative amount = outflow
 *  (spend). This convention lets sum() compute net cash movement
 *  without per-provider sign-flipping. */
export interface UnifiedTransaction {
  /** Globally unique id: `<source>:<provider_id>`. */
  id: string;
  /** Provider key, matches DATA_SOURCES registry. */
  source: string;
  /** ISO datetime — when the money moved. */
  occurred_at: string;
  /** Cents, signed. Inflow positive, outflow negative. */
  amount_cents: number;
  /** ISO 4217 currency code, lowercase ("usd"). */
  currency: string;
  /** Coarse-grained category — drives summaries and AXON answers. */
  kind:
    | "charge"        // customer payment in
    | "refund"        // payment back out to a customer
    | "payout"        // transfer to bank
    | "subscription"  // recurring revenue event
    | "transfer"      // movement between own accounts
    | "fee"           // platform / interchange / network fee
    | "manual"        // operator hand-entered
    | "other";
  /** Free-text describing the line item. */
  description: string;
  /** Optional human counterparty — customer name, vendor name. */
  counterparty: string | null;
  /** Lifecycle bucket. */
  status: "pending" | "completed" | "failed";
  /** Back-link to the provider's UI if available. */
  external_url: string | null;
}

/** Snapshot of available cash in a single account. */
export interface UnifiedBalance {
  /** `<source>:<account_id>` or `<source>:primary`. */
  id: string;
  source: string;
  account_name: string;
  available_cents: number;
  pending_cents: number;
  currency: string;
  /** When this balance was last fetched from the provider. */
  as_of: string;
}

/** Recurring revenue snapshot — Stripe's MRR for now; Toast etc
 *  could contribute a subscription line for restaurant operators
 *  with subscription items. */
export interface UnifiedRevenue {
  source: string;
  mrr_cents: number;
  active_subscriptions: number;
  currency: string;
  computed_at: string;
}

// ────────────────────────────────────────────────
// Per-provider adapters — pure functions
// ────────────────────────────────────────────────

function fromStripeCharges(raw: StripeRecent): UnifiedTransaction[] {
  return raw.charges.map<UnifiedTransaction>((c: StripeRecentCharge) => ({
    id: `stripe:${c.id}`,
    source: "stripe",
    occurred_at: c.created_at,
    // Charges are inflows (customer paid us). Stripe returns
    // positive cents; we keep them positive.
    amount_cents: c.amount_cents,
    currency: c.currency,
    kind: "charge",
    description:
      c.description ||
      (c.customer_name
        ? `Payment from ${c.customer_name}`
        : "Stripe payment"),
    counterparty: c.customer_name ?? null,
    status: "completed",
    external_url: `https://dashboard.stripe.com/payments/${c.id}`,
  }));
}

function fromStripeBalance(raw: StripeBalance): UnifiedBalance[] {
  // Primary currency balance is the headline row. Additional
  // currencies render as separate balances so the operator sees
  // each one without mental conversion.
  const primary: UnifiedBalance = {
    id: "stripe:primary",
    source: "stripe",
    account_name: "Stripe (Primary)",
    available_cents: raw.available_cents,
    pending_cents: raw.pending_cents,
    currency: raw.primary_currency,
    as_of: raw.computed_at,
  };
  const others = raw.other_currencies.map<UnifiedBalance>((c, i) => ({
    id: `stripe:other-${i}`,
    source: "stripe",
    account_name: `Stripe (${c.currency.toUpperCase()})`,
    available_cents: c.available_cents,
    pending_cents: c.pending_cents,
    currency: c.currency,
    as_of: raw.computed_at,
  }));
  return [primary, ...others];
}

function fromStripeRevenue(raw: StripeSnapshot): UnifiedRevenue {
  return {
    source: "stripe",
    mrr_cents: raw.mrr_cents,
    active_subscriptions: raw.active_subscriptions,
    currency: raw.currency,
    computed_at: raw.computed_at,
  };
}

// ─── Future provider stubs ─────────────────────────────────────
//
// Each is a one-liner once the per-provider lib ships:
//
// function fromMercuryTransactions(raw: MercuryTx[]): UnifiedTransaction[] {
//   return raw.map(t => ({
//     id: `mercury:${t.id}`,
//     source: "mercury",
//     occurred_at: t.postedAt,
//     // Mercury returns signed amounts (debits negative).
//     amount_cents: Math.round(t.amount * 100),
//     currency: "usd",
//     kind: t.kind === "ach" ? "transfer" : "other",
//     description: t.counterpartyName ?? t.note ?? "Mercury transaction",
//     counterparty: t.counterpartyName ?? null,
//     status: t.status === "sent" ? "completed" : "pending",
//     external_url: null,
//   }));
// }
//
// function fromMercuryBalance(raw: MercuryAccount[]): UnifiedBalance[] {
//   return raw.map(a => ({
//     id: `mercury:${a.id}`,
//     source: "mercury",
//     account_name: a.name,
//     available_cents: Math.round(a.availableBalance * 100),
//     pending_cents: 0,
//     currency: "usd",
//     as_of: new Date().toISOString(),
//   }));
// }
//
// function fromPlaidTransactions(raw: PlaidTx[]): UnifiedTransaction[] { … }
// function fromBrexTransactions(raw: BrexTx[]): UnifiedTransaction[] { … }
// function fromToastTransactions(raw: ToastTx[]): UnifiedTransaction[] { … }
// function fromRampTransactions(raw: RampTx[]): UnifiedTransaction[] { … }

// ────────────────────────────────────────────────
// Aggregator hook — React
// ────────────────────────────────────────────────

export interface UnifiedFinanceSnapshot {
  transactions: UnifiedTransaction[];
  balances: UnifiedBalance[];
  revenue: UnifiedRevenue[];
  providerStatus: Array<{
    source: string;
    connected: boolean;
    loading: boolean;
    error: Error | null;
  }>;
}

/** Pulls finance data from every connected provider in parallel.
 *  Each provider can fail or load independently — the surface
 *  shows whatever did load and labels the rest. */
export function useUnifiedFinance(opts: { txLimit?: number } = {}) {
  const { data: connectors = [] } = useConnectors();

  const stripeConn = useMemo(
    () => connectors.find((c) => c.kind === "stripe" && c.status === "connected"),
    [connectors],
  );
  const stripeKey = (stripeConn?.credentials as any)?.secret_key as
    | string
    | undefined;

  // ─── Stripe ───────────────────────────────────────────────────
  // Three parallel calls: balance, recent charges, MRR snapshot.
  // Each is a different React Query so cache hit rates stay high.
  const stripeBalanceQ = useQuery<UnifiedBalance[]>({
    queryKey: ["unified-finance", "stripe", "balance", stripeConn?.id ?? "none"],
    enabled: !!stripeKey,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => fromStripeBalance(await stripeBalance(stripeKey!)),
  });

  const stripeTxQ = useQuery<UnifiedTransaction[]>({
    queryKey: ["unified-finance", "stripe", "tx", stripeConn?.id ?? "none", opts.txLimit ?? 50],
    enabled: !!stripeKey,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      fromStripeCharges(await stripeRecentCharges(stripeKey!, opts.txLimit ?? 50)),
  });

  const stripeRevenueQ = useQuery<UnifiedRevenue>({
    queryKey: ["unified-finance", "stripe", "revenue", stripeConn?.id ?? "none"],
    enabled: !!stripeKey,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => fromStripeRevenue(await stripeSnapshot(stripeKey!)),
  });

  // ─── Future providers slot in here ──────────────────────────

  // Merge + sort transactions chronologically newest-first.
  const transactions = useMemo<UnifiedTransaction[]>(() => {
    const all: UnifiedTransaction[] = [];
    if (stripeTxQ.data) all.push(...stripeTxQ.data);
    all.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
    return all;
  }, [stripeTxQ.data]);

  const balances = useMemo<UnifiedBalance[]>(() => {
    const all: UnifiedBalance[] = [];
    if (stripeBalanceQ.data) all.push(...stripeBalanceQ.data);
    return all;
  }, [stripeBalanceQ.data]);

  const revenue = useMemo<UnifiedRevenue[]>(() => {
    const all: UnifiedRevenue[] = [];
    if (stripeRevenueQ.data) all.push(stripeRevenueQ.data);
    return all;
  }, [stripeRevenueQ.data]);

  const providerStatus = useMemo(() => {
    return [
      {
        source: "stripe",
        connected: !!stripeKey,
        loading:
          stripeBalanceQ.isLoading ||
          stripeTxQ.isLoading ||
          stripeRevenueQ.isLoading,
        error:
          (stripeBalanceQ.error ||
            stripeTxQ.error ||
            stripeRevenueQ.error) as Error | null,
      },
    ];
  }, [
    stripeKey,
    stripeBalanceQ.isLoading,
    stripeTxQ.isLoading,
    stripeRevenueQ.isLoading,
    stripeBalanceQ.error,
    stripeTxQ.error,
    stripeRevenueQ.error,
  ]);

  return {
    transactions,
    balances,
    revenue,
    providerStatus,
    isLoading:
      stripeBalanceQ.isLoading ||
      stripeTxQ.isLoading ||
      stripeRevenueQ.isLoading,
    isError: !!(stripeBalanceQ.error || stripeTxQ.error || stripeRevenueQ.error),
  } satisfies UnifiedFinanceSnapshot & {
    isLoading: boolean;
    isError: boolean;
  };
}

// ────────────────────────────────────────────────
// Imperative version — used by AXON actions
// ────────────────────────────────────────────────

export async function fetchUnifiedFinance(opts: {
  txLimit?: number;
} = {}): Promise<UnifiedFinanceSnapshot> {
  const transactions: UnifiedTransaction[] = [];
  const balances: UnifiedBalance[] = [];
  const revenue: UnifiedRevenue[] = [];
  const providerStatus: UnifiedFinanceSnapshot["providerStatus"] = [];

  // ─── Stripe ───────────────────────────────────────────────────
  try {
    const conn = await fetchConnectorByKind("stripe");
    const key = (conn?.credentials as any)?.secret_key as string | undefined;
    if (key) {
      const [bal, tx, rev] = await Promise.all([
        stripeBalance(key),
        stripeRecentCharges(key, opts.txLimit ?? 50),
        stripeSnapshot(key),
      ]);
      balances.push(...fromStripeBalance(bal));
      transactions.push(...fromStripeCharges(tx));
      revenue.push(fromStripeRevenue(rev));
      providerStatus.push({
        source: "stripe",
        connected: true,
        loading: false,
        error: null,
      });
    } else {
      providerStatus.push({
        source: "stripe",
        connected: false,
        loading: false,
        error: null,
      });
    }
  } catch (e) {
    providerStatus.push({
      source: "stripe",
      connected: true,
      loading: false,
      error: e as Error,
    });
  }

  // ─── Future providers append here ──────────────────────────

  transactions.sort(
    (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
  );
  return { transactions, balances, revenue, providerStatus };
}

// ────────────────────────────────────────────────
// Aggregation helpers — used by both UI + AXON actions
// ────────────────────────────────────────────────

/** Sum of available balances across every source, in primary
 *  currency (assumes USD for now — multi-currency conversion is a
 *  separate concern we'll add when we have a real FX rate source). */
export function totalCashCents(balances: UnifiedBalance[]): number {
  // Filter to USD until we add FX. Non-USD balances surface in the
  // UI but don't roll up into "total cash" yet.
  return balances
    .filter((b) => b.currency.toLowerCase() === "usd")
    .reduce((sum, b) => sum + b.available_cents, 0);
}

/** Combined MRR across providers (today: just Stripe). */
export function totalMrrCents(revenue: UnifiedRevenue[]): number {
  return revenue
    .filter((r) => r.currency.toLowerCase() === "usd")
    .reduce((sum, r) => sum + r.mrr_cents, 0);
}

/** Average monthly outflow over the last N days. Heuristic: sum
 *  outflows (negative amounts) in the window, divide by days, then
 *  multiply by 30. Better than nothing when the operator hasn't
 *  hand-budgeted yet, and refines as more provider data comes in. */
export function monthlyBurnCents(
  transactions: UnifiedTransaction[],
  windowDays = 30,
): number {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const outflows = transactions
    .filter((t) => Date.parse(t.occurred_at) >= cutoff)
    .filter((t) => t.amount_cents < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);
  return Math.round((outflows / windowDays) * 30);
}

/** Days of runway = cash / (burn / 30). Returns null when burn is
 *  zero (no spend recorded — runway is effectively infinite, but
 *  null is a more honest UI signal than "∞"). */
export function runwayDays(
  cashCents: number,
  monthlyBurn: number,
): number | null {
  if (monthlyBurn <= 0) return null;
  return Math.floor((cashCents / monthlyBurn) * 30);
}

/** Net cash movement in the last N days. Positive = net inflow. */
export function netCashWindow(
  transactions: UnifiedTransaction[],
  windowDays = 30,
): number {
  const cutoff = Date.now() - windowDays * 86_400_000;
  return transactions
    .filter((t) => Date.parse(t.occurred_at) >= cutoff)
    .reduce((sum, t) => sum + t.amount_cents, 0);
}
