import type { components } from "../generated/api";
import { getEnvelope } from "./http";

export type AdminBackupRun = components["schemas"]["AdminBackupRun"];

export function runAdminBackup(): Promise<AdminBackupRun> {
  return getEnvelope<AdminBackupRun>("/api/admin/backups/run", {
    method: "POST",
  });
}

export function verifyAdminBackup(id: string): Promise<AdminBackupRun> {
  return getEnvelope<AdminBackupRun>(
    `/api/admin/backups/${encodeURIComponent(id)}/verify`,
    { method: "POST" },
  );
}

export function stageAdminBackupRestore(id: string): Promise<AdminBackupRun> {
  return getEnvelope<AdminBackupRun>(
    `/api/admin/backups/${encodeURIComponent(id)}/stage-restore`,
    { method: "POST" },
  );
}
