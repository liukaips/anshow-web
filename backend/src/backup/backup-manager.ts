import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

import type {
  SettingsRepository,
  SiteSettings,
} from "../admin/repositories/settings-repository.js";
import { createAuditRepository } from "../admin/repositories/audit-repository.js";
import type { AppDatabase } from "../db/client.js";
import {
  backupRuns,
  type backupTargets,
} from "../db/schema/backups.js";
import type { BackupStorage } from "./backup-storage.js";
import {
  createEncryptedBackup,
  verifyAndRestoreBackup,
} from "./backup-service.js";

type BackupTarget = (typeof backupTargets)[number];
type BackupSettings = NonNullable<SiteSettings["backup"]>;
export type BackupRun = typeof backupRuns.$inferSelect;
const RUN_LOCK_TIMEOUT_MS = 6 * 3_600_000;

export class BackupManagerError extends Error {
  constructor(
    readonly code:
      | "BACKUP_ALREADY_RUNNING"
      | "BACKUP_NOT_CONFIGURED"
      | "BACKUP_RUN_NOT_FOUND"
      | "BACKUP_RUN_NOT_VERIFIABLE"
      | "BACKUP_RUN_FAILED"
      | "BACKUP_VERIFY_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "BackupManagerError";
  }
}

type BackupManagerOptions = {
  database: AppDatabase;
  settingsRepository: Pick<SettingsRepository, "getSettings">;
  databasePath: string;
  mediaDir?: string;
  stagingRoot: string;
  encryptionKey?: string;
  storageFor: (target: BackupTarget, settings: BackupSettings) => BackupStorage;
  createId?: () => string;
  now?: () => Date;
  createBackup?: typeof createEncryptedBackup;
  verifyBackup?: typeof verifyAndRestoreBackup;
};

async function fileMetadata(file: string): Promise<{
  sizeBytes: number;
  sha256: string;
}> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return { sizeBytes: (await stat(file)).size, sha256: hash.digest("hex") };
}

function errorMessage(error: unknown, encryptionKey?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  return (encryptionKey ? raw.replaceAll(encryptionKey, "[已隐藏]") : raw).slice(
    0,
    2_000,
  );
}

function requireConfiguration(
  settings: SiteSettings,
  encryptionKey?: string,
): BackupSettings {
  if (!settings.backup || !encryptionKey) {
    throw new BackupManagerError(
      "BACKUP_NOT_CONFIGURED",
      "备份尚未配置，请先设置服务器加密密钥和备份策略",
    );
  }
  if (
    settings.backup.target === "cos" &&
    (!settings.backup.cosBucket || !settings.backup.cosRegion)
  ) {
    throw new BackupManagerError(
      "BACKUP_NOT_CONFIGURED",
      "腾讯云 COS 备份尚未完整配置",
    );
  }
  return settings.backup;
}

export class BackupManager {
  private locked = false;
  private readonly createId: () => string;
  private readonly now: () => Date;
  private readonly createBackup: typeof createEncryptedBackup;
  private readonly verifyBackup: typeof verifyAndRestoreBackup;

  constructor(private readonly options: BackupManagerOptions) {
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
    this.createBackup = options.createBackup ?? createEncryptedBackup;
    this.verifyBackup = options.verifyBackup ?? verifyAndRestoreBackup;
  }

  get running(): boolean {
    return this.locked;
  }

  list(limit = 50): BackupRun[] {
    return this.options.database
      .select()
      .from(backupRuns)
      .orderBy(desc(backupRuns.startedAt))
      .limit(Math.min(Math.max(limit, 1), 100))
      .all();
  }

  async runNow(actorId: string): Promise<BackupRun> {
    if (this.locked) {
      throw new BackupManagerError(
        "BACKUP_ALREADY_RUNNING",
        "已有备份任务正在执行",
      );
    }
    const settings = await this.options.settingsRepository.getSettings();
    const backupSettings = requireConfiguration(
      settings,
      this.options.encryptionKey,
    );
    return this.executeRun(actorId, backupSettings);
  }

  async runDue(): Promise<BackupRun | null> {
    if (this.locked) return null;
    const settings = await this.options.settingsRepository.getSettings();
    if (!settings.backup?.enabled) return null;
    const backupSettings = requireConfiguration(
      settings,
      this.options.encryptionKey,
    );
    const latest = this.options.database
      .select({ startedAt: backupRuns.startedAt })
      .from(backupRuns)
      .where(inArray(backupRuns.status, ["succeeded", "verified"]))
      .orderBy(desc(backupRuns.startedAt))
      .limit(1)
      .get();
    if (
      latest &&
      this.now().getTime() - latest.startedAt.getTime() <
        backupSettings.intervalHours * 3_600_000
    ) {
      return null;
    }
    return this.executeRun("system:backup-worker", backupSettings);
  }

