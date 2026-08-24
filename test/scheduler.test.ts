import { test } from "node:test";
import assert from "node:assert/strict";
import { decideNext, initialState, type SchedulerConfig } from "../src/domain/scheduler";

const cfg: SchedulerConfig = {
  startIntervalMin: 15,
  minIntervalMin: 5,
  maxIntervalMin: 120,
  incrementMin: 15,
  streakThreshold: 3,
};

test("first observation counts as a change and starts at the start interval", () => {
  const d = decideNext(initialState(cfg), "2026-08-23 09:00:00.0", cfg);
  assert.equal(d.changed, true);
  assert.equal(d.nextDelayMin, 15);
  assert.equal(d.nextState.currentIntervalMin, 15);
  assert.equal(d.nextState.noChangeStreak, 0);
  assert.equal(d.nextState.lastSeenUpdateDate, "2026-08-23 09:00:00.0");
});

test("three no-change polls trigger a +15 backoff and reset the streak", () => {
  let state = decideNext(initialState(cfg), "2026-08-23 09:00:00.0", cfg).nextState;
  const same = "2026-08-23 09:00:00.0";

  let d = decideNext(state, same, cfg);
  assert.equal(d.changed, false);
  assert.equal(d.nextState.noChangeStreak, 1);
  assert.equal(d.nextDelayMin, 15);
  state = d.nextState;

  d = decideNext(state, same, cfg);
  assert.equal(d.nextState.noChangeStreak, 2);
  assert.equal(d.nextDelayMin, 15);
  state = d.nextState;

  d = decideNext(state, same, cfg);
  assert.equal(d.nextState.currentIntervalMin, 30);
  assert.equal(d.nextState.noChangeStreak, 0);
  assert.equal(d.nextDelayMin, 30);
});

test("a detected change sets the interval to the observed gap and resets streak", () => {
  const state = {
    currentIntervalMin: 45,
    noChangeStreak: 2,
    lastSeenUpdateDate: "2026-08-23 09:00:00.0",
  };
  const d = decideNext(state, "2026-08-23 09:20:00.0", cfg);
  assert.equal(d.changed, true);
  assert.equal(d.nextDelayMin, 20);
  assert.equal(d.nextState.currentIntervalMin, 20);
  assert.equal(d.nextState.noChangeStreak, 0);
});

test("observed gap is clamped to the minimum", () => {
  const state = {
    currentIntervalMin: 30,
    noChangeStreak: 0,
    lastSeenUpdateDate: "2026-08-23 09:00:00.0",
  };
  const d = decideNext(state, "2026-08-23 09:02:00.0", cfg); // 2 min gap
  assert.equal(d.nextState.currentIntervalMin, 5);
});

test("backoff is clamped to the maximum", () => {
  const state = {
    currentIntervalMin: 120,
    noChangeStreak: 2,
    lastSeenUpdateDate: "2026-08-23 09:00:00.0",
  };
  const d = decideNext(state, "2026-08-23 09:00:00.0", cfg);
  assert.equal(d.nextState.currentIntervalMin, 120);
});
