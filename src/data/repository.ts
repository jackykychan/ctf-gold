import type { RawPoint } from "../domain/changes";

/**
 * The data-access contract for price history + small meta records. Dependency-
 * free so both the better-sqlite3 backend (Node/tests) and the Cloudflare D1
 * backend (Worker) can implement it without pulling in the other's runtime.
 */
export interface PriceRepository {
  /** Insert a point unless (code, updateDate) already exists. Returns true if inserted. */
  insertIfNew(code: number, price: number, updateDate: string, fetchedAt: string): Promise<boolean>;
  /** Full history for a series, ascending by update time. */
  historyForCode(code: number): Promise<RawPoint[]>;
  /** Newest point for a series, or null. */
  latest(code: number): Promise<RawPoint | null>;
  /** Newest updateDate for a series, or null. */
  latestUpdateDate(code: number): Promise<string | null>;
  /** Read a small key/value meta record (e.g. last_polled_at), or null. */
  getMeta(key: string): Promise<string | null>;
  /** Upsert a small key/value meta record. */
  setMeta(key: string, value: string): Promise<void>;
}
