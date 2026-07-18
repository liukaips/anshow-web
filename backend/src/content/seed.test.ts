import { createHash } from "node:crypto";

import { and, count, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { AppDatabase } from "../db/client.js";
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
  contentSeedRevisions,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  partners,
  mediaAssets,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/index.js";
import {
  legacySeedFingerprints,
  type LegacySeedKey,
} from "./legacy-seed-fingerprints.js";
import {
  currentContentSeedRevision,
  seedCatalog,
  type SeedCollection,
  type SeedItem,
  type SeedTranslation,
} from "./seed-catalog.js";
import {
  createContentSeeder,
  seedCollectionRoutes,
  seedPublicContent,
} from "./seed.js";
import {
  buildCatalogSeedFingerprintInput,
  buildSeedFingerprintInput,
  computeSeedCatalogDigest,
  fingerprintSeedRecord,
} from "./seed-upgrades.js";
import { structuredContentBodySchema } from "./structured-body.js";
import { LOCALES, type Locale, type ProcessStageId } from "./types.js";

const SEEDED_AT = new Date("2026-07-14T12:00:00.000Z");
const RESEEDED_AT = new Date("2026-08-14T12:00:00.000Z");

type LegacyCopy = Pick<SeedTranslation, "title" | "slug" | "summary">;

type LegacyServiceFixture = {
  code: string;
  sortOrder: number;
  processStageId: ProcessStageId;
  translations: Record<Locale, LegacyCopy>;
};

const LEGACY_SERVICES = [
  {
    code: "ocean-freight",
    sortOrder: 0,
    processStageId: "transit",
    translations: {
      en: {
        title: "Ocean Freight",
        slug: "ocean-freight",
        summary:
          "Forwarding support for containerized, consolidated, and specialist ocean cargo.",
      },
      zh: {
        title: "海运服务",
        slug: "hai-yun-fu-wu",
        summary: "为整箱、拼箱及专业海运货物提供货运代理支持。",
      },
      ru: {
        title: "Морские перевозки",
        slug: "morskie-perevozki",
        summary:
          "Экспедирование контейнерных, сборных и специализированных морских грузов.",
      },
    },
  },
  {
    code: "air-freight",
    sortOrder: 1,
    processStageId: "transit",
    translations: {
      en: {
        title: "Air Freight",
        slug: "air-freight",
        summary:
          "Air forwarding for priority, controlled, and schedule-sensitive cargo.",
      },
      zh: {
        title: "空运服务",
        slug: "kong-yun-fu-wu",
        summary: "为优先、受控及对时效敏感的货物提供空运代理。",
      },
      ru: {
        title: "Авиаперевозки",
        slug: "aviaperevozki",
        summary:
          "Авиаэкспедирование приоритетных, контролируемых и срочных грузов.",
      },
    },
  },
  {
    code: "multimodal",
    sortOrder: 4,
    processStageId: "route",
    translations: {
      en: {
        title: "Multimodal Transport",
        slug: "multimodal-transport",
        summary:
          "Combine ocean, air, rail, and road legs under one coordinated plan.",
      },
      zh: {
        title: "多式联运",
        slug: "duo-shi-lian-yun",
        summary: "在统一方案下衔接海运、空运、铁路和公路运输。",
      },
      ru: {
        title: "Мультимодальные перевозки",
        slug: "multimodalnye-perevozki",
        summary:
          "Объединяйте морские, авиационные, железнодорожные и автомобильные этапы в одном плане.",
      },
    },
  },
] as const satisfies readonly LegacyServiceFixture[];

const LEGACY_FINGERPRINT_KEYS = [
  "hero-slides/ocean",
  "hero-slides/air",
  "hero-slides/rail",
  "hero-slides/road",
  "services/ocean-freight",
  "services/air-freight",
  "services/rail-freight",
  "services/road-freight",
  "services/multimodal",
  "services/customs",
  "services/warehousing",
  "trade-lanes/china-russia",
  "trade-lanes/china-europe",
  "trade-lanes/central-asia",
  "trade-lanes/global-network",
  "cargo-types/project-cargo",
  "cargo-types/oversized-cargo",
  "cargo-types/dangerous-goods",
  "cargo-types/temperature-controlled",
  "pages/about",
  "pages/network",
  "pages/contact",
  "pages/privacy",
  "pages/terms",
  "pages/cookies",
  "pages/not-found",
  "case-studies/multimodal-planning",
  "case-studies/customs-readiness",
  "case-studies/warehouse-handoff",
  "articles/enquiry-preparation",
  "articles/mode-selection",
  "articles/document-readiness",
  "navigation-items/home",
  "navigation-items/services",
  "navigation-items/network",
  "navigation-items/about",
  "navigation-items/insights",
  "navigation-items/contact",
  "navigation-items/privacy",
  "navigation-items/terms",
  "navigation-items/cookies",
] as const satisfies readonly LegacySeedKey[];

// Independently generated from the complete persisted 5c9374e projection.
const LEGACY_FINGERPRINT_VECTOR_DIGEST =
  "843104fe769815b25499d61632ab090681debdb5ce109853008e5ce32d62da1a";

function expandLegacyCopy(copy: LegacyCopy, locale: Locale): SeedTranslation {
  const separator = locale === "zh" ? "：" : ": ";
  return {
    ...copy,
    body: copy.summary,
    seoTitle: `${copy.title} | AnShow`,
    seoDescription: copy.summary,
    altText: `${copy.title}${separator}${copy.summary}`,
  };
}

function insertLegacyServices(db: AppDatabase) {
  for (const item of LEGACY_SERVICES) {
    db.insert(services)
      .values({
        id: item.code,
        code: item.code,
        sortOrder: item.sortOrder,
        mediaId: null,
        processStageId: item.processStageId,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      })
      .run();

    for (const locale of LOCALES) {
      db.insert(serviceTranslations)
        .values({
          ownerId: item.code,
          locale,
          status: "published",
          scheduledAt: null,
          publishedAt: SEEDED_AT,
          ...expandLegacyCopy(item.translations[locale], locale),
          updatedAt: SEEDED_AT,
        })
        .run();
    }
  }
}

function insertCatalogMedia(db: AppDatabase) {
  const mediaIds = new Set(
    seedCatalog.flatMap((item) =>
      item.desiredMediaId === undefined ? [] : [item.desiredMediaId],
    ),
  );
  mediaIds.add("operator-ocean");

  for (const id of mediaIds) {
    db.insert(mediaAssets)
      .values({
        id,
        storageKey: `seed-test/${id}`,
        mimeType: "image/webp",
        width: 1600,
        height: 900,
        dominantColor: "#123456",
        createdAt: SEEDED_AT,
      })
      .run();
  }
}

function withTranslationTitle(
  catalog: readonly SeedItem[],
  code: string,
  locale: Locale,
  title: string,
): SeedItem[] {
  return catalog.map((item) =>
    item.code === code
      ? {
          ...item,
          translations: {
            ...item.translations,
            [locale]: { ...item.translations[locale], title },
          },
        }
      : item,
  );
}

function createTestSeeder(catalog: readonly SeedItem[], version: number) {
  return createContentSeeder({
    catalog,
    revision: {
      version,
      expectedCatalogDigest: computeSeedCatalogDigest(catalog),
    },
  });
}

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
} as const satisfies Record<SeedCollection, readonly string[]>;

