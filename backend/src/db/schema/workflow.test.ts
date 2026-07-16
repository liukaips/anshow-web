import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../test-db.js";
import {
  contentReviews,
  contentWorkflow,
  previewSnapshots,
  previewTokens,
  translationJobs,
  workflowStates,
} from "./workflow.js";

describe("admin workflow schema", () => {
  it("exports every workflow persistence table", () => {
    const tableNames = [
      contentWorkflow,
      contentReviews,
      translationJobs,
      previewSnapshots,
      previewTokens,
    ].map(getTableName);

    expect(tableNames).toEqual([
      "content_workflow",
      "content_reviews",
      "translation_jobs",
      "preview_snapshots",
      "preview_tokens",
    ]);
  });

  it("defines the complete workflow state vocabulary", () => {
    expect(workflowStates).toEqual([
      "draft",
      "translation_pending",
      "review_pending",
      "changes_requested",
      "approved",
      "scheduled",
      "published",
      "archived",
    ]);
  });

  it("keeps one workflow row per entity and one translation job per source version", () => {
    const workflowConfig = getTableConfig(contentWorkflow);
    const jobConfig = getTableConfig(translationJobs);

    expect(workflowConfig.primaryKeys).toHaveLength(1);
    expect(workflowConfig.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "entity_type",
      "entity_id",
    ]);
    expect(jobConfig.uniqueConstraints[0]?.columns.map((column) => column.name)).toEqual([
      "entity_type",
      "entity_id",
      "source_version",
      "target_locale",
    ]);
  });

  it("indexes review queues, translation queues, and preview token hashes", () => {
    expect(getTableConfig(contentReviews).indexes.map((index) => index.config.name)).toContain(
      "content_reviews_queue_idx",
    );
    expect(getTableConfig(translationJobs).indexes.map((index) => index.config.name)).toContain(
      "translation_jobs_queue_idx",
    );
    expect(getTableConfig(previewTokens).indexes.map((index) => index.config.name)).toContain(
      "preview_tokens_token_hash_unique",
    );
  });

  it("rejects a changes-requested decision without a reason", () => {
    const testDatabase = createTestDatabase();

    try {
      expect(() =>
        testDatabase.db
          .insert(contentReviews)
          .values({
            id: "review-without-reason",
            entityType: "services",
            entityId: "cold-chain",
            sourceVersion: 2,
            submittedBy: "editor-1",
            reviewerId: "reviewer-1",
            decision: "changes_requested",
            decidedAt: new Date(),
          })
          .run(),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });
});
