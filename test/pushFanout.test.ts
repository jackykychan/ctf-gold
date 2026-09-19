import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";
import { planPushDeliveries } from "../src/domain/pushFanout";
import type { InsertedPoint } from "../src/pollCore";
import type { AlertPrefs, StoredSubscription } from "../src/shared/push";

const prefs = (over: Partial<AlertPrefs>): AlertPrefs => ({
  everyUpdate: false,
  dailyHigh: false,
  series: "both",
  targets: { sell: { up: null, down: null }, buy: { up: null, down: null } },
  locale: "en",
  ...over,
});

const sub = (endpoint: string, over: Partial<AlertPrefs>): StoredSubscription => ({
  endpoint,
  p256dh: "P",
  auth: "A",
  prefs: prefs(over),
});

// Sell point at 51,000 on 2026-09-19 12:00, previous price 50,000.
const sellPoint: InsertedPoint = {
  code: 6,
  key: "sell",
  price: 51000,
  updateDate: "2026-09-19 12:00:00",
  prevPrice: 50000,
};

async function repoWithEarlierSell(price: number) {
  const repo = createRepository(createDb(":memory:"));
  // An earlier point the same day so daily-high can be computed.
  await repo.insertIfNew(6, price, "2026-09-19 09:00:00", "x");
  return repo;
}

test("planPushDeliveries: empty subscription list yields nothing", async () => {
  const repo = await repoWithEarlierSell(50000);
  assert.deepEqual(await planPushDeliveries(repo, [sellPoint], []), []);
});

test("everyUpdate, daily-high and crossing subs all match a new-high sell point", async () => {
  const repo = await repoWithEarlierSell(50000); // earlier max 50,000; new 51,000 is a high
  const subs = [
    sub("https://p/every", { everyUpdate: true }),
    sub("https://p/high", { dailyHigh: true }),
    sub("https://p/up", { targets: { sell: { up: 51000, down: null }, buy: { up: null, down: null } } }),
    sub("https://p/buyonly", { everyUpdate: true, series: "buy" }), // filtered out for a sell point
  ];
  const out = await planPushDeliveries(repo, [sellPoint], subs);
  const byEndpoint = Object.fromEntries(out.map((d) => [d.subscription.endpoint, d.payload.reason]));
  assert.equal(out.length, 3);
  assert.equal(byEndpoint["https://p/every"], "update");
  assert.equal(byEndpoint["https://p/high"], "dailyHigh");
  assert.equal(byEndpoint["https://p/up"], "up");
  assert.equal(byEndpoint["https://p/buyonly"], undefined); // buy series ignores sell point
});

test("daily-high does not fire when the point is below an earlier high", async () => {
  const repo = await repoWithEarlierSell(52000); // earlier max 52,000 > new 51,000
  const subs = [sub("https://p/high", { dailyHigh: true }), sub("https://p/every", { everyUpdate: true })];
  const out = await planPushDeliveries(repo, [sellPoint], subs);
  const endpoints = out.map((d) => d.subscription.endpoint);
  assert.deepEqual(endpoints, ["https://p/every"]); // only every-update; not a new daily high
});

test("first point of the day counts as a new daily high", async () => {
  const repo = createRepository(createDb(":memory:")); // no earlier points today
  const out = await planPushDeliveries(repo, [sellPoint], [sub("https://p/high", { dailyHigh: true })]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.payload.reason, "dailyHigh");
});
