import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import {
  articles,
  articleTranslations,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  certificates,
  certificateTranslations,
  contentSeedRevisions,
  heroSlides,
  heroSlideTranslations,
  mediaAssets,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/content.js";
import {
  legacySeedFingerprint,
  legacySeedFingerprints,
  type LegacySeedKey,
} from "./legacy-seed-fingerprints.js";
import {
  currentContentSeedRevision,
  seedCatalog,
  type ContentSeedRevision,
  type SeedCollection,
  type SeedItem,
} from "./seed-catalog.js";
import {
  buildCatalogSeedFingerprintInput,
  buildSeedFingerprintInput,
  computeSeedCatalogDigest,
  decideRevisionAwareSeedUpgrade,
  fingerprintSeedRecord,
  type SeedFingerprintInput,
  type SeedUpgradeDecision,
} from "./seed-upgrades.js";
import { LOCALES, type Locale } from "./types.js";

type ContentTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

type SeedCollectionRoute =
  | { baseTable: typeof articles; translationTable: typeof articleTranslations }
  | { baseTable: typeof cargoTypes; translationTable: typeof cargoTypeTranslations }
  | { baseTable: typeof caseStudies; translationTable: typeof caseStudyTranslations }
  | { baseTable: typeof certificates; translationTable: typeof certificateTranslations }
  | { baseTable: typeof heroSlides; translationTable: typeof heroSlideTranslations }
  | { baseTable: typeof navigationItems; translationTable: typeof navigationItemTranslations }
  | { baseTable: typeof pages; translationTable: typeof pageTranslations }
  | { baseTable: typeof proofMetrics; translationTable: typeof proofMetricTranslations }
  | { baseTable: typeof services; translationTable: typeof serviceTranslations }
  | { baseTable: typeof tradeLanes; translationTable: typeof tradeLaneTranslations };

type LocalizedBaseTable = SeedCollectionRoute["baseTable"];
type LocalizedTranslationTable = SeedCollectionRoute["translationTable"];
type LocalizedBaseRow = typeof articles.$inferSelect;
type LocalizedTranslationRow = typeof articleTranslations.$inferSelect;
type SeedRevisionRow = typeof contentSeedRevisions.$inferSelect;

/** Counts are per locale decision; one base archive can contribute three. */
export type SeedResult = {
  inserted: number;
  upgraded: number;
  archived: number;
  preserved: Array<{
    collection: SeedCollection;
    code: string;
    locale: Locale;
  }>;
};

type TranslationDecision = {
  locale: Locale;
  decision: SeedUpgradeDecision;
  recordRevision: boolean;
  intendedFingerprint: string | null;
};

export type ContentSeeder = (
  db: AppDatabase,
  options?: { now?: Date },
) => SeedResult;

export type ContentSeederConfig = {
  catalog: readonly SeedItem[];
  revision: ContentSeedRevision;
};

export const seedCollectionRoutes = {
  "hero-slides": {
    baseTable: heroSlides,
    translationTable: heroSlideTranslations,
  },
  services: { baseTable: services, translationTable: serviceTranslations },
  "trade-lanes": {
    baseTable: tradeLanes,
    translationTable: tradeLaneTranslations,
  },
  "cargo-types": {
    baseTable: cargoTypes,
    translationTable: cargoTypeTranslations,
  },
  pages: { baseTable: pages, translationTable: pageTranslations },
  "case-studies": {
    baseTable: caseStudies,
    translationTable: caseStudyTranslations,
  },
  articles: { baseTable: articles, translationTable: articleTranslations },
  certificates: {
    baseTable: certificates,
    translationTable: certificateTranslations,
  },
  "proof-metrics": {
    baseTable: proofMetrics,
    translationTable: proofMetricTranslations,
  },
  "navigation-items": {
    baseTable: navigationItems,
    translationTable: navigationItemTranslations,
  },
} satisfies Record<SeedCollection, SeedCollectionRoute>;

function readBase(
  tx: ContentTransaction,
  baseTable: LocalizedBaseTable,
  code: string,
): LocalizedBaseRow | undefined {
  return tx
    .select()
    .from(baseTable as typeof articles)
    .where(eq((baseTable as typeof articles).id, code))
    .get();
}

function readTranslation(
  tx: ContentTransaction,
  translationTable: LocalizedTranslationTable,
  code: string,
  locale: Locale,
): LocalizedTranslationRow | undefined {
  const table = translationTable as typeof articleTranslations;
  return tx
    .select()
    .from(table)
    .where(and(eq(table.ownerId, code), eq(table.locale, locale)))
    .get();
}

function readRevision(
  tx: ContentTransaction,
  collection: SeedCollection,
  code: string,
  locale: Locale,
): SeedRevisionRow | undefined {
  return tx
    .select()
    .from(contentSeedRevisions)
    .where(
      and(
        eq(contentSeedRevisions.collection, collection),
        eq(contentSeedRevisions.ownerId, code),
        eq(contentSeedRevisions.locale, locale),
      ),
    )
    .get();
}

function currentFingerprintInput(
  base: LocalizedBaseRow | undefined,
  translation: LocalizedTranslationRow | undefined,
): SeedFingerprintInput | null {
  if (base === undefined || translation === undefined) return null;
  return buildSeedFingerprintInput({ base, translation });
}

function resolveCatalogMediaId(
  tx: ContentTransaction,
  desiredMediaId: string | undefined,
): string | null {
  if (desiredMediaId === undefined) return null;
  return (
    tx
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, desiredMediaId))
      .get()?.id ?? null
  );
}