  async verify(id: string, actorId: string): Promise<BackupRun> {
    if (this.locked) {
      throw new BackupManagerError(
        "BACKUP_ALREADY_RUNNING",
        "已有备份任务正在执行",
      );
    }
    const run = this.options.database
      .select()
      .from(backupRuns)
      .where(eq(backupRuns.id, id))
      .get();
    if (!run) {
      throw new BackupManagerError(
        "BACKUP_RUN_NOT_FOUND",
        "备份记录不存在",
      );
    }
    if (
      !run.storageKey ||
      (run.status !== "succeeded" && run.status !== "verified")
    ) {
      throw new BackupManagerError(
        "BACKUP_RUN_NOT_VERIFIABLE",
        "该备份当前无法验证",
      );
    }
    const settings = await this.options.settingsRepository.getSettings();
    const backupSettings = requireConfiguration(
      settings,
      this.options.encryptionKey,
    );
    const storage = this.options.storageFor(run.target, backupSettings);
    await mkdir(this.options.stagingRoot, { recursive: true });
    const temporary = await mkdtemp(join(this.options.stagingRoot, "verify-"));
    this.locked = true;
    try {
      const file = join(temporary, "source.backup");
      const restoreDir = join(temporary, "isolated-restore");
      await storage.download(run.storageKey, file);
      await this.verifyBackup({
        backupFile: file,
        encryptionKey: this.options.encryptionKey!,
        restoreDir,
      });
      const verifiedAt = this.now();
      return this.options.database.transaction((transaction) => {
        transaction
          .update(backupRuns)
          .set({ status: "verified", verifiedAt, error: null })
          .where(eq(backupRuns.id, id))
          .run();
        createAuditRepository(transaction).record({
          actorId,
          action: "backup.verify.succeeded",
          entityType: "backup",
          entityId: id,
          detail: { target: run.target, verifiedAt: verifiedAt.toISOString() },
        });
        return transaction
          .select()
          .from(backupRuns)
          .where(eq(backupRuns.id, id))
          .get()!;
      });
    } catch (error) {
      const failedAt = this.now();
      this.options.database.transaction((transaction) => {
        transaction
          .update(backupRuns)
          .set({ status: "failed", completedAt: failedAt, error: errorMessage(error, this.options.encryptionKey) })
          .where(eq(backupRuns.id, id))
          .run();
        createAuditRepository(transaction).record({
          actorId,
          action: "backup.verify.failed",
          entityType: "backup",
          entityId: id,
          detail: { target: run.target },
        });
      });
      throw new BackupManagerError(
        "BACKUP_VERIFY_FAILED",
        "备份验证失败，请查看运行记录",
      );
    } finally {
      this.locked = false;
      await rm(temporary, { recursive: true, force: true });
    }
  }

  async stageRestore(id: string, actorId: string): Promise<BackupRun> {
    if (this.locked) {
      throw new BackupManagerError(
        "BACKUP_ALREADY_RUNNING",
        "已有备份任务正在执行",
      );
    }
    const run = this.options.database
      .select()
      .from(backupRuns)
      .where(eq(backupRuns.id, id))
      .get();
    if (!run) {
      throw new BackupManagerError(
        "BACKUP_RUN_NOT_FOUND",
        "备份记录不存在",
      );
    }
    if (!run.storageKey || run.status !== "verified") {
      throw new BackupManagerError(
        "BACKUP_RUN_NOT_VERIFIABLE",
        "请先通过恢复验证，再准备离线恢复包",
      );
    }
    const settings = await this.options.settingsRepository.getSettings();
    const backupSettings = requireConfiguration(
      settings,
      this.options.encryptionKey,
    );
    const storage = this.options.storageFor(run.target, backupSettings);
    await mkdir(this.options.stagingRoot, { recursive: true, mode: 0o700 });
    const temporary = await mkdtemp(join(this.options.stagingRoot, "stage-"));
    await chmod(temporary, 0o700);
    this.locked = true;
    try {
      const file = join(temporary, "source.backup");
      const restored = join(temporary, "restore");
      const destination = join(this.options.stagingRoot, `restore-${run.id}`);
      await storage.download(run.storageKey, file);
      await this.verifyBackup({
        backupFile: file,
        encryptionKey: this.options.encryptionKey!,
        restoreDir: restored,
      });
      await chmod(restored, 0o700);
      await rm(destination, { recursive: true, force: true });
      await rename(restored, destination);
      const restoreStagedAt = this.now();
      return this.options.database.transaction((transaction) => {
        transaction
          .update(backupRuns)
          .set({ restoreStagedAt, error: null })
          .where(eq(backupRuns.id, id))
          .run();
        createAuditRepository(transaction).record({
          actorId,
          action: "backup.restore.staged",
          entityType: "backup",
          entityId: id,
          detail: { target: run.target, restoreStagedAt: restoreStagedAt.toISOString() },
        });
        return transaction
          .select()
          .from(backupRuns)
          .where(eq(backupRuns.id, id))
          .get()!;
      });
    } catch {
      throw new BackupManagerError(
        "BACKUP_VERIFY_FAILED",
        "恢复包准备失败，请重新验证后再试",
      );
    } finally {
      this.locked = false;
      await rm(temporary, { recursive: true, force: true });
    }
  }

