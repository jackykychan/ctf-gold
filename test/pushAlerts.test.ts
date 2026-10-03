import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAlerts, type AlertEvent } from "../src/domain/pushAlerts";
import type { AlertPrefs } from "../src/shared/push";

const prefs = (over: Partial<AlertPrefs>): AlertPrefs => ({
  everyUpdate: false,
  dailyHigh: false,
  series: "both",
  targets: { sell: { up: null, down: null }, buy: { up: null, down: null } },
  locale: "en",
  ...over,
});

const withTarget = (
  s: "sell" | "buy",
  t: { up?: number | null; down?: number | null },
): AlertPrefs["targets"] => ({
  sell: { up: null, down: null },
  buy: { up: null, down: null },
  [s]: { up: t.up ?? null, down: t.down ?? null },
});

const event = (over: Partial<AlertEvent>): AlertEvent => ({
  series: "sell",
  price: 52000,
  prevPrice: 51900,
  isDailyHigh: false,
  updateDate: "2026-09-12 10:00:00",
  ...over,
});

test("everyUpdate notifies on any new point", () => {
  const out = evaluateAlerts(prefs({ everyUpdate: true }), event({}));
  assert.equal(out[0]?.reason, "update");
  assert.equal(out[0]?.series, "sell");
});

test("series filter: mismatched series yields no notification", () => {
  assert.deepEqual(evaluateAlerts(prefs({ everyUpdate: true, series: "buy" }), event({ series: "sell" })), []);
});

test("series 'both' matches sell and buy", () => {
  assert.equal(evaluateAlerts(prefs({ everyUpdate: true, series: "both" }), event({ series: "sell" })).length, 1);
  assert.equal(evaluateAlerts(prefs({ everyUpdate: true, series: "both" }), event({ series: "buy" })).length, 1);
});

test("dailyHigh notifies only when the point is a new daily high", () => {
  assert.deepEqual(evaluateAlerts(prefs({ dailyHigh: true }), event({ isDailyHigh: false })), []);
  assert.equal(evaluateAlerts(prefs({ dailyHigh: true }), event({ isDailyHigh: true }))[0]?.reason, "dailyHigh");
});

test("up target fires on the crossing, not while already above", () => {
  const p = prefs({ targets: withTarget("sell", { up: 53000 }) });
  // prev below, new at/above target -> crossing up.
  assert.equal(evaluateAlerts(p, event({ prevPrice: 52900, price: 53000 }))[0]?.reason, "up");
  // already above on the previous point -> no re-fire.
  assert.deepEqual(evaluateAlerts(p, event({ prevPrice: 53100, price: 53200 })), []);
  // first point (no prev) cannot cross.
  assert.deepEqual(evaluateAlerts(p, event({ prevPrice: null, price: 53500 })), []);
});

test("down target fires on the crossing, not while already below", () => {
  const p = prefs({ targets: withTarget("sell", { down: 52000 }) });
  assert.equal(evaluateAlerts(p, event({ prevPrice: 52100, price: 52000 }))[0]?.reason, "down");
  assert.deepEqual(evaluateAlerts(p, event({ prevPrice: 51900, price: 51800 })), []);
});

test("targets are per-series: a sell target ignores buy events and vice versa", () => {
  const p = prefs({ targets: withTarget("sell", { up: 53000 }) });
  // A buy event near the (much lower) buy level must not fire the sell target.
  assert.deepEqual(evaluateAlerts(p, event({ series: "buy", prevPrice: 52900, price: 53000 })), []);
  // The buy target fires on a buy event.
  const pb = prefs({ targets: withTarget("buy", { up: 43000 }) });
  assert.equal(evaluateAlerts(pb, event({ series: "buy", prevPrice: 42900, price: 43000 }))[0]?.reason, "up");
  assert.deepEqual(evaluateAlerts(pb, event({ series: "sell", prevPrice: 42900, price: 43000 })), []);
});

test("each matching setting produces a separate notification payload", () => {
  const p = prefs({ everyUpdate: true, dailyHigh: true, targets: withTarget("sell", { up: 53000 }) });
  const out = evaluateAlerts(p, event({ prevPrice: 52900, price: 53000, isDailyHigh: true }));
  assert.deepEqual(out.map((payload) => payload.reason), ["up", "dailyHigh", "update"]);
});

test("no matching alert yields an empty list", () => {
  assert.deepEqual(evaluateAlerts(prefs({}), event({})), []);
});
