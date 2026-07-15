import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import {
  auditLogs,
  mediaAssetTranslations,
  mediaAssets,
  mediaDerivatives,
  mediaUsage,
} from "../../db/schema/index.js";
import {
  createMediaRepository,
  type PersistedMediaInput,
} from "./media-repository.js";

const now = new Date("2026-07-15T04:00:00.000Z");
const metadata = {
  alt: { en: "Truck at warehouse", zh: "仓库中的卡车", ru: "Грузовик на складе" },
  focalX: 0.4,
  focalY: 0.6,
} as const;

function mediaInput(generation: string): PersistedMediaInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    storageKey: `${generation}/master.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    dominantColor: "#445566",
    ...metadata,
    derivatives: [
      {
        id: `${generation}-webp-480`,
        storageKey: `${generation}/480.webp`,
        url: `/media/${generation}/480.webp`,
        format: "webp",
        width: 480,
        height: 320,
        byteSize: 12_000,
      },
      {
        id: `${generation}-avif-480`,
        storageKey: `${generation}/480.avif`,
        url: `/media/${generation}/480.avif`,
        format: "avif",
        width: 480,
        height: 320,
        byteSize: 9_000,
      },
    ],
  };
}

describe("media repository", () => {
  let context: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    context = createTestDatabase();
  });

  afterEach(() => context.close());

  function repository() {
    let auditId = 0;
    return createMediaRepository(context.db, {
      now: () => now,
      createAuditId: () => `audit-${++auditId}`,
    });
  }

  it("inserts a complete localized asset and returns generated typed records", async () => {
    const result = await repository().insert(mediaInput("generation-a"), "staff-1");

    expect(result).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      storageKey: "generation-a/master.jpg",
      alt: metadata.alt,
      focalX: 0.4,
      focalY: 0.6,
      referenceCount: 0,
    });
    expect(result.derivatives).toHaveLength(2);
    expect(context.db.select().from(mediaAssetTranslations).all()).toHaveLength(3);
    expect(context.db.select().from(auditLogs).all()).toEqual([
      expect.objectContaining({
        actorId: "staff-1",
        action: "media.create",
        entityId: result.id,
      }),
    ]);
    await expect(repository().list()).resolves.toEqual([result]);
  });

  it("updates all alt text and focal coordinates in the same audited transaction", async () => {
    const repo = repository();
    await repo.insert(mediaInput("generation-a"), "staff-1");

    const updated = await repo.updateMetadata(
      mediaInput("generation-a").id,
      {
        alt: { en: "EN updated", zh: "ZH updated", ru: "RU updated" },
        focalX: 0.25,
        focalY: 0.75,
      },
      "staff-2",
    );

    expect(updated).toMatchObject({
      alt: { en: "EN updated", zh: "ZH updated", ru: "RU updated" },
      focalX: 0.25,
      focalY: 0.75,
    });
    expect(context.db.select().from(auditLogs).all().at(-1)).toMatchObject({
      actorId: "staff-2",
      action: "media.metadata.update",
    });
  });

  it("preserves the media ID and usage references during replacement", async () => {
    const repo = repository();
    const original = await repo.insert(mediaInput("generation-a"), "staff-1");
    context.db.insert(mediaUsage).values({
      mediaId: original.id,
      entityType: "hero-slide",
      entityId: "hero-1",
      field: "image",
    }).run();

    const replacement = await repo.replace(
      original.id,
      { ...mediaInput("generation-b"), id: original.id },
      "staff-2",
    );

    expect(replacement).toMatchObject({
      id: original.id,
      storageKey: "generation-b/master.jpg",
      referenceCount: 1,
    });
    expect(replacement.references).toEqual([
      { entityType: "hero-slide", entityId: "hero-1", field: "image" },
    ]);
    expect(context.db.select().from(mediaUsage).all()).toHaveLength(1);
    expect(context.db.select().from(mediaDerivatives).all()).toHaveLength(2);
  });

  it("blocks deletion of referenced media with its reference list", async () => {
    const repo = repository();
    const asset = await repo.insert(mediaInput("generation-a"), "staff-1");
    context.db.insert(mediaUsage).values({
      mediaId: asset.id,
      entityType: "article",
      entityId: "article-1",
      field: "leadImage",
    }).run();

    await expect(repo.deleteWithAudit(asset.id, "staff-1")).rejects.toMatchObject({
      code: "MEDIA_IN_USE",
      references: [
        { entityType: "article", entityId: "article-1", field: "leadImage" },
      ],
    });
    expect(context.db.select().from(mediaAssets).all()).toHaveLength(1);
  });

  it("deletes an unused asset and its records with an audit row", async () => {
    const repo = repository();
    const asset = await repo.insert(mediaInput("generation-a"), "staff-1");

    const deleted = await repo.deleteWithAudit(asset.id, "staff-1");

    expect(deleted.storageKeys).toEqual([
      "generation-a/master.jpg",
      "generation-a/480.avif",
      "generation-a/480.webp",
    ]);
    expect(context.db.select().from(mediaAssets).all()).toHaveLength(0);
    expect(context.db.select().from(mediaDerivatives).all()).toHaveLength(0);
    expect(context.db.select().from(auditLogs).all().at(-1)).toMatchObject({
      action: "media.delete",
      entityId: asset.id,
    });
  });

  it("rolls replacement back when its audit insert fails", async () => {
    const repo = repository();
    const original = await repo.insert(mediaInput("generation-a"), "staff-1");
    context.db.run(`
      CREATE TRIGGER reject_media_replace_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.action = 'media.replace'
      BEGIN
        SELECT RAISE(ABORT, 'media replacement audit rejected');
      END;
    `);

    await expect(
      repo.replace(original.id, { ...mediaInput("generation-b"), id: original.id }, "staff-2"),
    ).rejects.toThrow(/media replacement audit rejected/);

    expect(
      context.db.select().from(mediaAssets).where(eq(mediaAssets.id, original.id)).get(),
    ).toMatchObject({ storageKey: "generation-a/master.jpg" });
    expect(
      context.db.select().from(mediaDerivatives).all().map((row) => row.url).sort(),
    ).toEqual([
      "/media/generation-a/480.avif",
      "/media/generation-a/480.webp",
    ]);
  });
});
