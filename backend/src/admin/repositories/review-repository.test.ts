import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { createContentRepository } from "./content-repository.js";
import { createReviewRepository } from "./review-repository.js";

const complete = (locale: "en" | "zh" | "ru") => ({
  title: `${locale} title`, slug: `${locale}-service`, summary: `${locale} summary`, body: `${locale} body`, seoTitle: `${locale} SEO`, seoDescription: `${locale} description`, altText: `${locale} image`,
});

describe("review repository", () => {
  it("submits a complete version and approves it transactionally", async () => {
    const context = createTestDatabase();
    try {
      let id = 0;
      const content = createContentRepository(context.db, { createId: () => `content-${++id}` });
      let item = await content.create("services", { titleZh: "运输服务" }, "editor-1");
      for (const locale of ["zh", "en", "ru"] as const) item = await content.saveDraft("services", item.id, locale, complete(locale), "editor-1");
      const reviews = createReviewRepository(context.db, content, { createId: () => `review-${++id}` });
      const submitted = await reviews.submit({ collection: "services", id: item.id, submittedBy: "editor-1", expectedVersion: item.workflow.version });
      expect(submitted).toMatchObject({ decision: "pending", sourceVersion: item.workflow.version + 1 });
      expect(reviews.list({ decision: "pending" })).toHaveLength(1);
      const approved = reviews.approve({ reviewId: submitted.id, reviewerId: "reviewer-1", expectedVersion: submitted.sourceVersion });
      expect(approved.workflow).toMatchObject({ state: "approved", version: submitted.sourceVersion + 1 });
      expect(approved.review).toMatchObject({ decision: "approved", reviewerId: "reviewer-1" });
    } finally {
      context.close();
    }
  });

  it("requires a reason when requesting changes", async () => {
    const context = createTestDatabase();
    try {
      const content = createContentRepository(context.db);
      const reviews = createReviewRepository(context.db, content);
      expect(() => reviews.reject({ reviewId: "missing", reviewerId: "reviewer-1", expectedVersion: 1, reason: "" })).toThrowError("请填写退回原因");
    } finally {
      context.close();
    }
  });
});
