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

function insertLocalizedItem(
  tx: ContentTransaction,
  baseTable: typeof services,
  translationTable: typeof serviceTranslations,
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

      switch (seedItem.collection) {
        case "hero-slides":
          insertLocalizedItem(tx, heroSlides, heroSlideTranslations, seedItem, sortOrder, now);
          break;
        case "services":
          insertLocalizedItem(tx, services, serviceTranslations, seedItem, sortOrder, now);
          break;
        case "trade-lanes":
          insertLocalizedItem(tx, tradeLanes, tradeLaneTranslations, seedItem, sortOrder, now);
          break;
        case "cargo-types":
          insertLocalizedItem(tx, cargoTypes, cargoTypeTranslations, seedItem, sortOrder, now);
          break;
        case "pages":
          insertLocalizedItem(tx, pages, pageTranslations, seedItem, sortOrder, now);
          break;
        case "case-studies":
          insertLocalizedItem(tx, caseStudies, caseStudyTranslations, seedItem, sortOrder, now);
          break;
        case "articles":
          insertLocalizedItem(tx, articles, articleTranslations, seedItem, sortOrder, now);
          break;
        case "certificates":
          insertLocalizedItem(tx, certificates, certificateTranslations, seedItem, sortOrder, now);
          break;
        case "proof-metrics":
          insertLocalizedItem(tx, proofMetrics, proofMetricTranslations, seedItem, sortOrder, now);
          break;
        case "navigation-items":
          insertLocalizedItem(tx, navigationItems, navigationItemTranslations, seedItem, sortOrder, now);
          break;
      }
    }
  });
}
