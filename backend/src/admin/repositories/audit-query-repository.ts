import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import type { AppDatabase } from "../../db/client.js";
import { auditLogs } from "../../db/schema/settings.js";

export type AuditQuery = Readonly<{
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}>;

const sensitiveKey = /password|secret|token|credential|authorization|api[-_]?key|private[-_]?key/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      sensitiveKey.test(key) ? "[已隐藏]" : redact(child),
    ]),
  );
}

function parseDetail(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(value);
    const safe = redact(parsed);
    return safe && typeof safe === "object" && !Array.isArray(safe)
      ? (safe as Readonly<Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function conditions(filters: AuditQuery): SQL[] {
  return [
    filters.actorId ? eq(auditLogs.actorId, filters.actorId) : undefined,
    filters.action ? eq(auditLogs.action, filters.action) : undefined,
    filters.entityType ? eq(auditLogs.entityType, filters.entityType) : undefined,
    filters.entityId ? eq(auditLogs.entityId, filters.entityId) : undefined,
    filters.from ? gte(auditLogs.createdAt, filters.from) : undefined,
    filters.to ? lte(auditLogs.createdAt, filters.to) : undefined,
  ].filter((condition): condition is SQL => condition !== undefined);
}

export function createAuditQueryRepository(database: AppDatabase) {
  return {
    list(filters: AuditQuery = {}) {
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
      const where = and(...conditions(filters));
      const items = database
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all()
        .map(({ detail, ...item }) => ({ ...item, detail: parseDetail(detail) }));
      const total = database
        .select({ value: count() })
        .from(auditLogs)
        .where(where)
        .get()?.value ?? 0;
      return { items, page, pageSize, total };
    },
    detail(id: string) {
      const row = database
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, id))
        .get();
      if (!row) return null;
      return { ...row, detail: parseDetail(row.detail) };
    },
  };
}

export type AuditQueryRepository = ReturnType<typeof createAuditQueryRepository>;
