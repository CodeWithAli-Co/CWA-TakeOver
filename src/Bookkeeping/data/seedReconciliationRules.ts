// Default reconciliation rules — common patterns every business
// hits. Operator can override / extend in Settings → Rules.
//
// Rules need GLAccount.id values to point at, so this is a FACTORY:
// caller looks up the relevant accounts in the entity's CoA and
// passes them in.

import type { ReconciliationRule } from "../types/source";

export interface SeedRuleAccountMap {
  stripePending: string;
  cashOnPayout: string;
  bankFees: string;
  software: string;
  meals: string;
  rent: string;
  travel: string;
  marketing: string;
  professional: string;
  taxExpense: string;
  ownerDraw: string;
}

export function seedReconciliationRules(
  entityId: string,
  accounts: SeedRuleAccountMap,
  newId: () => string,
): ReconciliationRule[] {
  const now = new Date().toISOString();
  const rule = (
    priority: number,
    pattern: string,
    targetAccountId: string,
    memoTemplate: string,
  ): ReconciliationRule => ({
    id: newId(),
    entityId,
    priority,
    match: { descriptionRegex: pattern },
    action: { targetAccountId, memoTemplate },
    enabled: true,
    hitCount: 0,
    createdAt: now,
  });

  return [
    rule(10, "^STRIPE PAYOUT|stripe.*payout", accounts.stripePending, "Stripe payout"),
    rule(20, "OVERDRAFT|NSF|RETURNED.ITEM", accounts.bankFees, "Bank fee — overdraft / NSF"),
    rule(30, "MONTHLY.SERVICE.CHARGE|FOREIGN.TXN.FEE|WIRE.FEE", accounts.bankFees, "Bank service fee"),
    rule(40, "ANTHROPIC|OPENAI|CURSOR|GITHUB|VERCEL|SUPABASE|FIGMA|LINEAR|NOTION|SLACK|ZOOM|1PASSWORD|GROK|ELEVENLABS", accounts.software, "Software subscription"),
    rule(50, "AWS|AMAZON.WEB.SERVICES|GOOGLE.CLOUD|GCP|AZURE|DIGITALOCEAN|CLOUDFLARE|NETLIFY", accounts.software, "Cloud hosting"),
    rule(60, "UBER\\s|LYFT|TAXI|UBER.EATS|DOORDASH|GRUBHUB", accounts.travel, "Travel / rideshare"),
    rule(70, "STARBUCKS|COFFEE|RESTAURANT|EATS|DELI|CAFE|PIZZA|MCDONALD|CHIPOTLE", accounts.meals, "Meals (50% deductible)"),
    rule(80, "GOOGLE.ADS|META.ADS|FACEBOOK|LINKEDIN.ADS|X.CORP.ADS|TWITTER", accounts.marketing, "Marketing"),
    rule(90, "RENT|LEASE|REGUS|WEWORK", accounts.rent, "Rent"),
    rule(100, "IRS|TAX.PAYMENT|FRANCHISE.TAX|STATE.TAX", accounts.taxExpense, "Tax payment"),
    rule(110, "ATTORNEY|LEGAL|LEGALZOOM|GUSTO|CPA|ACCOUNTANT", accounts.professional, "Professional services"),
    rule(120, "OWNER.TRANSFER|OWNER.DRAW|MEMBER.DRAW|DRAW.TO|CHASE.TRANSFER.TO.PERSONAL", accounts.ownerDraw, "Owner draw"),
  ];
}
