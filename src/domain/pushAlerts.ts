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
 * PURE. Decide whether an event should notify a subscription and why. Returns
 * the push payload to send, or null if no configured alert matched.
 *
 * Threshold alerts are crossing-based (prev below/above → new at/through the
 * target), so they fire once per crossing and never re-fire while the price
 * stays past the target — no per-subscription "already fired" state needed.
 * Precedence when several match: up/down crossing > daily high > every update.
 */
export function evaluateAlerts(prefs: AlertPrefs, event: AlertEvent): PushPayload | null {
  // Series filter.
  if (prefs.series !== "both" && prefs.series !== event.series) return null;

  const { price, prevPrice } = event;
  let reason: AlertReason | null = null;

  if (
    prefs.upTarget != null &&
    prevPrice != null &&
    prevPrice < prefs.upTarget &&
    price >= prefs.upTarget
  ) {
    reason = "up";
  } else if (
    prefs.downTarget != null &&
    prevPrice != null &&
    prevPrice > prefs.downTarget &&
    price <= prefs.downTarget
  ) {
    reason = "down";
  } else if (prefs.dailyHigh && event.isDailyHigh) {
    reason = "dailyHigh";
  } else if (prefs.everyUpdate) {
    reason = "update";
  }

  if (reason === null) return null;
  return {
    series: event.series,
    price,
    prevPrice,
    reason,
    updateDate: event.updateDate,
    locale: prefs.locale,
  };
}
