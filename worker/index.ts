import { createGoldPriceClient } from "../src/api/goldPriceClient";
import { CANONICAL_SERIES_KEY, loadConfig, seriesByKey, type EnvSource } from "../src/config";
import { createHistoryService } from "../src/services/historyService";
import { createApiRouter } from "../src/http/api";
import { runPollOnce } from "../src/pollCore";
import { evaluateAlerts } from "../src/domain/pushAlerts";
import { META_LAST_POLLED } from "../src/shared/types";
import { createD1Repository } from "./d1Repository";
import { sendPush } from "./webPush";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // String vars from wrangler [vars] / secrets; read by loadConfig.
  API_URL?: string;
  HEALTH_STALE_AFTER_MIN?: string;
  START_POLL_INTERVAL_MIN?: string;
  MIN_POLL_INTERVAL_MIN?: string;
  MAX_POLL_INTERVAL_MIN?: string;
  SYNC_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_CONTACT?: string;
}

function deps(env: Env) {
  const repository = createD1Repository(env.DB);
  const config = loadConfig(env as unknown as EnvSource);
  return { repository, config };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const { repository, config } = deps(env);
      const service = createHistoryService(repository);
      const api = createApiRouter({ service, repository, config });

      // Edge-cache the cacheable GETs so repeat/auto-refresh reads (and multiple
      // visitors) are served from Cloudflare's cache instead of D1. TTL follows
      // each response's Cache-Control.
      const cacheable =
        request.method === "GET" &&
        (url.pathname === "/api/history" ||
          url.pathname === "/api/latest" ||
          url.pathname === "/api/daily-high");
      if (cacheable) {
        const cache = caches.default;
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await api.fetch(request, env, ctx);
        if (res.ok) ctx.waitUntil(cache.put(request, res.clone()));
        return res;
      }
      return api.fetch(request, env, ctx);
    }

    // Static assets, with SPA fallback to index.html for client-side routes.
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404 && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return assetRes;
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const { repository, config } = deps(env);
    const client = createGoldPriceClient(config.apiUrl);
    const canonicalCode = seriesByKey(CANONICAL_SERIES_KEY).code;
    try {
      const { inserted, canonicalUpdateDate, insertedPoints } = await runPollOnce({
        client,
        repository,
        canonicalCode,
      });
      console.log(`Poll ok: ${inserted} new point(s) @ ${canonicalUpdateDate}`);
      if (insertedPoints.length > 0 && config.vapidPublicKey && config.vapidPrivateKey) {
        await fanOutPush(repository, config, insertedPoints, ctx);
      }
    } catch (err) {
      console.error(`Poll failed: ${(err as Error).message}`);
    } finally {
      // Record cron liveness regardless of upstream success, so /api/health can
      // distinguish "cron stalled" from "upstream quiet".
      await repository.setMeta(META_LAST_POLLED, new Date().toISOString());
    }
  },
};

/**
 * Evaluate each newly-inserted point against every subscription's prefs and
 * send the matching Web Pushes. Runs under ctx.waitUntil so the cron returns
 * promptly; prunes subscriptions the push service reports as gone (404/410).
 */
async function fanOutPush(
  repository: ReturnType<typeof createD1Repository>,
  config: ReturnType<typeof loadConfig>,
  insertedPoints: Awaited<ReturnType<typeof runPollOnce>>["insertedPoints"],
  ctx: ExecutionContext,
): Promise<void> {
  const subs = await repository.listSubscriptions();
  if (subs.length === 0) return;

  const sends: Promise<void>[] = [];
  for (const pt of insertedPoints) {
    // A new daily high = strictly above the max of earlier points on the same
    // day (first point of the day counts as a new high).
    const dayStart = `${pt.updateDate.slice(0, 10)} 00:00:00`;
    const { rows } = await repository.historyWindow(pt.code, dayStart);
    const earlierMax = rows
      .filter((r) => r.updateDate < pt.updateDate)
      .reduce((m, r) => Math.max(m, r.price), 0);
    const isDailyHigh = pt.price > earlierMax;

    const event = {
      series: pt.key,
      price: pt.price,
      prevPrice: pt.prevPrice,
      isDailyHigh,
      updateDate: pt.updateDate,
    };
    for (const sub of subs) {
      const payload = evaluateAlerts(sub.prefs, event);
      if (!payload) continue;
      sends.push(
        sendPush(sub, payload, config)
          .then(async (status) => {
            if (status === 404 || status === 410) await repository.deleteSubscription(sub.endpoint);
          })
          .catch((err) => console.error(`Push failed: ${(err as Error).message}`)),
      );
    }
  }
  ctx.waitUntil(Promise.all(sends));
}
