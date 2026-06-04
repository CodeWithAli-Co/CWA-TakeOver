/**
 * lib/stripe.ts — browser-side Stripe client.
 *
 * Stripe's REST API doesn't include CORS headers (intentional —
 * Stripe blocks browser → secret-key calls for security), so we
 * route every request through the takeover-B2B proxy at
 *   ${VITE_TAKEOVER_SITE_URL}/api/stripe/{verify,snapshot,outstanding}
 *
 * The proxy carries the user's restricted key in the Authorization
 * header, forwards verbatim to api.stripe.com, never logs it, and
 * never persists it. The key still lives only in the connectors
 * row in Supabase on this end.
 *
 * Auth headers on every request:
 *   · Authorization: Bearer <stripe restricted key>
 *   · TakeOver-App: true   (proxy-side gate against random callers)
 *
 * Errors: every helper throws on non-2xx. The thrown Error carries
 * the human message Stripe returned (already redacted on the proxy
 * side). Caller chooses whether to surface to the user.
 */

const PROXY_BASE = (() => {
  const root = import.meta.env.VITE_TAKEOVER_SITE_URL ?? "";
  return root.replace(/\/$/, "");
})();

export interface StripeAccount {
  id: string;
  display_name: string;
  country: string | null;
  default_currency: string | null;
  livemode: boolean | null;
  charges_enabled: boolean | null;
}

export interface StripeSnapshot {
  mrr_cents: number;
  mtd_revenue_cents: number;
  mtd_charge_count: number;
  active_subscriptions: number;
  new_subscriptions_this_month: number;
  churned_this_month: number;
  currency: string;
  computed_at: string;
}

export interface StripeInvoiceRow {
  id: string;
  number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_due_cents: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
  days_overdue: number;
  hosted_invoice_url: string | null;
}

export interface StripeOutstanding {
  count: number;
  total_cents: number;
  currency: string;
  invoices: StripeInvoiceRow[];
  computed_at: string;
}

export interface StripeTimeseriesPoint {
  month: string;          // "2026-05"
  label: string;          // "May"
  revenue_cents: number;  // gross paid
  refund_cents: number;
  net_cents: number;      // gross - refunds, what the chart should plot
  charge_count: number;
}

export interface StripeTimeseries {
  months: number;
  currency: string;
  series: StripeTimeseriesPoint[];
  computed_at: string;
}

export interface StripeProductRow {
  product_id: string;
  name: string;
  value_cents: number;  // monthly normalized
  sub_count: number;
}

export interface StripeProducts {
  currency: string;
  items: StripeProductRow[];
  computed_at: string;
}

export interface StripeBalance {
  primary_currency: string;
  available_cents: number;
  pending_cents: number;
  other_currencies: Array<{
    currency: string;
    available_cents: number;
    pending_cents: number;
  }>;
  computed_at: string;
}

export interface StripeRecentCharge {
  id: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  description: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
}

export interface StripeRecent {
  count: number;
  charges: StripeRecentCharge[];
  computed_at: string;
}

// ── Customers ─────────────────────────────────────────────────

export type CustomerStatus = "active" | "past_customer" | "one_time" | "free";

export interface StripeCustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  status: CustomerStatus;
  mrr_cents: number;
  ltv_cents: number;
  active_sub_count: number;
  last_activity_at: string;
  currency: string;
}

export interface StripeCustomersSummary {
  total: number;
  active: number;
  past_customer: number;
  one_time: number;
  free: number;
  total_ltv_cents: number;
  total_mrr_cents: number;
}

export interface StripeCustomers {
  currency: string;
  summary: StripeCustomersSummary;
  items: StripeCustomerRow[];
  computed_at: string;
}

// ── Payouts ───────────────────────────────────────────────────

export interface StripePayoutRow {
  id: string;
  amount_cents: number;
  currency: string;
  arrival_date: string;
  created_at: string;
  status: string;
  method: string | null;
  type: string | null;
  description: string | null;
  statement_descriptor: string | null;
  failure_code: string | null;
  failure_message: string | null;
}

