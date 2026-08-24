import { parseApiDate, truncateToSecond } from "../shared/time";
import type { CardEvent, PricePoint, Range } from "../shared/types";
import { RANGE_DAYS } from "../shared/types";

/** A raw stored observation (before change % is computed). */
export interface RawPoint {
  updateDate: string;
  price: number;
}

/**
 * PURE. Given a full, chronologically-ascending series, compute each point's
 * percent change versus the previous point. The first point has changePct null.
 * Computing over the FULL series (not a windowed slice) keeps the earliest card
 * inside any range showing a correct delta.
 */
export function computeChangePct(points: readonly RawPoint[]): PricePoint[] {
  const out: PricePoint[] = [];
  let prev: number | null = null;
  for (const p of points) {
    const changePct =
      prev === null || prev === 0 ? (prev === null ? null : 0) : ((p.price - prev) / prev) * 100;
    out.push({ t: p.updateDate, price: p.price, changePct });
    prev = p.price;
  }
  return out;
}

/**
 * PURE. Keep only points within the range window ending at `now`.
 * Points must be pre-sorted ascending; the returned slice preserves order.
 */
export function filterRange(points: readonly PricePoint[], range: Range, now: Date): PricePoint[] {
  const cutoff = now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return points.filter((p) => parseApiDate(p.t).getTime() >= cutoff);
}

/** A single day's aggregated point. */
export interface DailyPoint {
  /** The updateDate of the day's highest observation. */
  t: string;
  /** The highest price seen that day. */
  price: number;
}

/**
 * PURE. Group points by calendar day and keep the day's HIGHEST price. Returns
 * one point per day, ascending by time, carrying the timestamp at which that
 * day's high occurred.
 */
export function dailyHigh(points: readonly { t: string; price: number }[]): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();
  for (const p of points) {
    const day = p.t.slice(0, 10);
    const cur = byDay.get(day);
    if (!cur || p.price > cur.price) byDay.set(day, { t: p.t, price: p.price });
  }
  return [...byDay.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

/**
 * PURE. Percent change of the latest price versus the last price recorded on the
 * most recent earlier calendar day. Null if there is no prior day's data.
 */
export function previousDayChangePct(points: readonly RawPoint[]): number | null {
  if (points.length === 0) return null;
  const latest = points[points.length - 1]!;
  const latestDay = latest.updateDate.slice(0, 10);
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.updateDate.slice(0, 10) < latestDay) {
      const prev = points[i]!.price;
      return prev === 0 ? null : ((latest.price - prev) / prev) * 100;
    }
  }
  return null;
}

/**
 * PURE. Group Buy and Sell points that belong to the same update event into one
 * card. Buy/Sell of an event share a timestamp to the second (they differ only
 * by milliseconds). Returns newest-first for top-of-stack rendering.
 */
export type CardGranularity = "second" | "day";

export function groupCardEvents(
  sell: readonly PricePoint[],
  buy: readonly PricePoint[],
  granularity: CardGranularity = "second",
): CardEvent[] {
  const keyOf = granularity === "day" ? (t: string) => t.slice(0, 10) : truncateToSecond;
  const byKey = new Map<string, CardEvent>();

  const add = (point: PricePoint, which: "sell" | "buy"): void => {
    const key = keyOf(point.t);
    let event = byKey.get(key);
    if (!event) {
      event = { t: key };
      byKey.set(key, event);
    }
    event[which] = point;
  };

  for (const p of sell) add(p, "sell");
  for (const p of buy) add(p, "buy");

  return [...byKey.values()].sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
}

/**
 * PURE. Reduce a series to one point per day (the day's highest price) with the
 * percent change of each day's high versus the previous day's high.
 */
export function dailyHighSeries(points: readonly PricePoint[]): PricePoint[] {
  const highs = dailyHigh(points);
  return computeChangePct(highs.map((h) => ({ updateDate: h.t, price: h.price })));
}
