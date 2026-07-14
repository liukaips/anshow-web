import { describe, expect, it } from "vitest";

import { parseCreateAdminArguments } from "./create-admin-arguments.js";

describe("create administrator arguments", () => {
  it("accepts an email with an optional flagged display name", () => {
    expect(parseCreateAdminArguments(["--", "admin@example.com"])).toEqual({
      email: "admin@example.com",
      name: "Administrator",
    });
    expect(
      parseCreateAdminArguments([
        "admin@example.com",
        "--name",
        "Ada Administrator",
      ]),
    ).toEqual({
      email: "admin@example.com",
      name: "Ada Administrator",
    });
  });

  it.each([
    ["a positional password", ["admin@example.com", "old-password"]],
    ["an unknown flag", ["admin@example.com", "--display-name", "Ada"]],
    ["a missing name value", ["admin@example.com", "--name"]],
    ["a flag-like name value", ["admin@example.com", "--name", "--other"]],
  ])("rejects %s", (_case, arguments_) => {
    expect(() => parseCreateAdminArguments(arguments_)).toThrow("Usage:");
  });
});
