import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";
import { buildApp } from "../src/app";

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function seededApp() {
  const repo = createRepository(createDb(":memory:"));
  // Sell (6) and Buy (8): one point ~100 days ago (inside 6M, outside 5D) and one recent.
  const old = daysAgo(100);
  const recent = daysAgo(0);
  repo.insertIfNew(6, 52000, old, "x");
  repo.insertIfNew(6, 52100, recent, "x");
  repo.insertIfNew(8, 41000, old, "x");
  repo.insertIfNew(8, 41050, recent, "x");
  return buildApp({ repository: repo });
}

test("GET /api/history returns both series with the requested range", async () => {
  const res = await request(seededApp()).get("/api/history?range=5d");
  assert.equal(res.status, 200);
  assert.equal(res.body.range, "5d");
  assert.ok(Array.isArray(res.body.series.sell));
  assert.ok(Array.isArray(res.body.series.buy));
  // The year-2000 point is outside a 5-day window; only the recent one remains.
  assert.equal(res.body.series.sell.length, 1);
  assert.equal(res.body.series.sell[0].price, 52100);
});

test("GET /api/history defaults to 1m for a missing/invalid range", async () => {
  const app = seededApp();
  const def = await request(app).get("/api/history");
  assert.equal(def.body.range, "1m");
  const bad = await request(app).get("/api/history?range=nonsense");
  assert.equal(bad.body.range, "1m");
});

test("GET /api/history?range=6m includes the full history and computed changePct", async () => {
  const res = await request(seededApp()).get("/api/history?range=6m");
  const sell = res.body.series.sell;
  assert.equal(sell.length, 2);
  assert.equal(sell[0].changePct, null); // first point
  assert.ok(Math.abs(sell[1].changePct - ((52100 - 52000) / 52000) * 100) < 1e-9);
});

test("GET /api/latest returns newest per series", async () => {
  const res = await request(seededApp()).get("/api/latest");
  assert.equal(res.status, 200);
  assert.equal(res.body.sell.price, 52100);
  assert.equal(res.body.buy.price, 41050);
});

test("GET /api/latest includes the previous-day change percent", async () => {
  const res = await request(seededApp()).get("/api/latest");
  // Latest 52100 vs the previous day's last price 52000.
  assert.ok(Math.abs(res.body.sell.changePct - ((52100 - 52000) / 52000) * 100) < 1e-9);
  assert.ok(Math.abs(res.body.buy.changePct - ((41050 - 41000) / 41000) * 100) < 1e-9);
});

test("GET /api/latest changePct is null with only one day of data", async () => {
  const repo = createRepository(createDb(":memory:"));
  repo.insertIfNew(6, 52000, daysAgo(0), "x");
  repo.insertIfNew(8, 41000, daysAgo(0), "x");
  const res = await request(buildApp({ repository: repo })).get("/api/latest");
  assert.equal(res.body.sell.changePct, null);
  assert.equal(res.body.buy.changePct, null);
});
