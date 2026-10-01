import { test, expect } from "@playwright/test";

const endpoint = "https://push.example.test/e2e-browser";
const initialPrefs = {
  everyUpdate: false,
  dailyHigh: true,
  series: "both",
  targets: {
    sell: { up: 55_000, down: 50_000 },
    buy: { up: 45_000, down: 40_000 },
  },
  locale: "en",
};

test("favicon reflects the newest Sell price movement", async ({ page }) => {
  await page.route("**/api/history?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        range: "1m",
        generatedAt: "2026-10-01T00:00:00.000Z",
        series: {
          sell: [{ t: "2026-10-01 08:00:00", price: 52_100, changePct: 0.19 }],
          buy: [{ t: "2026-10-01 08:00:00", price: 42_000, changePct: 0.12 }],
        },
      }),
    }),
  );

  await page.goto("/");
  await expect(page.locator('link[rel~="icon"]')).toHaveAttribute("data-price-direction", "up");
  await expect(page.locator('link[rel~="icon"]')).toHaveAttribute("href", /^data:image\/svg\+xml,/);
});

test("website language is persisted to an active notification subscription", async ({ page }) => {
  await page.addInitScript(
    ({ endpoint: fakeEndpoint, prefs }) => {
      localStorage.setItem("locale", "en");
      localStorage.setItem("notify-prefs", JSON.stringify(prefs));

      Object.defineProperty(PushManager.prototype, "getSubscription", {
        configurable: true,
        value: async () => ({
          endpoint: fakeEndpoint,
          toJSON: () => ({
            endpoint: fakeEndpoint,
            keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
          }),
          unsubscribe: async () => true,
        }),
      });
    },
    { endpoint, prefs: initialPrefs },
  );

  await page.goto("/");

  const updateViaCache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.updateViaCache;
  });
  expect(updateViaCache).toBe("none");

  // Wait until the real service worker is ready and the UI has discovered the
  // deterministic existing PushSubscription above.
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByRole("switch", { name: "Enable notifications" })).toBeChecked();
  await page.getByRole("button", { name: "Close" }).click();

  const updatedSubscription = page.waitForRequest((request) => {
    if (!request.url().endsWith("/api/push/subscribe") || request.method() !== "POST") return false;
    return request.postDataJSON().prefs?.locale === "zh-Hant";
  });

  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "繁體中文" }).click();

  const request = await updatedSubscription;
  const response = await request.response();
  expect(response?.status()).toBe(200);

  const body = request.postDataJSON();
  expect(body.subscription.endpoint).toBe(endpoint);
  expect(body.prefs).toEqual({ ...initialPrefs, locale: "zh-Hant" });
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");

  const storedPrefs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("notify-prefs") ?? "null"),
  );
  expect(storedPrefs).toEqual({ ...initialPrefs, locale: "zh-Hant" });
});
