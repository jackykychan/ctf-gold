-- Initial schema for Cloudflare D1 (mirrors src/data/db.ts).

CREATE TABLE IF NOT EXISTS price_points (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  price_code   INTEGER NOT NULL,   -- 6 = sell, 8 = buy
  origin_price INTEGER NOT NULL,   -- HKD per 兩
  update_date  TEXT    NOT NULL,   -- raw updateDate from API (HK time)
  fetched_at   TEXT    NOT NULL,   -- ISO time we recorded it
  UNIQUE(price_code, update_date)
);

CREATE INDEX IF NOT EXISTS idx_code_update ON price_points(price_code, update_date);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
