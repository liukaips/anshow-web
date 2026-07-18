import { createHash } from "node:crypto";

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

export type SeedUpgradeDecision =
  | "insert"
  | "upgrade"
  | "preserve"
  | "archive"
  | "noop";

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
  if (current === null) {
    return nextSeed === null ? "noop" : "insert";
  }

  if (
    previousSeed === null ||
    fingerprintSeedRecord(current) !== fingerprintSeedRecord(previousSeed)
  ) {
    return "preserve";
  }

  return nextSeed === null ? "archive" : "upgrade";
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
