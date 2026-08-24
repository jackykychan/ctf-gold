import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { loadConfig } from "./config";
import { createDb } from "./data/db";
import { createRepository } from "./data/priceRepository";
import { createHistoryService } from "./services/historyService";
import { createApiRouter } from "./http/api";
import { createGoldPriceClient } from "./api/goldPriceClient";
import { createPoller } from "./poller";

/**
 * Node local-dev entry: the same Hono API router as production, served over
 * @hono/node-server with better-sqlite3 storage and the adaptive in-process
 * poller. Production runs the equivalent on Cloudflare Workers (worker/index.ts).
 */
function main(): void {
  const config = loadConfig();
  const db = createDb(config.dbPath);
  const repository = createRepository(db);
  const service = createHistoryService(repository);

  const app = new Hono();
  app.route("/", createApiRouter({ service, repository, config }));
  // Static frontend, with SPA fallback to index.html for client-side routes.
  app.use("/*", serveStatic({ root: "./public" }));
  app.get("*", serveStatic({ path: "./public/index.html" }));

  const client = createGoldPriceClient(config.apiUrl);
  const poller = createPoller({ client, repository, config });

  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Gold dashboard listening on http://localhost:${info.port}`);
    void poller.start();
  });

  const shutdown = (): void => {
    console.log("Shutting down...");
    poller.stop();
    server.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
