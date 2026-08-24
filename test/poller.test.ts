import { test } from "node:test";
import assert from "node:assert/strict";
import { createPoller } from "../src/poller";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";
import type { AppConfig } from "../src/config";

const config: AppConfig = {
  port: 0,
  dbPath: ":memory:",
  apiUrl: "http://example.invalid",
  startPollIntervalMin: 15,
  minPollIntervalMin: 5,
  maxPollIntervalMin: 120,
  pollIncrementMin: 15,
  pollStreakThreshold: 3,
  healthStaleAfterMin: 30,
};

const sample = {
  "6": [{ originGoldPrice: 52589, updateDate: "2026-08-23 09:03:57.217" }],
  "8": [{ originGoldPrice: 41959, updateDate: "2026-08-23 09:03:57.22" }],
};

const silent = { info() {}, error() {} };

test("poller fetches, parses and stores both series on boot", async () => {
  const repo = createRepository(createDb(":memory:"));
  let fetches = 0;
  const client = {
    fetchRaw: async () => {
      fetches++;
      return sample;
    },
  };
  const poller = createPoller({ client, repository: repo, config, logger: silent });
  await poller.start();
  poller.stop();

  assert.equal(fetches, 1);
  assert.equal((await repo.latest(6))?.price, 52589);
  assert.equal((await repo.latest(8))?.price, 41959);
});

test("poller dedupes an unchanged updateDate across polls", async () => {
  const repo = createRepository(createDb(":memory:"));
  const client = { fetchRaw: async () => sample };
  const poller = createPoller({ client, repository: repo, config, logger: silent });
  await poller.start();
  poller.stop();
  // Pre-seed the same point, then poll again via a fresh poller: no duplicate row.
  const before = (await repo.historyForCode(6)).length;
  const poller2 = createPoller({ client, repository: repo, config, logger: silent });
  await poller2.start();
  poller2.stop();
  assert.equal((await repo.historyForCode(6)).length, before); // still one row
});

test("poller survives a fetch error without throwing and stores nothing", async () => {
  const repo = createRepository(createDb(":memory:"));
  const client = {
    fetchRaw: async () => {
      throw new Error("boom");
    },
  };
  const errors: string[] = [];
  const poller = createPoller({
    client,
    repository: repo,
    config,
    logger: { info() {}, error: (m) => errors.push(m) },
  });
  await poller.start();
  poller.stop();

  assert.equal(await repo.latest(6), null);
  assert.ok(errors.some((e) => /Poll failed/.test(e)));
});
