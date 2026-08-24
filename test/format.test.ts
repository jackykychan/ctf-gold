import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatHkClock,
  formatHkDate,
  formatHkTime,
  formatPct,
  formatPrice,
} from "../web/format";

test("formatPrice groups thousands and drops fractions", () => {
  assert.equal(formatPrice(52589, "en"), "52,589");
  assert.equal(formatPrice(41959, "en"), "41,959");
  assert.equal(formatPrice(1234.7, "en"), "1,235"); // rounded, no decimals
});

test("formatPct is signed with two decimals", () => {
  assert.equal(formatPct(0.42, "en"), "+0.42%");
  assert.equal(formatPct(-1.36, "en"), "-1.36%");
  assert.equal(formatPct(0, "en"), "0.00%");
});

test("formatHkTime shows the HK wall-clock time regardless of host timezone", () => {
  // The API string is HK local; the digits must be preserved exactly.
  assert.equal(formatHkTime("2026-08-23 09:03:57.217", "en"), "09:03");
  assert.equal(formatHkTime("2026-01-01 23:59:00.0", "en"), "23:59");
});

test("formatHkClock includes date and time; seconds only when requested", () => {
  const withSecs = formatHkClock("2026-08-23 09:03:57.217", "en", true);
  assert.match(withSecs, /2026/);
  assert.match(withSecs, /09:03:57/);

  const noSecs = formatHkClock("2026-08-23 09:03:57.217", "en", false);
  assert.match(noSecs, /09:03/);
  assert.doesNotMatch(noSecs, /:57/);
});

test("formatHkDate formats date-only; accepts a day-only string", () => {
  const full = formatHkDate("2026-08-23 09:03:57.217", "en");
  assert.match(full, /2026/);
  assert.match(full, /Aug/);
  assert.match(full, /23/);

  // A daily card's key has no time part; it should still format (not echo raw).
  const dayOnly = formatHkDate("2026-08-23", "en");
  assert.match(dayOnly, /2026/);
  assert.match(dayOnly, /Aug/);
  assert.notEqual(dayOnly, "2026-08-23");
});

test("format helpers echo the raw string on unparseable input", () => {
  assert.equal(formatHkDate("not-a-date", "en"), "not-a-date");
  assert.equal(formatHkTime("nope", "en"), "nope");
});
