import type { RawPoint } from "../src/domain/changes";
import type { PriceRepository } from "../src/data/repository";

interface Row {
  update_date: string;
  origin_price: number;
}

/** Newest row strictly before `boundary`, or null. */
async function beforeRow(db: D1Database, code: number, boundary: string): Promise<RawPoint | null> {
  const r = await db
    .prepare(
      `SELECT update_date, origin_price FROM price_points
       WHERE price_code = ? AND update_date < ? ORDER BY update_date DESC LIMIT 1`,
    )
    .bind(code, boundary)
    .first<Row>();
  return r ? { updateDate: r.update_date, price: r.origin_price } : null;
}

/** Cloudflare D1 (async, SQLite-compatible) backend — production. */
export function createD1Repository(db: D1Database): PriceRepository {
  return {
    async insertIfNew(code, price, updateDate, fetchedAt) {
      const res = await db
        .prepare(
          `INSERT OR IGNORE INTO price_points (price_code, origin_price, update_date, fetched_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(code, price, updateDate, fetchedAt)
        .run();
      return (res.meta.changes ?? 0) > 0;
    },
    async insertManyIfNew(rows, source) {
      if (rows.length === 0) return { inserted: 0, skipped: 0 };
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO price_points (price_code, origin_price, update_date, fetched_at, source)
         VALUES (?, ?, ?, ?, ?)`,
      );
      const results = await db.batch(
        rows.map((r) => stmt.bind(r.code, r.price, r.updateDate, r.fetchedAt, source)),
      );
      const inserted = results.reduce((n, res) => n + (res.meta.changes ?? 0), 0);
      return { inserted, skipped: rows.length - inserted };
    },
    async historyForCode(code) {
      const res = await db
        .prepare(
          `SELECT update_date, origin_price FROM price_points
           WHERE price_code = ? ORDER BY update_date ASC`,
        )
        .bind(code)
        .all<Row>();
      return res.results.map((r) => ({ updateDate: r.update_date, price: r.origin_price }));
    },
    async historyWindow(code, since) {
      const res = await db
        .prepare(
          `SELECT update_date, origin_price FROM price_points
           WHERE price_code = ? AND update_date >= ? ORDER BY update_date ASC`,
        )
        .bind(code, since)
        .all<Row>();
      const rows = res.results.map((r) => ({ updateDate: r.update_date, price: r.origin_price }));
      const preceding = await beforeRow(db, code, since);
      return { preceding, rows };
    },
    async latestBeforeDay(code, boundary) {
      return beforeRow(db, code, boundary);
    },
    async latest(code) {
      const row = await db
        .prepare(
          `SELECT update_date, origin_price FROM price_points
           WHERE price_code = ? ORDER BY update_date DESC LIMIT 1`,
        )
        .bind(code)
        .first<Row>();
      return row ? { updateDate: row.update_date, price: row.origin_price } : null;
    },
    async latestUpdateDate(code) {
      const row = await db
        .prepare(
          `SELECT update_date FROM price_points
           WHERE price_code = ? ORDER BY update_date DESC LIMIT 1`,
        )
        .bind(code)
        .first<{ update_date: string }>();
      return row ? row.update_date : null;
    },
    async getMeta(key) {
      const row = await db.prepare(`SELECT value FROM meta WHERE key = ?`).bind(key).first<{
        value: string;
      }>();
      return row ? row.value : null;
    },
    async setMeta(key, value) {
      await db
        .prepare(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .bind(key, value)
        .run();
    },
  };
}
