import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const reuseExistingServer =
  process.env.E2E_REUSE_EXISTING_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "pnpm --filter @anshow/backend dev",
          cwd: "..",
          reuseExistingServer,
          timeout: 120_000,
          url: "http://localhost:4000/api/health/ready",
        },
        {
          command: "pnpm --filter @anshow/frontend dev",
          cwd: "..",
          reuseExistingServer,
          timeout: 120_000,
          url: baseURL,
        },
      ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
