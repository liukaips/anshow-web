import { join } from "node:path";

import type {
  SettingsRepository,
  SiteSettings,
} from "../admin/repositories/settings-repository.js";
import type { AppDatabase } from "../db/client.js";
import type { RuntimeEnv } from "../env.js";
import { BackupManager, BackupManagerError } from "./backup-manager.js";
import type { BackupStorage } from "./backup-storage.js";
import { createCosBackupStorage } from "./cos-backup-storage.js";
import { createLocalBackupStorage } from "./local-backup-storage.js";

type BackupSettings = NonNullable<SiteSettings["backup"]>;
type BackupTarget = BackupSettings["target"];

export function createBackupStorageResolver(
  environment: RuntimeEnv,
): (target: BackupTarget, settings: BackupSettings) => BackupStorage {
  const local = createLocalBackupStorage({
    root: environment.BACKUP_DIR ?? "data/backups",
  });

  return (target, settings) => {
    if (target === "local") return local;
    if (!environment.COS_SECRET_ID || !environment.COS_SECRET_KEY) {
      throw new BackupManagerError(
        "BACKUP_NOT_CONFIGURED",
        "腾讯云 COS 访问凭据尚未在部署环境中配置",
      );
    }
    return createCosBackupStorage({
      bucket: settings.cosBucket,
      region: settings.cosRegion,
      secretId: environment.COS_SECRET_ID,
      secretKey: environment.COS_SECRET_KEY,
    });
  };
}

export function createRuntimeBackupManager(options: {
  database: AppDatabase;
  settingsRepository: Pick<SettingsRepository, "getSettings">;
  environment: RuntimeEnv;
}): BackupManager {
  const backupRoot = options.environment.BACKUP_DIR ?? "data/backups";
  return new BackupManager({
    database: options.database,
    settingsRepository: options.settingsRepository,
    databasePath: options.environment.DATABASE_PATH,
    mediaDir: "/media",
    stagingRoot: join(backupRoot, ".staging"),
    encryptionKey: options.environment.BACKUP_ENCRYPTION_KEY,
    storageFor: createBackupStorageResolver(options.environment),
  });
}
