import { PRICE_SERIES } from "../config";
import { computeChangePct, filterRange, previousDayChangePct } from "../domain/changes";
import type { PriceRepository } from "../data/priceRepository";
import type {
  HistoryResponse,
  LatestEntry,
  LatestResponse,
  PricePoint,
  Range,
  SeriesKey,
} from "../shared/types";

export interface HistoryService {
  getHistory(range: Range, now?: Date): HistoryResponse;
  getLatest(): LatestResponse;
}

function emptySeriesMap<T>(make: () => T): Record<SeriesKey, T> {
  const map = {} as Record<SeriesKey, T>;
  for (const s of PRICE_SERIES) map[s.key] = make();
  return map;
}

export function createHistoryService(repo: PriceRepository): HistoryService {
  return {
    getHistory(range, now = new Date()): HistoryResponse {
      const series = emptySeriesMap<PricePoint[]>(() => []);
      for (const s of PRICE_SERIES) {
        const full = computeChangePct(repo.historyForCode(s.code));
        series[s.key] = filterRange(full, range, now);
      }
      return { range, generatedAt: now.toISOString(), series };
    },

    getLatest(): LatestResponse {
      const latest = emptySeriesMap<LatestEntry | null>(() => null);
      for (const s of PRICE_SERIES) {
        const rows = repo.historyForCode(s.code);
        const row = rows[rows.length - 1];
        latest[s.key] = row
          ? {
              key: s.key,
              code: s.code,
              price: row.price,
              updateDate: row.updateDate,
              changePct: previousDayChangePct(rows),
            }
          : null;
      }
      return latest;
    },
  };
}
