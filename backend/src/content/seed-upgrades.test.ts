import { describe, expect, it } from "vitest";

import {
  buildSeedFingerprintInput,
  decideRevisionAwareSeedUpgrade,
  decideSeedUpgrade,
  fingerprintSeedRecord,
  type SeedFingerprintInput,
  type SeedFingerprintSource,
} from "./seed-upgrades.js";

function fingerprintInput(overrides: {
  base?: Partial<SeedFingerprintInput["base"]>;
  translation?: Partial<SeedFingerprintInput["translation"]>;
} = {}): SeedFingerprintInput {
  return {
    base: {
      sortOrder: 0,
      mediaId: null,
      processStageId: null,
      archived: false,
      verified: false,
      verificationSource: null,
      ...overrides.base,
    },
    translation: {
      status: "draft",
      scheduled: false,
      published: false,
      slug: "ocean-freight",
      title: "Ocean freight",
      summary: "Summary",
      body: "Body",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      altText: "Alt",
      ...overrides.translation,
    },
  };
}

function fingerprintSource(
  overrides: {
    base?: Partial<SeedFingerprintSource["base"]>;
    translation?: Partial<SeedFingerprintSource["translation"]>;
  } = {},
): SeedFingerprintSource {
  return {
    base: {
      sortOrder: 0,
      mediaId: null,
      processStageId: null,
      archivedAt: null,
      verifiedAt: null,
      verificationSource: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      ...overrides.base,
    },
    translation: {
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      slug: "ocean-freight",
      title: "Ocean freight",
      summary: "Summary",
      body: "Body",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      altText: "Alt",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      ...overrides.translation,
    },
  };
}

