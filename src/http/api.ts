import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppConfig } from "../config";
import type { PriceRepository } from "../data/repository";
import type { HistoryService } from "../services/historyService";
import { META_LAST_POLLED, RANGES, type Range } from "../shared/types";

const DEFAULT_RANGE: Range = "1m";

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
    return c.json(await service.getHistory(range));
  });

  api.get("/api/latest", async (c) => {
    return c.json(await service.getLatest());
  });

  // Liveness: degraded (503) when the poller/cron hasn't recorded a run recently,
  // so an external uptime monitor can alert on a silently stalled poller.
  api.get("/api/health", async (c) => {
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
