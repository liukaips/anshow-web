import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { auditLogs, backupRuns } from "../db/schema/index.js";
import type { SiteSettings } from "../admin/repositories/settings-repository.js";
import { createLocalBackupStorage } from "./local-backup-storage.js";
import { BackupManager, BackupManagerError } from "./backup-manager.js";

const KEY = "11".repeat(32);
const NOW = new Date("2026-07-16T10:00:00.000Z");

function settings(overrides: Partial<NonNullable<SiteSettings["backup"]>> = {}): SiteSettings {
  return {
    companyIdentity: { displayName: "", legalName: "", registrationNumber: "", address: "" },
    publicContacts: { email: "", phone: "" },
    privacyController: { name: "", email: "" },
    smtpRecipient: { name: "", email: "" },
    localeDefaults: { defaultLocale: "en", enabledLocales: ["en", "zh", "ru"] },
    mediaMode: "local",
    featureFlags: { enquiriesEnabled: true, caseStudiesEnabled: true, insightsEnabled: true },
    backup: {
      enabled: true,
      intervalHours: 24,
      retentionDays: 30,
      target: "local",
      cosBucket: "",
      cosRegion: "",
      encryptionConfigured: true,
      ...overrides,
    },
  };
}

async function createSourceDatabase(directory: string): Promise<string> {
  const path = join(directory, "production.db");
  const sqlite = new Database(path);
  sqlite.exec("CREATE TABLE proof (value TEXT NOT NULL); INSERT INTO proof VALUES ('production');");
  sqlite.close();
  return path;
}

