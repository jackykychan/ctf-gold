import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAlerts, type AlertEvent } from "../src/domain/pushAlerts";
import type { AlertPrefs } from "../src/shared/push";

const prefs = (over: Partial<AlertPrefs>): AlertPrefs => ({
  everyUpdate: false,
  dailyHigh: false,
  upTarget: null,
  downTarget: null,
  series: "both",
  locale: "en",
  ...over,
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
  assert.equal(out?.reason, "update");
  assert.equal(out?.series, "sell");
});

test("series filter: mismatched series yields no notification", () => {
  assert.equal(evaluateAlerts(prefs({ everyUpdate: true, series: "buy" }), event({ series: "sell" })), null);
});

test("series 'both' matches sell and buy", () => {
  assert.ok(evaluateAlerts(prefs({ everyUpdate: true, series: "both" }), event({ series: "sell" })));
  assert.ok(evaluateAlerts(prefs({ everyUpdate: true, series: "both" }), event({ series: "buy" })));
});

test("dailyHigh notifies only when the point is a new daily high", () => {
  assert.equal(evaluateAlerts(prefs({ dailyHigh: true }), event({ isDailyHigh: false })), null);
  assert.equal(evaluateAlerts(prefs({ dailyHigh: true }), event({ isDailyHigh: true }))?.reason, "dailyHigh");
});

test("up target fires on the crossing, not while already above", () => {
  const p = prefs({ upTarget: 53000 });
  // prev below, new at/above target -> crossing up.
  assert.equal(evaluateAlerts(p, event({ prevPrice: 52900, price: 53000 }))?.reason, "up");
  // already above on the previous point -> no re-fire.
  assert.equal(evaluateAlerts(p, event({ prevPrice: 53100, price: 53200 })), null);
  // first point (no prev) cannot cross.
  assert.equal(evaluateAlerts(p, event({ prevPrice: null, price: 53500 })), null);
});

test("down target fires on the crossing, not while already below", () => {
  const p = prefs({ downTarget: 52000 });
  assert.equal(evaluateAlerts(p, event({ prevPrice: 52100, price: 52000 }))?.reason, "down");
  assert.equal(evaluateAlerts(p, event({ prevPrice: 51900, price: 51800 })), null);
});

test("threshold crossing takes precedence over daily-high/every-update", () => {
  const p = prefs({ everyUpdate: true, dailyHigh: true, upTarget: 53000 });
  const out = evaluateAlerts(p, event({ prevPrice: 52900, price: 53000, isDailyHigh: true }));
  assert.equal(out?.reason, "up");
});

test("no matching alert yields null", () => {
  assert.equal(evaluateAlerts(prefs({}), event({})), null);
});
