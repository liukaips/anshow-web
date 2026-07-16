import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { auditLogs } from "../../db/schema/index.js";
import {
  ContentRepositoryError,
  createContentRepository,
  type AdminContentItem,
  type ContentRepository,
} from "./content-repository.js";

const NOW = new Date("2026-07-15T04:00:00.000Z");
const FIRST_CONTENT_ID = "00000000-0000-4000-8000-000000000001";
const completeTranslation = {
  title: "Freight service",
  slug: "freight-service",
  summary: "A complete summary.",
  body: "A complete body.",
  seoTitle: "Freight service",
  seoDescription: "A complete search description.",
  altText: "Cargo being handled at a terminal",
};

type RepositoryWithVerification = ContentRepository & {
  updateVerification(
    collection: "partners" | "certificates" | "proof-metrics",
    id: string,
    input: { verified: boolean; verificationSource: string | null },
    actorId: string,
  ): Promise<AdminContentItem>;
};

function withVerification(
  repository: ContentRepository,
): RepositoryWithVerification {
  expect("updateVerification" in repository).toBe(true);
  return repository as RepositoryWithVerification;
}

function createRepository() {
  const testDatabase = createTestDatabase();
  let contentSequence = 0;
  let auditSequence = 0;
  const repository = createContentRepository(testDatabase.db, {
    createId: () =>
      `00000000-0000-4000-8000-${String(++contentSequence).padStart(12, "0")}`,
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
        { titleZh: "冷链运输服务" },
        "staff-1",
      );
      expect(created).toMatchObject({
        id: FIRST_CONTENT_ID,
        code: expect.stringMatching(/^content-[a-f0-9]{8}$/),
        translations: {
          en: { locale: "en", status: "draft", title: "" },
          ru: { locale: "ru", status: "draft", title: "" },
          zh: {
            locale: "zh",
            status: "draft",
            title: "冷链运输服务",
            slug: expect.stringMatching(/^content-[a-f0-9]{8}$/),
          },
        },
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
          entityId: FIRST_CONTENT_ID,
        }),
        expect.objectContaining({
          actorId: "staff-1",
          action: "content.translation.save-draft",
          entityType: "services",
          entityId: FIRST_CONTENT_ID,
        }),
      ]);
    } finally {
      context.close();
    }
  });

  it("validates create input at the repository boundary", async () => {
    const context = createRepository();

    try {
      await expect(
        context.repository.create(
          "services",
          { titleZh: "   " },
          "staff-1",
        ),
      ).rejects.toMatchObject({ name: "ZodError" });
      await expect(context.repository.list("services")).resolves.toEqual([]);
    } finally {
      context.close();
    }
  });

  it("generates unique internal codes and Chinese slugs when titles collide", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { titleZh: "Air Freight" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { titleZh: "Air Freight" },
        "staff-1",
      );

      expect(first).toMatchObject({
        code: "air-freight",
        translations: { zh: { slug: "air-freight" } },
      });
      expect(second).toMatchObject({
        code: "air-freight-2",
        translations: { zh: { slug: "air-freight-2" } },
      });
      expect(
        context.db
          .select()
          .from(auditLogs)
          .all()
          .map((entry) => JSON.parse(entry.detail)),
      ).toEqual([{ code: "air-freight" }, { code: "air-freight-2" }]);
    } finally {
      context.close();
    }
  });

  it("lists every base and translation using two select queries", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { titleZh: "List First" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { titleZh: "List Second" },
        "staff-1",
      );
      await context.repository.saveDraft(
        "services",
        first.id,
        "en",
        { ...completeTranslation, slug: "list-first" },
        "staff-1",
      );
      await context.repository.saveDraft(
        "services",
        second.id,
        "ru",
        { ...completeTranslation, slug: "list-second" },
        "staff-1",
      );
      const select = vi.spyOn(context.db, "select");

      const listed = await context.repository.list("services");

      expect(listed).toHaveLength(2);
      expect(select).toHaveBeenCalledTimes(2);
    } finally {
      context.close();
    }
  });

  it("publishes Russian without changing English or Chinese state", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "articles",
        { titleZh: "Language States" },
        "staff-1",
      );
      for (const locale of ["en", "zh"] as const) {
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
        {
          ...completeTranslation,
          title: "Fresh Russian title",
          slug: "ru-language-states",
        },
        "staff-publisher",
      );

      expect(published.translations.ru).toMatchObject({
        status: "published",
        title: "Fresh Russian title",
        slug: "ru-language-states",
      });
      expect(published.translations.en!.status).toBe("draft");
      expect(published.translations.zh!.status).toBe("draft");
      expect(context.db.select().from(auditLogs).all().at(-1)).toMatchObject({
        actorId: "staff-publisher",
        action: "content.translation.publish",
        entityId: item.id,
      });
      expect(
        context.db.select().from(auditLogs).all().map((entry) => entry.action),
      ).toEqual([
        "content.create",
        "content.translation.save-draft",
        "content.translation.save-draft",
        "content.translation.publish",
      ]);
    } finally {
      context.close();
    }
  });

  it("schedules only complete translations for a future instant using the injected clock", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "pages",
        { titleZh: "Scheduled Page" },
        "staff-1",
      );
      await expect(
        context.repository.schedule(
          "pages",
          item.id,
          "en",
          { ...completeTranslation, scheduledAt: NOW.toISOString() },
          "staff-publisher",
        ),
      ).rejects.toMatchObject({ code: "SCHEDULE_NOT_FUTURE" });

      const future = new Date(NOW.getTime() + 60_000).toISOString();
      const scheduled = await context.repository.schedule(
        "pages",
        item.id,
        "en",
        {
          ...completeTranslation,
          title: "Fresh scheduled title",
          scheduledAt: future,
        },
        "staff-publisher",
      );
      expect(scheduled.translations.en).toMatchObject({
        status: "scheduled",
        title: "Fresh scheduled title",
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
          { titleZh: `Unverified ${collection}` },
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
            completeTranslation,
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

  it.each(["partners", "certificates", "proof-metrics"] as const)(
    "verifies an unverified %s with a source before publication",
    async (collection) => {
      const context = createRepository();

      try {
        const item = await context.repository.create(
          collection,
          { titleZh: `Verified ${collection}` },
          "staff-1",
        );
        const verified = await withVerification(
          context.repository,
        ).updateVerification(
          collection,
          item.id,
          {
            verified: true,
            verificationSource: "  Official registry record  ",
          },
          "staff-editor",
        );
        const published = await context.repository.publish(
          collection,
          item.id,
          "en",
          { ...completeTranslation, slug: `verified-${collection}` },
          "staff-publisher",
        );

        expect(verified).toMatchObject({
          verified: true,
          verificationSource: "Official registry record",
        });
        expect(published.translations.en?.status).toBe("published");
        expect(
          context.db.select().from(auditLogs).all().map((entry) => entry.action),
        ).toEqual([
          "content.create",
          "content.verification.update",
          "content.translation.publish",
        ]);
      } finally {
        context.close();
      }
    },
  );

  it("unverifies proof content and clears its source", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "partners",
        { titleZh: "Unverify Partner" },
        "staff-1",
      );
      await withVerification(context.repository).updateVerification(
        "partners",
        item.id,
        { verified: true, verificationSource: "Official registry record" },
        "staff-editor",
      );
      const unverified = await withVerification(
        context.repository,
      ).updateVerification(
        "partners",
        item.id,
        { verified: false, verificationSource: null },
        "staff-editor",
      );

      expect(unverified).toMatchObject({
        verified: false,
        verificationSource: null,
      });
      await expect(
        context.repository.publish(
          "partners",
          item.id,
          "en",
          completeTranslation,
          "staff-publisher",
        ),
      ).rejects.toMatchObject({ code: "PROOF_NOT_VERIFIED" });
    } finally {
      context.close();
    }
  });

  it("rolls back verification metadata when its audit insert fails", async () => {
    const context = createRepository();

    try {
      const item = await context.repository.create(
        "certificates",
        { titleZh: "Verification Rollback" },
        "staff-1",
      );
      context.db.run(sql.raw(`
        CREATE TRIGGER reject_verification_audit
        BEFORE INSERT ON audit_logs
        WHEN NEW.action = 'content.verification.update'
        BEGIN
          SELECT RAISE(ABORT, 'verification audit rejected');
        END
      `));

      await expect(
        withVerification(context.repository).updateVerification(
          "certificates",
          item.id,
          { verified: true, verificationSource: "Official register" },
          "staff-editor",
        ),
      ).rejects.toThrow(/verification audit rejected/);
      await expect(
        context.repository.get("certificates", item.id),
      ).resolves.toMatchObject({
        verified: false,
        verificationSource: null,
      });
    } finally {
      context.close();
    }
  });

  it("maps duplicate locale slugs to a stable conflict error", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { titleZh: "First" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { titleZh: "Second" },
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

  it("maps a create unique-constraint race to CONTENT_CONFLICT", async () => {
    const context = createRepository();

    try {
      context.db.run(sql.raw(`
        CREATE TRIGGER race_service_code
        BEFORE INSERT ON services
        WHEN NEW.code = 'race-code' AND NEW.id <> 'race-winner'
        BEGIN
          INSERT INTO services (id, code, sort_order, created_at, updated_at)
          VALUES ('race-winner', NEW.code, 0, 0, 0);
        END
      `));

      await expect(
        context.repository.create(
          "services",
          { titleZh: "Race Code" },
          "staff-1",
        ),
      ).rejects.toMatchObject({ code: "CONTENT_CONFLICT" });
    } finally {
      context.close();
    }
  });

  it.each(["save", "publish", "schedule"] as const)(
    "maps a translation unique-constraint race during %s to SLUG_CONFLICT",
    async (command) => {
      const context = createRepository();

      try {
        const first = await context.repository.create(
          "services",
          { titleZh: `Race First ${command}` },
          "staff-1",
        );
        const second = await context.repository.create(
          "services",
          { titleZh: `Race Second ${command}` },
          "staff-1",
        );
        context.db.run(sql.raw(`
          CREATE TRIGGER race_service_slug
          BEFORE INSERT ON service_translations
          WHEN NEW.slug = 'race-slug' AND NEW.service_id <> '${first.id}'
          BEGIN
            UPDATE service_translations
            SET slug = NEW.slug
            WHERE service_id = '${first.id}' AND locale = NEW.locale;
          END
        `));
        const translation = { ...completeTranslation, slug: "race-slug" };
        const mutation =
          command === "save"
            ? context.repository.saveDraft(
                "services",
                second.id,
                "en",
                translation,
                "staff-1",
              )
            : command === "publish"
              ? context.repository.publish(
                  "services",
                  second.id,
                  "en",
                  translation,
                  "staff-1",
                )
              : context.repository.schedule(
                  "services",
                  second.id,
                  "en",
                  {
                    ...translation,
                    scheduledAt: new Date(
                      NOW.getTime() + 60_000,
                    ).toISOString(),
                  },
                  "staff-1",
                );

        await expect(mutation).rejects.toMatchObject({ code: "SLUG_CONFLICT" });
      } finally {
        context.close();
      }
    },
  );

  it("preserves blank slugs for multiple same-locale incomplete drafts", async () => {
    const context = createRepository();

    try {
      const first = await context.repository.create(
        "services",
        { titleZh: "Blank First" },
        "staff-1",
      );
      const second = await context.repository.create(
        "services",
        { titleZh: "Blank Second" },
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
        { titleZh: "Archivable" },
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

  it("keeps repeat archive idempotent without changing time or audit", async () => {
    const testDatabase = createTestDatabase();
    let clockTick = 0;
    let auditSequence = 0;
    const repository = createContentRepository(testDatabase.db, {
      createId: () => FIRST_CONTENT_ID,
      createAuditId: () => `archive-audit-${++auditSequence}`,
      now: () => new Date(NOW.getTime() + clockTick++ * 60_000),
    });

    try {
      const item = await repository.create(
        "hero-slides",
        { titleZh: "Archive Once" },
        "staff-1",
      );
      const first = await repository.archive(
        "hero-slides",
        item.id,
        "staff-1",
      );
      const second = await repository.archive(
        "hero-slides",
        item.id,
        "staff-1",
      );

      expect(second.archivedAt).toBe(first.archivedAt);
      expect(
        testDatabase.db
          .select()
          .from(auditLogs)
          .all()
          .filter((entry) => entry.action === "content.archive"),
      ).toHaveLength(1);
    } finally {
      testDatabase.close();
    }
  });

  it("creates RFC UUID identifiers by default", async () => {
    const testDatabase = createTestDatabase();

    try {
      const repository = createContentRepository(testDatabase.db, {
        createAuditId: () => "audit-create-uuid",
        now: () => NOW,
      });
      const item = await repository.create(
        "services",
        { titleZh: "UUID Created" },
        "staff-1",
      );

      expect(item.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      testDatabase.close();
    }
  });

  it.each(["publish", "schedule"] as const)(
    "rolls back the submitted translation when %s audit insertion fails",
    async (command) => {
      const context = createRepository();

      try {
        const item = await context.repository.create(
          "services",
          { titleZh: `Rollback ${command}` },
          "staff-1",
        );
        context.db.run(sql.raw(`
          CREATE TRIGGER reject_content_action_audit
          BEFORE INSERT ON audit_logs
          BEGIN
            SELECT RAISE(ABORT, 'content audit rejected');
          END
        `));

        const mutation =
          command === "publish"
            ? context.repository.publish(
                "services",
                item.id,
                "en",
                completeTranslation,
                "staff-publisher",
              )
            : context.repository.schedule(
                "services",
                item.id,
                "en",
                {
                  ...completeTranslation,
                  scheduledAt: new Date(NOW.getTime() + 60_000).toISOString(),
                },
                "staff-publisher",
              );

        await expect(mutation).rejects.toThrow(/content audit rejected/);
        await expect(
          context.repository.get("services", item.id),
        ).resolves.toMatchObject({ translations: {} });
      } finally {
        context.close();
      }
    },
  );
});
