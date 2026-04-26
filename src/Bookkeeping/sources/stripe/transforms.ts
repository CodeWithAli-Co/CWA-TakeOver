// Pure transformation functions: Stripe events → DraftJournalEntry.
// No live Stripe API calls here — the client (separate file) calls
// Stripe and pipes the responses through these transformers, so the
// JE shape is testable + deterministic without a network connection.
//
// Account ids passed in are GLAccount.id values from the entity's CoA.
// Caller resolves them by subtype lookup (e.g. "stripe_pending" account).

import type { DraftJournalEntry } from "../../types/journal";

export interface StripeAccountResolver {
  /** GL account id for "Stripe Pending Balance". */
  stripePending: string;
  /** GL account id for the cash deposit account (the bank Stripe pays
   *  out to). */
  cashOnPayout: string;
  /** GL account id for "Stripe Processing Fees" expense. */
  stripeFees: string;
  /** GL account id for income (Subscription Revenue or Service Revenue). */
  revenue: string;
  /** Optional override: contra-revenue / refund expense. */
  refundContra?: string;
}

export interface StripeChargeShape {
  id: string;
  amount: number;        // in major units (e.g. 100.00)
  currency: string;
  fee: number;           // Stripe fee
  created: number;       // unix seconds
  description?: string;
  customerName?: string;
}

export interface StripePayoutShape {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: number;   // unix seconds
}

export interface StripeRefundShape {
  id: string;
  amount: number;
  currency: string;
  created: number;
  chargeId: string;
}

const isoFromUnix = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** A Stripe charge: customer paid us money (sits in Stripe Pending),
 *  we owe Stripe a fee. Two pairs of debits/credits. */
export function chargeToJournalEntry(
  charge: StripeChargeShape,
  entityId: string,
  resolver: StripeAccountResolver,
): DraftJournalEntry {
  return {
    entityId,
    date: isoFromUnix(charge.created),
    memo: `Stripe — ${charge.id}${charge.customerName ? ` (${charge.customerName})` : ""}`,
    source: "stripe",
    sourceRef: charge.id,
    lines: [
      // Recognize gross revenue
      {
        accountId: resolver.stripePending,
        debit: charge.amount,
        credit: 0,
        currency: charge.currency.toUpperCase(),
        memo: charge.description,
      },
      {
        accountId: resolver.revenue,
        debit: 0,
        credit: charge.amount,
        currency: charge.currency.toUpperCase(),
      },
      // Recognize Stripe fee
      {
        accountId: resolver.stripeFees,
        debit: charge.fee,
        credit: 0,
        currency: charge.currency.toUpperCase(),
        memo: "Stripe fee",
      },
      {
        accountId: resolver.stripePending,
        debit: 0,
        credit: charge.fee,
        currency: charge.currency.toUpperCase(),
      },
    ],
  };
}

/** Stripe payout: money flows out of Stripe Pending into our bank cash. */
export function payoutToJournalEntry(
  payout: StripePayoutShape,
  entityId: string,
  resolver: StripeAccountResolver,
): DraftJournalEntry {
  return {
    entityId,
    date: isoFromUnix(payout.arrivalDate),
    memo: `Stripe payout — ${payout.id}`,
    source: "stripe",
    sourceRef: payout.id,
    lines: [
      {
        accountId: resolver.cashOnPayout,
        debit: payout.amount,
        credit: 0,
        currency: payout.currency.toUpperCase(),
      },
      {
        accountId: resolver.stripePending,
        debit: 0,
        credit: payout.amount,
        currency: payout.currency.toUpperCase(),
      },
    ],
  };
}

/** Stripe refund — flips a charge. Reduces revenue, reduces Stripe Pending. */
export function refundToJournalEntry(
  refund: StripeRefundShape,
  entityId: string,
  resolver: StripeAccountResolver,
): DraftJournalEntry {
  const contra = resolver.refundContra ?? resolver.revenue;
  return {
    entityId,
    date: isoFromUnix(refund.created),
    memo: `Stripe refund — ${refund.id} (charge ${refund.chargeId})`,
    source: "stripe",
    sourceRef: refund.id,
    lines: [
      {
        accountId: contra,
        debit: refund.amount,
        credit: 0,
        currency: refund.currency.toUpperCase(),
      },
      {
        accountId: resolver.stripePending,
        debit: 0,
        credit: refund.amount,
        currency: refund.currency.toUpperCase(),
      },
    ],
  };
}
