import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPushLocale } from "../web/pushLocale";
import type { AlertPrefs } from "../src/shared/push";

const englishPrefs: AlertPrefs = {
  everyUpdate: false,
  dailyHigh: true,
  series: "both",
  targets: {
    sell: { up: 55_000, down: 50_000 },
    buy: { up: 45_000, down: 40_000 },
  },
  locale: "en",
};

test("syncPushLocale stores and persists the website locale for active notifications", async () => {
  const stored: AlertPrefs[] = [];
  const persisted: AlertPrefs[] = [];

  const next = await syncPushLocale(
    englishPrefs,
    "zh-Hant",
    true,
    (prefs) => stored.push(prefs),
    async (prefs) => {
      persisted.push(prefs);
    },
  );

  assert.equal(next.locale, "zh-Hant");
  assert.deepEqual(next.targets, englishPrefs.targets);
  assert.equal(next.everyUpdate, englishPrefs.everyUpdate);
  assert.equal(next.dailyHigh, englishPrefs.dailyHigh);
  assert.equal(next.series, englishPrefs.series);
  assert.deepEqual(stored, [next]);
  assert.deepEqual(persisted, [next]);
});

test("syncPushLocale updates local preferences without a server write when notifications are off", async () => {
  const stored: AlertPrefs[] = [];
  let persistCalls = 0;

  const next = await syncPushLocale(
    englishPrefs,
    "zh-Hant",
    false,
    (prefs) => stored.push(prefs),
    async () => {
      persistCalls += 1;
    },
  );

  assert.equal(next.locale, "zh-Hant");
  assert.deepEqual(stored, [next]);
  assert.equal(persistCalls, 0);
});

test("syncPushLocale reuses preferences when the language already matches", async () => {
  let stored: AlertPrefs | null = null;

  const next = await syncPushLocale(
    englishPrefs,
    "en",
    false,
    (prefs) => {
      stored = prefs;
    },
    async () => {},
  );

  assert.strictEqual(next, englishPrefs);
  assert.strictEqual(stored, englishPrefs);
});
