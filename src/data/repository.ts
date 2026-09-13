import type { RawPoint } from "../domain/changes";
import type { AlertPrefs, StoredSubscription } from "../shared/push";

/**
 * The data-access contract for price history + small meta records. Dependency-
 * free so both the better-sqlite3 backend (Node/tests) and the Cloudflare D1
 * backend (Worker) can implement it without pulling in the other's runtime.
 */
export interface PriceRepository {
  /** Insert a point unless (code, updateDate) already exists. Returns true if inserted. */
  insertIfNew(code: number, price: number, updateDate: string, fetchedAt: string): Promise<boolean>;
  /** Bulk insert-if-new (for the Sheet import), tagging every row with `source`. */
  insertManyIfNew(
    rows: ReadonlyArray<{ code: number; price: number; updateDate: string; fetchedAt: string }>,
    source: string,
  ): Promise<{ inserted: number; skipped: number }>;
  /** Full history for a series, ascending by update time. */
  historyForCode(code: number): Promise<RawPoint[]>;
  /**
   * Bounded read for a range window: rows with `update_date >= since` (ascending)
   * plus the single row immediately before `since` (for a correct first-point
   * delta). Reads O(window), not O(all history).
   */
  historyWindow(code: number, since: string): Promise<{ preceding: RawPoint | null; rows: RawPoint[] }>;
  /** Newest row strictly before `boundary` (e.g. the previous day's close). */
  latestBeforeDay(code: number, boundary: string): Promise<RawPoint | null>;
  /** Newest point for a series, or null. */
  latest(code: number): Promise<RawPoint | null>;
  /** Newest updateDate for a series, or null. */
  latestUpdateDate(code: number): Promise<string | null>;
  /** Read a small key/value meta record (e.g. last_polled_at), or null. */
  getMeta(key: string): Promise<string | null>;
  /** Upsert a small key/value meta record. */
  setMeta(key: string, value: string): Promise<void>;

  /** Insert or update a push subscription (keyed by endpoint) with its prefs. */
  upsertSubscription(
    endpoint: string,
    p256dh: string,
    auth: string,
    prefs: AlertPrefs,
    now: string,
  ): Promise<void>;
  /** Remove a push subscription (e.g. on unsubscribe or when the push service reports it gone). */
  deleteSubscription(endpoint: string): Promise<void>;
  /** All push subscriptions, for the cron fan-out. */
  listSubscriptions(): Promise<StoredSubscription[]>;
}
