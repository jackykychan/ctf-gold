import { defineConfig } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    permissions: ["notifications"],
    serviceWorkers: "allow",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      DB_PATH: ":memory:",
      // The browser boundary is deterministic in this suite, so these only
      // need to make the subscription API available; no real push is sent.
      VAPID_PUBLIC_KEY: "e2e-public-key",
      VAPID_PRIVATE_KEY: "e2e-private-key",
      API_URL: "http://127.0.0.1:1/e2e-no-upstream",
    },
  },
});
