import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeChangePct,
  dailyHigh,
  dailyHighSeries,
  filterRange,
  groupCardEvents,
  previousDayChangePct,
} from "../src/domain/changes";
import type { PricePoint } from "../src/shared/types";

test("computeChangePct: first point null, subsequent computed", () => {
  const out = computeChangePct([
    { updateDate: "2026-08-01 09:00:00.0", price: 100 },
    { updateDate: "2026-08-01 10:00:00.0", price: 110 },
    { updateDate: "2026-08-01 11:00:00.0", price: 99 },
  ]);
  assert.equal(out[0]!.changePct, null);
  assert.equal(out[1]!.changePct, 10);
  assert.ok(Math.abs(out[2]!.changePct! - -10) < 1e-9);
});

test("computeChangePct treats a zero previous price as 0% (no divide-by-zero)", () => {
  const out = computeChangePct([
    { updateDate: "2026-08-01 09:00:00.0", price: 0 },
    { updateDate: "2026-08-01 10:00:00.0", price: 50 },
  ]);
  assert.equal(out[0]!.changePct, null);
  assert.equal(out[1]!.changePct, 0);
});

test("filterRange keeps only points inside the window", () => {
  const now = new Date("2026-08-20T00:00:00Z");
  const points: PricePoint[] = [
    { t: "2026-08-01 09:00:00.0", price: 1, changePct: null }, // 19 days ago
    { t: "2026-08-18 09:00:00.0", price: 2, changePct: 0 }, // 2 days ago
    { t: "2026-08-19 09:00:00.0", price: 3, changePct: 0 },
  ];
  const five = filterRange(points, "5d", now);
  assert.deepEqual(
    five.map((p) => p.price),
    [2, 3],
  );
  const month = filterRange(points, "1m", now);
  assert.equal(month.length, 3);
});

test("groupCardEvents merges buy+sell of the same second, newest first", () => {
  const sell: PricePoint[] = [
    { t: "2026-08-23 09:00:00.217", price: 52000, changePct: null },
    { t: "2026-08-23 10:00:00.100", price: 52100, changePct: 0.19 },
  ];
  const buy: PricePoint[] = [
    { t: "2026-08-23 09:00:00.220", price: 41000, changePct: null },
    { t: "2026-08-23 10:00:00.130", price: 41050, changePct: 0.12 },
  ];
  const events = groupCardEvents(sell, buy);
  assert.equal(events.length, 2);
  assert.equal(events[0]!.t, "2026-08-23 10:00:00"); // newest first
  assert.equal(events[0]!.sell!.price, 52100);
  assert.equal(events[0]!.buy!.price, 41050);
  assert.equal(events[1]!.t, "2026-08-23 09:00:00");
});

test("dailyHigh keeps the highest price per calendar day, ascending", () => {
  const points: PricePoint[] = [
    { t: "2026-08-01 09:00:00.0", price: 100, changePct: null },
    { t: "2026-08-01 13:00:00.0", price: 130, changePct: 0 }, // day high
    { t: "2026-08-01 17:00:00.0", price: 120, changePct: 0 },
    { t: "2026-08-02 10:00:00.0", price: 90, changePct: 0 },
    { t: "2026-08-02 15:00:00.0", price: 95, changePct: 0 }, // day high
  ];
  const highs = dailyHigh(points);
  assert.equal(highs.length, 2);
  assert.deepEqual(highs[0], { t: "2026-08-01 13:00:00.0", price: 130 });
  assert.deepEqual(highs[1], { t: "2026-08-02 15:00:00.0", price: 95 });
});

test("previousDayChangePct compares latest to the previous day's last price", () => {
  const rows = [
    { updateDate: "2026-08-01 09:00:00.0", price: 100 },
    { updateDate: "2026-08-01 16:00:00.0", price: 110 }, // previous day's last
    { updateDate: "2026-08-02 09:00:00.0", price: 121 }, // latest
  ];
  const pct = previousDayChangePct(rows);
  assert.ok(pct !== null && Math.abs(pct - 10) < 1e-9);
});

test("previousDayChangePct is null when there is no earlier day", () => {
  assert.equal(previousDayChangePct([{ updateDate: "2026-08-02 09:00:00.0", price: 1 }]), null);
  assert.equal(previousDayChangePct([]), null);
});

test("dailyHighSeries: one point per day with day-over-day change", () => {
  const points: PricePoint[] = [
    { t: "2026-08-01 09:00:00.0", price: 100, changePct: null },
    { t: "2026-08-01 13:00:00.0", price: 120, changePct: 16.67 }, // day 1 high
    { t: "2026-08-02 10:00:00.0", price: 132, changePct: 10 }, // day 2 high
  ];
  const out = dailyHighSeries(points);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.price, 120);
  assert.equal(out[0]!.changePct, null); // first day
  assert.equal(out[1]!.price, 132);
  // 132 vs previous day's high 120 => +10%
  assert.ok(Math.abs(out[1]!.changePct! - 10) < 1e-9);
});

test("groupCardEvents day granularity groups by calendar day", () => {
  const sell: PricePoint[] = [
    { t: "2026-08-01 13:00:00.0", price: 120, changePct: null },
    { t: "2026-08-02 15:00:00.0", price: 95, changePct: -20.8 },
  ];
  const events = groupCardEvents(sell, [], "day");
  assert.equal(events.length, 2);
  assert.equal(events[0]!.t, "2026-08-02"); // newest first, day key
  assert.equal(events[1]!.t, "2026-08-01");
});

test("groupCardEvents tolerates a missing series on one side", () => {
  const events = groupCardEvents(
    [{ t: "2026-08-23 09:00:00.2", price: 1, changePct: null }],
    [],
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.sell!.price, 1);
  assert.equal(events[0]!.buy, undefined);
});
