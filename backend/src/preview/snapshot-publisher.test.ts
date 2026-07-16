import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  auditLogs,
  contentWorkflow,
  previewSnapshots,
  services,
  serviceTranslations,
} from "../db/schema/index.js";
import { createSnapshotPublisher } from "./snapshot-publisher.js";

const createdAt = new Date("2026-07-16T04:00:00.000Z");
const publishedAt = new Date("2026-07-16T05:00:00.000Z");
const contentHash = "a".repeat(64);

function addApprovedService(
  database: ReturnType<typeof createTestDatabase>["db"],
  id: string,
  version: number,
) {
  database.insert(services).values({ id, code: id, createdAt, updatedAt: createdAt }).run();
  database.insert(serviceTranslations).values(
    (["zh", "en", "ru"] as const).map((locale) => ({
      ownerId: id,
      locale,
      status: "draft" as const,
      slug: `${id}-${locale}`,
      title: `${id} ${locale}`,
      summary: "summary",
      body: "body",
      seoTitle: "seo title",
      seoDescription: "seo description",
      altText: "alt text",
      updatedAt: createdAt,
    })),
  ).run();
  database.insert(contentWorkflow).values({
    entityType: "services",
    entityId: id,
    state: "approved",
    ownerId: "editor-1",
    version,
    updatedAt: createdAt,
  }).run();
}

function addSnapshot(
  database: ReturnType<typeof createTestDatabase>["db"],
  versions: { entityType: string; entityId: string; version: number }[],
  id = "snapshot-1",
) {
  database.insert(previewSnapshots).values({
    id,
    payload: {},
    contentHash,
    sourceVersions: versions,
    createdBy: "editor-1",
    createdAt,
    expiresAt: new Date("2026-07-17T04:00:00.000Z"),
  }).run();
}

