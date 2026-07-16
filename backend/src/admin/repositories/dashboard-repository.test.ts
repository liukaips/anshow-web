import { describe, expect, it } from "vitest";

import {
  auditLogs,
  contentReviews,
  contentWorkflow,
  inquiries,
  notificationDeliveries,
  serviceTranslations,
  services,
  translationJobs,
} from "../../db/schema/index.js";
import { createTestDatabase } from "../../db/test-db.js";
import { createDashboardRepository } from "./dashboard-repository.js";

const now = new Date("2026-07-16T04:00:00.000Z");

describe("dashboard repository", () => {
  it("orders assigned inquiries by business priority rather than text", () => {
    const context = createTestDatabase();
    try {
      const rows = (["low", "normal", "high", "urgent"] as const).map((priority, index) => ({
        id: `priority-${priority}`,
        name: priority,
        company: "Priority Co",
        email: `${priority}@example.test`,
        phone: "",
        transportNeed: "rail",
        message: "priority order",
        locale: "en" as const,
        sourceUrl: "/en/quote",
        privacyVersion: "2026-01",
        consentedAt: now.getTime(),
        assigneeId: "staff-1",
        priority,
        status: "in_progress" as const,
        createdAt: now.getTime(),
        updatedAt: now.getTime() + index,
      }));
      context.db.insert(inquiries).values(rows).run();

      expect(
        createDashboardRepository(context.db, { now: () => now })
          .summary("staff-1")
          .tasks.inquiries.map((item) => item.priority),
      ).toEqual(["urgent", "high", "normal", "low"]);
    } finally {
      context.close();
    }
  });

  it("counts current translation work once per content item and ignores stale failures", () => {
    const context = createTestDatabase();
    try {
      context.db.insert(contentWorkflow).values({
        entityType: "services",
        entityId: "service-1",
        state: "translation_pending",
        version: 2,
        updatedAt: now,
      }).run();
      context.db.insert(translationJobs).values([
        { id: "current-en", entityType: "services", entityId: "service-1", sourceVersion: 2, targetLocale: "en", status: "queued", createdAt: now, updatedAt: now },
        { id: "current-ru", entityType: "services", entityId: "service-1", sourceVersion: 2, targetLocale: "ru", status: "running", createdAt: now, updatedAt: now },
        { id: "stale-failed", entityType: "services", entityId: "service-1", sourceVersion: 1, targetLocale: "en", status: "failed", createdAt: now, updatedAt: now },
      ]).run();

      expect(
        createDashboardRepository(context.db, { now: () => now }).summary("staff-1"),
      ).toMatchObject({ translationPending: 1, systemHealth: "normal" });
    } finally {
      context.close();
    }
  });

  it("summarizes real operations and returns the current employee's tasks", () => {
    const context = createTestDatabase();
    try {
      context.db.insert(inquiries).values([
        {
          id: "inquiry-1",
          name: "Alice",
          company: "Acme",
          email: "alice@example.test",
          phone: "+1 555 0100",
          transportNeed: "air",
          message: "Urgent shipment",
          locale: "en",
          sourceUrl: "/en/quote",
          privacyVersion: "2026-01",
          consentedAt: now.getTime(),
          assigneeId: "staff-1",
          priority: "high",
          status: "new",
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
        {
          id: "inquiry-2",
          name: "Bob",
          company: "Beta",
          email: "bob@example.test",
          phone: "+1 555 0101",
          transportNeed: "rail",
          message: "Weekly shipment",
          locale: "en",
          sourceUrl: "/en/quote",
          privacyVersion: "2026-01",
          consentedAt: now.getTime(),
          assigneeId: "staff-2",
          priority: "normal",
          status: "new",
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
        {
          id: "inquiry-3",
          name: "Carol",
          company: "Cargo",
          email: "carol@example.test",
          phone: "+1 555 0102",
          transportNeed: "sea",
          message: "Closed shipment",
          locale: "en",
          sourceUrl: "/en/quote",
          privacyVersion: "2026-01",
          consentedAt: now.getTime(),
          assigneeId: "staff-1",
          priority: "urgent",
          status: "closed",
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
          closedAt: now.getTime(),
        },
      ]).run();

      context.db.insert(contentWorkflow).values([
        { entityType: "services", entityId: "service-1", state: "review_pending", ownerId: "editor-1", version: 2, submittedAt: now, updatedAt: now },
        { entityType: "articles", entityId: "article-1", state: "review_pending", ownerId: "editor-2", version: 4, submittedAt: now, updatedAt: now },
        { entityType: "pages", entityId: "page-1", state: "review_pending", ownerId: "editor-3", version: 3, submittedAt: now, updatedAt: now },
      ]).run();
      context.db.insert(contentReviews).values([
        { id: "review-1", entityType: "services", entityId: "service-1", sourceVersion: 2, submittedBy: "editor-1", decision: "pending", submittedAt: now },
        { id: "review-2", entityType: "articles", entityId: "article-1", sourceVersion: 4, submittedBy: "editor-2", decision: "pending", submittedAt: now },
        { id: "review-3", entityType: "pages", entityId: "page-1", sourceVersion: 3, submittedBy: "editor-3", decision: "pending", submittedAt: now },
      ]).run();

      context.db.insert(translationJobs).values([
        { id: "translation-1", entityType: "services", entityId: "service-1", sourceVersion: 2, targetLocale: "en", status: "queued", createdAt: now, updatedAt: now },
        { id: "translation-2", entityType: "services", entityId: "service-1", sourceVersion: 2, targetLocale: "ru", status: "succeeded", createdAt: now, updatedAt: now },
      ]).run();

      context.db.insert(services).values([
        { id: "published-1", code: "published-1", createdAt: now, updatedAt: now },
        { id: "published-2", code: "published-2", createdAt: now, updatedAt: now },
      ]).run();
      const translation = (ownerId: string, locale: "zh" | "en" | "ru") => ({
        ownerId,
        locale,
        status: "published" as const,
        publishedAt: now,
        slug: `${ownerId}-${locale}`,
        title: `${ownerId} ${locale}`,
        summary: "summary",
        body: "body",
        seoTitle: "seo",
        seoDescription: "description",
        altText: "alt",
        updatedAt: now,
      });
      context.db.insert(serviceTranslations).values([
        translation("published-1", "zh"),
        translation("published-1", "en"),
        translation("published-1", "ru"),
        translation("published-2", "zh"),
      ]).run();

      context.db.insert(auditLogs).values(
        Array.from({ length: 12 }, (_, index) => ({
          id: `audit-${String(index).padStart(2, "0")}`,
          actorId: index % 2 === 0 ? "staff-1" : "staff-2",
          action: "content.update",
          entityType: "services",
          entityId: `service-${index}`,
          detail: JSON.stringify({ index }),
          createdAt: new Date(now.getTime() + index),
        })),
      ).run();

      const summary = createDashboardRepository(context.db, { now: () => now }).summary("staff-1");

      expect(summary).toMatchObject({
        newInquiries: 2,
        highPriorityInquiries: 1,
        reviewPending: 3,
        translationPending: 1,
        publishedThisWeek: 4,
        systemHealth: "normal",
      });
      expect(summary.tasks.inquiries.map((task) => task.id)).toEqual(["inquiry-1"]);
      expect(summary.tasks.reviews).toEqual([]);
      expect(summary.recentAuditEvents).toHaveLength(10);
      expect(summary.recentAuditEvents[0]).toMatchObject({
        id: "audit-11",
        detail: { index: 11 },
      });
    } finally {
      context.close();
    }
  });

  it.each(["translation", "notification"] as const)(
    "reports a warning when a %s operation has failed",
    (failedOperation) => {
      const context = createTestDatabase();
      try {
        if (failedOperation === "translation") {
          context.db.insert(contentWorkflow).values({
            entityType: "services",
            entityId: "service-1",
            state: "translation_pending",
            version: 1,
            updatedAt: now,
          }).run();
          context.db.insert(translationJobs).values({
            id: "translation-failed",
            entityType: "services",
            entityId: "service-1",
            sourceVersion: 1,
            targetLocale: "en",
            status: "failed",
            attempts: 3,
            lastError: "provider unavailable",
            createdAt: now,
            updatedAt: now,
          }).run();
        } else {
          context.db.insert(notificationDeliveries).values({
            id: "notification-failed",
            inquiryId: "inquiry-1",
            status: "failed",
            attempts: 3,
            nextAttemptAt: now.getTime(),
            lastError: "mail provider unavailable",
            idempotencyKey: "notification-failed",
          }).run();
        }

        expect(
          createDashboardRepository(context.db, { now: () => now }).summary("staff-1"),
        ).toMatchObject({ systemHealth: "warning" });
      } finally {
        context.close();
      }
    },
  );
});
