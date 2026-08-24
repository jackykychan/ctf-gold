import type { DB } from "./db";
import type { PriceRepository } from "./repository";

export type { PriceRepository };

interface Row {
  update_date: string;
  origin_price: number;
}

/** better-sqlite3 (synchronous) backend used for local dev, the seed script and tests. */
export function createRepository(db: DB): PriceRepository {
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO price_points (price_code, origin_price, update_date, fetched_at)
     VALUES (?, ?, ?, ?)`,
  );
  const historyStmt = db.prepare(
    `SELECT update_date, origin_price FROM price_points
     WHERE price_code = ? ORDER BY update_date ASC`,
  );
  const latestStmt = db.prepare(
    `SELECT update_date, origin_price FROM price_points
     WHERE price_code = ? ORDER BY update_date DESC LIMIT 1`,
  );
  const getMetaStmt = db.prepare(`SELECT value FROM meta WHERE key = ?`);
  const setMetaStmt = db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  return {
    async insertIfNew(code, price, updateDate, fetchedAt) {
      const info = insertStmt.run(code, price, updateDate, fetchedAt);
      return info.changes > 0;
    },
    async historyForCode(code) {
      const rows = historyStmt.all(code) as Row[];
      return rows.map((r) => ({ updateDate: r.update_date, price: r.origin_price }));
    },
    async latest(code) {
      const row = latestStmt.get(code) as Row | undefined;
      return row ? { updateDate: row.update_date, price: row.origin_price } : null;
    },
    async latestUpdateDate(code) {
      const row = latestStmt.get(code) as Row | undefined;
      return row ? row.update_date : null;
    },
    async getMeta(key) {
      const row = getMetaStmt.get(key) as { value: string } | undefined;
      return row ? row.value : null;
    },
    async setMeta(key, value) {
      setMetaStmt.run(key, value);
    },
  };
}
