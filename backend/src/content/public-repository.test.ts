import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  services,
  serviceTranslations,
} from "../db/schema/index.js";
import { createDrizzleContentStore } from "./drizzle-content-store.js";
import { createPublicRepository } from "./public-repository.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

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
            ? new Date("2026-07-13T12:00:00.000Z")
            : undefined),
        slug: translation.slug,
        title: translation.title,
        summary: `${translation.title} summary`,
        body: `${translation.title} body`,
        seoTitle: `${translation.title} | AnShow`,
        seoDescription: `${translation.title} SEO description`,
        altText: `${translation.title} meaningful alt text`,
        updatedAt: NOW,
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
  it("returns the requested published locale without mixing translations", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "ocean-freight",
        translations: [
          { locale: "en", slug: "ocean-freight", title: "Ocean Freight" },
          { locale: "zh", slug: "hai-yun-fu-wu", title: "海运服务" },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getServiceBySlug(
          "zh",
          "hai-yun-fu-wu",
        ),
      ).resolves.toMatchObject({
        id: "ocean-freight",
        code: "ocean-freight",
        locale: "zh",
        slug: "hai-yun-fu-wu",
        title: "海运服务",
        body: "海运服务 body",
      });
    } finally {
      testDatabase.close();
    }
  });

  it("does not fall back to another locale", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "air-freight",
        translations: [
          { locale: "en", slug: "air-freight", title: "Air Freight" },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getServiceBySlug("ru", "air-freight"),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });

  it("excludes draft translations", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "draft-service",
        translations: [
          {
            locale: "en",
            slug: "draft-service",
            title: "Draft Service",
            status: "draft",
          },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getServiceBySlug(
          "en",
          "draft-service",
        ),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });

  it("excludes translations scheduled for future publication", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "future-service",
        translations: [
          {
            locale: "en",
            slug: "future-service",
            title: "Future Service",
            status: "published",
            publishedAt: new Date("2026-07-15T12:00:00.000Z"),
          },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getServiceBySlug(
          "en",
          "future-service",
        ),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });

  it("excludes services whose base record is archived", async () => {
    const testDatabase = createTestDatabase();

    try {
      insertService(testDatabase.db, {
        id: "archived-service",
        archivedAt: new Date("2026-07-14T00:00:00.000Z"),
        translations: [
          {
            locale: "en",
            slug: "archived-service",
            title: "Archived Service",
          },
        ],
      });

      await expect(
        createRepository(testDatabase.db).getServiceBySlug(
          "en",
          "archived-service",
        ),
      ).resolves.toBeNull();
    } finally {
      testDatabase.close();
    }
  });
});
