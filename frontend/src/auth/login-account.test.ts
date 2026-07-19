import { describe, expect, it } from "vitest";

import { loginAccountToEmail } from "./login-account";

describe("login account normalization", () => {
  it("allows the deploy admin to sign in with the liukai username", () => {
    expect(loginAccountToEmail(" liukai ")).toBe("liukai@anshow.local");
  });

  it("keeps normal email logins compatible", () => {
    expect(loginAccountToEmail("Admin@Example.COM")).toBe("admin@example.com");
  });
});
