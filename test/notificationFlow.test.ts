import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";
import { planPushDeliveries } from "../src/domain/pushFanout";
import { createApiRouter } from "../src/http/api";
import { runPollOnce } from "../src/pollCore";
import { createHistoryService } from "../src/services/historyService";
import type { AlertPrefs } from "../src/shared/push";
import { syncPushLocale } from "../web/pushLocale";
import { renderPushNotification } from "./helpers/serviceWorkerHarness";

test("website language flows through subscription, polling, fan-out, and notification rendering", async () => {
  const repository = createRepository(createDb(":memory:"));
  const app = createApiRouter({
    service: createHistoryService(repository),
    repository,
    config: loadConfig({ VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private" }),
  });
  const endpoint = "https://push.example.com/end-to-end";
  const subscription = { endpoint, keys: { p256dh: "P", auth: "A" } };
  const initialPrefs: AlertPrefs = {
    everyUpdate: true,
    dailyHigh: false,
    series: "sell",
    targets: { sell: { up: null, down: null }, buy: { up: null, down: null } },
    locale: "en",
  };
  const saveThroughApi = async (prefs: AlertPrefs): Promise<void> => {
    const response = await app.request("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription, prefs }),
    });
    assert.equal(response.status, 200);
  };

  await saveThroughApi(initialPrefs);
  await syncPushLocale(initialPrefs, "zh-Hant", true, () => {}, saveThroughApi);
  assert.equal((await repository.listSubscriptions())[0]!.prefs.locale, "zh-Hant");

  await repository.insertIfNew(6, 52_000, "2026-09-30 09:00:00", "seed");
  await repository.insertIfNew(8, 42_000, "2026-09-30 09:00:00", "seed");
  const poll = await runPollOnce({
    client: {
      fetchRaw: async () => ({
        "6": [{ originGoldPrice: 52_100, updateDate: "2026-09-30 10:00:00" }],
        "8": [{ originGoldPrice: 42_050, updateDate: "2026-09-30 10:00:00" }],
      }),
    },
    repository,
    canonicalCode: 6,
    now: new Date("2026-09-30T02:00:00Z"),
  });
  const deliveries = await planPushDeliveries(
    repository,
    poll.insertedPoints,
    await repository.listSubscriptions(),
  );

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]!.payload.locale, "zh-Hant");
  assert.equal(deliveries[0]!.payload.prevPrice, 52_000);

  const notification = await renderPushNotification(deliveries[0]!.payload);
  assert.equal(notification.title, "金價追蹤");
  assert.equal(notification.options.body, "賣出價格更新：52,100 (↑ +0.19%)");
});
