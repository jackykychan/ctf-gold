import { PRICE_SERIES } from "../config";
import type { ParsedPoint } from "../shared/types";

/**
 * PURE. Extract the configured series from a raw goldPrice API payload.
 * Reads the integer `originGoldPrice` (HKD per 兩) and `updateDate` for each
 * configured priceCode. Throws a clear error if a configured series is missing
 * or malformed; ignores every other price code in the payload.
 */
export function parseGoldPrice(raw: unknown): ParsedPoint[] {
  if (raw === null || typeof raw !== "object") {
    throw new Error("goldPrice payload is not an object");
  }
  const obj = raw as Record<string, unknown>;
  const points: ParsedPoint[] = [];

  for (const series of PRICE_SERIES) {
    const entry = obj[String(series.code)];
    if (!Array.isArray(entry) || entry.length === 0) {
      throw new Error(`Missing data for price code ${series.code} (${series.key})`);
    }
    const first = entry[0] as Record<string, unknown>;

    const price = first["originGoldPrice"];
    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new Error(`Invalid originGoldPrice for code ${series.code}: ${String(price)}`);
    }

    const updateDate = first["updateDate"];
    if (typeof updateDate !== "string" || updateDate.length === 0) {
      throw new Error(`Invalid updateDate for code ${series.code}: ${String(updateDate)}`);
    }

    points.push({ code: series.code, key: series.key, price, updateDate });
  }

  return points;
}
