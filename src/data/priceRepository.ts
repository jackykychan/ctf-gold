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
  const windowStmt = db.prepare(
    `SELECT update_date, origin_price FROM price_points
     WHERE price_code = ? AND update_date >= ? ORDER BY update_date ASC`,
  );
  const beforeStmt = db.prepare(
    `SELECT update_date, origin_price FROM price_points
     WHERE price_code = ? AND update_date < ? ORDER BY update_date DESC LIMIT 1`,
  );
  const insertSourcedStmt = db.prepare(
    `INSERT OR IGNORE INTO price_points (price_code, origin_price, update_date, fetched_at, source)
     VALUES (?, ?, ?, ?, ?)`,
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
    async insertManyIfNew(rows, source) {
      const run = db.transaction(
        (batch: ReadonlyArray<{ code: number; price: number; updateDate: string; fetchedAt: string }>) => {
          let inserted = 0;
          for (const r of batch) {
            inserted += insertSourcedStmt.run(r.code, r.price, r.updateDate, r.fetchedAt, source).changes;
          }
          return inserted;
        },
      );
      const inserted = run(rows) as number;
      return { inserted, skipped: rows.length - inserted };
    },
    async historyForCode(code) {
      const rows = historyStmt.all(code) as Row[];
      return rows.map((r) => ({ updateDate: r.update_date, price: r.origin_price }));
    },
    async historyWindow(code, since) {
      const rows = (windowStmt.all(code, since) as Row[]).map((r) => ({
        updateDate: r.update_date,
        price: r.origin_price,
      }));
      const p = beforeStmt.get(code, since) as Row | undefined;
      const preceding = p ? { updateDate: p.update_date, price: p.origin_price } : null;
      return { preceding, rows };
    },
    async latestBeforeDay(code, boundary) {
      const r = beforeStmt.get(code, boundary) as Row | undefined;
      return r ? { updateDate: r.update_date, price: r.origin_price } : null;
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