const FORBIDDEN_CLAIM_PATTERNS = [
  /100\s*%\s*(?:satisfaction|满意|удовлетвор\p{L}*)/iu,
  /guaranteed\s+satisfaction|satisfaction\s+guaranteed|unconditional\s+satisfaction|保证满意|绝对满意|满意度保证|(?:гарантированн\p{L}*|абсолютн\p{L}*)(?:\s+\p{L}+){0,3}\s+удовлетвор\p{L}*/iu,
  /zero[-\s]*(?:risk|violations?)|零(?:风险|违规)|нулев\p{L}*\s+(?:риск|нарушен\p{L}*)|ноль\s+риска|без\s+(?:риска|нарушен\p{L}*)/iu,
  /200\s*\+\s*countries(?:\s+and\s+regions)?|200多个国家(?:和地区)?|200\s*\+\s*стран|более\s+200\s+стран/iu,
  /全球(?:无死角|全覆盖)|complete\s+global\s+coverage|worldwide\s+without\s+gaps|пол\p{L}*\s+покрыт\p{L}*\s+по\s+всему\s+миру|пол\p{L}*\s+(?:глобальн\p{L}*|всемирн\p{L}*|миров\p{L}*)\s+покрыт\p{L}*|(?:всемирн\p{L}*\s+)?покрыт\p{L}*\s+без\s+пробел\p{L}*|по\s+всему\s+миру\s+без\s+пробел\p{L}*/iu,
] as const;

