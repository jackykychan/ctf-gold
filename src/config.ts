import type { SeriesKey } from "./shared/types";

export interface SeriesDef {
  /** API priceCode. */
  code: number;
  key: SeriesKey;
  label: { en: string; zh: string };
}

/**
 * The registry every layer iterates. Adding a new series (e.g. platinum) is a
 * one-line edit here — parser, storage, API shape, chart and cards all follow.
 */
export const PRICE_SERIES: readonly SeriesDef[] = [
  { code: 6, key: "sell", label: { en: "9999 Gold Sell", zh: "飾金賣出價" } },
  { code: 8, key: "buy", label: { en: "9999 Gold Buy", zh: "飾金買入價" } },
];

/** The series whose updateDate drives the adaptive poll scheduler. */
export const CANONICAL_SERIES_KEY: SeriesKey = "sell";

export function seriesByKey(key: SeriesKey): SeriesDef {
  const def = PRICE_SERIES.find((s) => s.key === key);
  if (!def) throw new Error(`Unknown series key: ${key}`);
  return def;
}

export interface AppConfig {
  port: number;
  dbPath: string;
  apiUrl: string;
  startPollIntervalMin: number;
  minPollIntervalMin: number;
  maxPollIntervalMin: number;
  /** Minutes added after a run of no-change polls. */
  pollIncrementMin: number;
  /** No-change polls at one interval before backing off. */
  pollStreakThreshold: number;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number, got "${raw}"`);
  return n;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

export function loadConfig(): AppConfig {
  return {
    port: num("PORT", 3000),
    dbPath: str("DB_PATH", "./data/gold.db"),
    apiUrl: str(
      "API_URL",
      "https://www.chowtaifook.com/bin/servlet/ctfweb/goldPrice?region=HK",
    ),
    startPollIntervalMin: num("START_POLL_INTERVAL_MIN", 15),
    minPollIntervalMin: num("MIN_POLL_INTERVAL_MIN", 5),
    maxPollIntervalMin: num("MAX_POLL_INTERVAL_MIN", 120),
    pollIncrementMin: num("POLL_INCREMENT_MIN", 15),
    pollStreakThreshold: num("POLL_STREAK_THRESHOLD", 3),
  };
}
