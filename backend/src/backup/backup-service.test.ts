import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createEncryptedBackup,
  verifyAndRestoreBackup,
} from "./backup-service.js";

const cleanup: string[] = [];
const encryptionKey = "a".repeat(64);

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function rewritePayload(
  backupFile: string,
  mutate: (payload: {
    manifest: { entries: Array<{ path: string; size: number; sha256: string }> };
    entries: Array<{ path: string; size: number; sha256: string; data: string }>;
  }) => void,
) {
  const key = Buffer.from(encryptionKey, "hex");
  const envelope = JSON.parse(await readFile(backupFile, "utf8")) as {
    version: number;
    algorithm: string;
    iv: string;
    tag: string;
    payload: string;
  };
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.payload, "base64")),
    decipher.final(),
  ]);
  const payload = JSON.parse(plain.toString()) as Parameters<typeof mutate>[0];
  mutate(payload);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload))),
    cipher.final(),
  ]);
  await writeFile(
    backupFile,
    JSON.stringify({
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      payload: encrypted.toString("base64"),
    }),
  );
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "anshow-backup-"));
  cleanup.push(root);
  const media = join(root, "media");
  await mkdir(media);
  await writeFile(join(root, "anshow.db"), "sqlite");
  await writeFile(join(media, "hero.jpg"), "image");
  const backup = await createEncryptedBackup({
    databasePath: join(root, "anshow.db"),
    mediaDir: media,
    outputDir: join(root, "backups"),
    encryptionKey,
  });
  return { ...backup, root, restoreDir: join(root, "restore") };
}

describe("encrypted backups", () => {
  it("creates an encrypted manifest and restores verified files", async () => {
    const { file, manifest, restoreDir } = await fixture();
    expect(manifest.entries).toHaveLength(2);
    expect(await readFile(file, "utf8")).not.toContain("sqlite");

    const result = await verifyAndRestoreBackup({
      backupFile: file,
      encryptionKey,
      restoreDir,
    });

    expect(result.entries).toHaveLength(2);
    expect(await readFile(join(restoreDir, "anshow.db"), "utf8")).toBe(
      "sqlite",
    );
  });

  it("rejects unsupported envelopes before attempting restore", async () => {
    const { file, restoreDir } = await fixture();
    const envelope = JSON.parse(await readFile(file, "utf8")) as Record<
      string,
      unknown
    >;
    envelope.algorithm = "aes-256-cbc";
    await writeFile(file, JSON.stringify(envelope));

    await expect(
      verifyAndRestoreBackup({
        backupFile: file,
        encryptionKey,
        restoreDir,
      }),
    ).rejects.toThrow("不支持的备份文件格式");
    await expect(readFile(join(restoreDir, "anshow.db"))).rejects.toThrow();
  });

  it("validates every checksum before writing any restored file", async () => {
    const { file, restoreDir } = await fixture();
    await rewritePayload(file, (payload) => {
      payload.entries[1]!.data = Buffer.from("corrupt").toString("base64");
    });

    await expect(
      verifyAndRestoreBackup({
        backupFile: file,
        encryptionKey,
        restoreDir,
      }),
    ).rejects.toThrow("备份文件校验失败");
    await expect(readFile(join(restoreDir, "anshow.db"))).rejects.toThrow();
  });

  it("rejects unsafe paths before writing any restored file", async () => {
    const { file, restoreDir } = await fixture();
    await rewritePayload(file, (payload) => {
      payload.entries[1]!.path = "../outside.jpg";
      payload.manifest.entries[1]!.path = "../outside.jpg";
    });

    await expect(
      verifyAndRestoreBackup({
        backupFile: file,
        encryptionKey,
        restoreDir,
      }),
    ).rejects.toThrow("备份文件包含不安全路径");
    await expect(readFile(join(restoreDir, "anshow.db"))).rejects.toThrow();
  });
});
