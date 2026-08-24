import { PRICE_SERIES } from "../config";
import { computeChangePct, previousDayChangePct } from "../domain/changes";
import type { PriceRepository } from "../data/repository";
import { formatWallClock } from "../shared/time";
import {
  RANGE_DAYS,
  type HistoryResponse,
  type LatestEntry,
  type LatestResponse,
  type PricePoint,
  type Range,
  type SeriesKey,
} from "../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HistoryService {
  getHistory(range: Range, now?: Date): Promise<HistoryResponse>;
  getLatest(): Promise<LatestResponse>;
}

function emptySeriesMap<T>(make: () => T): Record<SeriesKey, T> {
  const map = {} as Record<SeriesKey, T>;
  for (const s of PRICE_SERIES) map[s.key] = make();
  return map;
}

export function createHistoryService(repo: PriceRepository): HistoryService {
  return {
    async getHistory(range, now = new Date()): Promise<HistoryResponse> {
      // Read only the range window (+ the one row before it, so the earliest
      // point still has a correct % change). Reads O(window), not O(all history).
      const since = formatWallClock(new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS));
      const series = emptySeriesMap<PricePoint[]>(() => []);
      for (const s of PRICE_SERIES) {
        const { preceding, rows } = await repo.historyWindow(s.code, since);
        const withBaseline = preceding ? [preceding, ...rows] : rows;
        const full = computeChangePct(withBaseline);
        series[s.key] = preceding ? full.slice(1) : full;
      }
      return { range, generatedAt: now.toISOString(), series };
    },

    async getLatest(): Promise<LatestResponse> {
      const latest = emptySeriesMap<LatestEntry | null>(() => null);
      for (const s of PRICE_SERIES) {
        const row = await repo.latest(s.code);
        if (!row) continue;
        // Only two rows read: the latest and the previous day's last close.
        const dayBoundary = `${row.updateDate.slice(0, 10)} 00:00:00`;
        const prev = await repo.latestBeforeDay(s.code, dayBoundary);
        latest[s.key] = {
          key: s.key,
          code: s.code,
          price: row.price,
          updateDate: row.updateDate,
          changePct: previousDayChangePct(prev ? [prev, row] : [row]),
        };
      }
      return latest;
    },
  };
}
