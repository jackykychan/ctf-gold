import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type WorkerEvent = {
  data?: { json(): unknown };
  waitUntil(promise: Promise<unknown>): void;
};
type WorkerHandler = (event: WorkerEvent) => void;

export interface RenderedNotification {
  title: string;
  options: { body: string };
}

export interface ServiceWorkerHarness {
  listeners: Map<string, WorkerHandler>;
  notifications: RenderedNotification[];
  calls: { skipWaiting: number; claim: number };
}

/** Load the real static service worker with observable browser primitives. */
export function loadServiceWorker(): ServiceWorkerHarness {
  const listeners = new Map<string, WorkerHandler>();
  const notifications: RenderedNotification[] = [];
  const calls = { skipWaiting: 0, claim: 0 };
  const self = {
    addEventListener(type: string, handler: WorkerHandler) {
      listeners.set(type, handler);
    },
    async skipWaiting() {
      calls.skipWaiting += 1;
    },
    clients: {
      async claim() {
        calls.claim += 1;
      },
    },
    registration: {
      async showNotification(title: string, options: { body: string }) {
        notifications.push({ title, options });
      },
    },
  };

  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, { self, Intl, Number });
  return { listeners, notifications, calls };
}

/** Dispatch a lifecycle event and await the worker's waitUntil promise. */
export async function dispatchWorkerEvent(
  harness: ServiceWorkerHarness,
  type: string,
  data?: { json(): unknown },
): Promise<void> {
  let pending: Promise<unknown> | undefined;
  harness.listeners.get(type)!({
    data,
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
}

/** Execute the real static service worker and capture its rendered notification. */
export async function renderPushNotification(
  payload: Record<string, unknown>,
): Promise<RenderedNotification> {
  const harness = loadServiceWorker();
  await dispatchWorkerEvent(harness, "push", { json: () => payload });
  return harness.notifications[0]!;
}
