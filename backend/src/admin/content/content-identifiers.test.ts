import { describe, expect, it } from "vitest";

import {
  contentIdentifier,
  slugFromTitle,
  uniqueIdentifier,
} from "./content-identifiers.js";

describe("content identifiers", () => {
  it("creates a deterministic opaque identifier for Chinese-only titles", () => {
    const first = contentIdentifier("冷链运输服务");
    expect(first).toMatch(/^content-[a-f0-9]{8}$/);
    expect(contentIdentifier("冷链运输服务")).toBe(first);
  });

  it("keeps readable Latin words in identifiers and slugs", () => {
    expect(contentIdentifier("Air Freight")).toBe("air-freight");
    expect(slugFromTitle("Air Freight", "en")).toBe("air-freight");
    expect(slugFromTitle("Éurope Express", "en")).toBe("europe-express");
  });

  it("adds stable numeric suffixes until an identifier is unique", () => {
    expect(
      uniqueIdentifier(
        "Air Freight",
        new Set(["air-freight", "air-freight-2"]),
      ),
    ).toBe("air-freight-3");
    expect(uniqueIdentifier("服务", new Set())).toMatch(
      /^content-[a-f0-9]{8}$/,
    );
  });

  it("can make a previously generated slug unique without re-hashing it", () => {
    expect(
      uniqueIdentifier(
        "air-freight",
        new Set(["air-freight", "air-freight-2"]),
      ),
    ).toBe("air-freight-3");
  });

  it("keeps generated values inside the database limit", () => {
    expect(contentIdentifier("A".repeat(500))).toHaveLength(200);
    expect(slugFromTitle("A".repeat(500), "zh")).toHaveLength(200);
  });
});
