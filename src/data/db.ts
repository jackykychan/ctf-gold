import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS price_points (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  price_code   INTEGER NOT NULL,   -- 6 = sell, 8 = buy
  origin_price INTEGER NOT NULL,   -- HKD per 兩
  update_date  TEXT    NOT NULL,   -- raw updateDate from API (HK time)
  fetched_at   TEXT    NOT NULL,   -- ISO time we recorded it
  source       TEXT    NOT NULL DEFAULT 'auto', -- 'auto' (poller) | 'manual' (sheet import)
  -- UNIQUE also creates the index used by every query (price_code + update_date).
  UNIQUE(price_code, update_date)
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Open (or create) the SQLite database and run migrations. Pass ":memory:" for
 * an ephemeral database in tests. Creates the parent directory for file paths.
 */
export function createDb(dbPath: string): DB {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}
