// Date labels in the reader's language. Call these on the server: Node and the
// browser ship different ICU data, so a label formatted on both sides can
// differ and break hydration. Dates are calendar days, so they read in UTC.

function utcDate(value: string): Date | null {
  const d = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 Nov" / "11月4日". */
export function dayLabel(value: string, intl: string): string {
  const d = utcDate(value);
  return d ? d.toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) : "";
}

/** "Wed" / "周三". */
export function weekdayLabel(value: string, intl: string): string {
  const d = utcDate(value);
  return d ? d.toLocaleDateString(intl, { weekday: "short", timeZone: "UTC" }) : "";
}

/** "November 2026" / "2026年11月"; null when the date can't be read. */
export function monthLabel(value: string, intl: string): string | null {
  const d = utcDate(value);
  return d ? d.toLocaleDateString(intl, { month: "long", year: "numeric", timeZone: "UTC" }) : null;
}

/** "4 Nov 2026" (or "4 Nov" without the year) / "2026年11月4日". */
export function shortDateLabel(value: string, intl: string, withYear = true): string {
  const d = utcDate(value);
  return d
    ? d.toLocaleDateString(intl, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
    : "";
}
