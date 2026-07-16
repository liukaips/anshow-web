import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

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
  const database = new Database(join(root, "anshow.db"));
  database.exec("create table backup_fixture (value text not null)");
  database.prepare("insert into backup_fixture values (?)").run("sqlite");
  database.close();
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
  it("includes committed WAL data through a consistent SQLite snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "anshow-backup-wal-"));
    cleanup.push(root);
    const databasePath = join(root, "anshow.db");
    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.pragma("wal_autocheckpoint = 0");
    database.exec("create table delivery_check (id text primary key, value text not null)");
    database.prepare("insert into delivery_check values (?, ?)").run("committed-1", "在 WAL 中已提交");

    const { file } = await createEncryptedBackup({
      databasePath,
      outputDir: join(root, "backups"),
      encryptionKey,
    });
    database.close();
    const restoreDir = join(root, "restore");
    await verifyAndRestoreBackup({ backupFile: file, encryptionKey, restoreDir });

    const restored = new Database(join(restoreDir, "anshow.db"), { readonly: true });
    try {
      expect(restored.prepare("select value from delivery_check where id = ?").get("committed-1")).toEqual({
        value: "在 WAL 中已提交",
      });
    } finally {
      restored.close();
    }
  });

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
    const restored = new Database(join(restoreDir, "anshow.db"), { readonly: true });
    try {
      expect(restored.prepare("select value from backup_fixture").get()).toEqual({ value: "sqlite" });
    } finally {
      restored.close();
    }
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

  it("rejects a checksum-valid but corrupt SQLite database before restore", async () => {
    const { file, restoreDir } = await fixture();
    await rewritePayload(file, (payload) => {
      const invalid = Buffer.from("not a sqlite database");
      const checksum = createHash("sha256").update(invalid).digest("hex");
      payload.entries[0]!.data = invalid.toString("base64");
      payload.entries[0]!.size = invalid.length;
      payload.entries[0]!.sha256 = checksum;
      payload.manifest.entries[0]!.size = invalid.length;
      payload.manifest.entries[0]!.sha256 = checksum;
    });

    await expect(
      verifyAndRestoreBackup({ backupFile: file, encryptionKey, restoreDir }),
    ).rejects.toThrow("SQLite 数据库完整性校验失败");
    await expect(readFile(join(restoreDir, "anshow.db"))).rejects.toThrow();
  });
});
