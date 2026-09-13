import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePrefs, toPushSubscription } from "../src/domain/pushSubscription";

const validBody = {
  subscription: {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "BPK...", auth: "AUTH..." },
  },
  prefs: { everyUpdate: true, series: "buy", upTarget: 53000 },
};

test("toPushSubscription accepts a valid body and normalizes prefs", () => {
  const sub = toPushSubscription(validBody);
  assert.equal(sub.endpoint, "https://push.example.com/abc");
  assert.equal(sub.p256dh, "BPK...");
  assert.equal(sub.auth, "AUTH...");
  assert.deepEqual(sub.prefs, {
    everyUpdate: true,
    dailyHigh: false,
    upTarget: 53000,
    downTarget: null,
    series: "buy",
    locale: "en",
  });
});

test("toPushSubscription rejects a malformed subscription", () => {
  assert.throws(() => toPushSubscription(null));
  assert.throws(() => toPushSubscription({}));
  assert.throws(() => toPushSubscription({ subscription: { endpoint: "ftp://x", keys: {} } }));
  assert.throws(() =>
    toPushSubscription({ subscription: { endpoint: "https://x", keys: { p256dh: "a" } } }),
  );
});

test("normalizePrefs coerces types and clamps targets", () => {
  assert.deepEqual(normalizePrefs({ series: "nonsense", upTarget: "53000", downTarget: -5, locale: "zh-Hant" }), {
    everyUpdate: false,
    dailyHigh: false,
    upTarget: 53000, // numeric string coerced + rounded
    downTarget: null, // non-positive -> null
    series: "sell", // invalid enum -> default
    locale: "zh-Hant",
  });
  assert.deepEqual(normalizePrefs(undefined), {
    everyUpdate: false,
    dailyHigh: false,
    upTarget: null,
    downTarget: null,
    series: "sell",
    locale: "en",
  });
});
