import type { GoldPriceClient } from "./api/goldPriceClient";
import { parseGoldPrice } from "./api/parseGoldPrice";
import type { PriceRepository } from "./data/repository";

export interface PollOnceDeps {
  client: GoldPriceClient;
  repository: PriceRepository;
  /** priceCode whose updateDate is the canonical change signal. */
  canonicalCode: number;
  now?: Date;
}

export interface PollOnceResult {
  inserted: number;
  canonicalUpdateDate: string | null;
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
  for (const p of points) {
    if (await repository.insertIfNew(p.code, p.price, p.updateDate, fetchedAt)) inserted++;
    if (p.code === canonicalCode) canonicalUpdateDate = p.updateDate;
  }
  return { inserted, canonicalUpdateDate };
}
