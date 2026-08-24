import { CANONICAL_SERIES_KEY, seriesByKey, type AppConfig } from "./config";
import type { GoldPriceClient } from "./api/goldPriceClient";
import { parseGoldPrice } from "./api/parseGoldPrice";
import type { PriceRepository } from "./data/priceRepository";
import {
  decideNext,
  initialState,
  type PollState,
  type SchedulerConfig,
} from "./domain/scheduler";

export interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

export interface PollerDeps {
  client: GoldPriceClient;
  repository: PriceRepository;
  config: AppConfig;
  logger?: Logger;
}

export interface Poller {
  /** Run one poll immediately, then keep self-scheduling. */
  start(): Promise<void>;
  stop(): void;
}

/**
 * Orchestrates the adaptive polling loop: fetch -> parse -> store new points ->
 * ask the pure scheduler for the next delay -> setTimeout. All decision logic
 * lives in `scheduler`; this module only does I/O and timing.
 */
export function createPoller({ client, repository, config, logger }: PollerDeps): Poller {
  const log = logger ?? { info: console.log, error: console.error };
  const canonicalCode = seriesByKey(CANONICAL_SERIES_KEY).code;

  const schedCfg: SchedulerConfig = {
    startIntervalMin: config.startPollIntervalMin,
    minIntervalMin: config.minPollIntervalMin,
    maxIntervalMin: config.maxPollIntervalMin,
    incrementMin: config.pollIncrementMin,
    streakThreshold: config.pollStreakThreshold,
  };

  let state: PollState = initialState(schedCfg);
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  // Resume backoff state across restarts from the newest stored point.
  const seeded = repository.latestUpdateDate(canonicalCode);
  if (seeded) state = { ...state, lastSeenUpdateDate: seeded };

  function schedule(delayMin: number): void {
    if (stopped) return;
    const ms = Math.max(1, delayMin) * 60_000;
    log.info(`Next poll in ${delayMin} min`);
    timer = setTimeout(() => void tick(), ms);
    // Don't keep the event loop alive solely for the poller.
    if (typeof timer.unref === "function") timer.unref();
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    const fetchedAt = new Date().toISOString();
    try {
      const raw = await client.fetchRaw();
      const points = parseGoldPrice(raw);

      let inserted = 0;
      let canonicalUpdate: string | null = null;
      for (const p of points) {
        if (repository.insertIfNew(p.code, p.price, p.updateDate, fetchedAt)) inserted++;
        if (p.code === canonicalCode) canonicalUpdate = p.updateDate;
      }

      if (canonicalUpdate === null) {
        log.error("Poll succeeded but canonical series was absent; retrying at current interval");
        schedule(state.currentIntervalMin);
        return;
      }

      const decision = decideNext(state, canonicalUpdate, schedCfg);
      state = decision.nextState;
      log.info(
        `Poll ok: ${inserted} new point(s); ${decision.changed ? "CHANGED" : "no change"} ` +
          `@ ${canonicalUpdate}`,
      );
      schedule(decision.nextDelayMin);
    } catch (err) {
      log.error(`Poll failed: ${(err as Error).message}`);
      schedule(state.currentIntervalMin);
    }
  }

  return {
    async start() {
      stopped = false;
      await tick();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
