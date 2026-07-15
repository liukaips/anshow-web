import { describe, expect, it, vi } from "vitest";

import { CosStorage } from "./cos-storage.js";

describe("COS media storage", () => {
  it("writes immutable cache metadata and returns a normalized public URL", async () => {
    const putObject = vi.fn((_args, callback) => callback(null, {}));
    const storage = new CosStorage({ client: { putObject, deleteObject: vi.fn() } as never, bucket: "b", region: "r", publicBaseUrl: "https://assets.example/" });
    await expect(storage.put("media/hash.avif", new Uint8Array([1]), "image/avif")).resolves.toBe("https://assets.example/media/hash.avif");
    expect(putObject).toHaveBeenCalledWith(expect.objectContaining({ CacheControl: "public,max-age=31536000,immutable", ContentType: "image/avif" }), expect.any(Function));
  });

  it("rejects traversal keys and propagates delete failures", async () => {
    const deleteObject = vi.fn((_args, callback) => callback(new Error("nope"), {}));
    const storage = new CosStorage({ client: { putObject: vi.fn(), deleteObject } as never, bucket: "b", region: "r", publicBaseUrl: "https://assets.example" });
    await expect(storage.put("../escape", new Uint8Array(), "image/png")).rejects.toThrow(/Invalid/);
    await expect(storage.delete("media/x")).rejects.toThrow("nope");
  });
});
