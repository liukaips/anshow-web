import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { contentWorkflow, previewSnapshots, services, serviceTranslations } from "../db/schema/index.js";
import { createSnapshotPublisher } from "./snapshot-publisher.js";
import { processDueScheduledSnapshots } from "./scheduled-publish-worker.js";

const createdAt = new Date("2026-07-16T04:00:00.000Z");
const dueAt = new Date("2026-07-16T05:00:00.000Z");
const hash = "a".repeat(64);

function seed(context: ReturnType<typeof createTestDatabase>) {
  context.db.insert(services).values({ id: "service-1", code: "service-1", createdAt, updatedAt: createdAt }).run();
  context.db.insert(serviceTranslations).values(([
    "zh", "en", "ru",
  ] as const).map((locale) => ({ ownerId: "service-1", locale, status: "draft" as const, slug: `service-1-${locale}`, title: "title", summary: "summary", body: "body", seoTitle: "seo", seoDescription: "description", altText: "alt", updatedAt: createdAt }))).run();
  context.db.insert(contentWorkflow).values({ entityType: "services", entityId: "service-1", state: "approved", version: 1, updatedAt: createdAt }).run();
  context.db.insert(previewSnapshots).values({ id: "snapshot-1", payload: {}, contentHash: hash, sourceVersions: [{ entityType: "services", entityId: "service-1", version: 1 }], createdBy: "staff-1", createdAt, expiresAt: new Date("2026-07-17T04:00:00.000Z"), scheduledAt: new Date("2026-07-16T04:30:00.000Z") }).run();
}

describe("scheduled publication worker", () => {
  it("publishes a due snapshot once when two workers poll concurrently", async () => {
    const context = createTestDatabase();
    try {
      seed(context);
      const publisher = createSnapshotPublisher(context.db, { now: () => dueAt });
      const workerService = { ...publisher, publishSnapshot: publisher.publish };
      const [first, second] = await Promise.all([
        processDueScheduledSnapshots(workerService, "worker-1", dueAt),
        processDueScheduledSnapshots(workerService, "worker-2", dueAt),
      ]);
      expect(first.published + second.published).toBe(1);
      expect(first.processed + second.processed).toBe(1);
      expect(context.db.select().from(previewSnapshots).where(eq(previewSnapshots.id, "snapshot-1")).get()).toMatchObject({ publishedAt: dueAt, scheduledAt: null });
    } finally {
      context.close();
    }
  });
});
