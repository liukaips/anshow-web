import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createDrizzleContentStore } from "../content/drizzle-content-store.js";
import { createPublicRepository } from "../content/public-repository.js";
import { services, serviceTranslations } from "../db/schema/index.js";
import { createTestDatabase } from "../db/test-db.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");
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
  "summary",
  "title",
];

function createFixture() {
  const testDatabase = createTestDatabase();
  testDatabase.db
    .insert(services)
    .values({
      id: "ocean-freight",
      code: "ocean-freight",
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
  testDatabase.db
    .insert(serviceTranslations)
    .values([
      {
        ownerId: "ocean-freight",
        locale: "en",
        status: "published",
        publishedAt: new Date("2026-07-13T12:00:00.000Z"),
        slug: "ocean-freight",
        title: "Ocean Freight",
        summary: "Ocean summary",
        body: "Ocean body",
        seoTitle: "Ocean Freight | AnShow",
        seoDescription: "Ocean SEO",
        altText: "Ocean freight scene",
        updatedAt: NOW,
      },
      {
        ownerId: "ocean-freight",
        locale: "zh",
        status: "published",
        publishedAt: new Date("2026-07-13T12:00:00.000Z"),
        slug: "hai-yun-fu-wu",
        title: "海运服务",
        summary: "海运摘要",
        body: "海运正文",
        seoTitle: "海运服务 | AnShow",
        seoDescription: "海运 SEO",
        altText: "海运场景",
        updatedAt: NOW,
      },
    ])
    .run();

  const publicContentRepository = createPublicRepository(
    createDrizzleContentStore(testDatabase.db, { now: () => NOW }),
  );

  return {
    app: createApp({ publicContentRepository }),
    close: testDatabase.close,
  };
}

describe("public content API", () => {
  it("serves home and collection routes from the injected repository", async () => {
    const fixture = createFixture();

    try {
      const [homeResponse, listResponse] = await Promise.all([
        fixture.app.request("/api/public/content/home/en"),
        fixture.app.request("/api/public/content/services/en"),
      ]);

      expect(homeResponse.status).toBe(200);
      await expect(homeResponse.json()).resolves.toMatchObject({
        data: {
          locale: "en",
          services: [expect.objectContaining({ slug: "ocean-freight" })],
        },
        error: null,
        requestId: homeResponse.headers.get("x-request-id"),
      });

      expect(listResponse.status).toBe(200);
      await expect(listResponse.json()).resolves.toMatchObject({
        data: [expect.objectContaining({ slug: "ocean-freight" })],
        error: null,
        requestId: listResponse.headers.get("x-request-id"),
      });
    } finally {
      fixture.close();
    }
  });

  it("returns content in the stable envelope with one middleware request ID", async () => {
    const fixture = createFixture();

    try {
      const response = await fixture.app.request(
        "/api/public/content/services/zh/hai-yun-fu-wu",
      );
      const requestId = response.headers.get("x-request-id");

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: Record<string, unknown>;
        error: unknown;
        requestId: string;
      };
      expect(body).toMatchObject({
        data: { locale: "zh", slug: "hai-yun-fu-wu", title: "海运服务" },
        error: null,
        requestId,
      });
      expect(Object.keys(body.data).sort()).toEqual(PUBLIC_ITEM_KEYS);
      expect(requestId).toEqual(expect.any(String));
    } finally {
      fixture.close();
    }
  });

  it("returns 404 instead of falling back to another language", async () => {
    const fixture = createFixture();

    try {
      const response = await fixture.app.request(
        "/api/public/content/services/ru/ocean-freight",
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        data: null,
        error: { code: "CONTENT_NOT_FOUND" },
        requestId: response.headers.get("x-request-id"),
      });
    } finally {
      fixture.close();
    }
  });

  it("registers sitemap before dynamic collection routes", async () => {
    const fixture = createFixture();

    try {
      const response = await fixture.app.request("/api/public/content/sitemap");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ path: "/en/services/ocean-freight" }),
        ]),
        error: null,
      });
    } finally {
      fixture.close();
    }
  });

  it("uses the app validation envelope for invalid locales", async () => {
    const fixture = createFixture();

    try {
      const response = await fixture.app.request(
        "/api/public/content/services/fr",
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          fields: { locale: [expect.any(String)] },
          message: "The request is invalid.",
        },
        requestId: response.headers.get("x-request-id"),
      });
    } finally {
      fixture.close();
    }
  });
});
