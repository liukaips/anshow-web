import { describe, expect, it } from "vitest";

import {
  decideSeedUpgrade,
  fingerprintSeedRecord,
} from "./seed-upgrades.js";

describe("seed upgrades", () => {
  it("upgrades a current record that exactly matches the previous seed", () => {
    const previousSeed = { title: "Ocean freight", body: { version: 1 } };
    const current = { body: { version: 1 }, title: "Ocean freight" };
    const nextSeed = { title: "Ocean freight services", body: { version: 2 } };

    expect(decideSeedUpgrade({ current, previousSeed, nextSeed })).toBe("upgrade");
  });

  it("preserves a record changed since the previous seed", () => {
    expect(
      decideSeedUpgrade({
        current: { title: "Editorial ocean freight" },
        previousSeed: { title: "Ocean freight" },
        nextSeed: { title: "PPT ocean freight" },
      }),
    ).toBe("preserve");
  });

  it("archives an unchanged record absent from the next seed", () => {
    const previousSeed = { title: "Retired service" };

    expect(
      decideSeedUpgrade({
        current: { title: "Retired service" },
        previousSeed,
        nextSeed: null,
      }),
    ).toBe("archive");
  });

  it("inserts a missing record present in the next seed", () => {
    expect(
      decideSeedUpgrade({
        current: null,
        previousSeed: null,
        nextSeed: { title: "PPT service" },
      }),
    ).toBe("insert");
  });

  it("does nothing when neither current nor next seed exists", () => {
    expect(
      decideSeedUpgrade({ current: null, previousSeed: null, nextSeed: null }),
    ).toBe("noop");
  });

  it("fingerprints equivalent nested objects with different key order equally", () => {
    const first = {
      title: "Ocean freight",
      body: { version: 1, sections: [{ text: "Plan", type: "paragraph" }] },
    };
    const second = {
      body: { sections: [{ type: "paragraph", text: "Plan" }], version: 1 },
      title: "Ocean freight",
    };

    expect(fingerprintSeedRecord(first)).toBe(fingerprintSeedRecord(second));
  });

  it("keeps array order in fingerprints", () => {
    const first = { sections: ["Plan", "Book"] };
    const reordered = { sections: ["Book", "Plan"] };

    expect(fingerprintSeedRecord(first)).not.toBe(
      fingerprintSeedRecord(reordered),
    );
  });

  it("changes fingerprints when content changes", () => {
    expect(fingerprintSeedRecord({ title: "Ocean freight" })).not.toBe(
      fingerprintSeedRecord({ title: "Air freight" }),
    );
  });

  it("rejects unsupported values without exposing seed content", () => {
    expect(() =>
      fingerprintSeedRecord({ omitted: undefined } as unknown as {
        omitted: string;
      }),
    ).toThrow("Seed fingerprints require JSON values");
  });
});