export interface StripePayoutsSummary {
  total_paid_ytd_cents: number;
  count_ytd: number;
  average_payout_cents: number;
  last_payout: StripePayoutRow | null;
}

export interface StripePayouts {
  currency: string;
  summary: StripePayoutsSummary;
  items: StripePayoutRow[];
  computed_at: string;
}

// ── Failed payments ───────────────────────────────────────────

export interface StripeFailedRow {
  id: string;
  amount_cents: number;
  currency: string;
  attempted_at: string;
  failure_code: string | null;
  failure_message: string | null;
  description: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  retryable: boolean;
}

export interface StripeFailed {
  count: number;
  total_cents: number;
  retryable_count: number;
  currency: string;
  items: StripeFailedRow[];
  computed_at: string;
}

// ── Subscriptions ─────────────────────────────────────────────

export interface StripeSubscriptionRow {
  id: string;
  status: string;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  product_id: string | null;
  product_name: string | null;
  mrr_cents: number;
  currency: string;
  started_at: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  days_until_renewal: number;
}

export interface StripeSubscriptionsSummary {
  total: number;
  by_status: Record<string, number>;
  total_mrr_cents: number;
}

export interface StripeSubscriptions {
  currency: string;
  summary: StripeSubscriptionsSummary;
  items: StripeSubscriptionRow[];
  computed_at: string;
}

