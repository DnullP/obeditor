import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4317",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    bypassCSP: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 4317,
    env: {
      ...process.env,
      NO_PROXY: [
        process.env.NO_PROXY,
        process.env.no_proxy,
        "127.0.0.1",
        "localhost",
        "::1",
      ].filter(Boolean).join(","),
      no_proxy: [
        process.env.NO_PROXY,
        process.env.no_proxy,
        "127.0.0.1",
        "localhost",
        "::1",
      ].filter(Boolean).join(","),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
