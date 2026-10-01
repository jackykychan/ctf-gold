import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type PushHandler = (event: {
  data: { json(): unknown };
  waitUntil(promise: Promise<unknown>): void;
}) => void;

export interface RenderedNotification {
  title: string;
  options: { body: string };
}

/** Execute the real static service worker and capture its rendered notification. */
export async function renderPushNotification(
  payload: Record<string, unknown>,
): Promise<RenderedNotification> {
  const listeners = new Map<string, PushHandler>();
  const notifications: RenderedNotification[] = [];
  const self = {
    addEventListener(type: string, handler: PushHandler) {
      listeners.set(type, handler);
    },
    registration: {
      async showNotification(title: string, options: { body: string }) {
        notifications.push({ title, options });
      },
    },
  };

  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, { self, Intl, Number });

  let pending: Promise<unknown> | undefined;
  listeners.get("push")!({
    data: { json: () => payload },
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  return notifications[0]!;
}
