import { describe, expect, it } from "vitest";

import { can } from "./permissions.js";

describe("permission guard", () => {
  it("defaults to deny", () => {
    expect(can([], "content.publish")).toBe(false);
  });

  it("allows an explicitly granted permission", () => {
    expect(can(["content.publish"], "content.publish")).toBe(true);
  });
});
