import path from "node:path";
import express, { type Express } from "express";
import { createHistoryRouter } from "./routes/history";
import { createHistoryService } from "./services/historyService";
import type { PriceRepository } from "./data/priceRepository";

export interface AppDeps {
  repository: PriceRepository;
  /** Directory of static frontend assets. Defaults to ../public relative to build output. */
  publicDir?: string;
}

/**
 * Build the Express app with injected dependencies. No network/DB side effects
 * and no `listen` — so route tests can drive it against an in-memory repository.
 */
export function buildApp({ repository, publicDir }: AppDeps): Express {
  const app = express();
  const service = createHistoryService(repository);

  app.use("/api", createHistoryRouter(service));

  const staticDir = publicDir ?? path.join(__dirname, "..", "public");
  app.use(express.static(staticDir));

  return app;
}
