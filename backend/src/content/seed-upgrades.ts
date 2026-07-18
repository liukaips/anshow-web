import { createHash } from "node:crypto";

import type { SeedItem } from "./seed-catalog.js";
import { LOCALES, type Locale } from "./types.js";

type TimestampValue = Date | number | string | null | undefined;

export type SeedFingerprintInput = {
  base: {
    sortOrder: number;
    mediaId: string | null;
    processStageId: string | null;
    archived: boolean;
    verified: boolean;
    verificationSource: string | null;
  };
  translation: {
    status: string;
    scheduled: boolean;
    published: boolean;
    slug: string;
    title: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    altText: string;
  };
};

export type SeedFingerprintSource = {
  base: {
    sortOrder: number;
    mediaId: string | null;
    processStageId: string | null;
    archivedAt: TimestampValue;
    verifiedAt: TimestampValue;
    verificationSource: string | null;
    createdAt?: TimestampValue;
    updatedAt?: TimestampValue;
  };
  translation: {
    status: string;
    scheduledAt: TimestampValue;
    publishedAt: TimestampValue;
    slug: string;
    title: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    altText: string;
    createdAt?: TimestampValue;
    updatedAt?: TimestampValue;
  };
};

export type UpgradeInput = {
  current: SeedFingerprintInput | null;
  previousSeed: SeedFingerprintInput | null;
  nextSeed: SeedFingerprintInput | null;
};

export type FingerprintUpgradeInput = {
  current: SeedFingerprintInput | null;
  previousSeedFingerprint: string | null;
  nextSeed: SeedFingerprintInput | null;
};

export type RevisionAwareUpgradeInput = {
  current: SeedFingerprintInput | null;
  nextSeed: SeedFingerprintInput | null;
  revision:
    | { seedVersion: number; appliedFingerprint: string }
    | null
    | undefined;
  legacyFingerprint: string | null | undefined;
  currentSeedVersion: number;
};

export type SeedUpgradeDecision =
  | "insert"
  | "upgrade"
  | "preserve"
  | "archive"
  | "noop";

export type RevisionAwareUpgradeDecision = {
  decision: SeedUpgradeDecision;
  recordRevision: boolean;
};

export type CatalogSeedFingerprintInput = {
  seedItem: SeedItem;
  sortOrder: number;
  locale: Locale;
  mediaId: string | null;
};

export function buildSeedFingerprintInput(
  source: SeedFingerprintSource,
): SeedFingerprintInput {
  return {
    base: {
      sortOrder: source.base.sortOrder,
      mediaId: source.base.mediaId,
      processStageId: source.base.processStageId,
      archived: source.base.archivedAt != null,
      verified: source.base.verifiedAt != null,
      verificationSource: source.base.verificationSource,
    },
    translation: {
      status: source.translation.status,
      scheduled: source.translation.scheduledAt != null,
      published: source.translation.publishedAt != null,
      slug: source.translation.slug,
      title: source.translation.title,
      summary: source.translation.summary,
      body: source.translation.body,
      seoTitle: source.translation.seoTitle,
      seoDescription: source.translation.seoDescription,
      altText: source.translation.altText,
    },
  };
}

export function buildCatalogSeedFingerprintInput({
  seedItem,
  sortOrder,
  locale,
  mediaId,
}: CatalogSeedFingerprintInput): SeedFingerprintInput {
  return buildSeedFingerprintInput({
    base: {
      sortOrder,
      mediaId,
      processStageId: seedItem.processStageId ?? null,
      archivedAt: null,
      verifiedAt: null,
      verificationSource: null,
    },
    translation: {
      status: seedItem.publish ? "published" : "draft",
      scheduledAt: null,
      publishedAt: seedItem.publish ? 0 : null,
      ...seedItem.translations[locale],
    },
  });
}

export function computeSeedCatalogDigest(catalog: readonly SeedItem[]): string {
  const collectionPositions = new Map<string, number>();
  const entries: string[] = [];

  for (const seedItem of catalog) {
    const sortOrder = collectionPositions.get(seedItem.collection) ?? 0;
    collectionPositions.set(seedItem.collection, sortOrder + 1);
    for (const locale of LOCALES) {
      const fingerprint = fingerprintSeedRecord(
        buildCatalogSeedFingerprintInput({
          seedItem,
          sortOrder,
          locale,
          mediaId: seedItem.desiredMediaId ?? null,
        }),
      );
      entries.push(
        `${seedItem.collection}/${seedItem.code}/${locale}:${fingerprint}`,
      );
    }
  }

  return createHash("sha256")
    .update(canonicalJson(entries, new WeakSet<object>()))
    .digest("hex");
}

