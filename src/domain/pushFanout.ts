import type { PriceRepository } from "../data/repository";
import type { InsertedPoint } from "../pollCore";
import type { PushPayload, StoredSubscription } from "../shared/push";
import { evaluateAlerts } from "./pushAlerts";

export interface PushDelivery {
  subscription: StoredSubscription;
  payload: PushPayload;
}

/**
 * For each newly-inserted point, determine whether it set a new daily high
 * (strictly above the max of earlier points on the same day) and produce the
 * push payloads each subscription should receive. No network here — the caller
 * sends the returned deliveries. Runtime-agnostic (used by the Worker cron).
 */
export async function planPushDeliveries(
  repository: PriceRepository,
  insertedPoints: readonly InsertedPoint[],
  subscriptions: readonly StoredSubscription[],
): Promise<PushDelivery[]> {
  if (subscriptions.length === 0) return [];

  const deliveries: PushDelivery[] = [];
  for (const pt of insertedPoints) {
    const dayStart = `${pt.updateDate.slice(0, 10)} 00:00:00`;
    const { rows } = await repository.historyWindow(pt.code, dayStart);
    const earlierMax = rows
      .filter((r) => r.updateDate < pt.updateDate)
      .reduce((m, r) => Math.max(m, r.price), 0);
    const isDailyHigh = pt.price > earlierMax; // first point of the day counts

    const event = {
      series: pt.key,
      price: pt.price,
      prevPrice: pt.prevPrice,
      isDailyHigh,
      updateDate: pt.updateDate,
    };
    for (const sub of subscriptions) {
      const payload = evaluateAlerts(sub.prefs, event);
      if (payload) deliveries.push({ subscription: sub, payload });
    }
  }
  return deliveries;
}
