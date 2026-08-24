import { test } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_SERIES_KEY, PRICE_SERIES, loadConfig, seriesByKey } from "../src/config";

test("PRICE_SERIES registry maps the 9999-gold sell/buy codes", () => {
  assert.equal(PRICE_SERIES.length, 2);
  assert.equal(seriesByKey("sell").code, 6);
  assert.equal(seriesByKey("buy").code, 8);
  assert.equal(CANONICAL_SERIES_KEY, "sell");
  // Each series carries per-language labels used by the frontend.
  for (const s of PRICE_SERIES) {
    assert.ok(s.label.en.length > 0);
    assert.ok(s.label.zh.length > 0);
  }
});

test("seriesByKey throws on an unknown key", () => {
  assert.throws(() => seriesByKey("platinum" as never), /Unknown series key/);
});

test("loadConfig applies sensible defaults when env is unset", () => {
  const keys = [
    "PORT",
    "DB_PATH",
    "API_URL",
    "START_POLL_INTERVAL_MIN",
    "MIN_POLL_INTERVAL_MIN",
    "MAX_POLL_INTERVAL_MIN",
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  try {
    const c = loadConfig();
    assert.equal(c.port, 3000);
    assert.equal(c.startPollIntervalMin, 15);
    assert.equal(c.minPollIntervalMin, 5);
    assert.equal(c.maxPollIntervalMin, 120);
    assert.match(c.apiUrl, /chowtaifook/);
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
});

test("loadConfig reads numeric overrides and rejects non-numbers", () => {
  const prev = process.env["PORT"];
  try {
    process.env["PORT"] = "4123";
    assert.equal(loadConfig().port, 4123);
    process.env["PORT"] = "not-a-number";
    assert.throws(() => loadConfig(), /must be a number/);
  } finally {
    if (prev === undefined) delete process.env["PORT"];
    else process.env["PORT"] = prev;
  }
});
