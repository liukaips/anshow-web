import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseFrontendServerEnv } from "./env";

describe("frontend server environment", () => {
  it("uses the local backend origin outside production", () => {
    expect(parseFrontendServerEnv({ NODE_ENV: "development" })).toEqual({
      BACKEND_INTERNAL_URL: "http://localhost:4000",
      SITE_URL: "http://localhost:3000",
    });
  });

  it("requires a private backend origin in production", () => {
    expect(() =>
      parseFrontendServerEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_BACKEND_INTERNAL_URL: "https://public.example.com",
      }),
    ).toThrow(/BACKEND_INTERNAL_URL is required/);
  });

  it("requires a clean HTTPS public site origin in production", () => {
    expect(() =>
      parseFrontendServerEnv({
        BACKEND_INTERNAL_URL: "http://backend:4000",
        NODE_ENV: "production",
        SITE_URL: "http://www.anshow.test/path",
      }),
    ).toThrow(/SITE_URL must be an HTTPS origin/);

    expect(
      parseFrontendServerEnv({
        BACKEND_INTERNAL_URL: "http://backend:4000",
        NODE_ENV: "production",
        SITE_URL: "https://www.anshow.test/",
      }),
    ).toEqual({
      BACKEND_INTERNAL_URL: "http://backend:4000",
      SITE_URL: "https://www.anshow.test",
    });
  });
});
