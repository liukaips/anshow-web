import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { auditLogs } from "../../db/schema/index.js";
import {
  ContentRepositoryError,
  createContentRepository,
} from "./content-repository.js";

const NOW = new Date("2026-07-15T04:00:00.000Z");
const completeTranslation = {
  title: "Freight service",
  slug: "freight-service",
  summary: "A complete summary.",
  body: "A complete body.",
  seoTitle: "Freight service",
  seoDescription: "A complete search description.",
  altText: "Cargo being handled at a terminal",
};

function createRepository() {
  const testDatabase = createTestDatabase();
  let contentSequence = 0;
  let auditSequence = 0;
  const repository = createContentRepository(testDatabase.db, {
    createId: () => `content-${++contentSequence}`,
    createAuditId: () => `audit-${++auditSequence}`,
    now: () => NOW,
  });

  return { ...testDatabase, repository };
}

describe("administration content repository", () => {
  it("creates, lists, reads, and saves an incomplete draft with actor-linked audits", async () => {
    const context = createRepository();

    try {
      const created = await context.repository.create(
        "services",
        { code: "freight-service", sortOrder: 3 },
        "staff-1",
      );
      expect(created).toMatchObject({
        id: "content-1",
        code: "freight-service",
        translations: {},
      });

      const saved = await context.repository.saveDraft(
        "services",
        created.id,
        "ru",
        { ...completeTranslation, body: "", seoTitle: "", altText: "" },
        "staff-1",
      );
      expect(saved.translations.ru).toMatchObject({
        locale: "ru",
        status: "draft",
        body: "",
        seoTitle: "",
        altText: "",
      });
      await expect(
        context.repository.list("services"),
      ).resolves.toEqual([saved]);
      await expect(
        context.repository.get("services", created.id),
      ).resolves.toEqual(saved);

      expect(context.db.select().from(auditLogs).all()).toEqual([
        expect.objectContaining({
          actorId: "staff-1",
          action: "content.create",
          entityType: "services",
          entityId: "content-1",
        }),
        expect.objectContaining({
          actorId: "staff-1",
          action: "content.translation.save-draft",
          entityType: "services",
          entityId: "content-1",
        }),
      ]);
    } finally {
      context.close();
    }
  });

  it("publishes Russian without changing English or Chinese state", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "articles",
        { code: "language-states" },
        "staff-1",
      );
      for (const locale of ["en", "zh", "ru"] as const) {
        await context.repository.saveDraft(
          "articles",
          item.id,
          locale,
          { ...completeTranslation, slug: `${locale}-language-states` },
          "staff-1",
        );
      }

      const published = await context.repository.publish(
        "articles",
        item.id,
        "ru",
        "staff-publisher",
      );

      expect(published.translations.ru!.status).toBe("published");
      expect(published.translations.en!.status).toBe("draft");
      expect(published.translations.zh!.status).toBe("draft");
    } finally {
      context.close();
    }
  });

  it("schedules only complete translations for a future instant using the injected clock", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "pages",
        { code: "scheduled-page" },
        "staff-1",
      );
      await context.repository.saveDraft(
        "pages",
        item.id,
        "en",
        completeTranslation,
        "staff-1",
      );

      await expect(
        context.repository.schedule(
          "pages",
          item.id,
          "en",
          NOW.toISOString(),
          "staff-publisher",
        ),
      ).rejects.toMatchObject({ code: "SCHEDULE_NOT_FUTURE" });

      const future = new Date(NOW.getTime() + 60_000).toISOString();
      const scheduled = await context.repository.schedule(
        "pages",
        item.id,
        "en",
        future,
        "staff-publisher",
      );
      expect(scheduled.translations.en).toMatchObject({
        status: "scheduled",
        scheduledAt: future,
        publishedAt: null,
      });
    } finally {
      context.close();
    }
  });

  it.each(["partners", "certificates", "proof-metrics"] as const)(
    "rejects publishing unverified %s with the proof-specific error",
    async (collection) => {
      const context = createRepository();

      try {
        const item = await context.repository.create(
          collection,
          { code: `unverified-${collection}` },
          "staff-1",
        );
        await context.repository.saveDraft(
          collection,
          item.id,
          "en",
          completeTranslation,
          "staff-1",
        );

        await expect(
          context.repository.publish(
            collection,
            item.id,
            "en",
            "staff-publisher",
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            code: "PROOF_NOT_VERIFIED",
            name: "ContentRepositoryError",
          }),
        );
      } finally {
        context.close();
      }
    },
  );

  it("maps duplicate locale slugs to a stable conflict error", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { code: "first" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { code: "second" },
        "staff-1",
      );
      await context.repository.saveDraft(
        "services",
        first.id,
        "en",
        completeTranslation,
        "staff-1",
      );

      await expect(
        context.repository.saveDraft(
          "services",
          second.id,
          "en",
          completeTranslation,
          "staff-1",
        ),
      ).rejects.toMatchObject({ code: "SLUG_CONFLICT" });
    } finally {
      context.close();
    }
  });

  it("preserves blank slugs for multiple same-locale incomplete drafts", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { code: "blank-first" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { code: "blank-second" },
        "staff-1",
      );
      const incomplete = {
        ...completeTranslation,
        slug: "",
        body: "",
        seoTitle: "",
        altText: "",
      };

      const firstSaved = await context.repository.saveDraft(
        "services",
        first.id,
        "en",
        incomplete,
        "staff-1",
      );
      const secondSaved = await context.repository.saveDraft(
        "services",
        second.id,
        "en",
        incomplete,
        "staff-1",
      );

      expect(firstSaved.translations.en?.slug).toBe("");
      expect(secondSaved.translations.en?.slug).toBe("");
    } finally {
      context.close();
    }
  });

  it("archives content and reports missing content with a domain error", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "hero-slides",
        { code: "archivable" },
        "staff-1",
      );
      const archived = await context.repository.archive(
        "hero-slides",
        item.id,
        "staff-1",
      );
      expect(archived.archivedAt).toBe(NOW.toISOString());

      await expect(
        context.repository.get("hero-slides", "missing"),
      ).rejects.toBeInstanceOf(ContentRepositoryError);
      await expect(
        context.repository.get("hero-slides", "missing"),
      ).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" });
    } finally {
      context.close();
    }
  });
});
