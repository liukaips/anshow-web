import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
} from "../db/schema/index.js";
import { createDrizzleContentStore } from "./drizzle-content-store.js";
import { createPublicRepository } from "./public-repository.js";
import { seedPublicContent } from "./seed.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");
const PUBLISHED_AT = new Date("2026-07-13T12:00:00.000Z");

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

function insertService(
  db: TestDatabase,
  options: {
    id: string;
    archivedAt?: Date;
    translations: Array<{
      locale: "en" | "zh" | "ru";
      slug: string;
      title: string;
      status?: "draft" | "scheduled" | "published";
      publishedAt?: Date;
      updatedAt?: Date;
    }>;
  },
) {
  db.insert(services)
    .values({
      id: options.id,
      code: options.id,
      sortOrder: 0,
      archivedAt: options.archivedAt,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  db.insert(serviceTranslations)
    .values(
      options.translations.map((translation) => ({
        ownerId: options.id,
        locale: translation.locale,
        status: translation.status ?? "published",
        publishedAt:
          translation.publishedAt ??
          (translation.status === undefined ||
          translation.status === "published"
            ? PUBLISHED_AT
            : undefined),
        scheduledAt:
          translation.status === "scheduled"
            ? translation.publishedAt ?? PUBLISHED_AT
            : undefined,
        slug: translation.slug,
        title: translation.title,
        summary: `${translation.title} summary`,
        body: `${translation.title} body`,
        seoTitle: `${translation.title} | AnShow`,
        seoDescription: `${translation.title} SEO description`,
        altText: `${translation.title} meaningful alt text`,
        updatedAt: translation.updatedAt ?? NOW,
      })),
    )
    .run();
}

function createRepository(db: TestDatabase) {
  return createPublicRepository(
    createDrizzleContentStore(db, { now: () => NOW }),
  );
}

describe("public content repository", () => {
  it("returns only the requested published locale without fallback", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "ocean-freight",
        translations: [
          { locale: "en", slug: "ocean-freight", title: "Ocean Freight" },
          { locale: "zh", slug: "hai-yun-fu-wu", title: "海运服务" },
        ],
      });

      const repository = createRepository(testDatabase.db);
      await expect(
        repository.getBySlug("services", "zh", "hai-yun-fu-wu"),
      ).resolves.toMatchObject({
        id: "ocean-freight",
        locale: "zh",
        slug: "hai-yun-fu-wu",
        title: "海运服务",
        body: "海运服务 body",
        alternates: {
          en: "/en/services/ocean-freight",
          zh: "/zh/services/hai-yun-fu-wu",
        },
        media: null,
      });
      await expect(
        repository.getBySlug("services", "ru", "ocean-freight"),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });

  it("excludes draft, future, and archived records from collection lists", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "published-service",
        translations: [
          { locale: "en", slug: "published", title: "Published" },
        ],
      });
      insertService(testDatabase.db, {
        id: "draft-service",
        translations: [
          {
            locale: "en",
            slug: "draft",
            title: "Draft",
            status: "draft",
          },
        ],
      });
      insertService(testDatabase.db, {
        id: "future-service",
        translations: [
          {
            locale: "en",
            slug: "future",
            title: "Future",
            publishedAt: new Date("2026-07-15T12:00:00.000Z"),
          },
        ],
      });
      insertService(testDatabase.db, {
        id: "archived-service",
        archivedAt: NOW,
        translations: [
          { locale: "en", slug: "archived", title: "Archived" },
        ],
      });

      await expect(
        createRepository(testDatabase.db).listCollection("services", "en"),
      ).resolves.toMatchObject([{ id: "published-service" }]);
    } finally {
      testDatabase.close();
    }
  });

  it("builds alternates only from published translations for the same owner", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "customs",
        translations: [
          { locale: "en", slug: "customs", title: "Customs" },
          {
            locale: "zh",
            slug: "guan-wu",
            title: "关务",
            status: "draft",
          },
          {
            locale: "ru",
            slug: "tamozhnya",
            title: "Таможня",
            publishedAt: new Date("2026-07-15T12:00:00.000Z"),
          },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getBySlug(
          "services",
          "en",
          "customs",
        ),
      ).resolves.toMatchObject({
        alternates: { en: "/en/services/customs" },
      });
    } finally {
      testDatabase.close();
    }
  });

  it("maps public collection names to cargo types and articles", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: PUBLISHED_AT });
      const repository = createRepository(testDatabase.db);

      const [cargo, insights, cases] = await Promise.all([
        repository.listCollection("special-cargo", "en"),
        repository.listCollection("insights", "en"),
        repository.listCollection("case-studies", "en"),
      ]);

      expect(cargo.length).toBeGreaterThan(0);
      expect(cargo[0]?.alternates.en).toMatch(
        /^\/en\/special-cargo\//,
      );
      expect(insights).toHaveLength(3);
      expect(insights[0]?.alternates.en).toMatch(/^\/en\/insights\//);
      expect(cases).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("assembles a truthful homepage from configured published collections", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: PUBLISHED_AT });

      await expect(createRepository(testDatabase.db).getHome("zh")).resolves.toMatchObject({
        locale: "zh",
        headline: "协同衔接的国际海运",
        slides: expect.arrayContaining([
          expect.objectContaining({ locale: "zh", title: "协同衔接的国际海运" }),
        ]),
        services: expect.any(Array),
        tradeLanes: expect.any(Array),
        cargoTypes: expect.any(Array),
        proof: [],
        verifiedTrust: [],
        cases: [],
        articles: expect.any(Array),
        channels: [],
      });
    } finally {
      testDatabase.close();
    }
  });

  it("exposes proof only when published verification metadata is configured", async () => {
    const testDatabase = createTestDatabase();

    try {
      testDatabase.db
        .insert(proofMetrics)
        .values([
          {
            id: "unverified-proof",
            code: "unverified-proof",
            sortOrder: 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: "verified-proof",
            code: "verified-proof",
            sortOrder: 1,
            verifiedAt: PUBLISHED_AT,
            verificationSource: "audited operations record",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ])
        .run();
      testDatabase.db
        .insert(proofMetricTranslations)
        .values(
          ["unverified-proof", "verified-proof"].map((ownerId) => ({
            ownerId,
            locale: "en" as const,
            status: "published" as const,
            publishedAt: PUBLISHED_AT,
            slug: ownerId,
            title: ownerId,
            summary: `${ownerId} summary`,
            body: `${ownerId} body`,
            seoTitle: `${ownerId} | AnShow`,
            seoDescription: `${ownerId} description`,
            altText: `${ownerId} alt text`,
            updatedAt: NOW,
          })),
        )
        .run();

      const home = await createRepository(testDatabase.db).getHome("en");

      expect(home.proof).toHaveLength(1);
      expect(home.proof[0]?.id).toBe("verified-proof");
    } finally {
      testDatabase.close();
    }
  });

  it("lists only published locale URLs with actual alternates", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "ocean-freight",
        translations: [
          {
            locale: "en",
            slug: "ocean-freight",
            title: "Ocean Freight",
            updatedAt: new Date("2026-07-13T10:00:00.000Z"),
          },
          {
            locale: "zh",
            slug: "hai-yun-fu-wu",
            title: "海运服务",
            updatedAt: new Date("2026-07-13T11:00:00.000Z"),
          },
          {
            locale: "ru",
            slug: "morskie-perevozki",
            title: "Морские перевозки",
            status: "draft",
          },
        ],
      });

      await expect(createRepository(testDatabase.db).listSitemap()).resolves.toEqual([
        {
          path: "/en/services/ocean-freight",
          updatedAt: "2026-07-13T10:00:00.000Z",
          alternates: {
            en: "/en/services/ocean-freight",
            zh: "/zh/services/hai-yun-fu-wu",
          },
        },
        {
          path: "/zh/services/hai-yun-fu-wu",
          updatedAt: "2026-07-13T11:00:00.000Z",
          alternates: {
            en: "/en/services/ocean-freight",
            zh: "/zh/services/hai-yun-fu-wu",
          },
        },
      ]);
    } finally {
      testDatabase.close();
    }
  });
});
