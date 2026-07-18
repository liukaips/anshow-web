import { createHash } from "node:crypto";

export type SeedRecord = {
  readonly [key: string]: SeedValue;
};

export type SeedValue =
  | null
  | boolean
  | number
  | string
  | readonly SeedValue[]
  | SeedRecord;

export type UpgradeInput = {
  current: SeedRecord | null;
  previousSeed: SeedRecord | null;
  nextSeed: SeedRecord | null;
};

export type SeedUpgradeDecision =
  | "insert"
  | "upgrade"
  | "preserve"
  | "archive"
  | "noop";

export function fingerprintSeedRecord(record: SeedRecord): string {
  return createHash("sha256").update(canonicalJson(record)).digest("hex");
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Seed fingerprints require finite numbers");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (typeof value !== "object") {
    throw new TypeError("Seed fingerprints require JSON values");
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError("Seed fingerprints require plain JSON objects");
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
