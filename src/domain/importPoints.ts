/**
 * PURE. Validate and normalise a Google-Sheet import payload into price_points
 * rows. Malformed body (not `{ points: [...] }`) throws; individual invalid rows
 * (bad code, non-ISO date, non-positive/NaN price) are skipped.
 */
export interface ImportPoint {
  code: number;
  price: number;
  updateDate: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toImportPoints(body: unknown): ImportPoint[] {
  if (body === null || typeof body !== "object") {
    throw new Error("body must be an object");
  }
  const raw = (body as { points?: unknown }).points;
  if (!Array.isArray(raw)) {
    throw new Error("body.points must be an array");
  }

  const out: ImportPoint[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const { code, date, price } = item as { code?: unknown; date?: unknown; price?: unknown };
    if (code !== 6 && code !== 8) continue;
    if (typeof date !== "string" || !ISO_DATE.test(date)) continue;
    const p = typeof price === "number" ? price : Number(price);
    if (!Number.isFinite(p) || p <= 0) continue;
    out.push({ code, price: Math.round(p), updateDate: `${date} 00:00:00` });
  }
  return out;
}
