import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLocale, intlLocale, LOCALES, STRINGS } from "../web/i18n";

test("detectLocale: Chinese browser variants map to Traditional Chinese", () => {
  assert.equal(detectLocale(["zh-HK"], null), "zh-Hant");
  assert.equal(detectLocale(["zh-TW"], null), "zh-Hant");
  assert.equal(detectLocale(["zh-Hant", "en"], null), "zh-Hant");
});

test("detectLocale: English and other browsers default to English", () => {
  assert.equal(detectLocale(["en-US"], null), "en");
  assert.equal(detectLocale(["fr-FR"], null), "en");
  assert.equal(detectLocale([], null), "en");
});

test("detectLocale: a stored override beats the browser", () => {
  assert.equal(detectLocale(["zh-HK"], "en"), "en");
  assert.equal(detectLocale(["en-US"], "zh-Hant"), "zh-Hant");
  assert.equal(detectLocale(["en-US"], "garbage"), "en"); // invalid stored -> fall back to browser
});

test("intlLocale maps to the HK Intl locales", () => {
  assert.equal(intlLocale("en"), "en-HK");
  assert.equal(intlLocale("zh-Hant"), "zh-HK");
});

test("every translation key exists in both dictionaries", () => {
  const keys = new Set<string>();
  for (const loc of LOCALES) for (const k of Object.keys(STRINGS[loc])) keys.add(k);
  for (const loc of LOCALES) {
    for (const k of keys) {
      assert.ok(STRINGS[loc][k], `missing key "${k}" in locale "${loc}"`);
    }
  }
});

test("English range labels use the full 'Last N …' wording", () => {
  assert.equal(STRINGS.en["range.5d"], "Last 5 Days");
  assert.equal(STRINGS.en["range.2w"], "Last 2 Weeks");
  assert.equal(STRINGS.en["range.1m"], "Last 1 Month");
  assert.equal(STRINGS.en["range.3m"], "Last 3 Months");
  assert.equal(STRINGS.en["range.6m"], "Last 6 Months");
});

test("relabelled controls: series 'All' and capitalised 'Daily High'", () => {
  assert.equal(STRINGS.en["view.both"], "All");
  assert.equal(STRINGS["zh-Hant"]["view.both"], "全部");
  assert.equal(STRINGS.en["cards.daily"], "Daily High");
});

test("source link label is present in both locales", () => {
  assert.ok(STRINGS.en["source.link"]);
  assert.ok(STRINGS["zh-Hant"]["source.link"]);
});
