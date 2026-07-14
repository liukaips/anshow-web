import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseFrontendServerEnv } from "./env";

describe("frontend server environment", () => {
  it("uses the local backend origin outside production", () => {
    expect(parseFrontendServerEnv({ NODE_ENV: "development" })).toEqual({
      BACKEND_INTERNAL_URL: "http://localhost:4000",
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
});
