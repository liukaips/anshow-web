import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalMediaStorage } from "./local-storage.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function storageFixture() {
  const root = await mkdtemp(join(tmpdir(), "anshow-media-"));
  roots.push(root);
  return { root, storage: createLocalMediaStorage({ root }) };
}

describe("local media storage", () => {
  it("writes nested immutable keys and returns an encoded public URL", async () => {
    const { root, storage } = await storageFixture();

    await expect(
      storage.put("generation one/master image.webp", new Uint8Array([1, 2, 3]), "image/webp"),
    ).resolves.toBe("/media/generation%20one/master%20image.webp");
    await expect(readFile(join(root, "generation one/master image.webp"))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it.each(["/absolute.webp", "../escape.webp", "safe/../../escape.webp", "safe\\escape.webp", "safe/\0escape.webp"])(
    "rejects unsafe key %s",
    async (key) => {
      const { storage } = await storageFixture();
      await expect(
        storage.put(key, new Uint8Array([1]), "image/webp"),
      ).rejects.toThrow(/media storage key/i);
      await expect(storage.delete(key)).rejects.toThrow(/media storage key/i);
    },
  );

  it("atomically replaces and safely deletes an existing object", async () => {
    const { root, storage } = await storageFixture();
    await storage.put("generation/master.webp", new Uint8Array([1]), "image/webp");
    await storage.put("generation/master.webp", new Uint8Array([9, 8]), "image/webp");

    await expect(readFile(join(root, "generation/master.webp"))).resolves.toEqual(
      Buffer.from([9, 8]),
    );
    await storage.delete("generation/master.webp");
    await expect(readFile(join(root, "generation/master.webp"))).rejects.toThrow();
    await expect(storage.delete("generation/master.webp")).resolves.toBeUndefined();
  });
});
