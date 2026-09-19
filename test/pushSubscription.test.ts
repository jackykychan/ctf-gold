import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePrefs, toPushSubscription } from "../src/domain/pushSubscription";

const validBody = {
  subscription: {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "BPK...", auth: "AUTH..." },
  },
  prefs: { everyUpdate: true, series: "buy", targets: { buy: { up: 43000, down: null } } },
};

test("toPushSubscription accepts a valid body and normalizes prefs", () => {
  const sub = toPushSubscription(validBody);
  assert.equal(sub.endpoint, "https://push.example.com/abc");
  assert.equal(sub.p256dh, "BPK...");
  assert.equal(sub.auth, "AUTH...");
  assert.deepEqual(sub.prefs, {
    everyUpdate: true,
    dailyHigh: false,
    series: "buy",
    targets: { sell: { up: null, down: null }, buy: { up: 43000, down: null } },
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

test("normalizePrefs coerces types and clamps per-series targets", () => {
  assert.deepEqual(
    normalizePrefs({
      series: "nonsense",
      targets: { sell: { up: "53000", down: -5 }, buy: { up: 43000 } },
      locale: "zh-Hant",
    }),
    {
      everyUpdate: false,
      dailyHigh: false,
      series: "sell", // invalid enum -> default
      targets: {
        sell: { up: 53000, down: null }, // numeric string coerced; non-positive -> null
        buy: { up: 43000, down: null },
      },
      locale: "zh-Hant",
    },
  );
  assert.deepEqual(normalizePrefs(undefined), {
    everyUpdate: false,
    dailyHigh: false,
    series: "sell",
    targets: { sell: { up: null, down: null }, buy: { up: null, down: null } },
    locale: "en",
  });
});

test("normalizePrefs maps legacy flat upTarget/downTarget onto the sell series", () => {
  const p = normalizePrefs({ upTarget: "50000", downTarget: 40000 });
  assert.deepEqual(p.targets, {
    sell: { up: 50000, down: 40000 },
    buy: { up: null, down: null },
  });
});
