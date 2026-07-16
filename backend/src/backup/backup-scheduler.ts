import type { BackupManager, BackupRun } from "./backup-manager.js";

type BackupScheduleManager = Pick<BackupManager, "runDue">;
type LogError = (message: string, detail: { name: string }) => void;

export async function runBackupScheduleTick(
  manager: BackupScheduleManager,
  logError: LogError = (message, detail) => console.error(message, detail),
): Promise<BackupRun | null> {
  try {
    return await manager.runDue();
  } catch (error) {
    logError("Backup scheduler tick failed", {
      name: error instanceof Error ? error.name : "NonErrorThrown",
    });
    return null;
  }
}
