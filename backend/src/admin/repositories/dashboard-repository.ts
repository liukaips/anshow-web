import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  sql,
  notInArray,
} from "drizzle-orm";

import type { AppDatabase } from "../../db/client.js";
import {
  articleTranslations,
  cargoTypeTranslations,
  caseStudyTranslations,
  certificateTranslations,
  heroSlideTranslations,
  navigationItemTranslations,
  pageTranslations,
  partnerTranslations,
  proofMetricTranslations,
  serviceTranslations,
  tradeLaneTranslations,
} from "../../db/schema/content.js";
import {
  inquiries,
  notificationDeliveries,
} from "../../db/schema/inquiries.js";
import {
  contentReviews,
  contentWorkflow,
  translationJobs,
} from "../../db/schema/workflow.js";
import { createAuditQueryRepository } from "./audit-query-repository.js";

const terminalInquiryStatuses: Array<"completed" | "closed" | "spam"> = [
  "completed",
  "closed",
  "spam",
];
const pendingTranslationStatuses: Array<"queued" | "running"> = [
  "queued",
  "running",
];
const publicationTables = [
  serviceTranslations,
  heroSlideTranslations,
  tradeLaneTranslations,
  cargoTypeTranslations,
  caseStudyTranslations,
  articleTranslations,
  partnerTranslations,
  certificateTranslations,
  proofMetricTranslations,
  pageTranslations,
  navigationItemTranslations,
] as const;

function startOfShanghaiWeek(value: Date): Date {
  const shanghaiOffset = 8 * 60 * 60 * 1_000;
  const shifted = new Date(value.getTime() + shanghaiOffset);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday,
    ) - shanghaiOffset,
  );
}

export function createDashboardRepository(
  database: AppDatabase,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());
  const audit = createAuditQueryRepository(database);

  return {
    summary(actorId: string) {
      const newInquiries = database
        .select({ value: count() })
        .from(inquiries)
        .where(eq(inquiries.status, "new"))
        .get()?.value ?? 0;
      const highPriorityInquiries = database
        .select({ value: count() })
        .from(inquiries)
        .where(
          and(
            inArray(inquiries.priority, ["high", "urgent"]),
            notInArray(inquiries.status, terminalInquiryStatuses),
          ),
        )
        .get()?.value ?? 0;
      const reviewPending = database
        .select({ value: count() })
        .from(contentWorkflow)
        .where(eq(contentWorkflow.state, "review_pending"))
        .get()?.value ?? 0;
      const translationPending = database
        .select({
          entityType: translationJobs.entityType,
          entityId: translationJobs.entityId,
        })
        .from(translationJobs)
        .innerJoin(
          contentWorkflow,
          and(
            eq(contentWorkflow.entityType, translationJobs.entityType),
            eq(contentWorkflow.entityId, translationJobs.entityId),
            eq(contentWorkflow.version, translationJobs.sourceVersion),
          ),
        )
        .where(inArray(translationJobs.status, pendingTranslationStatuses))
        .groupBy(translationJobs.entityType, translationJobs.entityId)
        .all().length;
      const weekStart = startOfShanghaiWeek(now());
      const publishedThisWeek = publicationTables.reduce(
        (total, table) =>
          total +
          (database
            .select({ value: count() })
            .from(table)
            .where(gte(table.publishedAt, weekStart))
            .get()?.value ?? 0),
        0,
      );
      const assignedInquiries = database
        .select({
          id: inquiries.id,
          name: inquiries.name,
          company: inquiries.company,
          priority: inquiries.priority,
          status: inquiries.status,
          updatedAt: inquiries.updatedAt,
        })
        .from(inquiries)
        .where(
          and(
            eq(inquiries.assigneeId, actorId),
            notInArray(inquiries.status, terminalInquiryStatuses),
          ),
        )
        .orderBy(
          desc(sql<number>`case ${inquiries.priority} when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end`),
          desc(inquiries.updatedAt),
        )
        .limit(10)
        .all();
      const reviewTasks = database
        .select({
          id: contentReviews.id,
          entityType: contentReviews.entityType,
          entityId: contentReviews.entityId,
          sourceVersion: contentReviews.sourceVersion,
          submittedBy: contentReviews.submittedBy,
          submittedAt: contentReviews.submittedAt,
        })
        .from(contentReviews)
        .where(
          and(
            eq(contentReviews.decision, "pending"),
            eq(contentReviews.reviewerId, actorId),
          ),
        )
        .orderBy(contentReviews.submittedAt)
        .limit(10)
        .all();
      const failedTranslations = database
        .select({ value: count() })
        .from(translationJobs)
        .innerJoin(
          contentWorkflow,
          and(
            eq(contentWorkflow.entityType, translationJobs.entityType),
            eq(contentWorkflow.entityId, translationJobs.entityId),
            eq(contentWorkflow.version, translationJobs.sourceVersion),
          ),
        )
        .where(eq(translationJobs.status, "failed"))
        .get()?.value ?? 0;
      const failedNotifications = database
        .select({ value: count() })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.status, "failed"))
        .get()?.value ?? 0;

      return {
        newInquiries,
        highPriorityInquiries,
        reviewPending,
        translationPending,
        publishedThisWeek,
        tasks: {
          inquiries: assignedInquiries,
          reviews: reviewTasks,
        },
        recentAuditEvents: audit.list({ pageSize: 10 }).items,
        systemHealth: (failedTranslations + failedNotifications > 0
          ? "warning"
          : "normal") as "normal" | "warning" | "unavailable",
      };
    },
  };
}

export type DashboardRepository = ReturnType<typeof createDashboardRepository>;
