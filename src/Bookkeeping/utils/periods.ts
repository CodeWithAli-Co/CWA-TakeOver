// Fiscal-year + period math.
// Periods are month-aligned: each calendar month is one period.

import type { Entity, FiscalPeriod } from "../types/entity";

/** Return YYYY-MM-DD for the first day of the fiscal year that contains
 *  the given date, given the entity's fiscalYearStart (MM-DD). */
export function fiscalYearStartFor(entity: Entity, date: string): string {
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const [fyMonthStr, fyDayStr] = entity.fiscalYearStart.split("-");
  const fyMonth = Number(fyMonthStr);
  const fyDay = Number(fyDayStr);

  const isBeforeFyStart =
    month < fyMonth || (month === fyMonth && day < fyDay);
  const fyYear = isBeforeFyStart ? year - 1 : year;
  return `${fyYear}-${String(fyMonth).padStart(2, "0")}-${String(fyDay).padStart(2, "0")}`;
}

/** First and last day of the calendar month a date falls in. */
export function monthRange(date: string): { start: string; end: string } {
  const [yStr, mStr] = date.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${yStr}-${mStr}-01`;
  // last day of month: subtract 1 day from the first of next month.
  const next = new Date(Date.UTC(y, m, 1));
  next.setUTCDate(0);
  const lastDay = String(next.getUTCDate()).padStart(2, "0");
  const end = `${yStr}-${mStr}-${lastDay}`;
  return { start, end };
}

/** Find the FiscalPeriod that contains `date` for the given entity, or
 *  null if none exists. */
export function periodForDate(
  date: string,
  periods: FiscalPeriod[],
  entityId: string,
): FiscalPeriod | null {
  for (const p of periods) {
    if (p.entityId !== entityId) continue;
    if (date >= p.start && date <= p.end) return p;
  }
  return null;
}

/** Pure factory — caller assigns id. */
export function buildMonthPeriod(
  entityId: string,
  anchorDate: string,
): Omit<FiscalPeriod, "id"> {
  const { start, end } = monthRange(anchorDate);
  return { entityId, start, end, status: "open" };
}
