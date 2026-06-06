// ───────────────────────────────────────────────────────────────────
// Unified finance actions — provider-neutral. Read from
// lib/unified/finance.ts which merges every connected finance
// provider (Stripe today; Mercury, Plaid, Brex, Toast, Ramp, QBO
// as those connectors ship) into a single source-attributed view.
//
// AXON doesn't need to know which provider produced any given
// number. These actions answer the operator's real questions:
//
//   · finance_balance              — how much cash do we have?
//   · finance_recent_transactions  — what moved in the last N days?
//   · finance_burn                 — how fast are we spending?
//   · finance_runway               — how long until we run out?
//
// Each response carries a `by_source` breakdown so AXON can surface
// "$32k Stripe + $84k Mercury = $116k total" when relevant, instead
// of just stating the merged number opaquely.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  fetchUnifiedFinance,
  monthlyBurnCents,
  netCashWindow,
  runwayDays,
  totalCashCents,
  totalMrrCents,
} from "@/lib/unified/finance";

// ─── finance_balance ─────────────────────────────────────────────

export const financeBalanceAction: AxonAction<
  Record<string, never>,
  {
    total_cents: number;
    currency: string;
    by_source: Record<string, number>;
    accounts: {
      source: string;
      name: string;
      available_cents: number;
      pending_cents: number;
      currency: string;
    }[];
  }
> = {
  name: "finance_balance",
  description:
    "Total available cash across every connected finance provider (Stripe, Mercury, Plaid, Brex, etc). Use this for 'how much cash do we have?', 'what's our bank balance?'. Returns a `by_source` breakdown so AXON can mention per-account context (e.g. 'Stripe $32k, Mercury $84k').",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const snap = await fetchUnifiedFinance();
    const total = totalCashCents(snap.balances);

    const by_source: Record<string, number> = {};
    for (const b of snap.balances) {
      if (b.currency.toLowerCase() !== "usd") continue;
      by_source[b.source] = (by_source[b.source] ?? 0) + b.available_cents;
    }

    ctx.logActivity({
      actionName: "finance_balance",
      params: {},
      summary: `Total cash: $${Math.round(total / 100).toLocaleString()}`,
    });

    return {
      summary:
        snap.balances.length === 0
          ? "No finance providers are connected. Connect Stripe or Mercury to see balances."
          : `Total cash: $${Math.round(total / 100).toLocaleString()}`,
      data: {
        total_cents: total,
        currency: "usd",
        by_source,
        accounts: snap.balances.map((b) => ({
          source: b.source,
          name: b.account_name,
          available_cents: b.available_cents,
          pending_cents: b.pending_cents,
          currency: b.currency,
        })),
      },
    };
  },
};

// ─── finance_recent_transactions ────────────────────────────────

export const financeRecentTransactionsAction: AxonAction<
  { limit?: number; source?: string; inflows_only?: boolean; outflows_only?: boolean },
  {
    count: number;
    transactions: {
      source: string;
      occurred_at: string;
      amount_cents: number;
      currency: string;
      kind: string;
      description: string;
      counterparty: string | null;
      status: string;
    }[];
  }
> = {
  name: "finance_recent_transactions",
  description:
    "List recent finance transactions across every connected provider, newest first. Filter to a single provider via `source`. Filter to money in via `inflows_only` or money out via `outflows_only`. Use this for 'who paid us today?', 'show me recent spend', 'any refunds this week?'.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max transactions (default 25)." },
      source: {
        type: "string",
        description:
          "Filter to one provider id (stripe / mercury / plaid / brex / toast / etc). Omit for all.",
      },
      inflows_only: { type: "boolean", description: "Only money in." },
      outflows_only: { type: "boolean", description: "Only money out." },
    },
  },
  handler: async (input, ctx) => {
    const snap = await fetchUnifiedFinance({ txLimit: 100 });
    let txs = snap.transactions;
    if (input.source) txs = txs.filter((t) => t.source === input.source);
    if (input.inflows_only) txs = txs.filter((t) => t.amount_cents > 0);
    if (input.outflows_only) txs = txs.filter((t) => t.amount_cents < 0);
    const slice = txs.slice(0, input.limit ?? 25);

    ctx.logActivity({
      actionName: "finance_recent_transactions",
      params: { limit: input.limit, source: input.source },
      summary: `${slice.length} transaction(s) returned`,
    });

    return {
      summary: `${slice.length} recent transaction(s).`,
      data: {
        count: slice.length,
        transactions: slice.map((t) => ({
          source: t.source,
          occurred_at: t.occurred_at,
          amount_cents: t.amount_cents,
          currency: t.currency,
          kind: t.kind,
          description: t.description,
          counterparty: t.counterparty,
          status: t.status,
        })),
      },
    };
  },
};

