// SourcesPanel — connect Stripe + Plaid, review import-run history.
// Gated on credentials being present; until then shows "Not connected"
// and points at the right place to paste creds.

import type { Entity } from "../types/entity";
import { resolveStripeClient } from "../sources/stripe/client";
import { resolvePlaidClient } from "../sources/plaid/client";

export function SourcesPanel({ entity }: { entity: Entity }) {
  const stripe = resolveStripeClient(entity.id);
  const plaid = resolvePlaidClient(entity.id);

  return (
    <section className="bk-section">
      <h2 className="bk-section-title">Sources · {entity.name}</h2>
      <p className="bk-section-blurb">
        Wire Stripe + Plaid so transactions auto-flow into the Import Inbox.
        Stripe handles revenue + fees + payouts; Plaid handles bank + credit-card
        feeds (Capital One in your case).
      </p>

      <div className="bk-source-grid">
        <SourceCard
          name="Stripe"
          status={stripe ? "connected" : "needs-creds"}
          hint={
            stripe
              ? "Account connected. Auto-import runs on a schedule."
              : "Restricted API key required. Phase-2 plumbing is in place; paste creds in Settings to connect."
          }
        />
        <SourceCard
          name="Plaid (Capital One)"
          status={plaid ? "connected" : "needs-creds"}
          hint={
            plaid
              ? "Capital One linked via Plaid. Transactions sync incrementally via /transactions/sync."
              : "Plaid client_id + secret required, plus an item access_token from Plaid Link. We can reuse the existing simplicity_web Plaid integration here."
          }
        />
      </div>
    </section>
  );
}

function SourceCard({
  name,
  status,
  hint,
}: {
  name: string;
  status: "connected" | "needs-creds";
  hint: string;
}) {
  return (
    <div className="bk-source-card" data-status={status}>
      <div className="bk-source-head">
        <span className="bk-source-name">{name}</span>
        <span
          className={`bk-pill ${
            status === "connected" ? "bk-pill--good" : "bk-pill--warn"
          }`}
        >
          {status === "connected" ? "Connected" : "Not connected"}
        </span>
      </div>
      <p className="bk-source-hint">{hint}</p>
    </div>
  );
}
