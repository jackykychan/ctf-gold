/**
 * Google Sheet ↔ ctf-gold site bridge (Apps Script).
 *
 * Setup:
 *   1. Extensions → Apps Script → paste this file.
 *   2. Project Settings → Script Properties: add
 *        SITE_URL     = https://ctf-gold.<subdomain>.workers.dev
 *        SYNC_SECRET  = <same value as the Worker's SYNC_SECRET secret>
 *   3. Run importFromSheet() once (authorise when prompted).
 *   4. Triggers → add a time-driven trigger on syncDailyHighToSheet() (e.g. hourly).
 *
 * Sheet layout — tab "Gold Price":
 *   Sell block: B=date (D/M/YYYY), C=weekday, D=賣出(港幣)
 *   Buy  block: L=date (D/M/YYYY),            M=買入(港幣)
 */

var TAB = "Gold Price";
var SELL = { date: 2, weekday: 3, price: 4 }; // B, C, D
var BUY = { date: 12, price: 13 }; // L, M

function props_() {
  return PropertiesService.getScriptProperties();
}
function siteUrl_() {
  var u = props_().getProperty("SITE_URL");
  if (!u) throw new Error("Script Property SITE_URL is not set");
  return u.trim().replace(/\/+$/, ""); // tolerate a trailing slash
}
function secret_() {
  return props_().getProperty("SYNC_SECRET");
}
function sheet_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sh) throw new Error('Tab "' + TAB + '" not found');
  return sh;
}
function tz_() {
  return SpreadsheetApp.getActive().getSpreadsheetTimeZone();
}

/** Cell value (Date or "D/M/YYYY" text) -> "YYYY-MM-DD", or null. */
function toIsoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), "yyyy-MM-dd");
  if (typeof v === "string") {
    var m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  }
  return null;
}
/** Cell value (number or comma text) -> number, or null. */
function toNumber_(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    var n = Number(v.replace(/,/g, "").trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

/** ── One-time import: Sheet → site ─────────────────────────────────────── */
function importFromSheet() {
  var sh = sheet_();
  var last = Math.max(sh.getLastRow(), 1);
  var points = [];

  [
    { code: 6, col: SELL },
    { code: 8, col: BUY },
  ].forEach(function (blk) {
    var dates = sh.getRange(1, blk.col.date, last, 1).getValues();
    var prices = sh.getRange(1, blk.col.price, last, 1).getValues();
    for (var i = 0; i < last; i++) {
      var iso = toIsoDate_(dates[i][0]);
      var price = toNumber_(prices[i][0]);
      if (iso && price != null && price > 0) points.push({ code: blk.code, date: iso, price: price });
    }
  });

  var received = 0,
    inserted = 0,
    skipped = 0;
  for (var i = 0; i < points.length; i += 500) {
    var out = postJson_("/api/import", { points: points.slice(i, i + 500) });
    received += out.received;
    inserted += out.inserted;
    skipped += out.skipped;
  }
  Logger.log("Import done: received=%s inserted=%s skipped=%s", received, inserted, skipped);
}

/** ── Recurring write-back: site daily-high → Sheet ─────────────────────── */
function syncDailyHighToSheet() {
  var sh = sheet_();
  var since = Utilities.formatDate(new Date(Date.now() - 3 * 86400000), tz_(), "yyyy-MM-dd");
  var res = UrlFetchApp.fetch(siteUrl_() + "/api/daily-high?since=" + since, {
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("daily-high -> " + res.getResponseCode());
  var data = JSON.parse(res.getContentText()); // { sell:[{date,price}], buy:[{date,price}] }
  var s = upsertBlock_(sh, SELL, data.sell || [], true);
  var b = upsertBlock_(sh, BUY, data.buy || [], false);
  Logger.log(
    "Write-back done: sell(updated=%s appended=%s unchanged=%s) buy(updated=%s appended=%s unchanged=%s)",
    s.updated, s.appended, s.unchanged, b.updated, b.appended, b.unchanged
  );
}

/**
 * Upsert {date,price} items into a block: append new dates, and overwrite an
 * existing date's price ONLY when it actually changed. Skipping equal-value
 * writes avoids polluting the Sheet's edit history with no-op changes on every
 * run (the daily high is unchanged most of the time).
 */
function upsertBlock_(sh, col, items, hasWeekday) {
  if (items.length === 0) return { updated: 0, appended: 0, unchanged: 0 };
  var last = Math.max(sh.getLastRow(), 1);
  var dates = sh.getRange(1, col.date, last, 1).getValues();
  var prices = sh.getRange(1, col.price, last, 1).getValues();
  var index = {},
    lastDataRow = 0;
  for (var i = 0; i < last; i++) {
    var iso = toIsoDate_(dates[i][0]);
    if (iso) {
      index[iso] = i + 1;
      lastDataRow = i + 1;
    }
  }
  var nextRow = lastDataRow + 1;
  var updated = 0,
    appended = 0,
    unchanged = 0;
  items.forEach(function (it) {
    var row = index[it.date];
    if (row) {
      // Compare numerically so 44975 vs "44,975.00" counts as unchanged.
      if (toNumber_(prices[row - 1][0]) === it.price) {
        unchanged++;
        return;
      }
      sh.getRange(row, col.price).setValue(it.price);
      updated++;
      return;
    }
    var p = it.date.split("-");
    var dateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    sh.getRange(nextRow, col.date).setValue(Utilities.formatDate(dateObj, tz_(), "d/M/yyyy"));
    if (hasWeekday) {
      sh.getRange(nextRow, col.weekday).setValue(Utilities.formatDate(dateObj, tz_(), "EEEE"));
    }
    sh.getRange(nextRow, col.price).setValue(it.price);
    index[it.date] = nextRow;
    nextRow++;
    appended++;
  });
  return { updated: updated, appended: appended, unchanged: unchanged };
}

function postJson_(path, body) {
  var res = UrlFetchApp.fetch(siteUrl_() + path, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("POST " + path + " -> " + res.getResponseCode() + ": " + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}
