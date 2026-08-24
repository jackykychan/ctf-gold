import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme } from "../web/theme";

test("resolveTheme: explicit choice wins over system preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("resolveTheme: system/null follows the OS preference", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme(null, false), "light");
});
