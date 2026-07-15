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
      parseEnv({ ...validEnvironment, MEDIA_DRIVER: "cos", PORT: "8080", COS_BUCKET: "b", COS_REGION: "r", COS_PUBLIC_BASE_URL: "https://cdn.example.com", COS_SECRET_ID: "id", COS_SECRET_KEY: "key" }),
    ).toMatchObject({ MEDIA_DRIVER: "cos", PORT: 8080 });
  });

  it("requires COS credentials when COS media is selected", () => {
    expect(() => parseEnv({ ...validEnvironment, MEDIA_DRIVER: "cos" })).toThrow(/COS_BUCKET/);
  });

  it("requires HTTPS for the production site URL", () => {
    expect(() =>
      parseEnv({ ...validEnvironment, SITE_URL: "http://example.com" }),
    ).toThrow(/SITE_URL/);
  });

  it.each([
    ["credentials", "https://operator:secret@example.com"],
    ["a non-root path", "https://example.com/admin"],
    ["a query", "https://example.com?preview=true"],
    ["an empty query marker", "https://example.com?"],
    ["a fragment", "https://example.com#content"],
    ["an empty fragment marker", "https://example.com#"],
    ["a nonstandard explicit port", "https://example.com:8443"],
  ])("rejects a production site URL with %s", (_case, siteUrl) => {
    expect(() =>
      parseEnv({ ...validEnvironment, SITE_URL: siteUrl }),
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
