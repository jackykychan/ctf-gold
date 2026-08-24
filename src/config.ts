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
  /** /api/health reports degraded if the last poll is older than this many minutes. */
  healthStaleAfterMin: number;
  /** Bearer secret required to write via /api/import; empty disables the endpoint. */
  syncSecret: string;
}

/** Anything with string-or-undefined values: `process.env` or a Worker `env` binding. */
export type EnvSource = Record<string, string | undefined>;

function num(env: EnvSource, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number, got "${raw}"`);
  return n;
}

function str(env: EnvSource, name: string, fallback: string): string {
  const raw = env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

/** Read `process.env` without referencing the Node global directly (Worker-safe). */
function processEnv(): EnvSource {
  return (globalThis as { process?: { env?: EnvSource } }).process?.env ?? {};
}

/** Build config from an env source (defaults to Node's `process.env`). */
export function loadConfig(env: EnvSource = processEnv()): AppConfig {
  return {
    port: num(env, "PORT", 3000),
    dbPath: str(env, "DB_PATH", "./data/gold.db"),
    apiUrl: str(
      env,
      "API_URL",
      "https://www.chowtaifook.com/bin/servlet/ctfweb/goldPrice?region=HK",
    ),
    startPollIntervalMin: num(env, "START_POLL_INTERVAL_MIN", 15),
    minPollIntervalMin: num(env, "MIN_POLL_INTERVAL_MIN", 5),
    maxPollIntervalMin: num(env, "MAX_POLL_INTERVAL_MIN", 120),
    pollIncrementMin: num(env, "POLL_INCREMENT_MIN", 15),
    pollStreakThreshold: num(env, "POLL_STREAK_THRESHOLD", 3),
    healthStaleAfterMin: num(env, "HEALTH_STALE_AFTER_MIN", 30),
    syncSecret: str(env, "SYNC_SECRET", ""),
  };
}
