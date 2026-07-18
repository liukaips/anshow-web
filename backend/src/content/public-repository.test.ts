import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  certificates,
  certificateTranslations,
  partners,
  partnerTranslations,
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
const PUBLIC_ITEM_KEYS = [
  "altText",
  "alternates",
  "body",
  "id",
  "locale",
  "media",
  "processStageId",
  "seoDescription",
  "seoTitle",
  "slug",
  "structuredBody",
  "summary",
  "title",
];

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
      body?: string;
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
        body: translation.body ?? `${translation.title} body`,
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
  it("returns only the requested published locale from detail reads", async () => {
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
        media: expect.objectContaining({ width: expect.any(Number), avifSrcSet: expect.stringContaining("/media/service-ocean/") }),
      });
      await expect(
        repository.getBySlug("services", "ru", "ocean-freight"),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });

  it("returns only contract fields from detail, list, and home reads", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "ocean-freight",
        translations: [
          { locale: "en", slug: "ocean-freight", title: "Ocean Freight" },
        ],
      });
      const repository = createRepository(testDatabase.db);
      const [detail, list, home] = await Promise.all([
        repository.getBySlug("services", "en", "ocean-freight"),
        repository.listCollection("services", "en"),
        repository.getHome("en"),
      ]);

      expect(Object.keys(detail ?? {}).sort()).toEqual(PUBLIC_ITEM_KEYS);
      expect(Object.keys(list[0] ?? {}).sort()).toEqual(PUBLIC_ITEM_KEYS);
      expect(Object.keys(home.services[0] ?? {}).sort()).toEqual(
        PUBLIC_ITEM_KEYS,
      );
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

  it("can include complete drafts for an authenticated preview snapshot", async () => {
    const testDatabase = createTestDatabase();
    try {
      insertService(testDatabase.db, {
        id: "draft-service",
        translations: [{ locale: "zh", slug: "draft-preview", title: "草稿预览", status: "draft" }],
      });
      const preview = createPublicRepository(createDrizzleContentStore(testDatabase.db, { now: () => NOW, includeDrafts: true }));
      await expect(preview.listCollection("services", "zh")).resolves.toMatchObject([{ id: "draft-service", title: "草稿预览" }]);
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
      expect(cases).toHaveLength(8);
      expect(cases[0]?.structuredBody?.version).toBe(1);
    } finally {
      testDatabase.close();
    }
  });

  it("assembles a truthful homepage from configured published collections", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: PUBLISHED_AT });

      const home = await createRepository(testDatabase.db).getHome("zh");

      expect(home).toMatchObject({
        locale: "zh",
        headline: "让国际海运更确定",
        channels: [],
      });
      expect(home.slides).toHaveLength(4);
      expect(home.services).toHaveLength(7);
      expect(home.tradeLanes).toHaveLength(4);
      expect(home.cargoTypes).toHaveLength(4);
      expect(home.proof).toHaveLength(4);
      expect(home.certificates).toHaveLength(4);
      expect(home.cases).toHaveLength(8);
      expect(home.articles).toHaveLength(3);
      expect(home.cases[0]?.structuredBody?.version).toBe(1);
      expect(home.verifiedTrust).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("fills a missing requested translation from the published English row", async () => {
    const testDatabase = createTestDatabase();

    try {
      const englishBody = JSON.stringify({
        version: 1,
        sections: [{ type: "paragraph", text: "English fallback content" }],
      });
      insertService(testDatabase.db, {
        id: "fallback-service",
        translations: [
          { locale: "en", slug: "fallback-service", title: "Fallback service", body: englishBody },
          { locale: "ru", slug: "rezervnyi-servis", title: "Резервный сервис" },
        ],
      });
      testDatabase.db
        .delete(serviceTranslations)
        .where(
          and(
            eq(serviceTranslations.ownerId, "fallback-service"),
            eq(serviceTranslations.locale, "ru"),
          ),
        )
        .run();

      const repository = createRepository(testDatabase.db);
      const [items, home, sitemap] = await Promise.all([
        repository.listCollection("services", "ru"),
        repository.getHome("ru"),
        repository.listSitemap(),
      ]);

      expect(items).toEqual([
        expect.objectContaining({
          id: "fallback-service",
          locale: "en",
          structuredBody: expect.objectContaining({ version: 1 }),
          alternates: { en: "/en/services/fallback-service" },
        }),
      ]);
      expect(home.services).toEqual(items);
      expect(sitemap.some((item) => item.path === "/ru/services/fallback-service")).toBe(false);

      testDatabase.db
        .delete(serviceTranslations)
        .where(
          and(
            eq(serviceTranslations.ownerId, "fallback-service"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();
      await expect(repository.listCollection("services", "ru")).resolves.toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("does not fill an explicitly unpublished requested translation from English", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "deliberately-hidden-service",
        translations: [
          { locale: "en", slug: "deliberately-hidden", title: "English service" },
          { locale: "ru", slug: "skrytyi", title: "Скрытый сервис" },
        ],
      });
      testDatabase.db
        .update(serviceTranslations)
        .set({ status: "draft", publishedAt: null })
        .where(
          and(
            eq(serviceTranslations.ownerId, "deliberately-hidden-service"),
            eq(serviceTranslations.locale, "ru"),
          ),
        )
        .run();

      const repository = createRepository(testDatabase.db);
      await expect(repository.listCollection("services", "ru")).resolves.toEqual([]);
      await expect(repository.getHome("ru")).resolves.toMatchObject({
        services: [],
      });

      testDatabase.db
        .delete(serviceTranslations)
        .where(
          and(
            eq(serviceTranslations.ownerId, "deliberately-hidden-service"),
            eq(serviceTranslations.locale, "en"),
          ),
        )
        .run();
      await expect(repository.listCollection("services", "ru")).resolves.toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("never fills archived content from English", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "archived-fallback-service",
        archivedAt: NOW,
        translations: [
          { locale: "en", slug: "archived-fallback", title: "Archived English service" },
        ],
      });

      await expect(
        createRepository(testDatabase.db).listCollection("services", "ru"),
      ).resolves.toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("retains invalid legacy bodies without failing a public collection", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "invalid-legacy-body",
        translations: [
          {
            locale: "en",
            slug: "invalid-legacy-body",
            title: "Invalid legacy body",
            body: "{not valid JSON",
          },
        ],
      });

      await expect(
        createRepository(testDatabase.db).listCollection("services", "en"),
      ).resolves.toEqual([
        expect.objectContaining({
          id: "invalid-legacy-body",
          body: "{not valid JSON",
          structuredBody: null,
        }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("returns published proof while reserving verification metadata for trust", async () => {
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

      expect(home.proof.map((item) => item.id)).toEqual([
        "unverified-proof",
        "verified-proof",
      ]);
      expect(home.verifiedTrust).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it("returns published certificates separately from verified trust", async () => {
    const testDatabase = createTestDatabase();

    try {
      testDatabase.db
        .insert(certificates)
        .values([
          {
            id: "unverified-certificate",
            code: "unverified-certificate",
            sortOrder: 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: "verified-certificate",
            code: "verified-certificate",
            sortOrder: 1,
            verifiedAt: PUBLISHED_AT,
            verificationSource: "certificate registry record",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ])
        .run();
      testDatabase.db
        .insert(certificateTranslations)
        .values(
          ["unverified-certificate", "verified-certificate"].map((ownerId) => ({
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

      expect(home.certificates.map((item) => item.id)).toEqual([
        "unverified-certificate",
        "verified-certificate",
      ]);
      expect(home.verifiedTrust).toEqual([
        expect.objectContaining({ id: "verified-certificate" }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("hides proof-bearing content whose verification source is whitespace", async () => {
    const testDatabase = createTestDatabase();

    try {
      const base = {
        sortOrder: 0,
        verifiedAt: PUBLISHED_AT,
        verificationSource: "   ",
        createdAt: NOW,
        updatedAt: NOW,
      };
      testDatabase.db.insert(partners).values({
        ...base,
        id: "whitespace-partner",
        code: "whitespace-partner",
      }).run();
      testDatabase.db.insert(certificates).values({
        ...base,
        id: "whitespace-certificate",
        code: "whitespace-certificate",
      }).run();
      testDatabase.db.insert(proofMetrics).values({
        ...base,
        id: "whitespace-proof",
        code: "whitespace-proof",
      }).run();

      const translation = (ownerId: string) => ({
        ownerId,
        locale: "en" as const,
        status: "published" as const,
        publishedAt: PUBLISHED_AT,
        slug: ownerId,
        title: ownerId,
        summary: `${ownerId} summary`,
        body: `${ownerId} body`,
        seoTitle: ownerId,
        seoDescription: `${ownerId} description`,
        altText: `${ownerId} alt text`,
        updatedAt: NOW,
      });
      testDatabase.db
        .insert(partnerTranslations)
        .values(translation("whitespace-partner"))
        .run();
      testDatabase.db
        .insert(certificateTranslations)
        .values(translation("whitespace-certificate"))
        .run();
      testDatabase.db
        .insert(proofMetricTranslations)
        .values(translation("whitespace-proof"))
        .run();

      const home = await createRepository(testDatabase.db).getHome("en");
      expect(home.verifiedTrust).toEqual([]);
      expect(home.certificates).toEqual([
        expect.objectContaining({ id: "whitespace-certificate" }),
      ]);
      expect(home.proof).toEqual([
        expect.objectContaining({ id: "whitespace-proof" }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("lists real locale roots and collection routes with stable updates", async () => {
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

      const sitemap = await createRepository(testDatabase.db).listSitemap();
      const byPath = new Map(sitemap.map((item) => [item.path, item]));

      expect([...byPath.keys()]).toEqual(
        expect.arrayContaining([
          "/en",
          "/zh",
          "/ru",
          "/en/services",
          "/zh/services",
          "/ru/services",
          "/en/trade-lanes",
          "/en/special-cargo",
          "/en/insights",
          "/en/case-studies",
          "/en/services/ocean-freight",
          "/zh/services/hai-yun-fu-wu",
        ]),
      );
      expect(byPath.get("/en")).toEqual({
        path: "/en",
        updatedAt: "2026-07-13T10:00:00.000Z",
        alternates: { en: "/en", zh: "/zh", ru: "/ru" },
      });
      expect(byPath.get("/en/services")).toEqual({
        path: "/en/services",
        updatedAt: "2026-07-13T10:00:00.000Z",
        alternates: {
          en: "/en/services",
          zh: "/zh/services",
          ru: "/ru/services",
        },
      });
      expect(byPath.get("/en/services/ocean-freight")?.alternates).toEqual({
        en: "/en/services/ocean-freight",
        zh: "/zh/services/hai-yun-fu-wu",
      });
      expect(byPath.has("/ru/services/morskie-perevozki")).toBe(false);
    } finally {
      testDatabase.close();
    }
  });

  it("uses fixed page codes and excludes system page records", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedPublicContent(testDatabase.db, { now: PUBLISHED_AT });

      const sitemap = await createRepository(testDatabase.db).listSitemap();
      const paths = sitemap.map((item) => item.path);
      const about = sitemap.find((item) => item.path === "/zh/about");

      expect(paths).toEqual(
        expect.arrayContaining([
          "/en/about",
          "/zh/about",
          "/ru/about",
          "/zh/network",
          "/zh/contact",
          "/zh/privacy",
          "/zh/terms",
          "/zh/cookies",
        ]),
      );
      expect(paths).not.toContain("/zh/guan-yu");
      expect(paths.some((path) => path.includes("not-found"))).toBe(false);
      expect(paths.some((path) => path.includes("wei-zhao-dao"))).toBe(false);
      expect(about?.alternates).toEqual({
        en: "/en/about",
        zh: "/zh/about",
        ru: "/ru/about",
      });
      for (const locale of ["en", "zh", "ru"] as const) {
        expect(
          sitemap.find((item) => item.path === `/${locale}/certifications`),
        ).toEqual({
          path: `/${locale}/certifications`,
          updatedAt: PUBLISHED_AT.toISOString(),
          alternates: {
            en: "/en/certifications",
            zh: "/zh/certifications",
            ru: "/ru/certifications",
          },
        });
        expect(
          sitemap.find((item) => item.path === `/${locale}/quote`),
        ).toEqual({
          path: `/${locale}/quote`,
          updatedAt: PUBLISHED_AT.toISOString(),
          alternates: {
            en: "/en/quote",
            zh: "/zh/quote",
            ru: "/ru/quote",
          },
        });
      }
    } finally {
      testDatabase.close();
    }
  });

  it("encodes a stored slug as one URL segment", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "reserved-slug",
        translations: [
          { locale: "en", slug: "a/b?c#d", title: "Reserved slug" },
        ],
      });

      const sitemap = await createRepository(testDatabase.db).listSitemap();
      const item = sitemap.find(
        (entry) => entry.path === "/en/services/a%2Fb%3Fc%23d",
      );

      expect(item).toMatchObject({
        alternates: { en: "/en/services/a%2Fb%3Fc%23d" },
      });
    } finally {
      testDatabase.close();
    }
  });
});
