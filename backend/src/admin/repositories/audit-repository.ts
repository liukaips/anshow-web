import type { AppDatabase } from "../../db/client.js";
import { auditLogs } from "../../db/schema/settings.js";

type AuditDatabase = Pick<AppDatabase, "insert">;

export type AuditEntry = Readonly<{
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Readonly<Record<string, unknown>>;
}>;

export interface AuditRepository {
  record(entry: AuditEntry): void;
}

type AuditRepositoryOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function createAuditRepository(
  database: AuditDatabase,
  options: AuditRepositoryOptions = {},
): AuditRepository {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    record(entry) {
      database
        .insert(auditLogs)
        .values({
          id: createId(),
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          detail: JSON.stringify(entry.detail),
          createdAt: now(),
        })
        .run();
    },
  };
}
