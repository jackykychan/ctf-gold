/**
 * Seed synthetic ~6-month Buy/Sell history so the dashboard is fully testable
 * without waiting for real data to accrue. Seeded rows are FAKE — clear them by
 * deleting the DB file (default ./data/gold.db).
 *
 * Usage: npm run seed
 */
import { loadConfig, PRICE_SERIES, seriesByKey } from "../src/config";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";

const config = loadConfig();
const repo = createRepository(createDb(config.dbPath));

const DAYS = 185;
const UPDATES_PER_DAY_MAX = 3;

// Starting reference prices (roughly current values).
const start = { sell: 52589, buy: 41959 };

function fmt(d: Date): string {
  // Emit an HK wall-clock-style string "YYYY-MM-DD HH:MM:SS.mmm".
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
  );
}

let sell = start.sell;
let buy = start.buy;
let inserted = 0;

const now = new Date();
for (let day = DAYS; day >= 0; day--) {
  const base = new Date(now);
  base.setDate(now.getDate() - day);
  const updates = 1 + Math.floor(Math.random() * UPDATES_PER_DAY_MAX);

  for (let u = 0; u < updates; u++) {
    // Random walk with mild mean drift.
    const drift = (Math.random() - 0.48) * 220;
    sell = Math.max(30000, Math.round(sell + drift));
    buy = Math.round(sell * (0.79 + Math.random() * 0.01)); // buy tracks below sell

    const ts = new Date(base);
    ts.setHours(9 + u * 3, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), u * 20);

    const sellDate = fmt(ts);
    const buyDate = fmt(new Date(ts.getTime() + 30)); // ~same second, different ms
    const fetchedAt = ts.toISOString();

    if (await repo.insertIfNew(seriesByKey("sell").code, sell, sellDate, fetchedAt)) inserted++;
    if (await repo.insertIfNew(seriesByKey("buy").code, buy, buyDate, fetchedAt)) inserted++;
  }
}

console.log(
  `Seeded ${inserted} synthetic points across ${DAYS} days for ${PRICE_SERIES.length} series ` +
    `into ${config.dbPath}. These are FAKE — delete the DB file to clear.`,
);
