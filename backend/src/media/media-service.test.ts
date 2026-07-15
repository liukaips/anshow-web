import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import type {
  AdminMediaAsset,
  MediaRepository,
} from "../admin/repositories/media-repository.js";
import {
  createMediaService,
  DERIVATIVE_BUDGETS,
  MAX_UPLOAD_BYTES,
  processUpload,
  type ProcessedMedia,
  validateUpload,
} from "./media-service.js";
import type { MediaStorage } from "./storage.js";

describe("validateUpload", () => {
  it("rejects executable bytes named like a JPEG", async () => {
    const executable = new TextEncoder().encode("#!/bin/sh\necho unsafe\n");

    await expect(
      validateUpload({
        name: "staff-photo.jpg",
        type: "image/jpeg",
        bytes: executable,
      }),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA" });
  });

  it("trusts decoded image metadata instead of the claimed MIME type", async () => {
    const bytes = await sharp({
      create: {
        width: 32,
        height: 18,
        channels: 3,
        background: "#17324d",
      },
    })
      .png()
      .toBuffer();

    await expect(
      validateUpload({ name: "wrong.jpg", type: "image/jpeg", bytes }),
    ).resolves.toMatchObject({
      format: "png",
      mimeType: "image/png",
      width: 32,
      height: 18,
    });
  });

  it("rejects uploads above the 20 MB service limit before decoding", async () => {
    await expect(
      validateUpload({
        name: "large.png",
        type: "image/png",
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      }),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE", status: 413 });
  });

  it("rejects animated WebP input", async () => {
    const raw = Buffer.alloc(8 * 16 * 4);
    for (let index = 0; index < raw.length; index += 4) {
      const firstFrame = index < raw.length / 2;
      raw.set(firstFrame ? [220, 30, 40, 255] : [20, 80, 220, 255], index);
    }
    const frames = await sharp(raw, {
      raw: { width: 8, height: 16, pageHeight: 8, channels: 4 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();

    await expect(
      validateUpload({ name: "animated.webp", type: "image/webp", bytes: frames }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  });
});

describe("processUpload", () => {
  it("auto-rotates, strips source metadata, and records actual output dimensions", async () => {
    const source = await sharp({
      create: {
        width: 40,
        height: 24,
        channels: 3,
        background: "#c54b35",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const processed = await processUpload({
      name: "rotated.jpg",
      type: "image/jpeg",
      bytes: source,
    });
    const masterMetadata = await sharp(processed.master.bytes).metadata();

    expect(processed).toMatchObject({ width: 24, height: 40, mimeType: "image/jpeg" });
    expect(masterMetadata).toMatchObject({ width: 24, height: 40 });
    expect(masterMetadata.orientation).toBeUndefined();
    expect(masterMetadata.exif).toBeUndefined();
  });

  it("generates non-enlarged AVIF and WebP variants within tier budgets", async () => {
    const source = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: "#496f62",
      },
    })
      .png()
      .toBuffer();

    const processed = await processUpload({
      name: "yard.png",
      type: "image/png",
      bytes: source,
    });

    expect(processed.derivatives.map(({ format, width }) => `${format}:${width}`)).toEqual([
      "avif:480",
      "webp:480",
      "avif:768",
      "webp:768",
      "avif:900",
      "webp:900",
    ]);
    for (const derivative of processed.derivatives) {
      expect(derivative.byteSize).toBe(derivative.bytes.byteLength);
      expect(derivative.byteSize).toBeLessThanOrEqual(
        DERIVATIVE_BUDGETS.find((tier) => derivative.width <= tier.maxWidth)!
          .maxBytes,
      );
    }
  });
});

const processedFixture: ProcessedMedia = {
  width: 800,
  height: 500,
  mimeType: "image/jpeg",
  dominantColor: "#123456",
  master: {
    bytes: new Uint8Array([1, 2]),
    format: "jpeg",
    contentType: "image/jpeg",
    width: 800,
    height: 500,
    byteSize: 2,
  },
  derivatives: [
    {
      bytes: new Uint8Array([3]),
      format: "avif",
      contentType: "image/avif",
      width: 480,
      height: 300,
      byteSize: 1,
    },
    {
      bytes: new Uint8Array([4]),
      format: "webp",
      contentType: "image/webp",
      width: 480,
      height: 300,
      byteSize: 1,
    },
  ],
};

const inputMetadata = {
  alt: { en: "English", zh: "中文", ru: "Русский" },
  focalX: 0.5,
  focalY: 0.5,
} as const;

function fakeRepository(overrides: Partial<MediaRepository> = {}): MediaRepository {
  const unavailable = async () => {
    throw new Error("not configured");
  };
  return {
    list: vi.fn(async () => []),
    get: vi.fn(unavailable),
    insert: vi.fn(unavailable),
    updateMetadata: vi.fn(unavailable),
    replace: vi.fn(unavailable),
    references: vi.fn(async () => []),
    deleteWithAudit: vi.fn(unavailable),
    ...overrides,
  };
}

function fakeStorage(events: string[] = []): MediaStorage & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async put(key) {
      events.push(`put:${key}`);
      keys.add(key);
      return `/media/${key}`;
    },
    async delete(key) {
      events.push(`delete:${key}`);
      keys.delete(key);
    },
  };
}

describe("media service orchestration", () => {
  it("cleans every written object when the repository insert fails", async () => {
    const storage = fakeStorage();
    const repository = fakeRepository({
      insert: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "generation-a",
      "derivative-a",
      "derivative-b",
    ];
    const service = createMediaService({
      storage,
      repository,
      process: async () => processedFixture,
      createId: () => ids.shift()!,
    });

    await expect(
      service.upload(
        { name: "photo.jpg", type: "image/jpeg", bytes: new Uint8Array([1]) },
        inputMetadata,
        "staff-1",
      ),
    ).rejects.toThrow("database unavailable");
    expect(storage.keys.size).toBe(0);
  });

  it("cleans earlier objects when a derivative write fails", async () => {
    const deleted: string[] = [];
    let writes = 0;
    const storage: MediaStorage = {
      async put(key) {
        writes += 1;
        if (writes === 2) throw new Error("object write failed");
        return `/media/${key}`;
      },
      async delete(key) {
        deleted.push(key);
      },
    };
    const repository = fakeRepository();
    const service = createMediaService({
      storage,
      repository,
      process: async () => processedFixture,
      createId: vi.fn()
        .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
        .mockReturnValueOnce("generation-a"),
    });

    await expect(
      service.upload(
        { name: "photo.jpg", type: "image/jpeg", bytes: new Uint8Array([1]) },
        inputMetadata,
        "staff-1",
      ),
    ).rejects.toThrow("object write failed");
    expect(deleted).toEqual([
      "11111111-1111-4111-8111-111111111111/generation-a/master.jpg",
    ]);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("preserves the ID and deletes the old generation only after replacement commits", async () => {
    const events: string[] = [];
    const storage = fakeStorage(events);
    const current = {
      id: "11111111-1111-4111-8111-111111111111",
      storageKey: "old/master.jpg",
      derivatives: [
        { storageKey: "old/480.webp" },
        { storageKey: "old/480.avif" },
      ],
    } as unknown as AdminMediaAsset;
    const repository = fakeRepository({
      get: vi.fn(async () => current),
      replace: vi.fn(async (_id, input) => {
        events.push("repository:replace");
        return { ...current, ...input } as AdminMediaAsset;
      }),
    });
    const ids = ["generation-b", "derivative-a", "derivative-b"];
    const service = createMediaService({
      storage,
      repository,
      process: async () => processedFixture,
      createId: () => ids.shift()!,
    });

    const result = await service.replace(
      current.id,
      { name: "replacement.jpg", type: "image/jpeg", bytes: new Uint8Array([1]) },
      inputMetadata,
      "staff-2",
    );

    expect(result.id).toBe(current.id);
    expect(repository.replace).toHaveBeenCalledWith(
      current.id,
      expect.objectContaining({ id: current.id }),
      "staff-2",
    );
    expect(events.indexOf("repository:replace")).toBeLessThan(
      events.indexOf("delete:old/master.jpg"),
    );
  });

  it("cleans only the new generation when replacement persistence rolls back", async () => {
    const storage = fakeStorage();
    const current = {
      id: "11111111-1111-4111-8111-111111111111",
      storageKey: "old/master.jpg",
      derivatives: [],
    } as unknown as AdminMediaAsset;
    const repository = fakeRepository({
      get: vi.fn(async () => current),
      replace: vi.fn(async () => {
        throw new Error("replacement audit rejected");
      }),
    });
    const ids = ["generation-b", "derivative-a", "derivative-b"];
    const service = createMediaService({
      storage,
      repository,
      process: async () => processedFixture,
      createId: () => ids.shift()!,
    });

    await expect(
      service.replace(
        current.id,
        { name: "replacement.jpg", type: "image/jpeg", bytes: new Uint8Array([1]) },
        inputMetadata,
        "staff-2",
      ),
    ).rejects.toThrow("replacement audit rejected");
    expect(storage.keys.size).toBe(0);
  });
});
