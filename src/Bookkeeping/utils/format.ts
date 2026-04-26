// Money + date formatters used across the module. Locale-aware,
// tabular-aligned, and predictable (no surprises in tables).

const MONEY_CACHE = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string = "USD"): string {
  const key = currency;
  let fmt = MONEY_CACHE.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    MONEY_CACHE.set(key, fmt);
  }
  return fmt.format(amount);
}

/** Same as formatMoney but with parens for negatives — accountant style. */
export function formatMoneyAccounting(
  amount: number,
  currency: string = "USD",
): string {
  if (amount < 0) return `(${formatMoney(-amount, currency)})`;
  return formatMoney(amount, currency);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
