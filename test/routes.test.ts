import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/data/db";
import { createRepository } from "../src/data/priceRepository";
import { createHistoryService } from "../src/services/historyService";
import { createApiRouter } from "../src/http/api";
import { loadConfig } from "../src/config";
import { META_LAST_POLLED } from "../src/shared/types";

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function routerFor(repo: ReturnType<typeof createRepository>) {
  return createApiRouter({
    service: createHistoryService(repo),
    repository: repo,
    config: loadConfig({}), // defaults (empty env)
  });
}

async function seededApp() {
  const repo = createRepository(createDb(":memory:"));
  // Sell (6) and Buy (8): one point ~100 days ago (inside 6M, outside 5D) and one recent.
  await repo.insertIfNew(6, 52000, daysAgo(100), "x");
  await repo.insertIfNew(6, 52100, daysAgo(0), "x");
  await repo.insertIfNew(8, 41000, daysAgo(100), "x");
  await repo.insertIfNew(8, 41050, daysAgo(0), "x");
  return routerFor(repo);
}

test("GET /api/history returns both series with the requested range", async () => {
  const res = await (await seededApp()).request("/api/history?range=5d");
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.range, "5d");
  assert.ok(Array.isArray(body.series.sell));
  // The 100-day-old point is outside a 5-day window; only the recent one remains.
  assert.equal(body.series.sell.length, 1);
  assert.equal(body.series.sell[0].price, 52100);
});

test("GET /api/history defaults to 1m for a missing/invalid range", async () => {
  const app = await seededApp();
  assert.equal(((await (await app.request("/api/history")).json()) as any).range, "1m");
  assert.equal(
    ((await (await app.request("/api/history?range=nonsense")).json()) as any).range,
    "1m",
  );
});

test("GET /api/history?range=6m includes full history and computed changePct", async () => {
  const body = (await (await (await seededApp()).request("/api/history?range=6m")).json()) as any;
  const sell = body.series.sell;
  assert.equal(sell.length, 2);
  assert.equal(sell[0].changePct, null);
  assert.ok(Math.abs(sell[1].changePct - ((52100 - 52000) / 52000) * 100) < 1e-9);
});

test("GET /api/latest returns newest per series with previous-day change", async () => {
  const body = (await (await (await seededApp()).request("/api/latest")).json()) as any;
  assert.equal(body.sell.price, 52100);
  assert.equal(body.buy.price, 41050);
  assert.ok(Math.abs(body.sell.changePct - ((52100 - 52000) / 52000) * 100) < 1e-9);
});

test("GET /api/latest changePct is null with only one day of data", async () => {
  const repo = createRepository(createDb(":memory:"));
  await repo.insertIfNew(6, 52000, daysAgo(0), "x");
  await repo.insertIfNew(8, 41000, daysAgo(0), "x");
  const body = (await (await routerFor(repo).request("/api/latest")).json()) as any;
  assert.equal(body.sell.changePct, null);
  assert.equal(body.buy.changePct, null);
});

function routerWithSecret(repo: ReturnType<typeof createRepository>, secret: string) {
  return createApiRouter({
    service: createHistoryService(repo),
    repository: repo,
    config: loadConfig({ SYNC_SECRET: secret }),
  });
}

test("POST /api/import rejects without the correct secret", async () => {
  const app = routerWithSecret(createRepository(createDb(":memory:")), "s3cr3t");
  const post = (headers: Record<string, string>) =>
    app.request("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ points: [] }),
    });
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ Authorization: "Bearer nope" })).status, 401);
});

test("POST /api/import inserts manual points and is idempotent", async () => {
  const repo = createRepository(createDb(":memory:"));
  const app = routerWithSecret(repo, "s3cr3t");
  const headers = { "content-type": "application/json", Authorization: "Bearer s3cr3t" };
  const body = JSON.stringify({
    points: [
      { code: 6, date: "2026-06-25", price: 44975 },
      { code: 8, date: "2026-06-25", price: 36999 },
    ],
  });
  const first = await (await app.request("/api/import", { method: "POST", headers, body })).json();
  assert.deepEqual(first, { received: 2, inserted: 2, skipped: 0 });
  const again = (await (await app.request("/api/import", { method: "POST", headers, body })).json()) as any;
  assert.equal(again.inserted, 0);
  assert.equal((await repo.historyForCode(6))[0]!.price, 44975);
});

test("GET /api/daily-high returns per-day maxima since a date", async () => {
  const repo = createRepository(createDb(":memory:"));
  await repo.insertIfNew(6, 100, "2026-06-25 09:00:00.0", "x");
  await repo.insertIfNew(6, 120, "2026-06-25 13:00:00.0", "x"); // day high
  await repo.insertIfNew(6, 130, "2026-06-26 10:00:00.0", "x");
  const app = routerWithSecret(repo, "");
  const body = (await (await app.request("/api/daily-high?since=2026-06-25")).json()) as any;
  assert.deepEqual(body.sell, [
    { date: "2026-06-25", price: 120 },
    { date: "2026-06-26", price: 130 },
  ]);
  assert.deepEqual(body.buy, []);
});

test("GET /api/health: starting -> ok -> degraded by poll liveness", async () => {
  const repo = createRepository(createDb(":memory:"));
  const app = routerFor(repo);

  const starting = await app.request("/api/health");
  assert.equal(starting.status, 200);
  assert.equal(((await starting.json()) as any).status, "starting");

  await repo.setMeta(META_LAST_POLLED, new Date().toISOString());
  const ok = await app.request("/api/health");
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as any).status, "ok");

  // 90 minutes ago > default 30-min threshold => degraded 503.
  await repo.setMeta(META_LAST_POLLED, new Date(Date.now() - 90 * 60_000).toISOString());
  const degraded = await app.request("/api/health");
  assert.equal(degraded.status, 503);
  assert.equal(((await degraded.json()) as any).status, "degraded");
});
