import { Router } from "express";
import type { HistoryService } from "../services/historyService";
import { RANGES } from "../shared/types";
import type { Range } from "../shared/types";

const DEFAULT_RANGE: Range = "1m";

function isRange(v: unknown): v is Range {
  return typeof v === "string" && (RANGES as readonly string[]).includes(v);
}

export function createHistoryRouter(service: HistoryService): Router {
  const router = Router();

  router.get("/history", (req, res) => {
    const raw = req.query["range"];
    const range: Range = isRange(raw) ? raw : DEFAULT_RANGE;
    res.json(service.getHistory(range));
  });

  router.get("/latest", (_req, res) => {
    res.json(service.getLatest());
  });

  return router;
}
