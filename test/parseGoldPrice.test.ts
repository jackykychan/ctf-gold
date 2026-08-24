import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoldPrice } from "../src/api/parseGoldPrice";

const sample = {
  "5": [{ priceCode: 5, originGoldPrice: 42221, updateDate: "2026-08-22 09:19:37.373" }],
  "6": [
    {
      priceCode: 6,
      goldPrice: "52,589.00",
      originGoldPrice: 52589,
      updateDate: "2026-08-22 09:19:37.39",
      priceDescEng: "9999 Gold - Sell",
    },
  ],
  "8": [
    {
      priceCode: 8,
      goldPrice: "41,959.00",
      originGoldPrice: 41959,
      updateDate: "2026-08-22 09:19:37.407",
      priceDescEng: "9999 Gold - Buy",
    },
  ],
};

test("parses configured sell/buy series and ignores others", () => {
  const points = parseGoldPrice(sample);
  assert.equal(points.length, 2);
  const sell = points.find((p) => p.key === "sell");
  const buy = points.find((p) => p.key === "buy");
  assert.deepEqual(sell, {
    code: 6,
    key: "sell",
    price: 52589,
    updateDate: "2026-08-22 09:19:37.39",
  });
  assert.deepEqual(buy, {
    code: 8,
    key: "buy",
    price: 41959,
    updateDate: "2026-08-22 09:19:37.407",
  });
});

test("tolerates variable millisecond precision in updateDate", () => {
  const points = parseGoldPrice({
    "6": [{ originGoldPrice: 1, updateDate: "2026-08-22 09:19:37.2" }],
    "8": [{ originGoldPrice: 2, updateDate: "2026-08-22 09:19:37.219" }],
  });
  assert.equal(points[0]!.updateDate, "2026-08-22 09:19:37.2");
  assert.equal(points[1]!.updateDate, "2026-08-22 09:19:37.219");
});

test("throws on non-object payloads", () => {
  assert.throws(() => parseGoldPrice(null));
  assert.throws(() => parseGoldPrice("nope"));
});

test("throws when a configured series is missing", () => {
  assert.throws(
    () => parseGoldPrice({ "6": [{ originGoldPrice: 1, updateDate: "2026-08-22 09:00:00.0" }] }),
    /price code 8/,
  );
});

test("throws when originGoldPrice is not a number", () => {
  assert.throws(
    () =>
      parseGoldPrice({
        "6": [{ originGoldPrice: "52,589", updateDate: "2026-08-22 09:00:00.0" }],
        "8": [{ originGoldPrice: 1, updateDate: "2026-08-22 09:00:00.0" }],
      }),
    /Invalid originGoldPrice/,
  );
});
