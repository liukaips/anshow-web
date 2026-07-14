import { describe, expect, it } from "vitest";

import { resolveBetterAuthSecret } from "./config.js";

describe("Better Auth configuration", () => {
  it("rejects a production environment without an explicit secret", () => {
    expect(() => resolveBetterAuthSecret({ NODE_ENV: "production" })).toThrow(
      "BETTER_AUTH_SECRET",
    );
  });

  it("keeps a development-only fallback for local startup", () => {
    expect(resolveBetterAuthSecret({ NODE_ENV: "development" })).toContain(
      "development-only",
    );
  });
});
