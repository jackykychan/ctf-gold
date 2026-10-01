import { test } from "node:test";
import assert from "node:assert/strict";
import { faviconDataUrl, faviconSvg, priceDirection } from "../web/favicon";

test("priceDirection maps Sell movement to up, down, or neutral", () => {
  assert.equal(priceDirection(0.01), "up");
  assert.equal(priceDirection(-0.01), "down");
  assert.equal(priceDirection(0), "flat");
  assert.equal(priceDirection(null), "flat");
  assert.equal(priceDirection(Number.NaN), "flat");
});

test("favicon SVG uses distinct colors and arrows for every direction", () => {
  const up = faviconSvg("up");
  const down = faviconSvg("down");
  const flat = faviconSvg("flat");

  assert.match(up, /#087f5b/);
  assert.match(up, /M32 12 50 31/);
  assert.match(down, /#c92a2a/);
  assert.match(down, /M32 52 14 33/);
  assert.match(flat, /#9a7200/);
  assert.match(flat, /M16 27h32v10/);
  assert.notEqual(up, down);
});

test("faviconDataUrl produces an encoded SVG data URL", () => {
  const url = faviconDataUrl("up");
  assert.match(url, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(url), /<svg/);
});
