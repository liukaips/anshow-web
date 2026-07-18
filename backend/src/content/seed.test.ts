import { and, count, eq } from "drizzle-orm";
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
  certificateTranslations,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  partners,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/index.js";
import { seedCatalog } from "./seed-catalog.js";
import { seedPublicContent } from "./seed.js";
import { structuredContentBodySchema } from "./structured-body.js";
import { LOCALES } from "./types.js";

const SEEDED_AT = new Date("2026-07-14T12:00:00.000Z");

const EXPECTED_CODES = {
  "hero-slides": ["ocean", "air", "rail", "road"],
  services: [
    "ocean-freight",
    "air-freight",
    "rail-freight",
    "road-freight",
    "warehousing",
    "customs-origin",
    "insurance-solutions",
  ],
  "trade-lanes": [
    "china-russia",
    "china-europe",
    "central-asia",
    "global-network",
  ],
  "cargo-types": [
    "dangerous-goods",
    "oversized-cargo",
    "temperature-controlled",
    "complex-projects",
  ],
  pages: ["about", "network", "contact", "privacy", "terms", "cookies", "not-found"],
  "case-studies": [
    "un1263-hamburg",
    "un3265-india",
    "un3480-los-angeles",
    "injection-machine-turkey",
    "excavators-tir-moscow",
    "auto-parts-rail-russia",
    "electronics-air-munich",
    "semiconductor-import-clearance",
  ],
  articles: ["enquiry-preparation", "mode-selection", "document-readiness"],
  certificates: ["iata", "nvocc", "wca", "jctrans"],
  "proof-metrics": [
    "founded-2012",
    "exception-response",
    "multilingual-support",
    "transparent-pricing",
  ],
  "navigation-items": [
    "home",
    "services",
    "network",
    "about",
    "insights",
    "contact",
    "privacy",
    "terms",
    "cookies",
  ],
} as const;

function structuredBody(itemCode: string, locale: string, body: string) {
  return structuredContentBodySchema.parse(JSON.parse(body), {
    error: (issue) => `${itemCode}/${locale}: ${issue.message}`,
  });
}

function canonicalFacts(body: string) {
  const parsed = structuredContentBodySchema.parse(JSON.parse(body));
  const factList = parsed.sections.find((section) => section.type === "fact-list");
  expect(factList, "case body must contain a fact-list").toBeDefined();
  if (!factList || factList.type !== "fact-list") return [];
  return factList.items.map(({ key, value }) => [key, value]);
}

