import { CANONICAL_SERIES_KEY, seriesByKey, type AppConfig } from "./config";
import type { GoldPriceClient } from "./api/goldPriceClient";
import type { PriceRepository } from "./data/repository";
import { runPollOnce } from "./pollCore";
import {
  decideNext,
  initialState,
  type PollState,
  type SchedulerConfig,
} from "./domain/scheduler";
import { META_LAST_POLLED } from "./shared/types";

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
 * Node local-dev poller: the adaptive self-scheduling loop. Runs `runPollOnce`,
 * then asks the pure `scheduler` for the next delay and `setTimeout`s it. (In
 * production the Worker uses a fixed Cron trigger instead — see worker/index.ts.)
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
    try {
      const { inserted, canonicalUpdateDate } = await runPollOnce({
        client,
        repository,
        canonicalCode,
      });

      if (canonicalUpdateDate === null) {
        log.error("Poll succeeded but canonical series was absent; retrying at current interval");
        schedule(state.currentIntervalMin);
        return;
      }

      const decision = decideNext(state, canonicalUpdateDate, schedCfg);
      state = decision.nextState;
      log.info(
        `Poll ok: ${inserted} new point(s); ${decision.changed ? "CHANGED" : "no change"} ` +
          `@ ${canonicalUpdateDate}`,
      );
      schedule(decision.nextDelayMin);
    } catch (err) {
      log.error(`Poll failed: ${(err as Error).message}`);
      schedule(state.currentIntervalMin);
    } finally {
      // Record liveness regardless of outcome so /api/health can tell a stalled
      // poller from a quiet upstream.
      await repository.setMeta(META_LAST_POLLED, new Date().toISOString());
    }
  }

  return {
    async start() {
      stopped = false;
      // Resume backoff state across restarts from the newest stored point.
      const seeded = await repository.latestUpdateDate(canonicalCode);
      if (seeded) state = { ...state, lastSeenUpdateDate: seeded };
      await tick();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
