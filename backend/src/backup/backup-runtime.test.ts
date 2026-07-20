import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeEnv } from "../env.js";
import type { SiteSettings } from "../admin/repositories/settings-repository.js";
import { BackupManagerError } from "./backup-manager.js";
import { createBackupStorageResolver } from "./backup-runtime.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function environment(overrides: Partial<RuntimeEnv> = {}): RuntimeEnv {
  return {
    NODE_ENV: "test",
    SITE_URL: "http://localhost:3000",
    SITE_HOST: "localhost",
    DATABASE_PATH: ":memory:",
    BETTER_AUTH_SECRET: "a".repeat(32),
    RATE_LIMIT_SECRET: "b".repeat(32),
    MEDIA_DRIVER: "local",
    LOCAL_MEDIA_ROOT: "/media",
    PORT: 4000,
    ...overrides,
  };
}

const backupSettings: NonNullable<SiteSettings["backup"]> = {
  enabled: true,
  intervalHours: 24,
  retentionDays: 30,
  target: "local",
  cosBucket: "",
  cosRegion: "",
  encryptionConfigured: true,
};

describe("backup runtime storage resolver", () => {
  it("stores local backups below the configured persistent backup directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "anshow-runtime-backup-"));
    directories.push(root);
    const source = join(root, "source.backup");
    const downloaded = join(root, "downloaded.backup");
    await writeFile(source, "encrypted backup");
    const resolver = createBackupStorageResolver(
      environment({ BACKUP_DIR: root }),
    );

    const storage = resolver("local", backupSettings);
    await storage.put("backups/2026/07/run.backup", source);
    await storage.download("backups/2026/07/run.backup", downloaded);

    await expect(readFile(downloaded, "utf8")).resolves.toBe(
      "encrypted backup",
    );
  });

  it("rejects COS backup selection when deployment credentials are missing", () => {
    const resolver = createBackupStorageResolver(environment());

    expect(() =>
      resolver("cos", {
        ...backupSettings,
        target: "cos",
        cosBucket: "anshow-backups-123456",
        cosRegion: "ap-shanghai",
      }),
    ).toThrow(
      new BackupManagerError(
        "BACKUP_NOT_CONFIGURED",
        "腾讯云 COS 访问凭据尚未在部署环境中配置",
      ),
    );
  });
});
