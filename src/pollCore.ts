import type { GoldPriceClient } from "./api/goldPriceClient";
import { parseGoldPrice } from "./api/parseGoldPrice";
import type { PriceRepository } from "./data/repository";
import type { SeriesKey } from "./shared/types";

export interface PollOnceDeps {
  client: GoldPriceClient;
  repository: PriceRepository;
  /** priceCode whose updateDate is the canonical change signal. */
  canonicalCode: number;
  now?: Date;
}

/** A point that was newly inserted this poll, with the series' prior price. */
export interface InsertedPoint {
  code: number;
  key: SeriesKey;
  price: number;
  updateDate: string;
  /** The series' latest price just before this insert, or null if none. */
  prevPrice: number | null;
}

export interface PollOnceResult {
  inserted: number;
  canonicalUpdateDate: string | null;
  /** Points inserted this poll (empty when nothing changed) — drives push alerts. */
  insertedPoints: InsertedPoint[];
}

/**
 * The shared poll core: fetch -> parse -> insert-if-new for every configured
 * series. Runtime-agnostic (used by the Node poller and the Worker cron). No
 * scheduling, timers, or Node-only APIs here.
 */
export async function runPollOnce({
  client,
  repository,
  canonicalCode,
  now,
}: PollOnceDeps): Promise<PollOnceResult> {
  const fetchedAt = (now ?? new Date()).toISOString();
  const raw = await client.fetchRaw();
  const points = parseGoldPrice(raw);

  let inserted = 0;
  let canonicalUpdateDate: string | null = null;
  const insertedPoints: InsertedPoint[] = [];
  for (const p of points) {
    // Read the prior latest BEFORE inserting so alerts can compute the delta.
    const prev = await repository.latest(p.code);
    if (await repository.insertIfNew(p.code, p.price, p.updateDate, fetchedAt)) {
      inserted++;
      insertedPoints.push({
        code: p.code,
        key: p.key,
        price: p.price,
        updateDate: p.updateDate,
        prevPrice: prev ? prev.price : null,
      });
    }
    if (p.code === canonicalCode) canonicalUpdateDate = p.updateDate;
  }
  return { inserted, canonicalUpdateDate, insertedPoints };
}
