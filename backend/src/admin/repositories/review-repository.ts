import { and, asc, eq } from "drizzle-orm";

import type { AdminContentCollection } from "../content/content-schema.js";
import { contentReviews, contentWorkflow } from "../../db/schema/workflow.js";
import type { AppDatabase } from "../../db/client.js";
import { transitionWorkflow } from "../../workflow/content-workflow.js";
import { createAuditRepository } from "./audit-repository.js";
import type { ContentRepository } from "./content-repository.js";

type ReviewDecision = typeof contentReviews.$inferSelect.decision;
type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function completeTranslation(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  return ["title", "slug", "summary", "body", "seoTitle", "seoDescription", "altText"].every((key) => typeof value[key] === "string" && value[key].trim().length > 0);
}

export function createReviewRepository(
  database: AppDatabase,
  content: ContentRepository,
  options: { createId?: () => string; now?: () => Date } = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const audit = (transaction: Transaction) => createAuditRepository(transaction, { createId, now });

  function workflow(entityType: string, entityId: string) {
    return database.select().from(contentWorkflow).where(and(eq(contentWorkflow.entityType, entityType), eq(contentWorkflow.entityId, entityId))).get();
  }

  function decide(input: { reviewId: string; reviewerId: string; expectedVersion: number; decision: "approved" | "changes_requested"; reason?: string }) {
    if (input.decision === "changes_requested" && !input.reason?.trim()) throw new Error("请填写退回原因");
    return database.transaction((transaction) => {
      const review = transaction.select().from(contentReviews).where(eq(contentReviews.id, input.reviewId)).get();
      if (!review) throw new Error("审核记录不存在");
      if (review.decision !== "pending") throw new Error("该审核任务已经处理");
      const current = transaction.select().from(contentWorkflow).where(and(eq(contentWorkflow.entityType, review.entityType), eq(contentWorkflow.entityId, review.entityId))).get();
      if (!current) throw new Error("内容工作流不存在");
      const next = transitionWorkflow({ currentState: current.state, nextState: input.decision === "approved" ? "approved" : "changes_requested", permission: "content.review", currentVersion: current.version, expectedVersion: input.expectedVersion });
      const decidedAt = now();
      transaction.update(contentReviews).set({ decision: input.decision, reviewerId: input.reviewerId, reason: input.decision === "changes_requested" ? input.reason!.trim() : null, decidedAt }).where(eq(contentReviews.id, review.id)).run();
      transaction.update(contentWorkflow).set({ state: next.state, version: next.version, updatedAt: decidedAt }).where(and(eq(contentWorkflow.entityType, review.entityType), eq(contentWorkflow.entityId, review.entityId))).run();
      audit(transaction).record({ actorId: input.reviewerId, action: input.decision === "approved" ? "content.review.approve" : "content.review.request-changes", entityType: review.entityType, entityId: review.entityId, detail: { reviewId: review.id, version: next.version, reason: input.reason?.trim() } });
      return {
        review: transaction.select().from(contentReviews).where(eq(contentReviews.id, review.id)).get()!,
        workflow: transaction.select().from(contentWorkflow).where(and(eq(contentWorkflow.entityType, review.entityType), eq(contentWorkflow.entityId, review.entityId))).get()!,
      };
    });
  }

  return {
    list(filters: { decision?: ReviewDecision } = {}) {
      return database.select().from(contentReviews).where(filters.decision ? eq(contentReviews.decision, filters.decision) : undefined).orderBy(asc(contentReviews.submittedAt)).all();
    },
    async submit(input: { collection: AdminContentCollection; id: string; submittedBy: string; expectedVersion: number }) {
      const item = await content.get(input.collection, input.id);
      if (!(["zh", "en", "ru"] as const).every((locale) => completeTranslation(item.translations[locale] as unknown as Record<string, unknown> | undefined))) {
        throw new Error("提交审核前请完整填写中文、英文和俄文内容");
      }
      return database.transaction((transaction) => {
        const current = transaction.select().from(contentWorkflow).where(and(eq(contentWorkflow.entityType, input.collection), eq(contentWorkflow.entityId, input.id))).get();
        if (!current) throw new Error("内容工作流不存在");
        const next = transitionWorkflow({ currentState: current.state, nextState: "review_pending", permission: "content.submit", currentVersion: current.version, expectedVersion: input.expectedVersion });
        const submittedAt = now();
        const id = createId();
        transaction.update(contentWorkflow).set({ state: next.state, version: next.version, submittedAt, updatedAt: submittedAt }).where(and(eq(contentWorkflow.entityType, input.collection), eq(contentWorkflow.entityId, input.id))).run();
        transaction.insert(contentReviews).values({ id, entityType: input.collection, entityId: input.id, sourceVersion: next.version, submittedBy: input.submittedBy, decision: "pending", submittedAt }).run();
        audit(transaction).record({ actorId: input.submittedBy, action: "content.review.submit", entityType: input.collection, entityId: input.id, detail: { reviewId: id, version: next.version } });
        return transaction.select().from(contentReviews).where(eq(contentReviews.id, id)).get()!;
      });
    },
    approve(input: { reviewId: string; reviewerId: string; expectedVersion: number }) {
      return decide({ ...input, decision: "approved" });
    },
    reject(input: { reviewId: string; reviewerId: string; expectedVersion: number; reason: string }) {
      return decide({ ...input, decision: "changes_requested" });
    },
    workflow,
  };
}

export type ReviewRepository = ReturnType<typeof createReviewRepository>;
