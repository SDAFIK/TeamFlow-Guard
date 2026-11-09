import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.TEAMFLOW_E2E === "supabase" ? "migration.spec.ts" : ["foundation.spec.ts", "recovery.spec.ts"],
  workers: 1,
  expect: { timeout: process.env.TEAMFLOW_VERCEL_SHARE_FILE ? 30_000 : 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE },
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
