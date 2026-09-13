import type { SeriesKey } from "./types";

/** Which series a subscription's alerts watch. */
export type AlertSeries = SeriesKey | "both";

/** The reasons a push can fire (rendered to text by the service worker). */
export type AlertReason = "update" | "dailyHigh" | "up" | "down";

/** UI languages the notification text can be rendered in. */
export type PushLocale = "en" | "zh-Hant";

/** Per-subscription alert preferences (stored as JSON in push_subscriptions.prefs). */
export interface AlertPrefs {
  /** Notify on any new price point for the watched series. */
  everyUpdate: boolean;
  /** Notify when a new daily high is set. */
  dailyHigh: boolean;
  /** Notify when the price crosses up to >= this target; null = off. */
  upTarget: number | null;
  /** Notify when the price crosses down to <= this target; null = off. */
  downTarget: number | null;
  /** Series the alerts apply to. */
  series: AlertSeries;
  /** Language the notification text is rendered in. */
  locale: PushLocale;
}

/** A stored push subscription with its decoded prefs. */
export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs: AlertPrefs;
}

/** The JSON payload the Worker encrypts and sends; the service worker localizes it. */
export interface PushPayload {
  series: SeriesKey;
  price: number;
  prevPrice: number | null;
  reason: AlertReason;
  /** Raw updateDate of the triggering point. */
  updateDate: string;
  /** Language to render the notification text in. */
  locale: PushLocale;
}

/** Default prefs for a brand-new subscription (every update on the sell series). */
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  everyUpdate: true,
  dailyHigh: false,
  upTarget: null,
  downTarget: null,
  series: "sell",
  locale: "en",
};