async function postProxy<T>(
  path: string,
  key: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  if (!PROXY_BASE) {
    throw new Error(
      "Stripe proxy URL not configured (VITE_TAKEOVER_SITE_URL).",
    );
  }
  const res = await fetch(`${PROXY_BASE}/api/stripe/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "TakeOver-App": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
  // Always try to parse JSON — the proxy returns structured errors
  // with { ok: false, error } on non-2xx.
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // proxy hard-crashed or returned non-JSON
  }
  if (!res.ok || body?.ok === false) {
    const msg =
      body?.error ??
      `Stripe proxy ${res.status} ${res.statusText || ""}`.trim();
    throw new Error(msg);
  }
  return body as T;
}

/** Verify a restricted key by pulling /account. Returns the
 *  display name + livemode so the connect dialog can show
 *  "Connected to Acme (Live)" in its success banner. */
export async function stripeVerify(
  key: string,
): Promise<{ ok: true; account: StripeAccount }> {
  return postProxy<{ ok: true; account: StripeAccount }>("verify", key);
}

/** Pull MRR + MTD revenue + sub deltas in one round trip. Caller
 *  caches this into Supabase so the dashboard widget can render
 *  off the cache instantly and only re-sync on Refresh / Axon
 *  action invocation. */
export async function stripeSnapshot(
  key: string,
): Promise<StripeSnapshot> {
  const res = await postProxy<{ ok: true; snapshot: StripeSnapshot }>(
    "snapshot",
    key,
  );
  return res.snapshot;
}

/** Pull open + past-due invoices, ranked by amount + age. Caller
 *  usually slices to top 5 for AXON, top 10 for the dashboard. */
export async function stripeOutstanding(
  key: string,
): Promise<StripeOutstanding> {
  const res = await postProxy<{ ok: true; outstanding: StripeOutstanding }>(
    "outstanding",
    key,
  );
  return res.outstanding;
}

/** Monthly revenue timeseries for the financial dashboard chart.
 *  Net (paid minus refunds) per month, last N months. Default 6,
 *  capped at 24 server-side. */
export async function stripeTimeseries(
  key: string,
  months = 6,
): Promise<StripeTimeseries> {
  const res = await postProxy<{ ok: true; timeseries: StripeTimeseries }>(
    "timeseries",
    key,
    { months },
  );
  return res.timeseries;
}

/** Active-sub MRR split by Stripe Product. Drives the Revenue
 *  Sources pie chart. */
export async function stripeProducts(key: string): Promise<StripeProducts> {
  const res = await postProxy<{ ok: true; products: StripeProducts }>(
    "products",
    key,
  );
  return res.products;
}

/** Stripe-side balance (available + pending). NOT the user's real
 *  bank balance — that would need Plaid or similar. */
export async function stripeBalance(key: string): Promise<StripeBalance> {
  const res = await postProxy<{ ok: true; balance: StripeBalance }>(
    "balance",
    key,
  );
  return res.balance;
}

/** Last N paid charges with customer info hydrated. Drives the
 *  Recent Transactions widget. */
export async function stripeRecentCharges(
  key: string,
  limit = 10,
): Promise<StripeRecent> {
  const res = await postProxy<{ ok: true; recent: StripeRecent }>(
    "recent",
    key,
    { limit },
  );
  return res.recent;
}

/** Customer list with LTV + MRR contribution + status. Powers the
 *  new Customers tab. Ranked by LTV DESC server-side. */
export async function stripeCustomers(key: string): Promise<StripeCustomers> {
  const res = await postProxy<{ ok: true; customers: StripeCustomers }>(
    "customers",
    key,
  );
  return res.customers;
}

/** Payout history — when money has actually been deposited to the
 *  connected bank account. Plus YTD summary numbers. */
export async function stripePayouts(key: string): Promise<StripePayouts> {
  const res = await postProxy<{ ok: true; payouts: StripePayouts }>(
    "payouts",
    key,
  );
  return res.payouts;
}

/** Failed charges in the last 30 days, ranked by amount. Each
 *  row carries a `retryable` flag indicating whether the failure
 *  code suggests a transient issue (decline, expired card) vs one
 *  requiring customer action. */
export async function stripeFailed(key: string): Promise<StripeFailed> {
  const res = await postProxy<{ ok: true; failed: StripeFailed }>(
    "failed",
    key,
  );
  return res.failed;
}

/** Full subscription list with customer + product hydrated.
 *  Status-prioritized sort (active first), MRR DESC within status. */
export async function stripeSubscriptions(
  key: string,
): Promise<StripeSubscriptions> {
  const res = await postProxy<{
    ok: true;
    subscriptions: StripeSubscriptions;
  }>("subscriptions", key);
  return res.subscriptions;
}

// ── Period comparison ─────────────────────────────────────────

export interface WindowDelta {
  current_cents: number;
  previous_cents: number;
  delta_cents: number;
  delta_pct: number;
  positive: boolean;
}

/** Compute "this period vs previous equal period" from the
 *  timeseries data we already have. Caller supplies the timeseries
 *  series (oldest-to-newest by month) and how many months to
 *  count as "current"; we sum the tail N months and the prior N
 *  months and produce a delta pill the KPI cards consume directly.
 *
 *  Months = 1 → "this month vs last month"
 *  Months = 3 → "this quarter vs last quarter"
 *  Months = 6 → "this half-year vs last half-year"
 *
 *  When there aren't enough prior months in the series to make a
 *  comparison, returns delta_pct: 0 and positive: true so the UI
 *  can render a neutral state instead of a misleading "+∞%" jump
 *  from zero. */
export function computeWindowDelta(
  series: StripeTimeseriesPoint[],
  months: number,
): WindowDelta {
  if (series.length < months) {
    const partial = series.reduce((s, p) => s + p.net_cents, 0);
    return {
      current_cents: partial,
      previous_cents: 0,
      delta_cents: partial,
      delta_pct: 0,
      positive: true,
    };
  }
  const current = series
    .slice(-months)
    .reduce((s, p) => s + p.net_cents, 0);
  const previous = series
    .slice(-(months * 2), -months)
    .reduce((s, p) => s + p.net_cents, 0);
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  return {
    current_cents: current,
    previous_cents: previous,
    delta_cents: delta,
    delta_pct: pct,
    positive: delta >= 0,
  };
}

/** Format minor units (cents) as the major-unit currency string a
 *  human would read. "1234500" + "usd" → "$12,345.00". */
export function formatStripeAmount(
  cents: number,
  currency: string,
  opts?: { compact?: boolean },
): string {
  const cur = (currency ?? "usd").toUpperCase();
  const amount = cents / 100;
  try {
    if (opts?.compact && Math.abs(amount) >= 10_000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(amount);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to "$X.XX"
    return `$${amount.toFixed(2)}`;
  }
}
