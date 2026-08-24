import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";

test("insertIfNew stores a new point and dedupes a repeat", async () => {
  const repo = createRepository(createDb(":memory:"));
  assert.equal(await repo.insertIfNew(6, 52000, "2026-08-23 09:00:00.2", "2026-08-23T01:00:00Z"), true);
  // Same (code, updateDate) is ignored.
  assert.equal(await repo.insertIfNew(6, 52000, "2026-08-23 09:00:00.2", "2026-08-23T01:05:00Z"), false);
  // Different updateDate inserts.
  assert.equal(await repo.insertIfNew(6, 52100, "2026-08-23 10:00:00.1", "2026-08-23T02:00:00Z"), true);

  const hist = await repo.historyForCode(6);
  assert.equal(hist.length, 2);
});

test("history is ascending; latest returns the newest", async () => {
  const repo = createRepository(createDb(":memory:"));
  await repo.insertIfNew(8, 41000, "2026-08-23 10:00:00.1", "x");
  await repo.insertIfNew(8, 40900, "2026-08-23 09:00:00.1", "x");
  const hist = await repo.historyForCode(8);
  assert.deepEqual(
    hist.map((p) => p.price),
    [40900, 41000],
  );
  assert.equal((await repo.latest(8))!.price, 41000);
  assert.equal(await repo.latestUpdateDate(8), "2026-08-23 10:00:00.1");
});

test("latest returns null for an empty series", async () => {
  const repo = createRepository(createDb(":memory:"));
  assert.equal(await repo.latest(6), null);
  assert.equal(await repo.latestUpdateDate(6), null);
});

test("meta get/set round-trips and upserts", async () => {
  const repo = createRepository(createDb(":memory:"));
  assert.equal(await repo.getMeta("last_polled_at"), null);
  await repo.setMeta("last_polled_at", "2026-08-23T00:00:00Z");
  assert.equal(await repo.getMeta("last_polled_at"), "2026-08-23T00:00:00Z");
  await repo.setMeta("last_polled_at", "2026-08-23T01:00:00Z");
  assert.equal(await repo.getMeta("last_polled_at"), "2026-08-23T01:00:00Z");
});
