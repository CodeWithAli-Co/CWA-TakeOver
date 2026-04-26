// ───────────────────────────────────────────────────────────────────
// Entity — a single set of books.
//
// CodeWithAli LLC and Simplicity Funds Inc are two Entities with their
// own chart of accounts, period close, and base currency. Reports are
// scoped per-entity; consolidation views UNION across entities.
// ───────────────────────────────────────────────────────────────────

export type LegalForm =
  | "LLC"
  | "C-Corp"
  | "S-Corp"
  | "Sole Prop"
  | "Partnership"
  | "Non-Profit";

export type ISO4217 =
  | "USD"
  | "CAD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "JPY"
  | (string & {});

/** Normalized fiscal-year start as MM-DD. "01-01" = calendar year. */
export type FiscalYearStart = `${string}-${string}`;

export type TaxJurisdiction =
  | "US-FED"
  | "US-CA"
  | "US-NY"
  | "US-WA"
  | "US-TX"
  | "CA-FED"
  | "CA-ON"
  | "CA-BC"
  | (string & {});

export interface Entity {
  id: string;
  name: string;
  slug: string;
  legalForm: LegalForm;
  baseCurrency: ISO4217;
  fiscalYearStart: FiscalYearStart;
  taxJurisdiction: TaxJurisdiction;
  taxId?: string;
  createdAt: string; // ISO8601
  archivedAt?: string;
}

export interface FiscalPeriod {
  id: string;
  entityId: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  status: "open" | "soft_closed" | "locked";
  closedBy?: string;
  closedAt?: string;
  closingEntryId?: string;
}
