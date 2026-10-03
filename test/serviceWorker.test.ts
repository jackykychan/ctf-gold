import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchWorkerEvent,
  loadServiceWorker,
  renderPushNotification,
} from "./helpers/serviceWorkerHarness";

async function notificationBody(payload: Record<string, unknown>): Promise<string> {
  return (await renderPushNotification(payload)).options.body;
}

test("new notification worker activates immediately instead of leaving stale formatting active", async () => {
  const harness = loadServiceWorker();
  await dispatchWorkerEvent(harness, "install");
  await dispatchWorkerEvent(harness, "activate");
  assert.deepEqual(harness.calls, { skipWaiting: 1, claim: 1 });
});

test("every notification reason includes signed change versus the previous price", async () => {
  const reasons = ["update", "dailyHigh", "up", "down"];
  for (const reason of reasons) {
    const body = await notificationBody({
      series: "sell",
      price: 52_100,
      prevPrice: 52_000,
      reason,
      locale: "en",
    });
    assert.match(body, /\(↑ \+0\.19%\)$/);
  }
});

test("each notification setting uses a distinct browser notification tag", async () => {
  const tags = await Promise.all(
    ["update", "dailyHigh", "up"].map(async (reason) =>
      (await renderPushNotification({
        series: "sell",
        price: 53_000,
        prevPrice: 52_900,
        reason,
        locale: "en",
      })).options.tag,
    ),
  );
  assert.deepEqual(tags, [
    "ctf-gold-sell-update",
    "ctf-gold-sell-dailyHigh",
    "ctf-gold-sell-up",
  ]);
});

test("notification change shows decreases and unchanged prices", async () => {
  const down = await notificationBody({
    series: "buy",
    price: 41_000,
    prevPrice: 42_000,
    reason: "down",
    locale: "en",
  });
  assert.match(down, /\(↓ -2\.38%\)$/);

  const unchanged = await notificationBody({
    series: "buy",
    price: 42_000,
    prevPrice: 42_000,
    reason: "update",
    locale: "zh-Hant",
  });
  assert.match(unchanged, /\(→ 0\.00%\)$/);
});

test("notification omits a comparison when there is no valid previous price", async () => {
  const body = await notificationBody({
    series: "sell",
    price: 52_100,
    prevPrice: null,
    reason: "update",
    locale: "en",
  });
  assert.equal(body, "Sell price updated: 52,100");
});
