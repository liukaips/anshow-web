import { describe, expect, it, vi } from "vitest";

import { initializeRuntime } from "./runtime-bootstrap.js";

const validEnvironment = {
  NODE_ENV: "production",
  SITE_URL: "https://example.com",
  SITE_HOST: "example.com",
  DATABASE_PATH: "/data/anshow.db",
  BETTER_AUTH_SECRET: "better-auth-secret-at-least-32-bytes",
  RATE_LIMIT_SECRET: "rate-limit-secret-at-least-32-bytes",
} as const;

describe("initializeRuntime", () => {
  it("rejects invalid configuration before loading runtime modules", async () => {
    const loadRuntime = vi.fn();

    await expect(
      initializeRuntime({ ...validEnvironment, BETTER_AUTH_SECRET: "short" }, loadRuntime),
    ).rejects.toThrow(/BETTER_AUTH_SECRET/);
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("passes validated configuration to the runtime loader", async () => {
    const loadRuntime = vi.fn();

    await initializeRuntime(validEnvironment, loadRuntime);

    expect(loadRuntime).toHaveBeenCalledOnce();
    expect(loadRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ MEDIA_DRIVER: "local", PORT: 4000 }),
    );
  });
});
