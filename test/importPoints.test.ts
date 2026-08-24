import { test } from "node:test";
import assert from "node:assert/strict";
import { toImportPoints } from "../src/domain/importPoints";

test("maps valid rows to price_points at midnight, rounding the price", () => {
  const out = toImportPoints({
    points: [
      { code: 6, date: "2026-06-25", price: 44975 },
      { code: 8, date: "2026-06-25", price: 36999.4 },
    ],
  });
  assert.deepEqual(out, [
    { code: 6, price: 44975, updateDate: "2026-06-25 00:00:00" },
    { code: 8, price: 36999, updateDate: "2026-06-25 00:00:00" },
  ]);
});

test("accepts numeric-string prices (comma-stripped upstream)", () => {
  const out = toImportPoints({ points: [{ code: 6, date: "2026-07-01", price: "45327" }] });
  assert.equal(out[0]!.price, 45327);
});

test("skips invalid rows: bad code, non-ISO date, blank/NaN/non-positive price", () => {
  const out = toImportPoints({
    points: [
      { code: 7, date: "2026-06-25", price: 100 }, // bad code
      { code: 6, date: "25/6/2026", price: 100 }, // not ISO
      { code: 6, date: "2026-06-25", price: "" }, // blank
      { code: 8, date: "2026-06-25", price: 0 }, // non-positive
      { code: 8, date: "2026-06-26", price: 37130 }, // valid
    ],
  });
  assert.deepEqual(out, [{ code: 8, price: 37130, updateDate: "2026-06-26 00:00:00" }]);
});

test("throws on a malformed body", () => {
  assert.throws(() => toImportPoints(null));
  assert.throws(() => toImportPoints({}));
  assert.throws(() => toImportPoints({ points: "nope" }));
});