describe("snapshot publisher", () => {
  it("publishes every approved language and marks the exact snapshot atomically", () => {
    const context = createTestDatabase();
    try {
      addApprovedService(context.db, "service-1", 3);
      addSnapshot(context.db, [{ entityType: "services", entityId: "service-1", version: 3 }]);

      const result = createSnapshotPublisher(context.db, { now: () => publishedAt }).publish({
        snapshotId: "snapshot-1",
        expectedHash: contentHash,
        actorId: "publisher-1",
      });

      expect(result).toMatchObject({ snapshotId: "snapshot-1", contentHash, publishedAt });
      expect(context.db.select().from(serviceTranslations).all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locale: "zh", status: "published", publishedAt }),
          expect.objectContaining({ locale: "en", status: "published", publishedAt }),
          expect.objectContaining({ locale: "ru", status: "published", publishedAt }),
        ]),
      );
      expect(
        context.db.select().from(contentWorkflow).where(and(
          eq(contentWorkflow.entityType, "services"),
          eq(contentWorkflow.entityId, "service-1"),
        )).get(),
      ).toMatchObject({ state: "published", version: 4, ownerId: "publisher-1" });
      expect(context.db.select().from(previewSnapshots).get()?.publishedAt).toEqual(publishedAt);
      expect(context.db.select().from(auditLogs).get()).toMatchObject({
        actorId: "publisher-1",
        action: "preview.snapshot.publish",
        entityId: "snapshot-1",
      });
    } finally {
      context.close();
    }
  });

  it("rejects a stale source version without publishing any item", () => {
    const context = createTestDatabase();
    try {
      addApprovedService(context.db, "service-1", 2);
      addApprovedService(context.db, "service-2", 2);
      addSnapshot(context.db, [
        { entityType: "services", entityId: "service-1", version: 2 },
        { entityType: "services", entityId: "service-2", version: 2 },
      ]);
      context.db.update(contentWorkflow).set({ version: 3 }).where(eq(contentWorkflow.entityId, "service-2")).run();

      expect(() =>
        createSnapshotPublisher(context.db, { now: () => publishedAt }).publish({
          snapshotId: "snapshot-1",
          expectedHash: contentHash,
          actorId: "publisher-1",
        }),
      ).toThrowError(expect.objectContaining({ code: "CONTENT_VERSION_CONFLICT" }));

      expect(context.db.select().from(serviceTranslations).all().every((row) => row.status === "draft")).toBe(true);
      expect(context.db.select().from(previewSnapshots).get()?.publishedAt).toBeNull();
      expect(context.db.select().from(auditLogs).all()).toEqual([]);
    } finally {
      context.close();
    }
  });

  it("rejects an altered hash and an empty approved change set", () => {
    const context = createTestDatabase();
    try {
      addSnapshot(context.db, []);
      const publisher = createSnapshotPublisher(context.db, { now: () => createdAt });
      expect(() => publisher.publish({ snapshotId: "snapshot-1", expectedHash: "b".repeat(64), actorId: "publisher-1" })).toThrowError(expect.objectContaining({ code: "SNAPSHOT_HASH_MISMATCH" }));
      expect(() => publisher.publish({ snapshotId: "snapshot-1", expectedHash: contentHash, actorId: "publisher-1" })).toThrowError(expect.objectContaining({ code: "SNAPSHOT_NO_APPROVED_CHANGES" }));
    } finally {
      context.close();
    }
  });

  it("schedules a future immutable snapshot only when the approved source set is current", () => {
    const context = createTestDatabase();
    try {
      addApprovedService(context.db, "service-1", 3);
      addSnapshot(context.db, [{ entityType: "services", entityId: "service-1", version: 3 }]);
      const scheduledAt = new Date("2026-07-16T06:00:00.000Z");
      const publisher = createSnapshotPublisher(context.db, { now: () => publishedAt });
      const result = publisher.schedule({ snapshotId: "snapshot-1", expectedHash: contentHash, scheduledAt, actorId: "publisher-1" });

      expect(result).toMatchObject({ snapshotId: "snapshot-1", scheduledAt });
      expect(context.db.select().from(previewSnapshots).get()).toMatchObject({ scheduledAt, publishedAt: null });
      expect(context.db.select().from(auditLogs).get()).toMatchObject({ action: "preview.snapshot.schedule", actorId: "publisher-1" });
    } finally {
      context.close();
    }
  });

  it("rejects a non-future schedule and a changed approved source set", () => {
    const context = createTestDatabase();
    try {
      addApprovedService(context.db, "service-1", 3);
      addSnapshot(context.db, [{ entityType: "services", entityId: "service-1", version: 3 }]);
      const publisher = createSnapshotPublisher(context.db, { now: () => publishedAt });
      expect(() => publisher.schedule({ snapshotId: "snapshot-1", expectedHash: contentHash, scheduledAt: publishedAt, actorId: "publisher-1" })).toThrowError(expect.objectContaining({ code: "SNAPSHOT_SCHEDULE_NOT_FUTURE" }));
      addApprovedService(context.db, "service-2", 1);
      expect(() => publisher.schedule({ snapshotId: "snapshot-1", expectedHash: contentHash, scheduledAt: new Date("2026-07-16T06:00:00.000Z"), actorId: "publisher-1" })).toThrowError(expect.objectContaining({ code: "SNAPSHOT_SOURCE_SET_CHANGED" }));
    } finally {
      context.close();
    }
  });

  it("claims a due schedule once and clears the claim when execution fails", () => {
    const context = createTestDatabase();
    try {
      addApprovedService(context.db, "service-1", 3);
      addSnapshot(context.db, [{ entityType: "services", entityId: "service-1", version: 3 }]);
      const publisher = createSnapshotPublisher(context.db, { now: () => createdAt });
      publisher.schedule({ snapshotId: "snapshot-1", expectedHash: contentHash, scheduledAt: new Date("2026-07-16T04:30:00.000Z"), actorId: "publisher-1" });
      expect(publisher.claimDue("worker-1", publishedAt)).toMatchObject({ id: "snapshot-1", scheduleClaimedBy: "worker-1" });
      expect(publisher.claimDue("worker-2", publishedAt)).toBeNull();
      publisher.releaseClaim("snapshot-1", "worker-1");
      expect(context.db.select().from(previewSnapshots).get()).toMatchObject({ scheduleClaimedAt: null, scheduleClaimedBy: null });
    } finally {
      context.close();
    }
  });
});