describe("BackupManager", () => {
  it("creates an encrypted backup, records metadata and audit history, and removes expired artifacts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-"));
    const context = createTestDatabase();
    try {
      const databasePath = await createSourceDatabase(directory);
      const storageRoot = join(directory, "stored");
      const storage = createLocalBackupStorage({ root: storageRoot });
      await writeFile(join(directory, "old.backup"), "old");
      await storage.put("backups/old.backup", join(directory, "old.backup"));
      context.db.insert(backupRuns).values({
        id: "old-run",
        status: "succeeded",
        target: "local",
        storageKey: "backups/old.backup",
        sizeBytes: 3,
        sha256: "00".repeat(32),
        actorId: "system",
        startedAt: new Date("2026-05-01T00:00:00.000Z"),
        completedAt: new Date("2026-05-01T00:01:00.000Z"),
      }).run();
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath,
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => storage,
        createId: () => "run-new",
        now: () => NOW,
      });

      const run = await manager.runNow("admin-1");

      expect(run).toMatchObject({
        id: "run-new",
        status: "succeeded",
        target: "local",
        storageKey: expect.stringMatching(/^backups\/2026\/07\/run-new\.backup$/),
        sizeBytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        actorId: "admin-1",
      });
      expect(context.db.select().from(backupRuns).all()).toEqual([
        expect.objectContaining({ id: "run-new", status: "succeeded" }),
      ]);
      expect(context.db.select().from(auditLogs).all()).toEqual([
        expect.objectContaining({ action: "backup.run.succeeded", actorId: "admin-1" }),
        expect.objectContaining({ action: "backup.retention.cleaned", actorId: "admin-1" }),
      ]);
      await expect(
        storage.download(run.storageKey!, join(directory, "roundtrip.backup")),
      ).resolves.toBeUndefined();
      await expect(
        storage.download("backups/old.backup", join(directory, "removed.backup")),
      ).rejects.toThrow();
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("records a failed run without exposing the underlying error to callers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-fail-"));
    const context = createTestDatabase();
    try {
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath: await createSourceDatabase(directory),
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => ({
          put: async () => { throw new Error("COS secret details"); },
          download: async () => undefined,
          delete: async () => undefined,
        }),
        createId: () => "failed-run",
        now: () => NOW,
      });

      await expect(manager.runNow("admin-1")).rejects.toMatchObject({
        code: "BACKUP_RUN_FAILED",
        message: "备份执行失败，请查看运行记录",
      });
      expect(context.db.select().from(backupRuns).all()).toEqual([
        expect.objectContaining({
          id: "failed-run",
          status: "failed",
          error: "COS secret details",
        }),
      ]);
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a concurrent run in the same process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-lock-"));
    const context = createTestDatabase();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    try {
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath: await createSourceDatabase(directory),
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => createLocalBackupStorage({ root: join(directory, "stored") }),
        createId: () => crypto.randomUUID(),
        now: () => NOW,
        createBackup: async () => {
          await pending;
          const file = join(directory, "deferred.backup");
          await writeFile(file, "encrypted");
          return { file, manifest: { version: 1, createdAt: NOW.toISOString(), entries: [] } };
        },
      });

      const first = manager.runNow("admin-1");
      await vi.waitFor(() => expect(manager.running).toBe(true));
      await expect(manager.runNow("admin-2")).rejects.toEqual(
        new BackupManagerError("BACKUP_ALREADY_RUNNING", "已有备份任务正在执行"),
      );
      release();
      await first;
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a concurrent run claimed by another process through SQLite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-db-lock-"));
    const context = createTestDatabase();
    try {
      context.db.insert(backupRuns).values({
        id: "other-process-run",
        status: "running",
        target: "local",
        actorId: "system:backup-worker",
        startedAt: new Date(NOW.getTime() - 60_000),
      }).run();
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath: await createSourceDatabase(directory),
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => createLocalBackupStorage({ root: join(directory, "stored") }),
        createId: () => "new-run",
        now: () => NOW,
      });

      await expect(manager.runNow("admin-1")).rejects.toEqual(
        new BackupManagerError("BACKUP_ALREADY_RUNNING", "已有备份任务正在执行"),
      );
      expect(context.db.select().from(backupRuns).all()).toEqual([
        expect.objectContaining({ id: "other-process-run", status: "running" }),
      ]);
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("marks an abandoned database claim failed before starting a new backup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-stale-lock-"));
    const context = createTestDatabase();
    try {
      context.db.insert(backupRuns).values({
        id: "abandoned-run",
        status: "running",
        target: "local",
        actorId: "system:backup-worker",
        startedAt: new Date(NOW.getTime() - 7 * 3_600_000),
      }).run();
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath: await createSourceDatabase(directory),
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => createLocalBackupStorage({ root: join(directory, "stored") }),
        createId: () => "replacement-run",
        now: () => NOW,
      });

      await expect(manager.runNow("admin-1")).resolves.toMatchObject({
        id: "replacement-run",
        status: "succeeded",
      });
      expect(context.db.select().from(backupRuns).where(eq(backupRuns.id, "abandoned-run")).get()).toMatchObject({
        status: "failed",
        completedAt: NOW,
        error: "备份进程异常中断，系统已释放运行锁",
      });
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("verifies into an isolated temporary directory and never overwrites the production database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-verify-"));
    const context = createTestDatabase();
    try {
      const databasePath = await createSourceDatabase(directory);
      const storage = createLocalBackupStorage({ root: join(directory, "stored") });
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath,
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => storage,
        createId: () => "verified-run",
        now: () => NOW,
      });
      const run = await manager.runNow("admin-1");

      const verified = await manager.verify(run.id, "admin-2");

      expect(verified).toMatchObject({
        id: run.id,
        status: "verified",
        verifiedAt: NOW,
      });
      const production = new Database(databasePath, { readonly: true });
      expect(production.prepare("SELECT value FROM proof").pluck().get()).toBe("production");
      production.close();
      await expect(readFile(join(directory, "anshow.db"))).rejects.toThrow();
      expect(context.db.select().from(auditLogs).all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: "backup.verify.succeeded", actorId: "admin-2" }),
        ]),
      );
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("stages only a verified backup for an offline recovery without touching production", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-stage-"));
    const context = createTestDatabase();
    try {
      const databasePath = await createSourceDatabase(directory);
      const stagingRoot = join(directory, "staging");
      const storage = createLocalBackupStorage({ root: join(directory, "stored") });
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => settings() },
        databasePath,
        stagingRoot,
        encryptionKey: KEY,
        storageFor: () => storage,
        createId: () => "staged-run",
        now: () => NOW,
      });
      const run = await manager.runNow("admin-1");

      await expect(manager.stageRestore(run.id, "admin-2")).rejects.toMatchObject({
        code: "BACKUP_RUN_NOT_VERIFIABLE",
      });
      await manager.verify(run.id, "admin-2");
      const staged = await manager.stageRestore(run.id, "admin-2");

      expect(staged).toMatchObject({
        id: run.id,
        status: "verified",
        restoreStagedAt: NOW,
      });
      await expect(access(join(stagingRoot, `restore-${run.id}`, "anshow.db"))).resolves.toBeUndefined();
      const production = new Database(databasePath, { readonly: true });
      expect(production.prepare("SELECT value FROM proof").pluck().get()).toBe("production");
      production.close();
      expect(context.db.select().from(auditLogs).all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: "backup.restore.staged", actorId: "admin-2" }),
        ]),
      );
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("runs scheduled backups only when enabled and due", async () => {
    const directory = await mkdtemp(join(tmpdir(), "anshow-manager-due-"));
    const context = createTestDatabase();
    try {
      let currentSettings = settings({ enabled: false });
      const manager = new BackupManager({
        database: context.db,
        settingsRepository: { getSettings: async () => currentSettings },
        databasePath: await createSourceDatabase(directory),
        stagingRoot: join(directory, "staging"),
        encryptionKey: KEY,
        storageFor: () => createLocalBackupStorage({ root: join(directory, "stored") }),
        createId: () => crypto.randomUUID(),
        now: () => NOW,
      });

      await expect(manager.runDue()).resolves.toBeNull();
      currentSettings = settings({ enabled: true, intervalHours: 24 });
      await expect(manager.runDue()).resolves.toMatchObject({ status: "succeeded" });
      await expect(manager.runDue()).resolves.toBeNull();
    } finally {
      context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
