import { loadConfig } from "./config";
import { createDb } from "./data/db";
import { createRepository } from "./data/priceRepository";
import { createGoldPriceClient } from "./api/goldPriceClient";
import { createPoller } from "./poller";
import { buildApp } from "./app";

function main(): void {
  const config = loadConfig();
  const db = createDb(config.dbPath);
  const repository = createRepository(db);

  const client = createGoldPriceClient(config.apiUrl);
  const poller = createPoller({ client, repository, config });

  const app = buildApp({ repository });
  const server = app.listen(config.port, () => {
    console.log(`Gold dashboard listening on http://localhost:${config.port}`);
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
