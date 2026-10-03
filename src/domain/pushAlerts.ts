import type { SeriesKey } from "../shared/types";
import type { AlertPrefs, AlertReason, PushPayload } from "../shared/push";

/** A single new price observation to evaluate against a subscription's prefs. */
export interface AlertEvent {
  series: SeriesKey;
  price: number;
  /** The series' previous price, or null if this is the first point. */
  prevPrice: number | null;
  /** Whether this point set a new high for the current day. */
  isDailyHigh: boolean;
  updateDate: string;
}

/**
 * PURE. Decide which configured alerts match an event. Returns one push payload
 * per matching setting, or an empty array if no configured alert matched.
 *
 * Threshold alerts are crossing-based (prev below/above → new at/through the
 * target), so they fire once per crossing and never re-fire while the price
 * stays past the target — no per-subscription "already fired" state needed.
 * Matching settings remain separate so, for example, crossing a target on a
 * new daily high can produce target, daily-high, and every-update notifications.
 */
export function evaluateAlerts(prefs: AlertPrefs, event: AlertEvent): PushPayload[] {
  // Series filter.
  if (prefs.series !== "both" && prefs.series !== event.series) return [];

  const { price, prevPrice } = event;
  const target = prefs.targets[event.series]; // per-series rise-to / drop-to
  const reasons: AlertReason[] = [];

  if (
    target.up != null &&
    prevPrice != null &&
    prevPrice < target.up &&
    price >= target.up
  ) {
    reasons.push("up");
  }
  if (
    target.down != null &&
    prevPrice != null &&
    prevPrice > target.down &&
    price <= target.down
  ) {
    reasons.push("down");
  }
  if (prefs.dailyHigh && event.isDailyHigh) reasons.push("dailyHigh");
  if (prefs.everyUpdate) reasons.push("update");

  return reasons.map((reason) => ({
    series: event.series,
    price,
    prevPrice,
    reason,
    updateDate: event.updateDate,
    locale: prefs.locale,
  }));
}
