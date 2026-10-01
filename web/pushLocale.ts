import type { AlertPrefs } from "../src/shared/push";

/**
 * Apply the website locale to notification preferences and, when notifications
 * are active, persist the same preferences to the push subscription.
 * `storePrefs` runs synchronously so local UI/storage never waits on the network.
 */
export async function syncPushLocale(
  prefs: AlertPrefs,
  locale: AlertPrefs["locale"],
  enabled: boolean,
  storePrefs: (next: AlertPrefs) => void,
  persistPrefs: (next: AlertPrefs) => Promise<void>,
): Promise<AlertPrefs> {
  const next = prefs.locale === locale ? prefs : { ...prefs, locale };
  storePrefs(next);
  if (enabled) await persistPrefs(next);
  return next;
}