describe("seed upgrades", () => {
  it("upgrades a current record that exactly matches the previous seed", () => {
    const previousSeed = fingerprintInput();
    const current = fingerprintInput();
    const nextSeed = fingerprintInput({ translation: { title: "PPT ocean freight" } });

    expect(decideSeedUpgrade({ current, previousSeed, nextSeed })).toBe("upgrade");
  });

  it("preserves a record changed since the previous seed", () => {
    expect(
      decideSeedUpgrade({
        current: fingerprintInput({
          translation: { title: "Editorial ocean freight" },
        }),
        previousSeed: fingerprintInput(),
        nextSeed: fingerprintInput({
          translation: { title: "PPT ocean freight" },
        }),
      }),
    ).toBe("preserve");
  });

  it("archives an unchanged record absent from the next seed", () => {
    const previousSeed = fingerprintInput();

    expect(
      decideSeedUpgrade({
        current: fingerprintInput(),
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
        nextSeed: fingerprintInput(),
      }),
    ).toBe("insert");
  });

  it("does nothing when neither current nor next seed exists", () => {
    expect(
      decideSeedUpgrade({ current: null, previousSeed: null, nextSeed: null }),
    ).toBe("noop");
  });

  it("does not rewrite a current seed revision that still matches", () => {
    const current = fingerprintInput();

    expect(
      decideRevisionAwareSeedUpgrade({
        current,
        nextSeed: fingerprintInput(),
        revision: {
          seedVersion: 2,
          appliedFingerprint: fingerprintSeedRecord(current),
        },
        legacyFingerprint: null,
        currentSeedVersion: 2,
      }),
    ).toEqual({ decision: "noop", recordRevision: false });
  });

  it("preserves edits without advancing the current revision", () => {
    const applied = fingerprintInput();

    expect(
      decideRevisionAwareSeedUpgrade({
        current: fingerprintInput({ translation: { title: "Operator title" } }),
        nextSeed: fingerprintInput(),
        revision: {
          seedVersion: 2,
          appliedFingerprint: fingerprintSeedRecord(applied),
        },
        legacyFingerprint: null,
        currentSeedVersion: 2,
      }),
    ).toEqual({ decision: "preserve", recordRevision: false });
  });

  it("rejects catalog drift under an already-applied seed version", () => {
    const applied = fingerprintInput();

    expect(() =>
      decideRevisionAwareSeedUpgrade({
        current: applied,
        nextSeed: fingerprintInput({ translation: { title: "Changed title" } }),
        revision: {
          seedVersion: 2,
          appliedFingerprint: fingerprintSeedRecord(applied),
        },
        legacyFingerprint: null,
        currentSeedVersion: 2,
      }),
    ).toThrow("Seed version 2 catalog drift");
  });

  it("rejects equal-version drift before restoring a missing record", () => {
    const applied = fingerprintInput();

    expect(() =>
      decideRevisionAwareSeedUpgrade({
        current: null,
        nextSeed: fingerprintInput({ translation: { title: "Changed title" } }),
        revision: {
          seedVersion: 2,
          appliedFingerprint: fingerprintSeedRecord(applied),
        },
        legacyFingerprint: null,
        currentSeedVersion: 2,
      }),
    ).toThrow("Seed version 2 catalog drift");
  });

  it("advances an older matching revision without rewriting equal content", () => {
    const current = fingerprintInput();

    expect(
      decideRevisionAwareSeedUpgrade({
        current,
        nextSeed: fingerprintInput(),
        revision: {
          seedVersion: 1,
          appliedFingerprint: fingerprintSeedRecord(current),
        },
        legacyFingerprint: null,
        currentSeedVersion: 2,
      }),
    ).toEqual({ decision: "noop", recordRevision: true });
  });

  it("fingerprints a stable projection with a fixed SHA-256 vector", () => {
    expect(fingerprintSeedRecord(fingerprintInput())).toBe(
      "77e2e08d9f3ca466dd7bbdca9029755425dc0a0854e89d0c11621edd4e6a16ee",
    );
  });

  it("fingerprints equivalent nested objects with different key order equally", () => {
    const first = fingerprintInput();
    const second = fingerprintInput();
    const firstBody = { version: 1, sections: [{ text: "Plan", type: "paragraph" }] };
    const secondBody = { sections: [{ type: "paragraph", text: "Plan" }], version: 1 };
    first.translation.body = firstBody as unknown as string;
    second.translation.body = secondBody as unknown as string;

    expect(fingerprintSeedRecord(first)).toBe(fingerprintSeedRecord(second));
  });

  it("keeps array order in fingerprints", () => {
    const first = fingerprintInput();
    const reordered = fingerprintInput();
    first.translation.body = ["Plan", "Book"] as unknown as string;
    reordered.translation.body = ["Book", "Plan"] as unknown as string;

    expect(fingerprintSeedRecord(first)).not.toBe(fingerprintSeedRecord(reordered));
  });

  it("rejects cyclic values", () => {
    const input = fingerprintInput();
    const cyclicBody: { self?: unknown } = {};
    cyclicBody.self = cyclicBody;
    input.translation.body = cyclicBody as unknown as string;

    expect(() => fingerprintSeedRecord(input)).toThrow(
      "Seed fingerprint input cannot contain cycles",
    );
  });

  it("rejects sparse arrays", () => {
    const input = fingerprintInput();
    input.translation.body = Array(1) as unknown as string;

    expect(() => fingerprintSeedRecord(input)).toThrow(
      "Seed fingerprints do not accept sparse arrays",
    );
  });

  it("allows repeated non-cyclic shared references", () => {
    const input = fingerprintInput();
    const shared = { text: "Shared" };
    input.base.mediaId = shared as unknown as string;
    input.translation.body = shared as unknown as string;

    expect(() => fingerprintSeedRecord(input)).not.toThrow();
  });

  it.each([
    ["Date", new Date("2026-01-01T00:00:00.000Z"), "Seed fingerprints do not accept Date values"],
    ["NaN", Number.NaN, "Seed fingerprints require finite numbers"],
    ["Infinity", Number.POSITIVE_INFINITY, "Seed fingerprints require finite numbers"],
    ["bigint", 1n, "Seed fingerprints require JSON values"],
    ["function", () => undefined, "Seed fingerprints require JSON values"],
    ["symbol", Symbol("seed"), "Seed fingerprints require JSON values"],
    ["undefined", undefined, "Seed fingerprints require JSON values"],
    [
      "class instance",
      new (class SeedContent {})(),
      "Seed fingerprints require plain JSON objects",
    ],
  ])("rejects unsupported %s values", (_name, value, message) => {
    const input = fingerprintInput();
    input.translation.body = value as unknown as string;

    expect(() => fingerprintSeedRecord(input)).toThrow(message);
  });

  it("projects stable editable fields while excluding raw timestamps", () => {
    const first = buildSeedFingerprintInput(
      fingerprintSource({
        base: {
          archivedAt: new Date("2026-02-01T00:00:00.000Z"),
          verifiedAt: new Date("2026-02-02T00:00:00.000Z"),
        },
        translation: {
          scheduledAt: new Date("2026-02-03T00:00:00.000Z"),
          publishedAt: new Date("2026-02-04T00:00:00.000Z"),
        },
      }),
    );
    const second = buildSeedFingerprintInput(
      fingerprintSource({
        base: {
          archivedAt: new Date("2027-02-01T00:00:00.000Z"),
          verifiedAt: new Date("2027-02-02T00:00:00.000Z"),
          createdAt: new Date("2027-02-03T00:00:00.000Z"),
          updatedAt: new Date("2027-02-04T00:00:00.000Z"),
        },
        translation: {
          scheduledAt: new Date("2027-02-05T00:00:00.000Z"),
          publishedAt: new Date("2027-02-06T00:00:00.000Z"),
          createdAt: new Date("2027-02-07T00:00:00.000Z"),
          updatedAt: new Date("2027-02-08T00:00:00.000Z"),
        },
      }),
    );

    expect(second).toEqual(first);
    expect(fingerprintSeedRecord(second)).toBe(fingerprintSeedRecord(first));
  });

  it.each([
    ["sortOrder", (source: SeedFingerprintSource) => { source.base.sortOrder = 1; }],
    ["mediaId", (source: SeedFingerprintSource) => { source.base.mediaId = "media-1"; }],
    ["processStageId", (source: SeedFingerprintSource) => { source.base.processStageId = "transit"; }],
    ["archived", (source: SeedFingerprintSource) => { source.base.archivedAt = new Date(); }],
    ["verified", (source: SeedFingerprintSource) => { source.base.verifiedAt = new Date(); }],
    ["verificationSource", (source: SeedFingerprintSource) => { source.base.verificationSource = "review"; }],
    ["status", (source: SeedFingerprintSource) => { source.translation.status = "published"; }],
    ["scheduled", (source: SeedFingerprintSource) => { source.translation.scheduledAt = new Date(); }],
    ["published", (source: SeedFingerprintSource) => { source.translation.publishedAt = new Date(); }],
    ["slug", (source: SeedFingerprintSource) => { source.translation.slug = "ppt-ocean-freight"; }],
    ["title", (source: SeedFingerprintSource) => { source.translation.title = "PPT ocean freight"; }],
    ["summary", (source: SeedFingerprintSource) => { source.translation.summary = "PPT summary"; }],
    ["body", (source: SeedFingerprintSource) => { source.translation.body = "PPT body"; }],
    ["seoTitle", (source: SeedFingerprintSource) => { source.translation.seoTitle = "PPT SEO title"; }],
    ["seoDescription", (source: SeedFingerprintSource) => { source.translation.seoDescription = "PPT SEO description"; }],
    ["altText", (source: SeedFingerprintSource) => { source.translation.altText = "PPT alt text"; }],
  ])("preserves editorial changes to selected %s fields", (_field, change) => {
    const previousSeed = buildSeedFingerprintInput(fingerprintSource());
    const currentSource = fingerprintSource();
    change(currentSource);
    const current = buildSeedFingerprintInput(currentSource);

    expect(fingerprintSeedRecord(current)).not.toBe(
      fingerprintSeedRecord(previousSeed),
    );
    expect(
      decideSeedUpgrade({
        current,
        previousSeed,
        nextSeed: buildSeedFingerprintInput(fingerprintSource()),
      }),
    ).toBe("preserve");
  });
});
