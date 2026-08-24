import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";

test("insertIfNew stores a new point and dedupes a repeat", () => {
  const repo = createRepository(createDb(":memory:"));
  assert.equal(repo.insertIfNew(6, 52000, "2026-08-23 09:00:00.2", "2026-08-23T01:00:00Z"), true);
  // Same (code, updateDate) is ignored.
  assert.equal(repo.insertIfNew(6, 52000, "2026-08-23 09:00:00.2", "2026-08-23T01:05:00Z"), false);
  // Different updateDate inserts.
  assert.equal(repo.insertIfNew(6, 52100, "2026-08-23 10:00:00.1", "2026-08-23T02:00:00Z"), true);

  const hist = repo.historyForCode(6);
  assert.equal(hist.length, 2);
});

test("history is ascending; latest returns the newest", () => {
  const repo = createRepository(createDb(":memory:"));
  repo.insertIfNew(8, 41000, "2026-08-23 10:00:00.1", "x");
  repo.insertIfNew(8, 40900, "2026-08-23 09:00:00.1", "x");
  const hist = repo.historyForCode(8);
  assert.deepEqual(
    hist.map((p) => p.price),
    [40900, 41000],
  );
  assert.equal(repo.latest(8)!.price, 41000);
  assert.equal(repo.latestUpdateDate(8), "2026-08-23 10:00:00.1");
});

test("latest returns null for an empty series", () => {
  const repo = createRepository(createDb(":memory:"));
  assert.equal(repo.latest(6), null);
  assert.equal(repo.latestUpdateDate(6), null);
});
