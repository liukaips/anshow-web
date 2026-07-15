import { initializeRuntime } from "../runtime-bootstrap.js";
import { createEncryptedBackup } from "../backup/backup-service.js";

await initializeRuntime(process.env, (environment) => {
  const keepAlive = setInterval(() => undefined, 60_000);
  const backupTimer = environment.BACKUP_ENCRYPTION_KEY
    ? setInterval(() => void createEncryptedBackup({ databasePath: environment.DATABASE_PATH, mediaDir: "/media", outputDir: environment.BACKUP_DIR ?? "data/backups", encryptionKey: environment.BACKUP_ENCRYPTION_KEY! }).catch((error) => console.error("Backup failed", error)), (environment.BACKUP_INTERVAL_HOURS ?? 24) * 3_600_000)
    : undefined;

  function shutdown(signal: NodeJS.Signals): void {
    console.info(`Received ${signal}; stopping AnShow worker.`);
    clearInterval(keepAlive);
    if (backupTimer) clearInterval(backupTimer);
    process.exitCode = 0;
  }

  console.info("AnShow worker is ready; encrypted backups are", backupTimer ? "enabled" : "disabled");

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
});
