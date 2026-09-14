import { fetchVapidKey, postSubscribe, postUnsubscribe } from "@/api";
import type { AlertPrefs } from "../src/shared/push";

/** True when this browser can do Web Push at all. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Whether the page is running as an installed PWA (required for push on iOS). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Rough iOS Safari detection (for the "add to Home Screen" hint). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function permissionState(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** The browser's current push subscription for this origin, or null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Request permission, subscribe, and persist prefs. Throws on denial / misconfig. */
export async function enablePush(prefs: AlertPrefs): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission-denied");
  const key = await fetchVapidKey();
  if (!key) throw new Error("push-not-configured");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key) as BufferSource,
    }));
  await postSubscribe(sub.toJSON(), prefs);
}

/** Update the stored prefs for the existing subscription. */
export async function savePrefs(prefs: AlertPrefs): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error("not-subscribed");
  await postSubscribe(sub.toJSON(), prefs);
}

/** Unsubscribe locally and remove the server row. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await postUnsubscribe(sub.endpoint);
  await sub.unsubscribe();
}