function insertBase(
  tx: ContentTransaction,
  baseTable: LocalizedBaseTable,
  seedItem: SeedItem,
  sortOrder: number,
  mediaId: string | null,
  now: Date,
) {
  tx.insert(baseTable as typeof articles)
    .values({
      id: seedItem.code,
      code: seedItem.code,
      sortOrder,
      mediaId,
      processStageId: seedItem.processStageId ?? null,
      archivedAt: null,
      verifiedAt: null,
      verificationSource: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function insertTranslation(
  tx: ContentTransaction,
  translationTable: LocalizedTranslationTable,
  seedItem: SeedItem,
  locale: Locale,
  now: Date,
) {
  tx.insert(translationTable as typeof articleTranslations)
    .values({
      ownerId: seedItem.code,
      locale,
      status: seedItem.publish ? "published" : "draft",
      scheduledAt: null,
      publishedAt: seedItem.publish ? now : null,
      ...seedItem.translations[locale],
      updatedAt: now,
    })
    .run();
}

function upgradeBase(
  tx: ContentTransaction,
  baseTable: LocalizedBaseTable,
  seedItem: SeedItem,
  sortOrder: number,
  mediaId: string | null,
  now: Date,
) {
  const table = baseTable as typeof articles;
  tx.update(table)
    .set({
      sortOrder,
      mediaId,
      processStageId: seedItem.processStageId ?? null,
      archivedAt: null,
      verifiedAt: null,
      verificationSource: null,
      updatedAt: now,
    })
    .where(eq(table.id, seedItem.code))
    .run();
}

function upgradeTranslation(
  tx: ContentTransaction,
  translationTable: LocalizedTranslationTable,
  seedItem: SeedItem,
  locale: Locale,
  now: Date,
) {
  const table = translationTable as typeof articleTranslations;
  tx.update(table)
    .set({
      status: seedItem.publish ? "published" : "draft",
      scheduledAt: null,
      publishedAt: seedItem.publish ? now : null,
      ...seedItem.translations[locale],
      updatedAt: now,
    })
    .where(and(eq(table.ownerId, seedItem.code), eq(table.locale, locale)))
    .run();
}

function writeRevision(
  tx: ContentTransaction,
  seedVersion: number,
  collection: SeedCollection,
  code: string,
  locale: Locale,
  appliedFingerprint: string,
  now: Date,
) {
  tx.insert(contentSeedRevisions)
    .values({
      collection,
      ownerId: code,
      locale,
      seedVersion,
      appliedFingerprint,
      appliedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        contentSeedRevisions.collection,
        contentSeedRevisions.ownerId,
        contentSeedRevisions.locale,
      ],
      set: {
        seedVersion,
        appliedFingerprint,
        appliedAt: now,
      },
    })
    .run();
}

function runContentSeeder(
  db: AppDatabase,
  catalog: readonly SeedItem[],
  seedVersion: number,
  options: { now?: Date } = {},
): SeedResult {
  const now = options.now ?? new Date();
  const collectionPositions = new Map<SeedCollection, number>();

  return db.transaction((tx) => {
    const result: SeedResult = {
      inserted: 0,
      upgraded: 0,
      archived: 0,
      preserved: [],
    };
    const currentKeys = new Set<string>();

    for (const seedItem of catalog) {
      const sortOrder = collectionPositions.get(seedItem.collection) ?? 0;
      collectionPositions.set(seedItem.collection, sortOrder + 1);
      currentKeys.add(`${seedItem.collection}/${seedItem.code}`);

      const route = seedCollectionRoutes[seedItem.collection];
      const existingBase = readBase(tx, route.baseTable, seedItem.code);
      const mediaId = resolveCatalogMediaId(tx, seedItem.desiredMediaId);
      const decisions = LOCALES.map((locale): TranslationDecision => {
        const current = currentFingerprintInput(
          existingBase,
          readTranslation(tx, route.translationTable, seedItem.code, locale),
        );
        const nextSeed = buildCatalogSeedFingerprintInput({
          seedItem,
          sortOrder,
          locale,
          mediaId,
        });
        return {
          locale,
          ...decideRevisionAwareSeedUpgrade({
            current,
            nextSeed,
            revision: readRevision(
              tx,
              seedItem.collection,
              seedItem.code,
              locale,
            ),
            legacyFingerprint: legacySeedFingerprint(
              seedItem.collection,
              seedItem.code,
              locale,
            ),
            currentSeedVersion: seedVersion,
          }),
          intendedFingerprint: fingerprintSeedRecord(nextSeed),
        };
      });

      if (existingBase === undefined) {
        insertBase(tx, route.baseTable, seedItem, sortOrder, mediaId, now);
      } else if (decisions.some(({ decision }) => decision === "upgrade")) {
        upgradeBase(tx, route.baseTable, seedItem, sortOrder, mediaId, now);
      }

      for (const {
        locale,
        decision,
        recordRevision,
        intendedFingerprint,
      } of decisions) {
        if (decision === "insert") {
          insertTranslation(tx, route.translationTable, seedItem, locale, now);
          result.inserted += 1;
        } else if (decision === "upgrade") {
          upgradeTranslation(tx, route.translationTable, seedItem, locale, now);
          result.upgraded += 1;
        } else if (decision === "preserve") {
          result.preserved.push({
            collection: seedItem.collection,
            code: seedItem.code,
            locale,
          });
        }

        if (recordRevision) {
          if (intendedFingerprint === null) {
            throw new Error(
              `Missing intended seed fingerprint for ${seedItem.collection}/${seedItem.code}/${locale}`,
            );
          }
          writeRevision(
            tx,
            seedVersion,
            seedItem.collection,
            seedItem.code,
            locale,
            intendedFingerprint,
            now,
          );
        }
      }
    }

    for (const key of Object.keys(legacySeedFingerprints) as LegacySeedKey[]) {
      if (currentKeys.has(key)) continue;
      const separator = key.indexOf("/");
      const collection = key.slice(0, separator) as SeedCollection;
      const code = key.slice(separator + 1);
      const route = seedCollectionRoutes[collection];
      const base = readBase(tx, route.baseTable, code);
      if (base === undefined) continue;

      const decisions = LOCALES.map((locale): TranslationDecision => {
        const current = currentFingerprintInput(
          base,
          readTranslation(tx, route.translationTable, code, locale),
        );
        const upgradeDecision = decideRevisionAwareSeedUpgrade({
          current,
          nextSeed: null,
          revision: readRevision(tx, collection, code, locale),
          legacyFingerprint: legacySeedFingerprint(
            collection,
            code,
            locale,
          ),
          currentSeedVersion: seedVersion,
        });
        return {
          locale,
          ...upgradeDecision,
          intendedFingerprint:
            upgradeDecision.decision === "archive" && current !== null
              ? fingerprintSeedRecord({
                  ...current,
                  base: { ...current.base, archived: true },
                })
              : null,
        };
      });
      const shouldArchive = decisions.every(
        ({ decision }) => decision === "archive",
      );

      if (shouldArchive) {
        const table = route.baseTable as typeof articles;
        tx.update(table)
          .set({ archivedAt: now, updatedAt: now })
          .where(eq(table.id, code))
          .run();
        for (const { locale, intendedFingerprint } of decisions) {
          if (intendedFingerprint === null) {
            throw new Error(
              `Missing intended archive fingerprint for ${collection}/${code}/${locale}`,
            );
          }
          result.archived += 1;
          writeRevision(
            tx,
            seedVersion,
            collection,
            code,
            locale,
            intendedFingerprint,
            now,
          );
        }
      } else {
        for (const { locale, decision } of decisions) {
          if (decision === "preserve") {
            result.preserved.push({ collection, code, locale });
          }
        }
      }
    }

    return result;
  });
}

export function createContentSeeder({
  catalog,
  revision,
}: ContentSeederConfig): ContentSeeder {
  const version = revision.version;
  const expectedCatalogDigest = revision.expectedCatalogDigest;
  const revisionSnapshot: ContentSeedRevision = {
    version,
    expectedCatalogDigest,
  };
  assertContentSeedContract(catalog, revisionSnapshot);

  return (db, options = {}) => {
    assertContentSeedContract(catalog, revisionSnapshot);
    return runContentSeeder(db, catalog, version, options);
  };
}

function assertContentSeedContract(
  catalog: readonly SeedItem[],
  revision: ContentSeedRevision,
) {
  if (!Number.isSafeInteger(revision.version) || revision.version < 1) {
    throw new Error("Seed version must be a positive safe integer");
  }
  const actualCatalogDigest = computeSeedCatalogDigest(catalog);
  if (actualCatalogDigest !== revision.expectedCatalogDigest) {
    throw new Error(
      `Seed catalog digest mismatch for version ${revision.version}: expected ${revision.expectedCatalogDigest}, received ${actualCatalogDigest}`,
    );
  }
}

const currentContentSeeder = createContentSeeder({
  catalog: seedCatalog,
  revision: currentContentSeedRevision,
});

export function seedPublicContent(
  db: AppDatabase,
  options: { now?: Date } = {},
): SeedResult {
  return currentContentSeeder(db, options);
}
