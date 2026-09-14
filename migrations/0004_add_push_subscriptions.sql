-- Web Push subscriptions + per-subscription alert preferences.
-- Mirrors the `push_subscriptions` table in src/data/db.ts (kept in sync manually).
-- `prefs` is a JSON blob: { everyUpdate, dailyHigh, upTarget, downTarget, series }.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,          -- push service endpoint URL (unique per subscription)
  p256dh     TEXT NOT NULL,             -- client public key (base64url)
  auth       TEXT NOT NULL,             -- client auth secret (base64url)
  prefs      TEXT NOT NULL,             -- JSON alert preferences
  created_at TEXT NOT NULL,             -- ISO time first subscribed
  updated_at TEXT NOT NULL              -- ISO time prefs last changed
);
