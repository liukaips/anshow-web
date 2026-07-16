import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import type { AdminContentCollection } from "../admin/content/content-schema.js";
import type { AppDatabase } from "../db/client.js";
import {
  articles,
  articleTranslations,
  auditLogs,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  certificates,
  certificateTranslations,
  contentWorkflow,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  partners,
  partnerTranslations,
  previewSnapshots,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/index.js";
import type { PreviewSourceVersion } from "../db/schema/workflow.js";
import { ContentVersionConflictError } from "../workflow/content-workflow.js";

type BaseTable = typeof services;
type TranslationTable = typeof serviceTranslations;
type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

type PublishConfig = Readonly<{
  base: BaseTable;
  requiresVerification: boolean;
  translations: TranslationTable;
}>;

const publishConfig: Record<AdminContentCollection, PublishConfig> = {
  pages: { base: pages, translations: pageTranslations, requiresVerification: false },
  "hero-slides": { base: heroSlides, translations: heroSlideTranslations, requiresVerification: false },
  services: { base: services, translations: serviceTranslations, requiresVerification: false },
  "trade-lanes": { base: tradeLanes, translations: tradeLaneTranslations, requiresVerification: false },
  "cargo-types": { base: cargoTypes, translations: cargoTypeTranslations, requiresVerification: false },
  "case-studies": { base: caseStudies, translations: caseStudyTranslations, requiresVerification: false },
  articles: { base: articles, translations: articleTranslations, requiresVerification: false },
  partners: { base: partners, translations: partnerTranslations, requiresVerification: true },
  certificates: { base: certificates, translations: certificateTranslations, requiresVerification: true },
  "proof-metrics": { base: proofMetrics, translations: proofMetricTranslations, requiresVerification: true },
  "navigation-items": { base: navigationItems, translations: navigationItemTranslations, requiresVerification: false },
};

export const SNAPSHOT_PUBLISH_ERROR_CODES = [
  "SNAPSHOT_NOT_FOUND",
  "SNAPSHOT_HASH_MISMATCH",
  "SNAPSHOT_EXPIRED",
  "SNAPSHOT_ALREADY_PUBLISHED",
  "SNAPSHOT_NO_APPROVED_CHANGES",
  "SNAPSHOT_SOURCE_NOT_FOUND",
  "SNAPSHOT_SOURCE_NOT_APPROVED",
  "SNAPSHOT_SOURCE_INCOMPLETE",
  "SNAPSHOT_SOURCE_UNVERIFIED",
  "SNAPSHOT_SOURCE_UNSUPPORTED",
  "SNAPSHOT_SCHEDULE_NOT_FUTURE",
  "SNAPSHOT_SCHEDULE_EXPIRED",
  "SNAPSHOT_SOURCE_SET_CHANGED",
  "SNAPSHOT_ALREADY_SCHEDULED",
  "SNAPSHOT_NOT_SCHEDULED",
  "SNAPSHOT_CLAIMED",
] as const;

export class SnapshotPublishError extends Error {
  readonly status = 409;

  constructor(readonly code: (typeof SNAPSHOT_PUBLISH_ERROR_CODES)[number], message: string) {
    super(message);
    this.name = "SnapshotPublishError";
  }
}

function collectionConfig(entityType: string): PublishConfig {
  if (!(entityType in publishConfig)) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_UNSUPPORTED", "预览包含不支持发布的内容类型");
  }
  return publishConfig[entityType as AdminContentCollection];
}

function validateSource(
  transaction: Transaction,
  source: { entityType: string; entityId: string; version: number },
) {
  const workflow = transaction
    .select()
    .from(contentWorkflow)
    .where(and(
      eq(contentWorkflow.entityType, source.entityType),
      eq(contentWorkflow.entityId, source.entityId),
    ))
    .get();
  if (!workflow) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_NOT_FOUND", "预览中的内容已不存在");
  }
  if (workflow.version !== source.version) {
    throw new ContentVersionConflictError(workflow.version, source.version);
  }
  if (workflow.state !== "approved") {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_NOT_APPROVED", "预览中的内容尚未通过审核");
  }

  const config = collectionConfig(source.entityType);
  const base = transaction.select().from(config.base).where(eq(config.base.id, source.entityId)).get();
  if (!base || base.archivedAt) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_NOT_FOUND", "预览中的内容已归档或不存在");
  }
  if (config.requiresVerification && (!base.verifiedAt || !base.verificationSource?.trim())) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_UNVERIFIED", "资质或证明内容缺少核验来源");
  }
  const translations = transaction
    .select()
    .from(config.translations)
    .where(eq(config.translations.ownerId, source.entityId))
    .all();
  const complete = translations.length === 3 && translations.every((translation) =>
    [
      translation.slug,
      translation.title,
      translation.summary,
      translation.body,
      translation.seoTitle,
      translation.seoDescription,
      translation.altText,
    ].every((value) => value.trim().length > 0),
  );
  if (!complete) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_INCOMPLETE", "预览中的三语内容不完整");
  }
  return config;
}

