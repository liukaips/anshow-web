import { describe, expect, it } from "vitest";

import {
  auditLogs,
  contentReviews,
  contentWorkflow,
  inquiries,
  serviceTranslations,
  services,
  translationJobs,
} from "../../db/schema/index.js";
import { createTestDatabase } from "../../db/test-db.js";
import { createDashboardRepository } from "./dashboard-repository.js";

const now = new Date("2026-07-16T04:00:00.000Z");

describe("dashboard repository", () => {
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
      expect(summary.tasks.reviews.map((task) => task.id)).toEqual([
        "review-1",
        "review-2",
        "review-3",
      ]);
      expect(summary.recentAuditEvents).toHaveLength(10);
      expect(summary.recentAuditEvents[0]).toMatchObject({
        id: "audit-11",
        detail: { index: 11 },
      });
    } finally {
      context.close();
    }
  });
});