describe("public content seed", () => {
  it("contains the complete approved catalog in all three locales", () => {
    expect(seedCatalog).toHaveLength(54);
    for (const [collection, codes] of Object.entries(EXPECTED_CODES)) {
      expect(
        seedCatalog
          .filter((item) => item.collection === collection)
          .map((item) => item.code),
      ).toEqual(codes);
    }

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
        expect(() => structuredBody(item.code, locale, copy.body)).not.toThrow();
      }
    }

    expect(
      seedCatalog.find((item) => item.collection === "hero-slides" && item.code === "air")
        ?.desiredMediaId,
    ).toBe("hero-air");
    expect(
      seedCatalog.find((item) => item.collection === "hero-slides" && item.code === "rail")
        ?.desiredMediaId,
    ).toBe("hero-rail");
  });

  it("publishes the exact representative cases with locale-invariant facts", () => {
    const cases = seedCatalog.filter((item) => item.collection === "case-studies");

    expect(cases.every((item) => item.publish)).toBe(true);
    expect(cases.map((item) => item.desiredMediaId)).toEqual(
      EXPECTED_CODES["case-studies"].map((code) => `case-${code}`),
    );
    for (const item of cases) {
      const enFacts = canonicalFacts(item.translations.en.body);
      expect(enFacts.length).toBeGreaterThan(0);
      expect(canonicalFacts(item.translations.zh.body)).toEqual(enFacts);
      expect(canonicalFacts(item.translations.ru.body)).toEqual(enFacts);
    }
  });

  it("keeps high-risk project facts in structured case data", () => {
    const caseFacts = Object.fromEntries(
      seedCatalog
        .filter((item) => item.collection === "case-studies")
        .map((item) => [item.code, Object.fromEntries(canonicalFacts(item.translations.en.body))]),
    );

    expect(caseFacts).toMatchObject({
      "un1263-hamburg": { unNumber: "UN1263", hazardClass: "3", weight: "12", duration: "28" },
      "un3265-india": { unNumber: "UN3265", hazardClass: "8", quantity: "800", clearanceDuration: "3" },
      "un3480-los-angeles": { unNumber: "UN3480", weight: "5", duration: "14", timeSaved: "7", costDifference: "8" },
      "injection-machine-turkey": { dimensions: "11.8 x 2.6 x 3.2", weight: "28", equipment: "40-foot flat rack" },
      "excavators-tir-moscow": { distance: "8600", duration: "15" },
      "auto-parts-rail-russia": { duration: "18-22", projectCostDifference: "60" },
      "electronics-air-munich": { weight: "3", duration: "42" },
      "semiconductor-import-clearance": { resolutionDuration: "5" },
    });
  });

  it("contains no prohibited absolute claims in published copy", () => {
    const publishedCopy = seedCatalog
      .filter((item) => item.publish)
      .flatMap((item) => LOCALES.map((locale) => Object.values(item.translations[locale]).join(" ")))
      .join("\n");

    expect(publishedCopy).not.toMatch(/100%|零风险|零违规|zero risk|zero violations|нулев(?:ой|ого|ые) риск|без нарушений/iu);
    expect(publishedCopy).not.toMatch(/200\+\s*countries/iu);
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
        [caseStudies, 8],
        [caseStudyTranslations, 24],
        [articles, 3],
        [articleTranslations, 9],
        [certificates, 4],
        [certificateTranslations, 12],
        [proofMetrics, 4],
        [proofMetricTranslations, 12],
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

  it("publishes the baseline while leaving partners empty", () => {
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
      const publishedCases = testDatabase.db
        .select({ status: caseStudyTranslations.status })
        .from(caseStudyTranslations)
        .all();
      expect(publishedCases).toHaveLength(24);
      expect(publishedCases.every((row) => row.status === "published")).toBe(true);
      expect(
        testDatabase.db
          .select({ status: certificateTranslations.status })
          .from(certificateTranslations)
          .all()
          .every((row) => row.status === "published"),
      ).toBe(true);
      expect(
        testDatabase.db
          .select({ status: proofMetricTranslations.status })
          .from(proofMetricTranslations)
          .all()
          .every((row) => row.status === "published"),
      ).toBe(true);
      expect(testDatabase.db.select().from(partners).all()).toEqual([]);
      expect(testDatabase.db.select().from(certificates).all()).toHaveLength(4);
      expect(testDatabase.db.select().from(proofMetrics).all()).toHaveLength(4);
    } finally {
      testDatabase.close();
    }
  });

  it("preserves editorial state while restoring missing bootstrap rows", () => {
    const testDatabase = createTestDatabase();
    const laterSeededAt = new Date("2026-08-14T12:00:00.000Z");
    const scheduledAt = new Date("2026-09-01T12:00:00.000Z");
    const editorialUpdatedAt = new Date("2026-07-20T12:00:00.000Z");
    const verifiedAt = new Date("2026-07-19T12:00:00.000Z");

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });

      testDatabase.db
        .update(services)
        .set({
          sortOrder: 99,
          processStageId: "customs",
          archivedAt: editorialUpdatedAt,
          verifiedAt,
          verificationSource: "editorial-review",
          updatedAt: editorialUpdatedAt,
        })
        .where(eq(services.id, "ocean-freight"))
        .run();
      testDatabase.db
        .update(serviceTranslations)
        .set({
          status: "scheduled",
          scheduledAt,
          publishedAt: null,
          title: "Edited scheduled service",
          summary: "Edited service summary",
          body: "Edited service body",
          seoTitle: "Edited service SEO title",
          seoDescription: "Edited service SEO description",
          altText: "Edited service alt text",
          updatedAt: editorialUpdatedAt,
        })
        .where(
          and(
            eq(serviceTranslations.ownerId, "ocean-freight"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();
      testDatabase.db
        .update(caseStudyTranslations)
        .set({
          status: "published",
          publishedAt: editorialUpdatedAt,
          title: "Approved representative case",
          body: "Approved editorial case body",
          updatedAt: editorialUpdatedAt,
        })
        .where(
          and(
            eq(caseStudyTranslations.ownerId, "un1263-hamburg"),
            eq(caseStudyTranslations.locale, "en"),
          ),
        )
        .run();
      testDatabase.db
        .update(caseStudyTranslations)
        .set({
          status: "draft",
          scheduledAt: null,
          publishedAt: null,
          title: "Edited draft representative case",
          body: "Edited draft case body",
          updatedAt: editorialUpdatedAt,
        })
        .where(
          and(
            eq(caseStudyTranslations.ownerId, "un3265-india"),
            eq(caseStudyTranslations.locale, "en"),
          ),
        )
        .run();

      testDatabase.db
        .delete(serviceTranslations)
        .where(
          and(
            eq(serviceTranslations.ownerId, "air-freight"),
            eq(serviceTranslations.locale, "ru"),
          ),
        )
        .run();
      testDatabase.db.delete(pages).where(eq(pages.id, "contact")).run();

      seedPublicContent(testDatabase.db, { now: laterSeededAt });

      expect(
        testDatabase.db
          .select({
            sortOrder: services.sortOrder,
            processStageId: services.processStageId,
            archivedAt: services.archivedAt,
            verifiedAt: services.verifiedAt,
            verificationSource: services.verificationSource,
            updatedAt: services.updatedAt,
          })
          .from(services)
          .where(eq(services.id, "ocean-freight"))
          .get(),
      ).toEqual({
        sortOrder: 99,
        processStageId: "customs",
        archivedAt: editorialUpdatedAt,
        verifiedAt,
        verificationSource: "editorial-review",
        updatedAt: editorialUpdatedAt,
      });
      expect(
        testDatabase.db
          .select({
            status: serviceTranslations.status,
            scheduledAt: serviceTranslations.scheduledAt,
            publishedAt: serviceTranslations.publishedAt,
            title: serviceTranslations.title,
            summary: serviceTranslations.summary,
            body: serviceTranslations.body,
            seoTitle: serviceTranslations.seoTitle,
            seoDescription: serviceTranslations.seoDescription,
            altText: serviceTranslations.altText,
            updatedAt: serviceTranslations.updatedAt,
          })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "ocean-freight"),
              eq(serviceTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({
        status: "scheduled",
        scheduledAt,
        publishedAt: null,
        title: "Edited scheduled service",
        summary: "Edited service summary",
        body: "Edited service body",
        seoTitle: "Edited service SEO title",
        seoDescription: "Edited service SEO description",
        altText: "Edited service alt text",
        updatedAt: editorialUpdatedAt,
      });
      expect(
        testDatabase.db
          .select({
            status: caseStudyTranslations.status,
            publishedAt: caseStudyTranslations.publishedAt,
            title: caseStudyTranslations.title,
            body: caseStudyTranslations.body,
            updatedAt: caseStudyTranslations.updatedAt,
          })
          .from(caseStudyTranslations)
          .where(
            and(
              eq(caseStudyTranslations.ownerId, "un1263-hamburg"),
              eq(caseStudyTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({
        status: "published",
        publishedAt: editorialUpdatedAt,
        title: "Approved representative case",
        body: "Approved editorial case body",
        updatedAt: editorialUpdatedAt,
      });
      expect(
        testDatabase.db
          .select({
            status: caseStudyTranslations.status,
            scheduledAt: caseStudyTranslations.scheduledAt,
            publishedAt: caseStudyTranslations.publishedAt,
            title: caseStudyTranslations.title,
            body: caseStudyTranslations.body,
            updatedAt: caseStudyTranslations.updatedAt,
          })
          .from(caseStudyTranslations)
          .where(
            and(
              eq(caseStudyTranslations.ownerId, "un3265-india"),
              eq(caseStudyTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({
        status: "draft",
        scheduledAt: null,
        publishedAt: null,
        title: "Edited draft representative case",
        body: "Edited draft case body",
        updatedAt: editorialUpdatedAt,
      });

      expect(
        testDatabase.db
          .select({ publishedAt: serviceTranslations.publishedAt })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "ru"),
            ),
          )
          .get(),
      ).toEqual({ publishedAt: laterSeededAt });
      expect(
        testDatabase.db.select({ value: count() }).from(pages).get()?.value,
      ).toBe(7);
      expect(
        testDatabase.db
          .select({ value: count() })
          .from(pageTranslations)
          .where(eq(pageTranslations.ownerId, "contact"))
          .get()?.value,
      ).toBe(3);
    } finally {
      testDatabase.close();
    }
  });
});
