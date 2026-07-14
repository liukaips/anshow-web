import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

const validEnvironment = {
  NODE_ENV: "production",
  SITE_URL: "https://example.com",
  SITE_HOST: "example.com",
  DATABASE_PATH: "/data/anshow.db",
  BETTER_AUTH_SECRET: "better-auth-secret-at-least-32-bytes",
  RATE_LIMIT_SECRET: "rate-limit-secret-at-least-32-bytes",
} as const;

describe("parseEnv", () => {
  it("normalizes deployment defaults", () => {
    expect(parseEnv(validEnvironment)).toEqual({
      ...validEnvironment,
      MEDIA_DRIVER: "local",
      PORT: 4000,
    });
  });

  it("accepts an explicit COS media driver and port", () => {
    expect(
      parseEnv({ ...validEnvironment, MEDIA_DRIVER: "cos", PORT: "8080" }),
    ).toMatchObject({ MEDIA_DRIVER: "cos", PORT: 8080 });
  });

  it("requires HTTPS for the production site URL", () => {
    expect(() =>
      parseEnv({ ...validEnvironment, SITE_URL: "http://example.com" }),
    ).toThrow(/SITE_URL/);
  });

  it("requires the configured host to match the site URL", () => {
    expect(() =>
      parseEnv({ ...validEnvironment, SITE_HOST: "www.example.com" }),
    ).toThrow(/SITE_HOST/);
  });

  it("requires the site host", () => {
    const environment: Record<string, string | undefined> = {
      ...validEnvironment,
    };
    delete environment.SITE_HOST;

    expect(() => parseEnv(environment)).toThrow(/SITE_HOST/);
  });

  it.each([
    ["BETTER_AUTH_SECRET", "too-short"],
    ["RATE_LIMIT_SECRET", "too-short"],
    ["PORT", "0"],
    ["PORT", "65536"],
    ["PORT", "not-a-number"],
    ["MEDIA_DRIVER", "filesystem"],
  ])("rejects invalid %s", (key, value) => {
    expect(() => parseEnv({ ...validEnvironment, [key]: value })).toThrow();
  });
});
