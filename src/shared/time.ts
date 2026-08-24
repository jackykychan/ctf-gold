/**
 * Time helpers. The API's `updateDate` is HK local time (UTC+8) with no timezone
 * suffix and variable millisecond precision (e.g. "...217" vs "...22").
 * For interval/gap math we only need consistent parsing, so relative differences
 * are timezone-independent.
 */

/** Parse an API `updateDate` string into a Date. Returns an invalid Date on garbage. */
export function parseApiDate(s: string): Date {
  // "2026-08-23 09:03:57.217" -> "2026-08-23T09:03:57.217"
  return new Date(s.replace(" ", "T"));
}

/** Whole-and-fractional minutes between two API date strings (a - b). */
export function minutesBetween(a: string, b: string): number {
  const ms = parseApiDate(a).getTime() - parseApiDate(b).getTime();
  return ms / 60_000;
}

/** Truncate an API `updateDate` to whole seconds: "YYYY-MM-DD HH:MM:SS". */
export function truncateToSecond(s: string): string {
  return s.slice(0, 19);
}

/** Clamp n into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
