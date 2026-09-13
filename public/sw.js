/* Service worker: receives Web Push notifications and focuses the app on click.
   Static (not bundled). The push payload is { series, price, prevPrice, reason,
   updateDate, locale } — see src/shared/push.ts. Text is localized here. */

const STRINGS = {
  en: {
    title: "Gold Price Tracker",
    sell: "Sell",
    buy: "Buy",
    update: (s, p) => `${s} price updated: ${p}`,
    dailyHigh: (s, p) => `New daily high — ${s}: ${p}`,
    up: (s, p) => `${s} rose to ${p}`,
    down: (s, p) => `${s} dropped to ${p}`,
  },
  "zh-Hant": {
    title: "金價追蹤",
    sell: "賣出",
    buy: "買入",
    update: (s, p) => `${s}價格更新：${p}`,
    dailyHigh: (s, p) => `當日新高 — ${s}：${p}`,
    up: (s, p) => `${s}升至 ${p}`,
    down: (s, p) => `${s}跌至 ${p}`,
  },
};

function fmtPrice(n, locale) {
  try {
    return new Intl.NumberFormat(locale === "zh-Hant" ? "zh-HK" : "en-HK").format(n);
  } catch (_) {
    return String(n);
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    /* malformed payload */
  }
  const locale = data.locale === "zh-Hant" ? "zh-Hant" : "en";
  const s = STRINGS[locale];
  const series = data.series === "buy" ? s.buy : s.sell;
  const price = fmtPrice(data.price, locale);
  const make = s[data.reason] || s.update;

  event.waitUntil(
    self.registration.showNotification(s.title, {
      body: make(series, price),
      tag: "ctf-gold-" + (data.series || "sell"),
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if (client.navigate) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
