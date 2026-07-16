import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL;
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 4400);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 3300);
const baseURL = externalBaseURL ?? `http://localhost:${frontendPort}`;
const reuseExistingServer =
  process.env.E2E_REUSE_EXISTING_SERVER === "true";

// Local E2E owns a temporary database and dedicated ports. Secrets are generated
// only for this process unless supplied by the caller; reuse is opt-in for trusted
// manually managed servers and is never enabled by default.
const e2eDatabasePath =
  process.env.E2E_DATABASE_PATH ??
  join(mkdtempSync(join(tmpdir(), "anshow-e2e-")), "anshow.db");
const e2eAdminEmail =
  process.env.E2E_ADMIN_EMAIL ??
  (externalBaseURL ? undefined : "e2e-admin@anshow.test");
const e2eAdminPassword =
  process.env.E2E_ADMIN_PASSWORD ??
  (externalBaseURL ? undefined : randomBytes(32).toString("base64url"));
const backendURL = `http://localhost:${backendPort}`;
const localEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  PORT: String(backendPort),
  SITE_URL: baseURL,
  SITE_HOST: new URL(baseURL).hostname,
  DATABASE_PATH: e2eDatabasePath,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? randomBytes(32).toString("base64url"),
  RATE_LIMIT_SECRET:
    process.env.RATE_LIMIT_SECRET ?? randomBytes(32).toString("base64url"),
  MEDIA_DRIVER: "local",
  ...(e2eAdminEmail ? { E2E_ADMIN_EMAIL: e2eAdminEmail } : {}),
  ...(e2eAdminPassword ? { E2E_ADMIN_PASSWORD: e2eAdminPassword } : {}),
};

// Admin tests read credentials from the Playwright process as well as the setup
// server, so generated credentials remain in-memory and never enter source.
if (e2eAdminEmail && e2eAdminPassword) {
  Object.assign(process.env, {
    E2E_ADMIN_EMAIL: e2eAdminEmail,
    E2E_ADMIN_PASSWORD: e2eAdminPassword,
  });
}

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command:
            "pnpm --filter @anshow/backend e2e:setup && pnpm --filter @anshow/backend dev",
          cwd: "..",
          env: localEnvironment,
          reuseExistingServer,
          timeout: 120_000,
          url: `${backendURL}/api/health/ready`,
        },
        {
          command: "pnpm --filter @anshow/frontend dev",
          cwd: "..",
          env: {
            ...localEnvironment,
            PORT: String(frontendPort),
            BACKEND_INTERNAL_URL: backendURL,
            SITE_URL: baseURL,
          },
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
