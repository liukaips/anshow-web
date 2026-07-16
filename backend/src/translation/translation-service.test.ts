import { describe, expect, it } from "vitest";

import { createContentRepository } from "../admin/repositories/content-repository.js";
import { createTestDatabase } from "../db/test-db.js";
import { translationJobs } from "../db/schema/workflow.js";
import { createTranslationService } from "./translation-service.js";
import type { TranslationProvider } from "./translation-provider.js";

const source = {
  title: "冷链运输服务",
  slug: "cold-chain-zh",
  summary: "国际温控运输服务",
  body: "提供从提货到交付的全程温控运输。",
  seoTitle: "冷链运输服务",
  seoDescription: "国际冷链运输与温控货运代理服务。",
  altText: "冷链货物正在装车",
};

describe("translation service", () => {
  it("creates idempotent jobs and saves editable English and Russian drafts", async () => {
    const context = createTestDatabase();
    try {
      let id = 0;
      const repository = createContentRepository(context.db, { createId: () => `content-${++id}` });
      const created = await repository.create("services", { titleZh: source.title }, "staff-1");
      await repository.saveDraft("services", created.id, "zh", source, "staff-1");
      const provider: TranslationProvider = {
        translate: async ({ targetLocale }) => ({
          title: targetLocale === "en" ? "Cold-chain logistics service" : "Холодовая логистика",
          slug: targetLocale === "en" ? "cold-chain-logistics-service" : "kholodovaya-logistika",
          summary: "Translated summary",
          body: "Translated body",
          seoTitle: "Translated title",
          seoDescription: "Translated description",
          altText: "Translated image description",
        }),
      };
      const service = createTranslationService(context.db, repository, provider, { createId: () => `job-${++id}` });

      const result = await service.generate({ collection: "services", id: created.id, actorId: "staff-1", targets: ["en", "ru"] });
      expect(result.item.translations.en?.title).toBe("Cold-chain logistics service");
      expect(result.item.translations.ru?.title).toBe("Холодовая логистика");
      expect(result.jobs.every((job) => job.status === "succeeded")).toBe(true);

      await service.generate({ collection: "services", id: created.id, actorId: "staff-1", targets: ["en", "ru"], sourceVersion: result.sourceVersion });
      expect(context.db.select().from(translationJobs).all()).toHaveLength(2);
    } finally {
      context.close();
    }
  });

  it("records failure without changing the Chinese source", async () => {
    const context = createTestDatabase();
    try {
      let id = 0;
      const repository = createContentRepository(context.db, { createId: () => `content-${++id}` });
      const created = await repository.create("services", { titleZh: source.title }, "staff-1");
      const saved = await repository.saveDraft("services", created.id, "zh", source, "staff-1");
      const provider: TranslationProvider = { translate: async () => { throw new Error("provider unavailable"); } };
      const service = createTranslationService(context.db, repository, provider, { createId: () => `job-${++id}` });
      const result = await service.generate({ collection: "services", id: created.id, actorId: "staff-1", targets: ["en"] });
      expect(result.jobs[0]).toMatchObject({ status: "failed", lastError: "provider unavailable" });
      expect(result.item.translations.zh).toEqual(saved.translations.zh);
      expect(result.item.translations.en?.title).toBe("");
    } finally {
      context.close();
    }
  });
});
