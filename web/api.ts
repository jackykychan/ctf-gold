import type { HistoryResponse, LatestResponse, Range } from "../src/shared/types";
import type { AlertPrefs } from "../src/shared/push";

export async function fetchHistory(range: Range): Promise<HistoryResponse> {
  const res = await fetch(`/api/history?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`history request failed: HTTP ${res.status}`);
  return (await res.json()) as HistoryResponse;
}

export async function fetchLatest(): Promise<LatestResponse> {
  const res = await fetch("/api/latest");
  if (!res.ok) throw new Error(`latest request failed: HTTP ${res.status}`);
  return (await res.json()) as LatestResponse;
}

/** VAPID public key for push subscription; empty string means push is disabled server-side. */
export async function fetchVapidKey(): Promise<string> {
  const res = await fetch("/api/push/public-key");
  if (!res.ok) throw new Error(`vapid key request failed: HTTP ${res.status}`);
  return ((await res.json()) as { key: string }).key;
}

export async function postSubscribe(subscription: PushSubscriptionJSON, prefs: AlertPrefs): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription, prefs }),
  });
  if (!res.ok) throw new Error(`subscribe failed: HTTP ${res.status}`);
}

export async function postUnsubscribe(endpoint: string): Promise<void> {
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}