export function fingerprintSeedRecord(input: SeedFingerprintInput): string {
  return createHash("sha256")
    .update(canonicalJson(input, new WeakSet<object>()))
    .digest("hex");
}

export function decideSeedUpgrade({
  current,
  previousSeed,
  nextSeed,
}: UpgradeInput): SeedUpgradeDecision {
  return decideSeedUpgradeFromFingerprint({
    current,
    previousSeedFingerprint:
      previousSeed === null ? null : fingerprintSeedRecord(previousSeed),
    nextSeed,
  });
}

export function decideSeedUpgradeFromFingerprint({
  current,
  previousSeedFingerprint,
  nextSeed,
}: FingerprintUpgradeInput): SeedUpgradeDecision {
  if (current === null) {
    return nextSeed === null ? "noop" : "insert";
  }

  const currentFingerprint = fingerprintSeedRecord(current);
  if (
    previousSeedFingerprint === null ||
    currentFingerprint !== previousSeedFingerprint
  ) {
    return "preserve";
  }

  if (nextSeed === null) {
    return current.base.archived ? "noop" : "archive";
  }

  return currentFingerprint === fingerprintSeedRecord(nextSeed)
    ? "noop"
    : "upgrade";
}

export function decideRevisionAwareSeedUpgrade({
  current,
  nextSeed,
  revision,
  legacyFingerprint,
  currentSeedVersion,
}: RevisionAwareUpgradeInput): RevisionAwareUpgradeDecision {
  if (
    revision?.seedVersion === currentSeedVersion &&
    nextSeed !== null &&
    revision.appliedFingerprint !== fingerprintSeedRecord(nextSeed)
  ) {
    throw new Error(
      `Seed version ${currentSeedVersion} catalog drift: applied fingerprint differs from the intended catalog fingerprint`,
    );
  }

  if (current === null) {
    return {
      decision: nextSeed === null ? "noop" : "insert",
      recordRevision: nextSeed !== null,
    };
  }

  const currentFingerprint = fingerprintSeedRecord(current);
  if (revision?.seedVersion === currentSeedVersion) {
    return {
      decision:
        currentFingerprint === revision.appliedFingerprint ? "noop" : "preserve",
      recordRevision: false,
    };
  }
  if (revision !== null && revision !== undefined) {
    if (revision.seedVersion > currentSeedVersion) {
      return { decision: "preserve", recordRevision: false };
    }
  } else if (
    nextSeed !== null &&
    currentFingerprint === fingerprintSeedRecord(nextSeed)
  ) {
    return { decision: "noop", recordRevision: true };
  }

  const decision = decideSeedUpgradeFromFingerprint({
    current,
    previousSeedFingerprint:
      revision?.appliedFingerprint ?? legacyFingerprint ?? null,
    nextSeed,
  });
  return {
    decision,
    recordRevision:
      decision === "insert" ||
      decision === "upgrade" ||
      (decision === "noop" &&
        revision !== null &&
        revision !== undefined &&
        revision.seedVersion < currentSeedVersion),
  };
}

function canonicalJson(value: unknown, activeReferences: WeakSet<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Seed fingerprints require finite numbers");
    }
    return JSON.stringify(value);
  }

  if (
    typeof value === "undefined" ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    throw new TypeError("Seed fingerprints require JSON values");
  }

  if (value instanceof Date) {
    throw new TypeError("Seed fingerprints do not accept Date values");
  }

  if (Array.isArray(value)) {
    return canonicalizeArray(value, activeReferences);
  }

  if (typeof value !== "object") {
    throw new TypeError("Seed fingerprints require JSON values");
  }

  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new TypeError("Seed fingerprints require plain JSON objects");
  }

  return canonicalizeObject(value, activeReferences);
}

function canonicalizeArray(
  value: readonly unknown[],
  activeReferences: WeakSet<object>,
): string {
  if (activeReferences.has(value)) {
    throw new TypeError("Seed fingerprint input cannot contain cycles");
  }

  activeReferences.add(value);
  try {
    const values: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) {
        throw new TypeError("Seed fingerprints do not accept sparse arrays");
      }
      values.push(canonicalJson(value[index], activeReferences));
    }
    return `[${values.join(",")}]`;
  } finally {
    activeReferences.delete(value);
  }
}

function canonicalizeObject(
  value: object,
  activeReferences: WeakSet<object>,
): string {
  if (activeReferences.has(value)) {
    throw new TypeError("Seed fingerprint input cannot contain cycles");
  }

  activeReferences.add(value);
  try {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(record[key], activeReferences)}`,
      )
      .join(",")}}`;
  } finally {
    activeReferences.delete(value);
  }
}
