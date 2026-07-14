import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  articles,
  articleTranslations,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  certificates,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  partners,
  proofMetrics,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/index.js";
import { seedCatalog, seedPublicContent } from "./seed.js";
import { LOCALES } from "./types.js";

const SEEDED_AT = new Date("2026-07-14T12:00:00.000Z");

describe("public content seed", () => {
  it("contains the complete approved catalog in all three locales", () => {
    const collectionCounts = Object.fromEntries(
      [
        "hero-slides",
        "services",
        "trade-lanes",
        "cargo-types",
        "pages",
        "case-studies",
        "articles",
        "navigation-items",
      ].map((collection) => [
        collection,
        seedCatalog.filter((item) => item.collection === collection).length,
      ]),
    );

    expect(collectionCounts).toEqual({
      "hero-slides": 4,
      services: 7,
      "trade-lanes": 4,
      "cargo-types": 4,
      pages: 7,
      "case-studies": 3,
      articles: 3,
      "navigation-items": 9,
    });

    for (const item of seedCatalog) {
      for (const locale of LOCALES) {
        const copy = item.translations[locale];
        expect(copy.title, `${item.code}/${locale} title`).not.toBe("");
        expect(copy.slug, `${item.code}/${locale} slug`).not.toBe("");
        expect(copy.summary, `${item.code}/${locale} summary`).not.toBe("");
        expect(copy.body, `${item.code}/${locale} body`).not.toBe("");
        expect(copy.seoTitle, `${item.code}/${locale} SEO title`).not.toBe("");
        expect(
          copy.seoDescription,
          `${item.code}/${locale} SEO description`,
        ).not.toBe("");
        expect(copy.altText, `${item.code}/${locale} alt text`).not.toBe("");
      }
    }
  });

  it("inserts base records and translations idempotently", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });

      const tableCounts = [
        [heroSlides, 4],
        [heroSlideTranslations, 12],
        [services, 7],
        [serviceTranslations, 21],
        [tradeLanes, 4],
        [tradeLaneTranslations, 12],
        [cargoTypes, 4],
        [cargoTypeTranslations, 12],
        [pages, 7],
        [pageTranslations, 21],
        [caseStudies, 3],
        [caseStudyTranslations, 9],
        [articles, 3],
        [articleTranslations, 9],
        [navigationItems, 9],
        [navigationItemTranslations, 27],
      ] as const;

      for (const [table, expected] of tableCounts) {
        expect(
          testDatabase.db.select({ value: count() }).from(table).get()?.value,
        ).toBe(expected);
      }
    } finally {
      testDatabase.close();
    }
  });

  it("publishes normal content and keeps representative cases unconfigured", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });

      const publishedServices = testDatabase.db
        .select({
          status: serviceTranslations.status,
          publishedAt: serviceTranslations.publishedAt,
        })
        .from(serviceTranslations)
        .all();
      expect(
        publishedServices.every(
          (row) =>
            row.status === "published" &&
            row.publishedAt?.getTime() === SEEDED_AT.getTime(),
        ),
      ).toBe(true);
      expect(
        testDatabase.db
          .select({
            status: caseStudyTranslations.status,
            scheduledAt: caseStudyTranslations.scheduledAt,
            publishedAt: caseStudyTranslations.publishedAt,
          })
          .from(caseStudyTranslations)
          .where(eq(caseStudyTranslations.status, "draft"))
          .all(),
      ).toEqual(
        Array.from({ length: 9 }, () => ({
          status: "draft",
          scheduledAt: null,
          publishedAt: null,
        })),
      );
      expect(testDatabase.db.select().from(partners).all()).toEqual([]);
      expect(testDatabase.db.select().from(certificates).all()).toEqual([]);
      expect(testDatabase.db.select().from(proofMetrics).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });
});
