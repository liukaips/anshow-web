import { describe, expect, it } from "vitest";

import { can } from "./permissions.js";

describe("permission guard", () => {
  it("defaults to deny", () => {
    expect(can([], "content.publish")).toBe(false);
  });

  it("allows an explicitly granted permission", () => {
    expect(can(["content.publish"], "content.publish")).toBe(true);
  });

  it("recognizes review and preview permissions as explicit capabilities", () => {
    expect(can(["content.submit"], "content.submit")).toBe(true);
    expect(can(["content.review"], "content.review")).toBe(true);
    expect(can(["preview.create"], "preview.create")).toBe(true);
    expect(can(["preview.share"], "preview.share")).toBe(true);
    expect(can(["preview.revoke"], "preview.revoke")).toBe(true);
  });
});
