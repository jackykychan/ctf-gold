import { intlLocale, type Locale } from "./i18n";

/** Format an integer HKD price with locale grouping. */
export function formatPrice(price: number, locale: Locale): string {
  return price.toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 });
}

/** Format a signed percentage, e.g. +0.42% / -1.10%. */
export function formatPct(pct: number, locale: Locale): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/** Parse an API date string (time optional) to a UTC-pinned Date preserving the digits. */
function parseWallClock(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, h ? +h : 0, mi ? +mi : 0, sec ? +sec : 0));
}

/**
 * Format an API date/second string as HK wall-clock time, localized. The API
 * string is already HK local time, so we pin it to UTC during parsing/formatting
 * to preserve the exact clock digits regardless of the viewer's timezone.
 */
export function formatHkClock(s: string, locale: Locale, withSeconds = false): string {
  const date = parseWallClock(s);
  if (!date) return s;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(date);
}

/** Date portion only, e.g. "23 Aug 2026". */
export function formatHkDate(s: string, locale: Locale): string {
  const date = parseWallClock(s);
  if (!date) return s;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Time portion only, e.g. "09:03". */
export function formatHkTime(s: string, locale: Locale): string {
  const date = parseWallClock(s);
  if (!date) return s;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
