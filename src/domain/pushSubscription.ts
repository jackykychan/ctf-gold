import type { AlertPrefs, AlertSeries, PushLocale, SeriesTargets, StoredSubscription } from "../shared/push";

/**
 * PURE. Validate and normalise a push-subscribe request body into a stored
 * subscription. A malformed subscription (missing endpoint/keys) throws;
 * prefs are coerced/clamped to safe defaults rather than rejected.
 *
 * Expected body: { subscription: { endpoint, keys: { p256dh, auth } }, prefs }
 */
function normalizeSeries(v: unknown): AlertSeries {
  return v === "buy" || v === "both" ? v : "sell";
}

function normalizeTarget(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeLocale(v: unknown): PushLocale {
  return v === "zh-Hant" ? "zh-Hant" : "en";
}

function normalizeTargets(raw: unknown): SeriesTargets {
  const t = (raw ?? {}) as Record<string, unknown>;
  return { up: normalizeTarget(t.up), down: normalizeTarget(t.down) };
}

/** Coerce an arbitrary object into safe AlertPrefs (never throws). */
export function normalizePrefs(raw: unknown): AlertPrefs {
  const p = (raw ?? {}) as Record<string, unknown>;
  const t = (p.targets ?? {}) as Record<string, unknown>;
  const sell = normalizeTargets(t.sell);
  const buy = normalizeTargets(t.buy);
  // Back-compat: a legacy flat upTarget/downTarget maps onto the sell series.
  if (sell.up == null) sell.up = normalizeTarget(p.upTarget);
  if (sell.down == null) sell.down = normalizeTarget(p.downTarget);
  return {
    everyUpdate: p.everyUpdate === true,
    dailyHigh: p.dailyHigh === true,
    series: normalizeSeries(p.series),
    targets: { sell, buy },
    locale: normalizeLocale(p.locale),
  };
}

export function toPushSubscription(body: unknown): StoredSubscription {
  if (body === null || typeof body !== "object") {
    throw new Error("body must be an object");
  }
  const sub = (body as { subscription?: unknown }).subscription;
  if (sub === null || typeof sub !== "object") {
    throw new Error("body.subscription is required");
  }
  const { endpoint, keys } = sub as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || !/^https?:\/\//.test(endpoint)) {
    throw new Error("subscription.endpoint must be an http(s) URL");
  }
  const k = (keys ?? {}) as { p256dh?: unknown; auth?: unknown };
  if (typeof k.p256dh !== "string" || !k.p256dh || typeof k.auth !== "string" || !k.auth) {
    throw new Error("subscription.keys.p256dh and .auth are required");
  }
  return {
    endpoint,
    p256dh: k.p256dh,
    auth: k.auth,
    prefs: normalizePrefs((body as { prefs?: unknown }).prefs),
  };
}