function sourceKey(source: { entityType: string; entityId: string; version: number }): string {
  return `${source.entityType}:${source.entityId}:${source.version}`;
}

function approvedSources(transaction: Transaction) {
  return transaction
    .select({ entityType: contentWorkflow.entityType, entityId: contentWorkflow.entityId, version: contentWorkflow.version })
    .from(contentWorkflow)
    .where(eq(contentWorkflow.state, "approved"))
    .orderBy(asc(contentWorkflow.entityType), asc(contentWorkflow.entityId))
    .all();
}

function assertApprovedSourceSet(transaction: Transaction, sourceVersions: PreviewSourceVersion[]): void {
  const expected = sourceVersions.map(sourceKey).sort();
  const current = approvedSources(transaction).map(sourceKey).sort();
  if (expected.length !== current.length || expected.some((value, index) => value !== current[index])) {
    throw new SnapshotPublishError("SNAPSHOT_SOURCE_SET_CHANGED", "审核通过的内容已变化，请重新生成预览快照");
  }
}

export function createSnapshotPublisher(
  database: AppDatabase,
  options: { createId?: () => string; now?: () => Date } = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    publish(input: { snapshotId: string; expectedHash: string; actorId: string }) {
      return database.transaction((transaction) => {
        const snapshot = transaction
          .select()
          .from(previewSnapshots)
          .where(eq(previewSnapshots.id, input.snapshotId))
          .get();
        if (!snapshot) throw new SnapshotPublishError("SNAPSHOT_NOT_FOUND", "预览快照不存在");
        if (snapshot.contentHash !== input.expectedHash) {
          throw new SnapshotPublishError("SNAPSHOT_HASH_MISMATCH", "预览校验值不一致，请重新生成预览");
        }
        const timestamp = now();
        if (snapshot.expiresAt && snapshot.expiresAt <= timestamp) {
          throw new SnapshotPublishError("SNAPSHOT_EXPIRED", "预览快照已过期，请重新生成");
        }
        if (snapshot.publishedAt) {
          throw new SnapshotPublishError("SNAPSHOT_ALREADY_PUBLISHED", "该预览快照已经发布");
        }
        if (snapshot.scheduledAt && snapshot.scheduledAt > timestamp) {
          throw new SnapshotPublishError("SNAPSHOT_ALREADY_SCHEDULED", "该快照已安排定时发布，请先取消定时任务");
        }
        if (snapshot.scheduleClaimedBy && snapshot.scheduleClaimedBy !== input.actorId) {
          throw new SnapshotPublishError("SNAPSHOT_CLAIMED", "该定时发布正在由其他工作进程执行");
        }
        if (snapshot.sourceVersions.length === 0) {
          throw new SnapshotPublishError("SNAPSHOT_NO_APPROVED_CHANGES", "当前预览没有已审核且可发布的变更");
        }

        const validated = snapshot.sourceVersions.map((source) => ({
          source,
          config: validateSource(transaction, source),
        }));
        assertApprovedSourceSet(transaction, snapshot.sourceVersions);

        for (const { source, config } of validated) {
          transaction
            .update(config.translations)
            .set({
              status: "published",
              scheduledAt: null,
              publishedAt: timestamp,
              updatedAt: timestamp,
            })
            .where(eq(config.translations.ownerId, source.entityId))
            .run();
          transaction
            .update(contentWorkflow)
            .set({
              state: "published",
              ownerId: input.actorId,
              version: sql`${contentWorkflow.version} + 1`,
              updatedAt: timestamp,
            })
            .where(and(
              eq(contentWorkflow.entityType, source.entityType),
              eq(contentWorkflow.entityId, source.entityId),
            ))
            .run();
        }

        transaction
          .update(previewSnapshots)
          .set({ publishedAt: timestamp, scheduledAt: null, scheduleClaimedAt: null, scheduleClaimedBy: null })
          .where(eq(previewSnapshots.id, snapshot.id))
          .run();
        transaction.insert(auditLogs).values({
          id: createId(),
          actorId: input.actorId,
          action: "preview.snapshot.publish",
          entityType: "preview",
          entityId: snapshot.id,
          detail: JSON.stringify({ contentHash: snapshot.contentHash, changes: validated.length }),
          createdAt: timestamp,
        }).run();

        return {
          snapshotId: snapshot.id,
          contentHash: snapshot.contentHash,
          publishedAt: timestamp,
          publishedChanges: validated.length,
        };
      });
    },
    schedule(input: { snapshotId: string; expectedHash: string; scheduledAt: Date; actorId: string }) {
      return database.transaction((transaction) => {
        const snapshot = transaction.select().from(previewSnapshots).where(eq(previewSnapshots.id, input.snapshotId)).get();
        if (!snapshot) throw new SnapshotPublishError("SNAPSHOT_NOT_FOUND", "预览快照不存在");
        if (snapshot.contentHash !== input.expectedHash) throw new SnapshotPublishError("SNAPSHOT_HASH_MISMATCH", "预览校验值不一致，请重新生成预览");
        const timestamp = now();
        if (input.scheduledAt <= timestamp) throw new SnapshotPublishError("SNAPSHOT_SCHEDULE_NOT_FUTURE", "定时发布时间必须晚于当前时间");
        if (snapshot.expiresAt && input.scheduledAt >= snapshot.expiresAt) throw new SnapshotPublishError("SNAPSHOT_SCHEDULE_EXPIRED", "定时发布时间必须早于预览快照过期时间");
        if (snapshot.expiresAt && snapshot.expiresAt <= timestamp) throw new SnapshotPublishError("SNAPSHOT_EXPIRED", "预览快照已过期，请重新生成");
        if (snapshot.publishedAt) throw new SnapshotPublishError("SNAPSHOT_ALREADY_PUBLISHED", "该预览快照已经发布");
        if (snapshot.scheduledAt) throw new SnapshotPublishError("SNAPSHOT_ALREADY_SCHEDULED", "该预览快照已经设置定时发布");
        if (snapshot.sourceVersions.length === 0) throw new SnapshotPublishError("SNAPSHOT_NO_APPROVED_CHANGES", "当前预览没有已审核且可发布的变更");
        snapshot.sourceVersions.forEach((source) => validateSource(transaction, source));
        assertApprovedSourceSet(transaction, snapshot.sourceVersions);
        transaction.update(previewSnapshots).set({ scheduledAt: input.scheduledAt }).where(eq(previewSnapshots.id, snapshot.id)).run();
        transaction.insert(auditLogs).values({
          id: createId(), actorId: input.actorId, action: "preview.snapshot.schedule", entityType: "preview", entityId: snapshot.id,
          detail: JSON.stringify({ contentHash: snapshot.contentHash, scheduledAt: input.scheduledAt.toISOString(), changes: snapshot.sourceVersions.length }), createdAt: timestamp,
        }).run();
        return { snapshotId: snapshot.id, contentHash: snapshot.contentHash, scheduledAt: input.scheduledAt, changes: snapshot.sourceVersions.length };
      });
    },
    cancelSchedule(input: { snapshotId: string; actorId: string }) {
      return database.transaction((transaction) => {
        const snapshot = transaction.select().from(previewSnapshots).where(eq(previewSnapshots.id, input.snapshotId)).get();
        if (!snapshot) throw new SnapshotPublishError("SNAPSHOT_NOT_FOUND", "预览快照不存在");
        if (!snapshot.scheduledAt) throw new SnapshotPublishError("SNAPSHOT_NOT_SCHEDULED", "该预览快照没有定时任务");
        if (snapshot.scheduleClaimedBy) throw new SnapshotPublishError("SNAPSHOT_CLAIMED", "该定时发布正在执行，暂不能取消");
        const timestamp = now();
        transaction.update(previewSnapshots).set({ scheduledAt: null }).where(eq(previewSnapshots.id, snapshot.id)).run();
        transaction.insert(auditLogs).values({ id: createId(), actorId: input.actorId, action: "preview.snapshot.schedule-cancel", entityType: "preview", entityId: snapshot.id, detail: JSON.stringify({ contentHash: snapshot.contentHash }), createdAt: timestamp }).run();
        return { snapshotId: snapshot.id, cancelled: true as const };
      });
    },
    claimDue(workerId: string, at = now()) {
      const claimedAt = at;
      const candidate = database.select().from(previewSnapshots).where(and(lte(previewSnapshots.scheduledAt, at), isNull(previewSnapshots.publishedAt), isNull(previewSnapshots.scheduleClaimedAt))).orderBy(asc(previewSnapshots.scheduledAt), asc(previewSnapshots.createdAt)).get();
      if (!candidate) return null;
      const changed = database.update(previewSnapshots).set({ scheduleClaimedAt: claimedAt, scheduleClaimedBy: workerId }).where(and(eq(previewSnapshots.id, candidate.id), lte(previewSnapshots.scheduledAt, at), isNull(previewSnapshots.publishedAt), isNull(previewSnapshots.scheduleClaimedAt))).run();
      return changed.changes === 1 ? database.select().from(previewSnapshots).where(eq(previewSnapshots.id, candidate.id)).get() ?? null : null;
    },
    releaseClaim(snapshotId: string, workerId: string) {
      database.update(previewSnapshots).set({ scheduleClaimedAt: null, scheduleClaimedBy: null }).where(and(eq(previewSnapshots.id, snapshotId), eq(previewSnapshots.scheduleClaimedBy, workerId))).run();
    },
  };
}

export type SnapshotPublisher = ReturnType<typeof createSnapshotPublisher>;