function containsForbiddenClaim(value: string) {
  return FORBIDDEN_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

function structuredBody(itemCode: string, locale: string, body: string) {
  return structuredContentBodySchema.parse(JSON.parse(body), {
    error: (issue) => `${itemCode}/${locale}: ${issue.message}`,
  });
}

function canonicalFacts(body: string) {
  const parsed = structuredContentBodySchema.parse(JSON.parse(body));
  const factLists = parsed.sections.filter((section) => section.type === "fact-list");
  expect(factLists, "case body must contain exactly one fact-list").toHaveLength(1);
  const [factList] = factLists;
  if (!factList || factList.type !== "fact-list") return [];
  return factList.items.map(({ key, value, unit }) => ({
    key,
    value,
    unit: unit ?? null,
  }));
}

describe("public content seed", () => {
  it("contains the complete approved catalog in all three locales", () => {
    expect(seedCatalog).toHaveLength(54);
    expect(Object.keys(seedCollectionRoutes)).toEqual(Object.keys(EXPECTED_CODES));
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
          copy.seoTitle.length,
          `${item.code}/${locale} SEO title length`,
        ).toBeLessThanOrEqual(70);
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
    const airFreight = seedCatalog.find(
      (item) => item.collection === "services" && item.code === "air-freight",
    );
    expect(airFreight?.translations.en.title).toBe("Air Freight for Time-Critical Cargo");
    expect(airFreight?.translations.en.seoTitle).toBe(
      "Air Freight for Time-Critical Cargo | AnShow",
    );
  });

  it("publishes the exact representative cases with locale-invariant facts", () => {
    const cases = seedCatalog.filter((item) => item.collection === "case-studies");

    expect(cases.every((item) => item.publish)).toBe(true);
    expect(Object.fromEntries(cases.map((item) => [item.code, item.desiredMediaId]))).toEqual({
      "un1263-hamburg": "case-un1263-hamburg",
      "un3265-india": "case-un3265-india",
      "un3480-los-angeles": "case-un3480-los-angeles",
      "injection-machine-turkey": "case-injection-machine-turkey",
      "excavators-tir-moscow": "case-excavators-tir-moscow",
      "auto-parts-rail-russia": "case-auto-parts-rail-russia",
      "electronics-air-munich": "case-electronics-air-munich",
      "semiconductor-import-clearance": "case-semiconductor-clearance",
    });
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
        .map((item) => [item.code, canonicalFacts(item.translations.en.body)]),
    );

    expect(caseFacts["un1263-hamburg"]).toEqual(expect.arrayContaining([
      { key: "un", value: "UN1263", unit: null },
      { key: "hazardClass", value: "3", unit: null },
      { key: "weight", value: "12", unit: "t" },
      { key: "duration", value: "28", unit: "days" },
    ]));
    expect(caseFacts["un3265-india"]).toEqual(expect.arrayContaining([
      { key: "un", value: "UN3265", unit: null },
      { key: "hazardClass", value: "8", unit: null },
      { key: "drums", value: "800", unit: "drums" },
      { key: "clearanceDuration", value: "3", unit: "days" },
    ]));
    expect(caseFacts["un3480-los-angeles"]).toEqual(expect.arrayContaining([
      { key: "un", value: "UN3480", unit: null },
      { key: "weight", value: "5", unit: "t" },
      { key: "duration", value: "14", unit: "days" },
      { key: "projectTimeSaved", value: "7", unit: "days" },
      { key: "projectCostDifference", value: "8", unit: "%" },
    ]));
    expect(caseFacts["injection-machine-turkey"]).toEqual(expect.arrayContaining([
      { key: "dimensions", value: "11.8 × 2.6 × 3.2", unit: "m" },
      { key: "weight", value: "28", unit: "t" },
      { key: "equipment", value: "40-foot flat rack", unit: null },
    ]));
    expect(caseFacts["excavators-tir-moscow"]).toEqual(expect.arrayContaining([
      { key: "distance", value: "8,600", unit: "km" },
      { key: "duration", value: "15", unit: "days" },
    ]));
    expect(caseFacts["auto-parts-rail-russia"]).toEqual(expect.arrayContaining([
      { key: "duration", value: "18–22", unit: "days" },
      { key: "projectCostDifference", value: "60", unit: "%" },
    ]));
    expect(caseFacts["electronics-air-munich"]).toEqual(expect.arrayContaining([
      { key: "weight", value: "3", unit: "t" },
      { key: "duration", value: "42", unit: "hours" },
    ]));
    expect(caseFacts["semiconductor-import-clearance"]).toEqual(expect.arrayContaining([
      { key: "duration", value: "5", unit: "days" },
    ]));
  });

  it("uses the complete English name for the injection molding machine", () => {
    const item = seedCatalog.find(
      (candidate) => candidate.collection === "case-studies" && candidate.code === "injection-machine-turkey",
    );
    expect(item).toBeDefined();
    const copy = item?.translations.en;
    expect(copy?.title).toContain("Injection Molding Machine");
    expect(copy?.seoTitle).toContain("Injection Molding Machine");
    expect(copy?.altText).toMatch(/injection molding machine/i);
    expect(copy?.body).toMatch(/injection molding machine/i);
    expect(Object.values(copy ?? {}).join(" ")).not.toMatch(/\bInjection Machine\b/);
  });

  it("contains no prohibited absolute claims in published copy", () => {
    const publishedCopy = seedCatalog
      .filter((item) => item.publish)
      .flatMap((item) => LOCALES.map((locale) => Object.values(item.translations[locale]).join(" ")))
      .join("\n");

    expect(containsForbiddenClaim(publishedCopy)).toBe(false);
  });

  it("rejects absolute satisfaction claims without banning factual percentages", () => {
    const prohibited = [
      "100% satisfaction",
      "Satisfaction guaranteed",
      "保证满意",
      "гарантированная удовлетворенность",
      "complete global coverage",
      "全球无死角",
      "полное покрытие по всему миру",
    ];
    const permitted = [
      "100% of the drums were counted for this project.",
      "该项目文件复核完成率为 100%。",
      "В этом проекте проверено 100% документов.",
    ];

    for (const value of prohibited) {
      expect(containsForbiddenClaim(value), value).toBe(true);
    }
    for (const value of permitted) {
      expect(containsForbiddenClaim(value), value).toBe(false);
    }
  });

  it("inserts base records and translations idempotently", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      const originalBaseTimestamps = testDatabase.db
        .select({ updatedAt: caseStudies.updatedAt })
        .from(caseStudies)
        .where(eq(caseStudies.id, "un1263-hamburg"))
        .get();
      const originalTranslationTimestamps = testDatabase.db
        .select({
          updatedAt: caseStudyTranslations.updatedAt,
          publishedAt: caseStudyTranslations.publishedAt,
        })
        .from(caseStudyTranslations)
        .where(
          and(
            eq(caseStudyTranslations.ownerId, "un1263-hamburg"),
            eq(caseStudyTranslations.locale, "en"),
          ),
        )
        .get();

      seedPublicContent(testDatabase.db, { now: RESEEDED_AT });

      expect(originalBaseTimestamps).toEqual({ updatedAt: SEEDED_AT });
      expect(originalTranslationTimestamps).toEqual({
        updatedAt: SEEDED_AT,
        publishedAt: SEEDED_AT,
      });
      expect(
        testDatabase.db
          .select({ updatedAt: caseStudies.updatedAt })
          .from(caseStudies)
          .where(eq(caseStudies.id, "un1263-hamburg"))
          .get(),
      ).toEqual(originalBaseTimestamps);
      expect(
        testDatabase.db
          .select({
            updatedAt: caseStudyTranslations.updatedAt,
            publishedAt: caseStudyTranslations.publishedAt,
          })
          .from(caseStudyTranslations)
          .where(
            and(
              eq(caseStudyTranslations.ownerId, "un1263-hamburg"),
              eq(caseStudyTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual(originalTranslationTimestamps);

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

  it("persists published structured case facts in SQLite", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });

      const storedCase = testDatabase.db
        .select({
          status: caseStudyTranslations.status,
          body: caseStudyTranslations.body,
        })
        .from(caseStudyTranslations)
        .where(
          and(
            eq(caseStudyTranslations.ownerId, "un1263-hamburg"),
            eq(caseStudyTranslations.locale, "en"),
          ),
        )
        .get();

      expect(storedCase?.status).toBe("published");
      expect(canonicalFacts(storedCase?.body ?? "")).toEqual(expect.arrayContaining([
        { key: "un", value: "UN1263", unit: null },
        { key: "hazardClass", value: "3", unit: null },
        { key: "weight", value: "12", unit: "t" },
        { key: "duration", value: "28", unit: "days" },
      ]));
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

  it("validates the committed legacy fingerprint against exact generic copy", () => {
    const legacyAir = LEGACY_SERVICES.find((item) => item.code === "air-freight");
    expect(legacyAir).toBeDefined();
    if (legacyAir === undefined) return;

    const fingerprint = fingerprintSeedRecord(
      buildSeedFingerprintInput({
        base: {
          sortOrder: legacyAir.sortOrder,
          mediaId: null,
          processStageId: legacyAir.processStageId,
          archivedAt: null,
          verifiedAt: null,
          verificationSource: null,
        },
        translation: {
          status: "published",
          scheduledAt: null,
          publishedAt: SEEDED_AT,
          ...expandLegacyCopy(legacyAir.translations.en, "en"),
        },
      }),
    );

    expect(fingerprint).toBe(
      legacySeedFingerprints["services/air-freight"].en,
    );
    const keys = Object.keys(legacySeedFingerprints) as LegacySeedKey[];
    expect(keys).toEqual(LEGACY_FINGERPRINT_KEYS);
    const vectors: string[] = [];
    for (const key of keys) {
      expect(Object.keys(legacySeedFingerprints[key])).toEqual(LOCALES);
      for (const locale of LOCALES) {
        const value = legacySeedFingerprints[key][locale];
        expect(value).toMatch(/^[a-f0-9]{64}$/u);
        vectors.push(`${key}/${locale}:${value}`);
      }
    }
    expect(
      createHash("sha256").update(JSON.stringify(vectors)).digest("hex"),
    ).toBe(LEGACY_FINGERPRINT_VECTOR_DIGEST);
  });

  it("upgrades untouched generic content while preserving operator changes", () => {
    const testDatabase = createTestDatabase();
    const operatorUpdatedAt = new Date("2026-07-20T12:00:00.000Z");

    try {
      insertCatalogMedia(testDatabase.db);
      insertLegacyServices(testDatabase.db);
      testDatabase.db
        .update(services)
        .set({ mediaId: "operator-ocean", updatedAt: operatorUpdatedAt })
        .where(eq(services.id, "ocean-freight"))
        .run();
      testDatabase.db
        .update(serviceTranslations)
        .set({
          status: "draft",
          scheduledAt: null,
          publishedAt: null,
          title: "Operator ocean title",
          body: "Operator ocean body",
          updatedAt: operatorUpdatedAt,
        })
        .where(
          and(
            eq(serviceTranslations.ownerId, "ocean-freight"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();
      testDatabase.db
        .update(serviceTranslations)
        .set({ title: "Operator air sibling", updatedAt: operatorUpdatedAt })
        .where(
          and(
            eq(serviceTranslations.ownerId, "air-freight"),
            eq(serviceTranslations.locale, "zh"),
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

      const result = seedPublicContent(testDatabase.db, { now: RESEEDED_AT });

      expect(result).toEqual({
        inserted: 157,
        upgraded: 1,
        archived: 3,
        preserved: [
          { collection: "services", code: "ocean-freight", locale: "en" },
          { collection: "services", code: "ocean-freight", locale: "zh" },
          { collection: "services", code: "ocean-freight", locale: "ru" },
          { collection: "services", code: "air-freight", locale: "zh" },
        ],
      });
      expect(JSON.stringify(result.preserved)).not.toMatch(
        /Operator ocean|Operator air|body/iu,
      );
      expect(
        testDatabase.db
          .select({
            mediaId: services.mediaId,
            updatedAt: services.updatedAt,
          })
          .from(services)
          .where(eq(services.id, "ocean-freight"))
          .get(),
      ).toEqual({ mediaId: "operator-ocean", updatedAt: operatorUpdatedAt });
      expect(
        testDatabase.db
          .select({
            status: serviceTranslations.status,
            publishedAt: serviceTranslations.publishedAt,
            title: serviceTranslations.title,
            body: serviceTranslations.body,
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
        status: "draft",
        publishedAt: null,
        title: "Operator ocean title",
        body: "Operator ocean body",
        updatedAt: operatorUpdatedAt,
      });

      const currentAir = seedCatalog.find(
        (item) => item.collection === "services" && item.code === "air-freight",
      );
      expect(
        testDatabase.db
          .select({
            mediaId: services.mediaId,
            updatedAt: services.updatedAt,
          })
          .from(services)
          .where(eq(services.id, "air-freight"))
          .get(),
      ).toEqual({ mediaId: "service-air", updatedAt: RESEEDED_AT });
      expect(
        testDatabase.db
          .select()
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toMatchObject({
        status: "published",
        publishedAt: RESEEDED_AT,
        title: "Air Freight for Time-Critical Cargo",
        body: currentAir?.translations.en.body,
        updatedAt: RESEEDED_AT,
      });
      expect(
        testDatabase.db
          .select({ title: serviceTranslations.title })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "zh"),
            ),
          )
          .get(),
      ).toEqual({ title: "Operator air sibling" });
      expect(
        testDatabase.db
          .select()
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "ru"),
            ),
          )
          .get(),
      ).toMatchObject(currentAir?.translations.ru ?? {});
      expect(
        testDatabase.db
          .select({ archivedAt: services.archivedAt })
          .from(services)
          .where(eq(services.id, "multimodal"))
          .get(),
      ).toEqual({ archivedAt: RESEEDED_AT });

      const currentCase = seedCatalog.find(
        (item) =>
          item.collection === "case-studies" && item.code === "un1263-hamburg",
      );
      expect(
        testDatabase.db
          .select({ mediaId: caseStudies.mediaId })
          .from(caseStudies)
          .where(eq(caseStudies.id, "un1263-hamburg"))
          .get(),
      ).toEqual({ mediaId: "case-un1263-hamburg" });
      expect(
        testDatabase.db
          .select({
            status: caseStudyTranslations.status,
            body: caseStudyTranslations.body,
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
        body: currentCase?.translations.en.body,
      });
      expect(testDatabase.db.select().from(certificates).all()).toHaveLength(4);
      expect(testDatabase.db.select().from(proofMetrics).all()).toHaveLength(4);
      expect(
        testDatabase.db
          .select({ value: count() })
          .from(contentSeedRevisions)
          .get()?.value,
      ).toBe(161);

      const beforeReseed = {
        services: testDatabase.db.select().from(services).all(),
        translations: testDatabase.db.select().from(serviceTranslations).all(),
        revisions: testDatabase.db.select().from(contentSeedRevisions).all(),
      };
      expect(seedPublicContent(testDatabase.db, { now: new Date("2026-09-14T12:00:00.000Z") })).toEqual({
        inserted: 0,
        upgraded: 0,
        archived: 0,
        preserved: result.preserved,
      });
      expect(testDatabase.db.select().from(services).all()).toEqual(
        beforeReseed.services,
      );
      expect(testDatabase.db.select().from(serviceTranslations).all()).toEqual(
        beforeReseed.translations,
      );
      expect(testDatabase.db.select().from(contentSeedRevisions).all()).toEqual(
        beforeReseed.revisions,
      );
    } finally {
      testDatabase.close();
    }
  });

  it("inserts the current catalog and revision rows idempotently on an empty database", () => {
    const testDatabase = createTestDatabase();

    try {
      insertCatalogMedia(testDatabase.db);
      const first = seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      const revisions = testDatabase.db.select().from(contentSeedRevisions).all();
      const currentRows = seedCatalog.length * LOCALES.length;

      expect(first).toEqual({
        inserted: currentRows,
        upgraded: 0,
        archived: 0,
        preserved: [],
      });
      expect(revisions).toHaveLength(currentRows);
      expect(new Set(revisions.map((revision) => revision.seedVersion))).toEqual(
        new Set([2]),
      );
      expect(seedPublicContent(testDatabase.db, { now: RESEEDED_AT })).toEqual({
        inserted: 0,
        upgraded: 0,
        archived: 0,
        preserved: [],
      });
      expect(testDatabase.db.select().from(contentSeedRevisions).all()).toEqual(
        revisions,
      );
    } finally {
      testDatabase.close();
    }
  });

  it("records catalog-intended media even when the asset is not installed", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      const ocean = seedCatalog.find(
        (item) => item.collection === "hero-slides" && item.code === "ocean",
      );
      expect(ocean).toBeDefined();
      if (ocean === undefined) return;

      expect(
        testDatabase.db
          .select({ mediaId: heroSlides.mediaId })
          .from(heroSlides)
          .where(eq(heroSlides.id, "ocean"))
          .get(),
      ).toEqual({ mediaId: null });
      expect(
        testDatabase.db
          .select({ appliedFingerprint: contentSeedRevisions.appliedFingerprint })
          .from(contentSeedRevisions)
          .where(
            and(
              eq(contentSeedRevisions.collection, "hero-slides"),
              eq(contentSeedRevisions.ownerId, "ocean"),
              eq(contentSeedRevisions.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({
        appliedFingerprint: fingerprintSeedRecord(
          buildCatalogSeedFingerprintInput({
            seedItem: ocean,
            sortOrder: 0,
            locale: "en",
            mediaId: "hero-ocean",
          }),
        ),
      });
    } finally {
      testDatabase.close();
    }
  });

  it.each(["title", "body", "media", "sort", "status"] as const)(
    "preserves an exact legacy record after an operator changes %s",
    (field) => {
      const testDatabase = createTestDatabase();
      const operatorUpdatedAt = new Date("2026-07-20T12:00:00.000Z");

      try {
        insertCatalogMedia(testDatabase.db);
        insertLegacyServices(testDatabase.db);
        if (field === "media") {
          testDatabase.db
            .update(services)
            .set({ mediaId: "operator-ocean", updatedAt: operatorUpdatedAt })
            .where(eq(services.id, "air-freight"))
            .run();
        } else if (field === "sort") {
          testDatabase.db
            .update(services)
            .set({ sortOrder: 42, updatedAt: operatorUpdatedAt })
            .where(eq(services.id, "air-freight"))
            .run();
        } else {
          testDatabase.db
            .update(serviceTranslations)
            .set(
              field === "status"
                ? {
                    status: "draft",
                    scheduledAt: null,
                    publishedAt: null,
                    updatedAt: operatorUpdatedAt,
                  }
                : { [field]: `Operator ${field}`, updatedAt: operatorUpdatedAt },
            )
            .where(
              and(
                eq(serviceTranslations.ownerId, "air-freight"),
                eq(serviceTranslations.locale, "en"),
              ),
            )
            .run();
        }

        const result = seedPublicContent(testDatabase.db, { now: RESEEDED_AT });
        expect(result.preserved).toContainEqual({
          collection: "services",
          code: "air-freight",
          locale: "en",
        });
        const base = testDatabase.db
          .select({
            mediaId: services.mediaId,
            sortOrder: services.sortOrder,
            updatedAt: services.updatedAt,
          })
          .from(services)
          .where(eq(services.id, "air-freight"))
          .get();
        if (field === "media") {
          expect(base).toEqual({
            mediaId: "operator-ocean",
            sortOrder: 1,
            updatedAt: operatorUpdatedAt,
          });
        }
        if (field === "sort") {
          expect(base).toEqual({
            mediaId: null,
            sortOrder: 42,
            updatedAt: operatorUpdatedAt,
          });
        }
        expect(
          testDatabase.db
            .select({
              status: serviceTranslations.status,
              title: serviceTranslations.title,
              body: serviceTranslations.body,
              updatedAt: serviceTranslations.updatedAt,
            })
            .from(serviceTranslations)
            .where(
              and(
                eq(serviceTranslations.ownerId, "air-freight"),
                eq(serviceTranslations.locale, "en"),
              ),
            )
            .get(),
        ).toMatchObject(
          field === "status"
            ? { status: "draft", updatedAt: operatorUpdatedAt }
            : field === "title" || field === "body"
              ? { [field]: `Operator ${field}`, updatedAt: operatorUpdatedAt }
              : {},
        );
      } finally {
        testDatabase.close();
      }
    },
  );

  it("does not archive an operator-modified superseded legacy record", () => {
    const testDatabase = createTestDatabase();

    try {
      insertLegacyServices(testDatabase.db);
      testDatabase.db
        .update(serviceTranslations)
        .set({ title: "Operator multimodal" })
        .where(
          and(
            eq(serviceTranslations.ownerId, "multimodal"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();

      const result = seedPublicContent(testDatabase.db, { now: RESEEDED_AT });
      expect(result.preserved).toContainEqual({
        collection: "services",
        code: "multimodal",
        locale: "en",
      });
      expect(
        testDatabase.db
          .select({ archivedAt: services.archivedAt })
          .from(services)
          .where(eq(services.id, "multimodal"))
          .get(),
      ).toEqual({ archivedAt: null });
    } finally {
      testDatabase.close();
    }
  });

  it("does not advance a revision after an operator edit", () => {
    const testDatabase = createTestDatabase();
    const operatorUpdatedAt = new Date("2026-07-20T12:00:00.000Z");

    try {
      insertCatalogMedia(testDatabase.db);
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      const revisionBeforeEdit = testDatabase.db
        .select()
        .from(contentSeedRevisions)
        .where(
          and(
            eq(contentSeedRevisions.collection, "services"),
            eq(contentSeedRevisions.ownerId, "ocean-freight"),
            eq(contentSeedRevisions.locale, "en"),
          ),
        )
        .get();
      testDatabase.db
        .update(serviceTranslations)
        .set({ title: "Operator current title", updatedAt: operatorUpdatedAt })
        .where(
          and(
            eq(serviceTranslations.ownerId, "ocean-freight"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();

      expect(seedPublicContent(testDatabase.db, { now: RESEEDED_AT }).preserved).toContainEqual({
        collection: "services",
        code: "ocean-freight",
        locale: "en",
      });
      expect(
        testDatabase.db
          .select()
          .from(contentSeedRevisions)
          .where(
            and(
              eq(contentSeedRevisions.collection, "services"),
              eq(contentSeedRevisions.ownerId, "ocean-freight"),
              eq(contentSeedRevisions.locale, "en"),
            ),
          )
          .get(),
      ).toEqual(revisionBeforeEdit);
    } finally {
      testDatabase.close();
    }
  });

  it("keeps an edited shared base operator-owned after restoring a locale", () => {
    const testDatabase = createTestDatabase();
    const operatorUpdatedAt = new Date("2026-07-20T12:00:00.000Z");
    const operatorVerifiedAt = new Date("2026-07-19T12:00:00.000Z");

    try {
      insertCatalogMedia(testDatabase.db);
      insertLegacyServices(testDatabase.db);
      testDatabase.db
        .update(services)
        .set({
          sortOrder: 42,
          mediaId: "operator-ocean",
          processStageId: "customs",
          archivedAt: operatorUpdatedAt,
          verifiedAt: operatorVerifiedAt,
          verificationSource: "operator-review",
          updatedAt: operatorUpdatedAt,
        })
        .where(eq(services.id, "air-freight"))
        .run();
      testDatabase.db
        .update(serviceTranslations)
        .set({ title: "Operator air sibling", updatedAt: operatorUpdatedAt })
        .where(
          and(
            eq(serviceTranslations.ownerId, "air-freight"),
            eq(serviceTranslations.locale, "en"),
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

      seedPublicContent(testDatabase.db, { now: RESEEDED_AT });

      const airItem = seedCatalog.find(
        (item) => item.collection === "services" && item.code === "air-freight",
      );
      expect(airItem).toBeDefined();
      if (airItem === undefined) return;
      const restoredRevision = testDatabase.db
        .select({ appliedFingerprint: contentSeedRevisions.appliedFingerprint })
        .from(contentSeedRevisions)
        .where(
          and(
            eq(contentSeedRevisions.collection, "services"),
            eq(contentSeedRevisions.ownerId, "air-freight"),
            eq(contentSeedRevisions.locale, "ru"),
          ),
        )
        .get();
      expect(restoredRevision).toEqual({
        appliedFingerprint: fingerprintSeedRecord(
          buildCatalogSeedFingerprintInput({
            seedItem: airItem,
            sortOrder: 1,
            locale: "ru",
            mediaId: "service-air",
          }),
        ),
      });

      const baseBeforeV3 = testDatabase.db
        .select()
        .from(services)
        .where(eq(services.id, "air-freight"))
        .get();
      const siblingsBeforeV3 = testDatabase.db
        .select()
        .from(serviceTranslations)
        .where(eq(serviceTranslations.ownerId, "air-freight"))
        .all();
      const v3Catalog = withTranslationTitle(
        seedCatalog,
        "air-freight",
        "ru",
        "V3 air title",
      );
      const v3Result = createTestSeeder(v3Catalog, 3)(testDatabase.db, {
        now: new Date("2026-10-14T12:00:00.000Z"),
      });

      expect(v3Result.preserved).toEqual(
        expect.arrayContaining([
          { collection: "services", code: "air-freight", locale: "en" },
          { collection: "services", code: "air-freight", locale: "zh" },
          { collection: "services", code: "air-freight", locale: "ru" },
        ]),
      );
      expect(
        testDatabase.db
          .select()
          .from(services)
          .where(eq(services.id, "air-freight"))
          .get(),
      ).toEqual(baseBeforeV3);
      expect(
        testDatabase.db
          .select()
          .from(serviceTranslations)
          .where(eq(serviceTranslations.ownerId, "air-freight"))
          .all(),
      ).toEqual(siblingsBeforeV3);
    } finally {
      testDatabase.close();
    }
  });

  it("rejects a changed catalog when the seed contract digest is stale", () => {
    const changedCatalog = withTranslationTitle(
      seedCatalog,
      "air-freight",
      "en",
      "Changed without a version bump",
    );

    expect(() =>
      createContentSeeder({
        catalog: changedCatalog,
        revision: currentContentSeedRevision,
      }),
    ).toThrow("Seed catalog digest mismatch");
  });

  it("revalidates the catalog contract when a constructed seeder starts", () => {
    const testDatabase = createTestDatabase();
    const mutableCatalog = withTranslationTitle(
      seedCatalog,
      "air-freight",
      "en",
      "Factory baseline title",
    );
    const seeder = createTestSeeder(mutableCatalog, 3);
    const air = mutableCatalog.find((item) => item.code === "air-freight");
    expect(air).toBeDefined();
    if (air === undefined) return;
    air.translations.en.title = "Mutated after construction";

    try {
      expect(() => seeder(testDatabase.db, { now: SEEDED_AT })).toThrow(
        "Seed catalog digest mismatch",
      );
      expect(testDatabase.db.select().from(services).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("rolls back equal-version catalog drift even with a matching digest", () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      const before = {
        services: testDatabase.db.select().from(services).all(),
        revisions: testDatabase.db.select().from(contentSeedRevisions).all(),
      };
      const changedCatalog = withTranslationTitle(
        seedCatalog,
        "air-freight",
        "en",
        "Changed under version two",
      );
      const changedV2Seeder = createTestSeeder(changedCatalog, 2);

      expect(() =>
        changedV2Seeder(testDatabase.db, { now: RESEEDED_AT }),
      ).toThrow("Seed version 2 catalog drift");
      expect(testDatabase.db.select().from(services).all()).toEqual(
        before.services,
      );
      expect(testDatabase.db.select().from(contentSeedRevisions).all()).toEqual(
        before.revisions,
      );
    } finally {
      testDatabase.close();
    }
  });

  it("upgrades only seed-owned records after a valid version bump", () => {
    const testDatabase = createTestDatabase();
    const operatorUpdatedAt = new Date("2026-07-20T12:00:00.000Z");

    try {
      insertCatalogMedia(testDatabase.db);
      seedPublicContent(testDatabase.db, { now: SEEDED_AT });
      testDatabase.db
        .update(serviceTranslations)
        .set({ title: "Operator ocean v2", updatedAt: operatorUpdatedAt })
        .where(
          and(
            eq(serviceTranslations.ownerId, "ocean-freight"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();
      const v3Catalog = withTranslationTitle(
        withTranslationTitle(
          seedCatalog,
          "ocean-freight",
          "en",
          "Catalog ocean v3",
        ),
        "air-freight",
        "en",
        "Catalog air v3",
      );

      const result = createTestSeeder(v3Catalog, 3)(testDatabase.db, {
        now: RESEEDED_AT,
      });

      expect(result.preserved).toContainEqual({
        collection: "services",
        code: "ocean-freight",
        locale: "en",
      });
      expect(
        testDatabase.db
          .select({ title: serviceTranslations.title })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "ocean-freight"),
              eq(serviceTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({ title: "Operator ocean v2" });
      expect(
        testDatabase.db
          .select({
            title: serviceTranslations.title,
            updatedAt: serviceTranslations.updatedAt,
          })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({ title: "Catalog air v3", updatedAt: RESEEDED_AT });
    } finally {
      testDatabase.close();
    }
  });

  it("rolls back content decisions when a revision write fails", () => {
    const testDatabase = createTestDatabase();

    try {
      insertLegacyServices(testDatabase.db);
      testDatabase.db.run(
        sql.raw(`
          CREATE TRIGGER reject_seed_revision
          BEFORE INSERT ON content_seed_revisions
          WHEN NEW.collection = 'services'
            AND NEW.owner_id = 'air-freight'
            AND NEW.locale = 'zh'
          BEGIN
            SELECT RAISE(ABORT, 'revision rejected');
          END
        `),
      );

      expect(() =>
        seedPublicContent(testDatabase.db, { now: RESEEDED_AT }),
      ).toThrow("revision rejected");
      expect(
        testDatabase.db
          .select({ title: serviceTranslations.title })
          .from(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.ownerId, "air-freight"),
              eq(serviceTranslations.locale, "en"),
            ),
          )
          .get(),
      ).toEqual({ title: "Air Freight" });
      expect(
        testDatabase.db
          .select({ archivedAt: services.archivedAt })
          .from(services)
          .where(eq(services.id, "multimodal"))
          .get(),
      ).toEqual({ archivedAt: null });
      expect(testDatabase.db.select().from(caseStudies).all()).toEqual([]);
      expect(testDatabase.db.select().from(heroSlides).all()).toEqual([]);
      expect(testDatabase.db.select().from(heroSlideTranslations).all()).toEqual(
        [],
      );
      expect(testDatabase.db.select().from(contentSeedRevisions).all()).toEqual(
        [],
      );
    } finally {
      testDatabase.close();
    }
  });
});
