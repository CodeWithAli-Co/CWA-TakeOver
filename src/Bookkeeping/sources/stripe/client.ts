// Stripe API client stub. Real fetch logic gates on STRIPE_SECRET_KEY
// being present in the env (per entity). Until credentials arrive,
// importCharges / importPayouts / importRefunds are no-ops that
// return empty arrays so the UI can render a "Not connected yet" state.

import type {
  StripeChargeShape,
  StripePayoutShape,
  StripeRefundShape,
} from "./transforms";

interface StripeClientConfig {
  secretKey: string;
  apiBase?: string;
}

export class StripeClient {
  constructor(private cfg: StripeClientConfig) {}

  async listCharges(_since?: string): Promise<StripeChargeShape[]> {
    if (!this.cfg.secretKey) return [];
    // TODO: implement real /v1/charges fetch when credentials land.
    // For now this is a deterministic stub so the import pipeline
    // can be tested end-to-end without hitting Stripe.
    return [];
  }

  async listPayouts(_since?: string): Promise<StripePayoutShape[]> {
    if (!this.cfg.secretKey) return [];
    return [];
  }

  async listRefunds(_since?: string): Promise<StripeRefundShape[]> {
    if (!this.cfg.secretKey) return [];
    return [];
  }
}

/** Resolve a StripeClient for an entity from saved credentials. Returns
 *  null when no Stripe key is configured for the entity yet. */
export function resolveStripeClient(_entityId: string): StripeClient | null {
  // Placeholder: will read from a `bookkeeping.stripe_credentials`
  // store once the operator pastes Stripe IDs / restricted keys.
  return null;
}
