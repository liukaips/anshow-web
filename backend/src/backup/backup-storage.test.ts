import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CosBackupStorage } from "./cos-backup-storage.js";
import { createLocalBackupStorage } from "./local-backup-storage.js";

describe("local backup storage", () => {
  it("stores, downloads, and deletes a backup below its configured root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-backup-storage-"));
    try {
      const source = join(directory, "source.backup");
      const destination = join(directory, "download.backup");
      await writeFile(source, "encrypted-backup");
      const storage = createLocalBackupStorage({ root: join(directory, "store") });

      await storage.put("backups/2026/run-1.backup", source);
      await storage.download("backups/2026/run-1.backup", destination);
      await expect(readFile(destination, "utf8")).resolves.toBe(
        "encrypted-backup",
      );

      await storage.delete("backups/2026/run-1.backup");
      await expect(
        storage.download("backups/2026/run-1.backup", destination),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects absolute and traversal storage keys", async () => {
    const storage = createLocalBackupStorage({ root: "/tmp/backups" });

    await expect(storage.put("../escape", "/tmp/source")).rejects.toThrow(
      "备份存储路径无效",
    );
    await expect(storage.download("/absolute", "/tmp/output")).rejects.toThrow(
      "备份存储路径无效",
    );
  });
});

describe("COS backup storage", () => {
  it("uploads, downloads, and deletes through an injected COS client", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-cos-backup-"));
    const object = Buffer.from("cos-encrypted-backup");
    try {
      const source = join(directory, "source.backup");
      const destination = join(directory, "download.backup");
      await writeFile(source, object);
      const uploadFile = vi.fn((input, callback) => callback(null, {}));
      const getObject = vi.fn((input, callback) => {
        input.Output.end(object, () => callback(null, {}));
      });
      const deleteObject = vi.fn((input, callback) => callback(null, {}));
      const storage = new CosBackupStorage({
        client: { uploadFile, getObject, deleteObject },
        bucket: "backup-123",
        region: "ap-shanghai",
      });

      await storage.put("backups/run-1.backup", source);
      await storage.download("backups/run-1.backup", destination);
      await storage.delete("backups/run-1.backup");

      await expect(readFile(destination)).resolves.toEqual(object);
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "backup-123",
          Region: "ap-shanghai",
          Key: "backups/run-1.backup",
          FilePath: source,
        }),
        expect.any(Function),
      );
      expect(getObject).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "backups/run-1.backup" }),
        expect.any(Function),
      );
      expect(deleteObject).toHaveBeenCalledOnce();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("removes a partial download when COS fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-cos-failure-"));
    try {
      const destination = join(directory, "partial.backup");
      const storage = new CosBackupStorage({
        client: {
          uploadFile: vi.fn(),
          getObject: vi.fn((input, callback) => {
            input.Output.write("partial");
            callback(new Error("COS unavailable"), {});
          }),
          deleteObject: vi.fn(),
        },
        bucket: "backup-123",
        region: "ap-shanghai",
      });

      await expect(
        storage.download("backups/run-1.backup", destination),
      ).rejects.toThrow("COS unavailable");
      await expect(readFile(destination)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
