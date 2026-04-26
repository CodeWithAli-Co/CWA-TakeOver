// Plaid client stub. Like the Stripe client, returns empty arrays
// until credentials are wired. Reuses the existing simplicity_web
// PlaidCredentials shape (bankCred[] + transactionsCred[] with
// access_token + cursor) once integrated.

import type { PlaidTxShape } from "./transforms";

interface PlaidClientConfig {
  clientId: string;
  secret: string;
  accessTokens: string[];   // one per Plaid Item
  env: "sandbox" | "development" | "production";
}

export class PlaidClient {
  constructor(private cfg: PlaidClientConfig) {}

  async syncTransactions(_cursorByItem: Record<string, string>): Promise<{
    added: PlaidTxShape[];
    modified: PlaidTxShape[];
    removed: string[];
    nextCursor: Record<string, string>;
  }> {
    if (!this.cfg.secret || this.cfg.accessTokens.length === 0) {
      return { added: [], modified: [], removed: [], nextCursor: {} };
    }
    // TODO: real /transactions/sync calls when credentials arrive.
    return { added: [], modified: [], removed: [], nextCursor: {} };
  }
}

/** Resolve a Plaid client for an entity. The credentials live in the
 *  user record (existing simplicity_web pattern) — once we plumb that
 *  through, this returns a configured client. */
export function resolvePlaidClient(_entityId: string): PlaidClient | null {
  return null;
}