// ─── finance_burn ────────────────────────────────────────────────

export const financeBurnAction: AxonAction<
  { window_days?: number },
  {
    monthly_burn_cents: number;
    net_cash_window_cents: number;
    window_days: number;
    mrr_cents: number;
    by_source_outflow: Record<string, number>;
  }
> = {
  name: "finance_burn",
  description:
    "Burn rate (monthly outflow) computed from recent transactions across every finance provider. Also returns net cash movement over the window and current MRR for context. Use this for 'what's our burn?', 'how much are we spending monthly?'.",
  input_schema: {
    type: "object",
    properties: {
      window_days: {
        type: "number",
        description: "Lookback in days. Default 30.",
      },
    },
  },
  handler: async (input, ctx) => {
    const window = input.window_days ?? 30;
    const snap = await fetchUnifiedFinance({ txLimit: 200 });
    const burn = monthlyBurnCents(snap.transactions, window);
    const net = netCashWindow(snap.transactions, window);
    const mrr = totalMrrCents(snap.revenue);

    // Per-source outflow split — useful when AXON's response wants
    // to call out a specific category ("most of your burn is on
    // Stripe processing fees" etc.).
    const cutoff = Date.now() - window * 86_400_000;
    const by_source_outflow: Record<string, number> = {};
    for (const t of snap.transactions) {
      if (Date.parse(t.occurred_at) < cutoff) continue;
      if (t.amount_cents >= 0) continue;
      by_source_outflow[t.source] =
        (by_source_outflow[t.source] ?? 0) + Math.abs(t.amount_cents);
    }

    ctx.logActivity({
      actionName: "finance_burn",
      params: { window_days: window },
      summary: `Burn: $${Math.round(burn / 100).toLocaleString()}/mo`,
    });

    return {
      summary: `Monthly burn ≈ $${Math.round(burn / 100).toLocaleString()} (last ${window}d).`,
      data: {
        monthly_burn_cents: burn,
        net_cash_window_cents: net,
        window_days: window,
        mrr_cents: mrr,
        by_source_outflow,
      },
    };
  },
};

// ─── finance_runway ──────────────────────────────────────────────

export const financeRunwayAction: AxonAction<
  Record<string, never>,
  {
    runway_days: number | null;
    cash_cents: number;
    monthly_burn_cents: number;
    mrr_cents: number;
    tone: "healthy" | "watch" | "critical" | "infinite";
    by_source_cash: Record<string, number>;
  }
> = {
  name: "finance_runway",
  description:
    "Days of runway = total cash across every finance provider divided by monthly burn. Returns null when there's no recorded burn (effectively infinite). Tone field: 'healthy' (>180d), 'watch' (90-180d), 'critical' (<90d), 'infinite' (no burn). Use this for 'how's runway?', 'how long can we last?'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const snap = await fetchUnifiedFinance({ txLimit: 200 });
    const cash = totalCashCents(snap.balances);
    const burn = monthlyBurnCents(snap.transactions, 30);
    const days = runwayDays(cash, burn);
    const mrr = totalMrrCents(snap.revenue);

    const tone: "healthy" | "watch" | "critical" | "infinite" =
      days === null
        ? "infinite"
        : days < 90
        ? "critical"
        : days < 180
        ? "watch"
        : "healthy";

    const by_source_cash: Record<string, number> = {};
    for (const b of snap.balances) {
      if (b.currency.toLowerCase() !== "usd") continue;
      by_source_cash[b.source] =
        (by_source_cash[b.source] ?? 0) + b.available_cents;
    }

    ctx.logActivity({
      actionName: "finance_runway",
      params: {},
      summary:
        days === null
          ? "Runway: ∞ (no recorded burn)"
          : `Runway: ${days} days`,
    });

    return {
      summary:
        days === null
          ? "No recorded burn — runway is effectively unlimited until you start spending."
          : `${days} days of runway at current burn.`,
      data: {
        runway_days: days,
        cash_cents: cash,
        monthly_burn_cents: burn,
        mrr_cents: mrr,
        tone,
        by_source_cash,
      },
    };
  },
};

export function registerUnifiedFinanceActions() {
  registerAction(financeBalanceAction);
  registerAction(financeRecentTransactionsAction);
  registerAction(financeBurnAction);
  registerAction(financeRunwayAction);
}
