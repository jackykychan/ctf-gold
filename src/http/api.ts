import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { PRICE_SERIES, type AppConfig } from "../config";
import { dailyHigh } from "../domain/changes";
import { toImportPoints } from "../domain/importPoints";
import type { PriceRepository } from "../data/repository";
import type { HistoryService } from "../services/historyService";
import { META_LAST_POLLED, RANGES, type Range, type SeriesKey } from "../shared/types";

const DEFAULT_RANGE: Range = "1m";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRange(v: unknown): v is Range {
  return typeof v === "string" && (RANGES as readonly string[]).includes(v);
}

export interface ApiDeps {
  service: HistoryService;
  repository: PriceRepository;
  config: AppConfig;
}

/**
 * Runtime-agnostic JSON API (Hono). Mounted by both the Node dev server and the
 * Cloudflare Worker. Only uses injected deps, so it is portable.
 */
export function createApiRouter({ service, repository, config }: ApiDeps): Hono {
  const api = new Hono();

  // JSON responses only need light hardening; the HTML/static CSP lives in public/_headers.
  api.use("/api/*", secureHeaders({ contentSecurityPolicy: undefined }));

  api.get("/api/history", async (c) => {
    const range: Range = isRange(c.req.query("range")) ? (c.req.query("range") as Range) : DEFAULT_RANGE;
    // Cacheable: history changes at most a few times/day; 60s staleness is fine
    // and lets the edge/browser absorb the dashboard's auto-refresh.
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await service.getHistory(range));
  });

  api.get("/api/latest", async (c) => {
    c.header("Cache-Control", "public, max-age=20");
    return c.json(await service.getLatest());
  });

  // Daily-high per series since `?since=YYYY-MM-DD` (default: all) — for the
  // Google Sheet write-back. Public aggregated data, like /api/history.
  api.get("/api/daily-high", async (c) => {
    const since = c.req.query("since");
    const boundary = since && ISO_DATE.test(since) ? `${since} 00:00:00` : "0000-01-01 00:00:00";
    c.header("Cache-Control", "public, max-age=60");
    const out = {} as Record<SeriesKey, { date: string; price: number }[]>;
    for (const s of PRICE_SERIES) {
      const { rows } = await repository.historyWindow(s.code, boundary);
      out[s.key] = dailyHigh(rows.map((r) => ({ t: r.updateDate, price: r.price }))).map((h) => ({
        date: h.t.slice(0, 10),
        price: h.price,
      }));
    }
    return c.json(out);
  });

  // Bulk import (Google Sheet historical data). Write endpoint — requires the
  // shared secret. Rows dedupe on (code, update_date), so re-imports are no-ops.
  api.post("/api/import", async (c) => {
    const secret = config.syncSecret;
    const auth = c.req.header("Authorization") ?? "";
    if (!secret || auth !== `Bearer ${secret}`) {
      return c.json({ error: "unauthorized" }, 401);
    }
    let points;
    try {
      points = toImportPoints(await c.req.json());
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
    const fetchedAt = new Date().toISOString();
    const { inserted, skipped } = await repository.insertManyIfNew(
      points.map((p) => ({ ...p, fetchedAt })),
      "manual",
    );
    return c.json({ received: points.length, inserted, skipped });
  });

  // Liveness: degraded (503) when the poller/cron hasn't recorded a run recently,
  // so an external uptime monitor can alert on a silently stalled poller.
  api.get("/api/health", async (c) => {
    c.header("Cache-Control", "no-store"); // liveness must never be cached
    const lastPolled = await repository.getMeta(META_LAST_POLLED);
    const now = Date.now();
    const staleAfterMs = config.healthStaleAfterMin * 60_000;

    if (lastPolled === null) {
      return c.json({ status: "starting", lastPolledAt: null }, 200);
    }
    const ageMs = now - Date.parse(lastPolled);
    const degraded = !Number.isFinite(ageMs) || ageMs > staleAfterMs;
    return c.json(
      {
        status: degraded ? "degraded" : "ok",
        lastPolledAt: lastPolled,
        ageSeconds: Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : null,
        staleAfterMinutes: config.healthStaleAfterMin,
      },
      degraded ? 503 : 200,
    );
  });

  return api;
}
