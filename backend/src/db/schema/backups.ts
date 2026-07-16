import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const backupRunStatuses = [
  "running",
  "succeeded",
  "failed",
  "verified",
] as const;
export const backupTargets = ["local", "cos"] as const;

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: backupRunStatuses }).notNull(),
    target: text("target", { enum: backupTargets }).notNull(),
    storageKey: text("storage_key"),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256"),
    actorId: text("actor_id").notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    verifiedAt: timestamp("verified_at"),
    restoreStagedAt: timestamp("restore_staged_at"),
    error: text("error"),
  },
  (table) => [
    index("backup_runs_status_started_idx").on(table.status, table.startedAt),
    index("backup_runs_started_idx").on(table.startedAt),
    check(
      "backup_runs_status_check",
      sql`${table.status} in ('running', 'succeeded', 'failed', 'verified')`,
    ),
    check(
      "backup_runs_target_check",
      sql`${table.target} in ('local', 'cos')`,
    ),
  ],
);
