// ───────────────────────────────────────────────────────────────────
// Default entities — CodeWithAli + SimplicityFunds.
//
// Created at module init. Each comes with its full default Chart of
// Accounts (per legal form) and a starter set of bank/credit-card
// accounts that match the operator's real-world setup (Capital One).
// ───────────────────────────────────────────────────────────────────

import type { Entity } from "../types/entity";
import type { GLAccount, NormalBalance } from "../types/coa";
import { normalBalanceFor } from "../types/coa";
import { seedChartOfAccounts } from "./seedChartOfAccounts";

/** Stable string IDs so the two entities are referentially the same
 *  every session before we have a real Postgres uuid generator. */
export const ENTITY_IDS = {
  CWA: "ent_cwa",
  SIMPLICITY: "ent_simplicity",
} as const;

export const SEED_ENTITIES: Entity[] = [
  {
    id: ENTITY_IDS.CWA,
    name: "CodeWithAli",
    slug: "cwa",
    legalForm: "Sole Prop",
    baseCurrency: "USD",
    fiscalYearStart: "01-01",
    taxJurisdiction: "US-FED",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  },
  {
    id: ENTITY_IDS.SIMPLICITY,
    name: "SimplicityFunds",
    slug: "simplicity",
    legalForm: "LLC",
    baseCurrency: "USD",
    fiscalYearStart: "01-01",
    taxJurisdiction: "US-FED",
    createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
  },
];

/** Capital-One-specific extras — appended to each entity's seed CoA.
 *  Once Plaid linkage exists the externalLink can resolve to the real
 *  Plaid account id; until then the rows exist as plain GL accounts
 *  the operator can post against manually. */
function capitalOneCardAccounts(
  entityId: string,
  newId: () => string,
): GLAccount[] {
  return [
    {
      id: newId(),
      entityId,
      code: "2110",
      name: "Credit Card - Capital One Business",
      type: "liability",
      subtype: "credit_card",
      normalBalance: normalBalanceFor("liability") satisfies NormalBalance,
      isPostable: true,
      isArchived: false,
    },
  ];
}

/** Build the full opening CoA for an entity. The base seed is the
 *  legal-form-specific defaults; the Capital One card is appended. */
export function seedEntityChartOfAccounts(
  entity: Entity,
  newId: () => string = randomId,
): GLAccount[] {
  const base = seedChartOfAccounts(entity.id, entity.legalForm, newId);
  const extras = capitalOneCardAccounts(entity.id, newId);
  return [...base, ...extras];
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
