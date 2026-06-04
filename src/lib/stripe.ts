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
