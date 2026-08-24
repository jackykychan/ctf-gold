import { createGoldPriceClient } from "../src/api/goldPriceClient";
import { CANONICAL_SERIES_KEY, loadConfig, seriesByKey, type EnvSource } from "../src/config";
import { createHistoryService } from "../src/services/historyService";
import { createApiRouter } from "../src/http/api";
import { runPollOnce } from "../src/pollCore";
import { META_LAST_POLLED } from "../src/shared/types";
import { createD1Repository } from "./d1Repository";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // String vars from wrangler [vars]; read by loadConfig.
  API_URL?: string;
  HEALTH_STALE_AFTER_MIN?: string;
  START_POLL_INTERVAL_MIN?: string;
  MIN_POLL_INTERVAL_MIN?: string;
  MAX_POLL_INTERVAL_MIN?: string;
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
      return api.fetch(request, env, ctx);
    }

    // Static assets, with SPA fallback to index.html for client-side routes.
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404 && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return assetRes;
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const { repository, config } = deps(env);
    const client = createGoldPriceClient(config.apiUrl);
    const canonicalCode = seriesByKey(CANONICAL_SERIES_KEY).code;
    try {
      const { inserted, canonicalUpdateDate } = await runPollOnce({
        client,
        repository,
        canonicalCode,
      });
      console.log(`Poll ok: ${inserted} new point(s) @ ${canonicalUpdateDate}`);
    } catch (err) {
      console.error(`Poll failed: ${(err as Error).message}`);
    } finally {
      // Record cron liveness regardless of upstream success, so /api/health can
      // distinguish "cron stalled" from "upstream quiet".
      await repository.setMeta(META_LAST_POLLED, new Date().toISOString());
    }
  },
};
