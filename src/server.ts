import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { loadConfig } from "./config";
import { createDb } from "./data/db";
import { createRepository } from "./data/priceRepository";
import { createHistoryService } from "./services/historyService";
import { createApiRouter } from "./http/api";
import { createGoldPriceClient } from "./api/goldPriceClient";
import { createPoller } from "./poller";

/** Dev only: enables live-reload + reads .dev.vars into process.env. */
const DEV = process.env.DEV === "true";

/** Load KEY=VALUE lines from .dev.vars into process.env (dev parity with wrangler). */
function loadDevVars(): void {
  try {
    const raw = fs.readFileSync(path.resolve("./.dev.vars"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && process.env[m[1]!] === undefined) {
        process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .dev.vars — fine */
  }
}

// Reload snippet injected into index.html in dev; reconnects on drop.
const RELOAD_SNIPPET =
  `<script>(()=>{const c=()=>{const e=new EventSource("/__livereload");` +
  `e.onmessage=(m)=>{if(m.data==="reload")location.reload()};` +
  `e.onerror=()=>{e.close();setTimeout(c,1000)}};c()})()</script>`;

/**
 * Node local-dev entry: the same Hono API router as production, served over
 * @hono/node-server with better-sqlite3 storage and the adaptive in-process
 * poller. Production runs the equivalent on Cloudflare Workers (worker/index.ts).
 */
function main(): void {
  if (DEV) loadDevVars();
  const config = loadConfig();
  const db = createDb(config.dbPath);
  const repository = createRepository(db);
  const service = createHistoryService(repository);

  const app = new Hono();
  app.route("/", createApiRouter({ service, repository, config }));

  if (DEV) {
    // ── Live reload ──────────────────────────────────────────────────────
    // Browsers subscribe to this SSE stream; when a built asset changes we
    // push "reload" and they refresh. index.html is served with the snippet.
    const reloadClients = new Set<() => void>();
    app.get("/__livereload", (c) =>
      streamSSE(c, (stream) =>
        new Promise<void>((resolve) => {
          const notify = () => void stream.writeSSE({ data: "reload" });
          reloadClients.add(notify);
          const ping = setInterval(() => void stream.writeSSE({ data: "ping", event: "ping" }), 30_000);
          stream.onAbort(() => {
            reloadClients.delete(notify);
            clearInterval(ping);
            resolve();
          });
        }),
      ),
    );

    // Watch the built output; debounce, then tell every client to reload.
    let timer: NodeJS.Timeout | undefined;
    try {
      fs.watch(path.resolve("./public"), (_event, filename) => {
        if (filename && /^(app\.js|styles\.css|index\.html)$/.test(filename)) {
          clearTimeout(timer);
          timer = setTimeout(() => reloadClients.forEach((fn) => fn()), 100);
        }
      });
    } catch {
      /* watching unavailable — non-fatal */
    }

    const renderIndex = () => {
      const html = fs.readFileSync(path.resolve("./public/index.html"), "utf8");
      return html.includes("</body>") ? html.replace("</body>", `${RELOAD_SNIPPET}</body>`) : html + RELOAD_SNIPPET;
    };
    app.get("/", (c) => c.html(renderIndex()));
    app.use("/*", serveStatic({ root: "./public" }));
    app.get("*", (c) => c.html(renderIndex())); // SPA fallback with the snippet
  } else {
    // Production/plain static serving, with SPA fallback to index.html.
    app.use("/*", serveStatic({ root: "./public" }));
    app.get("*", serveStatic({ path: "./public/index.html" }));
  }

  const client = createGoldPriceClient(config.apiUrl);
  const poller = createPoller({ client, repository, config });

  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Gold dashboard listening on http://localhost:${info.port}${DEV ? " (live reload on)" : ""}`);
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
