/**
 * Domain types shared across backend layers and the frontend bundle.
 * A change here is caught by the compiler on both sides of the wire.
 */

/** meta-table key recording the last time the poller/cron ran (for /api/health liveness). */
export const META_LAST_POLLED = "last_polled_at";

export type SeriesKey = "sell" | "buy";

export type Range = "5d" | "2w" | "1m" | "3m" | "6m";

export const RANGES: readonly Range[] = ["5d", "2w", "1m", "3m", "6m"];

/** Days covered by each range window. */
export const RANGE_DAYS: Record<Range, number> = {
  "5d": 5,
  "2w": 14,
  "1m": 30,
  "3m": 90,
  "6m": 180,
};

/** A single stored price observation for one series. */
export interface PricePoint {
  /** Raw `updateDate` from the API (HK local time, e.g. "2026-08-23 09:03:57.217"). */
  t: string;
  /** originGoldPrice — HKD per 兩. */
  price: number;
  /** Percent change vs the previous point in the same series; null for the first point. */
  changePct: number | null;
}

/** Result of `parseGoldPrice` for one configured series. */
export interface ParsedPoint {
  code: number;
  key: SeriesKey;
  price: number;
  updateDate: string;
}

/** GET /api/history response. */
export interface HistoryResponse {
  range: Range;
  generatedAt: string;
  series: Record<SeriesKey, PricePoint[]>;
}

export interface LatestEntry {
  key: SeriesKey;
  code: number;
  price: number;
  updateDate: string;
  /** Percent change vs the previous day's last price; null if unavailable. */
  changePct: number | null;
}

/** GET /api/latest response. */
export type LatestResponse = Record<SeriesKey, LatestEntry | null>;

/** One stacked change-card: a single update event pairing whichever series are present. */
export interface CardEvent {
  /** Second-truncated timestamp key, e.g. "2026-08-23 09:03:57". */
  t: string;
  sell?: PricePoint;
  buy?: PricePoint;
}