  private async executeRun(
    actorId: string,
    settings: BackupSettings,
  ): Promise<BackupRun> {
    this.locked = true;
    const id = this.createId();
    const startedAt = this.now();
    const target = settings.target;
    let claimed = false;
    let temporary: string | undefined;
    try {
      this.options.database.transaction((transaction) => {
        const running = transaction
          .select()
          .from(backupRuns)
          .where(eq(backupRuns.status, "running"))
          .all();
        const cutoff = startedAt.getTime() - RUN_LOCK_TIMEOUT_MS;
        if (running.some((run) => run.startedAt.getTime() >= cutoff)) {
          throw new BackupManagerError(
            "BACKUP_ALREADY_RUNNING",
            "已有备份任务正在执行",
          );
        }
        for (const abandoned of running) {
          transaction
            .update(backupRuns)
            .set({
              status: "failed",
              completedAt: startedAt,
              error: "备份进程异常中断，系统已释放运行锁",
            })
            .where(eq(backupRuns.id, abandoned.id))
            .run();
        }
        transaction
          .insert(backupRuns)
          .values({ id, status: "running", target, actorId, startedAt })
          .run();
      });
      claimed = true;
      await mkdir(this.options.stagingRoot, { recursive: true, mode: 0o700 });
      temporary = await mkdtemp(join(this.options.stagingRoot, "run-"));
      const result = await this.createBackup({
        databasePath: this.options.databasePath,
        ...(this.options.mediaDir ? { mediaDir: this.options.mediaDir } : {}),
        outputDir: temporary,
        encryptionKey: this.options.encryptionKey!,
      });
      const metadata = await fileMetadata(result.file);
      const storageKey = `backups/${startedAt.getUTCFullYear()}/${String(startedAt.getUTCMonth() + 1).padStart(2, "0")}/${id}.backup`;
      await this.options.storageFor(target, settings).put(storageKey, result.file);
      const completedAt = this.now();
      const run = this.options.database.transaction((transaction) => {
        transaction
          .update(backupRuns)
          .set({
            status: "succeeded",
            storageKey,
            sizeBytes: metadata.sizeBytes,
            sha256: metadata.sha256,
            completedAt,
            error: null,
          })
          .where(eq(backupRuns.id, id))
          .run();
        createAuditRepository(transaction).record({
          actorId,
          action: "backup.run.succeeded",
          entityType: "backup",
          entityId: id,
          detail: { target, storageKey, sizeBytes: metadata.sizeBytes },
        });
        return transaction
          .select()
          .from(backupRuns)
          .where(eq(backupRuns.id, id))
          .get()!;
      });
      await this.cleanupRetention(settings, actorId);
      return run;
    } catch (error) {
      if (!claimed && error instanceof BackupManagerError) throw error;
      const completedAt = this.now();
      this.options.database.transaction((transaction) => {
        transaction
          .update(backupRuns)
          .set({
            status: "failed",
            completedAt,
            error: errorMessage(error, this.options.encryptionKey),
          })
          .where(eq(backupRuns.id, id))
          .run();
        createAuditRepository(transaction).record({
          actorId,
          action: "backup.run.failed",
          entityType: "backup",
          entityId: id,
          detail: { target },
        });
      });
      throw new BackupManagerError(
        "BACKUP_RUN_FAILED",
        "备份执行失败，请查看运行记录",
      );
    } finally {
      this.locked = false;
      if (temporary) {
        await rm(temporary, { recursive: true, force: true });
      }
    }
  }

  private async cleanupRetention(
    settings: BackupSettings,
    actorId: string,
  ): Promise<void> {
    const cutoff = new Date(
      this.now().getTime() - settings.retentionDays * 86_400_000,
    );
    const expired = this.options.database
      .select()
      .from(backupRuns)
      .where(
        and(
          inArray(backupRuns.status, ["succeeded", "verified"]),
          lt(backupRuns.startedAt, cutoff),
        ),
      )
      .all();
    const removed: string[] = [];
    for (const run of expired) {
      if (!run.storageKey) continue;
      try {
        await this.options
          .storageFor(run.target, settings)
          .delete(run.storageKey);
        this.options.database
          .delete(backupRuns)
          .where(eq(backupRuns.id, run.id))
          .run();
        removed.push(run.id);
      } catch {
        // Preserve the row so a later retention pass can retry safely.
      }
    }
    if (removed.length > 0) {
      createAuditRepository(this.options.database).record({
        actorId,
        action: "backup.retention.cleaned",
        entityType: "backup",
        entityId: "retention",
        detail: { count: removed.length, runIds: removed },
      });
    }
  }
}
