import { and, eq, sql } from "drizzle-orm";

import type { ContentRepository } from "../admin/repositories/content-repository.js";
import type { AdminContentCollection } from "../admin/content/content-schema.js";
import type { AppDatabase } from "../db/client.js";
import { translationJobs, type translationTargetLocales } from "../db/schema/workflow.js";
import type { TranslationProvider, TranslationSource } from "./translation-provider.js";

type TargetLocale = (typeof translationTargetLocales)[number];

type TranslationServiceOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function createTranslationService(
  database: AppDatabase,
  contentRepository: ContentRepository,
  provider: TranslationProvider,
  options: TranslationServiceOptions = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    async generate(input: {
      collection: AdminContentCollection;
      id: string;
      actorId: string;
      targets: readonly TargetLocale[];
      sourceVersion?: number;
    }) {
      const initialItem = await contentRepository.get(input.collection, input.id);
      const sourceTranslation = initialItem.translations.zh;
      if (!sourceTranslation) throw new Error("请先填写中文内容");
      const source: TranslationSource = {
        title: sourceTranslation.title,
        summary: sourceTranslation.summary,
        body: sourceTranslation.body,
        seoTitle: sourceTranslation.seoTitle,
        seoDescription: sourceTranslation.seoDescription,
        altText: sourceTranslation.altText,
      };
      if (Object.values(source).some((value) => !value.trim())) {
        throw new Error("请先完整填写中文标题、介绍、正文、SEO 和图片说明");
      }
      const sourceVersion = input.sourceVersion ?? initialItem.workflow.version;
      const jobs = [];

      for (const targetLocale of [...new Set(input.targets)]) {
        let job = database.select().from(translationJobs).where(and(
          eq(translationJobs.entityType, input.collection),
          eq(translationJobs.entityId, input.id),
          eq(translationJobs.sourceVersion, sourceVersion),
          eq(translationJobs.targetLocale, targetLocale),
        )).get();
        if (job?.status === "succeeded") {
          jobs.push(job);
          continue;
        }
        const timestamp = now();
        if (!job) {
          database.insert(translationJobs).values({
            id: createId(),
            entityType: input.collection,
            entityId: input.id,
            sourceVersion,
            targetLocale,
            status: "queued",
            attempts: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          }).run();
          job = database.select().from(translationJobs).where(and(
            eq(translationJobs.entityType, input.collection),
            eq(translationJobs.entityId, input.id),
            eq(translationJobs.sourceVersion, sourceVersion),
            eq(translationJobs.targetLocale, targetLocale),
          )).get();
        }
        if (!job) throw new Error("翻译任务创建失败");
        database.update(translationJobs).set({
          status: "running",
          attempts: sql`${translationJobs.attempts} + 1`,
          lastError: null,
          updatedAt: timestamp,
        }).where(eq(translationJobs.id, job.id)).run();
        try {
          const translated = await provider.translate({ source, targetLocale });
          await contentRepository.saveDraft(input.collection, input.id, targetLocale, translated, input.actorId);
          database.update(translationJobs).set({ status: "succeeded", lastError: null, updatedAt: now() }).where(eq(translationJobs.id, job.id)).run();
        } catch (error) {
          const message = error instanceof Error ? error.message : "翻译服务执行失败";
          database.update(translationJobs).set({ status: "failed", lastError: message.slice(0, 500), updatedAt: now() }).where(eq(translationJobs.id, job.id)).run();
        }
        jobs.push(database.select().from(translationJobs).where(eq(translationJobs.id, job.id)).get()!);
      }

      return {
        sourceVersion,
        jobs,
        item: await contentRepository.get(input.collection, input.id),
      };
    },
    listJobs(collection: AdminContentCollection, id: string) {
      return database.select().from(translationJobs).where(and(
        eq(translationJobs.entityType, collection),
        eq(translationJobs.entityId, id),
      )).all();
    },
  };
}

export type TranslationService = ReturnType<typeof createTranslationService>;
