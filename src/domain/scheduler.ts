import { clamp, minutesBetween } from "../shared/time";

/**
 * PURE adaptive-backoff scheduler. No I/O, no clock. Given the current poll
 * state and the latest observed canonical `updateDate`, it decides the next
 * state and how long to wait before the next poll.
 *
 * Rules:
 *  - Start at `startIntervalMin`.
 *  - Each poll with NO change to the update time increments a streak; after
 *    `streakThreshold` consecutive no-change polls, add `incrementMin` to the
 *    interval (15 -> 30 -> 45 -> ...) and reset the streak.
 *  - When the update time DOES change, set the interval to the observed gap
 *    between this update and the previous one, reset the streak, and resume the
 *    same backoff from that new base if changes stop again.
 *  - The interval is always clamped to [minIntervalMin, maxIntervalMin].
 */

export interface SchedulerConfig {
  startIntervalMin: number;
  minIntervalMin: number;
  maxIntervalMin: number;
  incrementMin: number;
  streakThreshold: number;
}

export interface PollState {
  currentIntervalMin: number;
  noChangeStreak: number;
  /** Canonical updateDate last recorded; null before the first observation. */
  lastSeenUpdateDate: string | null;
}

export interface PollDecision {
  nextState: PollState;
  /** Minutes to wait before the next poll. */
  nextDelayMin: number;
  /** Whether this observation was a change (or the very first observation). */
  changed: boolean;
}

export function initialState(config: SchedulerConfig): PollState {
  return {
    currentIntervalMin: clamp(config.startIntervalMin, config.minIntervalMin, config.maxIntervalMin),
    noChangeStreak: 0,
    lastSeenUpdateDate: null,
  };
}

export function decideNext(
  state: PollState,
  observedUpdateDate: string,
  config: SchedulerConfig,
): PollDecision {
  const isFirst = state.lastSeenUpdateDate === null;
  const changed = isFirst || observedUpdateDate !== state.lastSeenUpdateDate;

  if (changed) {
    // On a real change, adopt the observed gap between updates as the new base.
    const gap = isFirst
      ? config.startIntervalMin
      : minutesBetween(observedUpdateDate, state.lastSeenUpdateDate as string);
    const interval = clamp(gap, config.minIntervalMin, config.maxIntervalMin);
    const nextState: PollState = {
      currentIntervalMin: interval,
      noChangeStreak: 0,
      lastSeenUpdateDate: observedUpdateDate,
    };
    return { nextState, nextDelayMin: interval, changed: true };
  }

  // No change: grow the streak; back off once it hits the threshold.
  const streak = state.noChangeStreak + 1;
  if (streak >= config.streakThreshold) {
    const interval = clamp(
      state.currentIntervalMin + config.incrementMin,
      config.minIntervalMin,
      config.maxIntervalMin,
    );
    const nextState: PollState = {
      currentIntervalMin: interval,
      noChangeStreak: 0,
      lastSeenUpdateDate: state.lastSeenUpdateDate,
    };
    return { nextState, nextDelayMin: interval, changed: false };
  }

  const nextState: PollState = {
    currentIntervalMin: state.currentIntervalMin,
    noChangeStreak: streak,
    lastSeenUpdateDate: state.lastSeenUpdateDate,
  };
  return { nextState, nextDelayMin: state.currentIntervalMin, changed: false };
}
