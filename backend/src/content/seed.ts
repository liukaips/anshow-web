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
  heroSlides,
  heroSlideTranslations,
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
  seedCatalog,
  type SeedCollection,
  type SeedItem,
} from "./seed-catalog.js";
import { LOCALES } from "./types.js";

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

function insertLocalizedItem(
  tx: ContentTransaction,
  baseTable: LocalizedBaseTable,
  translationTable: LocalizedTranslationTable,
  seedItem: SeedItem,
  sortOrder: number,
  now: Date,
) {
  tx.insert(baseTable)
    .values({
      id: seedItem.code,
      code: seedItem.code,
      sortOrder,
      processStageId: seedItem.processStageId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: baseTable.id })
    .run();

  for (const locale of LOCALES) {
    const copy = seedItem.translations[locale];
    tx.insert(translationTable)
      .values({
        ownerId: seedItem.code,
        locale,
        status: seedItem.publish ? "published" : "draft",
        scheduledAt: null,
        publishedAt: seedItem.publish ? now : null,
        ...copy,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [translationTable.ownerId, translationTable.locale],
      })
      .run();
  }
}

export function seedPublicContent(
  db: AppDatabase,
  options: { now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const collectionPositions = new Map<SeedCollection, number>();

  db.transaction((tx) => {
    for (const seedItem of seedCatalog) {
      const sortOrder = collectionPositions.get(seedItem.collection) ?? 0;
      collectionPositions.set(seedItem.collection, sortOrder + 1);

      const route = seedCollectionRoutes[seedItem.collection];
      insertLocalizedItem(
        tx,
        route.baseTable,
        route.translationTable,
        seedItem,
        sortOrder,
        now,
      );
    }
  });
}
