import { and, asc, desc, eq, gte, like, lte, or, type SQL } from "drizzle-orm";

import type { AppDatabase } from "../../db/client.js";
import {
  inquiries,
  inquiryHistory,
  inquiryNotes,
  inquiryPriorities,
  notificationDeliveries,
} from "../../db/schema/inquiries.js";
import { auditLogs } from "../../db/schema/settings.js";
import {
  assertInquiryTransition,
  type InquiryStatus,
} from "../../inquiries/state-machine.js";

export type InquiryPriority = (typeof inquiryPriorities)[number];

export type InquiryAdminFilters = Readonly<{
  status?: InquiryStatus;
  priority?: InquiryPriority;
  assigneeId?: string;
  search?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}>;

function filterConditions(filters: InquiryAdminFilters): SQL[] {
  const search = filters.search?.trim();
  return [
    filters.status ? eq(inquiries.status, filters.status) : undefined,
    filters.priority ? eq(inquiries.priority, filters.priority) : undefined,
    filters.assigneeId ? eq(inquiries.assigneeId, filters.assigneeId) : undefined,
    filters.from === undefined ? undefined : gte(inquiries.createdAt, filters.from),
    filters.to === undefined ? undefined : lte(inquiries.createdAt, filters.to),
    search
      ? or(
          like(inquiries.name, `%${search}%`),
          like(inquiries.company, `%${search}%`),
          like(inquiries.email, `%${search}%`),
          like(inquiries.phone, `%${search}%`),
        )
      : undefined,
  ].filter((condition): condition is SQL => condition !== undefined);
}

function spreadsheetSafe(value: unknown): string {
  const text = String(value ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const safe = /^[=+\-@\t]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function auditValues(
  actorId: string,
  action: string,
  inquiryId: string,
  detail: Readonly<Record<string, unknown>>,
  now: number,
) {
  return {
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType: "inquiry",
    entityId: inquiryId,
    detail: JSON.stringify(detail),
    createdAt: new Date(now),
  };
}

export function createInquiryAdminRepository(db: AppDatabase) {
  return {
    list(filters: InquiryAdminFilters = {}) {
      const conditions = filterConditions(filters);
      const query = db
        .select()
        .from(inquiries)
        .orderBy(desc(inquiries.updatedAt), desc(inquiries.createdAt))
        .limit(Math.min(filters.limit ?? 50, 100))
        .offset(filters.offset ?? 0);
      return conditions.length > 0 ? query.where(and(...conditions)).all() : query.all();
    },

    detail(id: string) {
      const inquiry = db.select().from(inquiries).where(eq(inquiries.id, id)).get();
      if (!inquiry) return null;
      return {
        ...inquiry,
        notes: db
          .select()
          .from(inquiryNotes)
          .where(eq(inquiryNotes.inquiryId, id))
          .orderBy(asc(inquiryNotes.createdAt))
          .all(),
        history: db
          .select()
          .from(inquiryHistory)
          .where(eq(inquiryHistory.inquiryId, id))
          .orderBy(asc(inquiryHistory.createdAt))
          .all(),
        notifications: db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.inquiryId, id))
          .orderBy(desc(notificationDeliveries.nextAttemptAt))
          .all(),
      };
    },

    assign(id: string, assigneeId: string | null, actorId: string) {
      return db.transaction((tx) => {
        const current = tx.select().from(inquiries).where(eq(inquiries.id, id)).get();
        if (!current) throw new Error("INQUIRY_NOT_FOUND");
        const now = Date.now();
        const updated = tx
          .update(inquiries)
          .set({ assigneeId, updatedAt: now })
          .where(eq(inquiries.id, id))
          .returning()
          .get();
        tx.insert(inquiryHistory)
          .values({
            id: crypto.randomUUID(),
            inquiryId: id,
            actorId,
            assigneeId,
            fromStatus: current.status,
            toStatus: current.status,
            createdAt: now,
          })
          .run();
        tx.insert(auditLogs)
          .values(auditValues(actorId, "inquiry.assign", id, { from: current.assigneeId, to: assigneeId }, now))
          .run();
        return updated;
      });
    },

    setPriority(id: string, priority: InquiryPriority, actorId: string) {
      return db.transaction((tx) => {
        const current = tx.select().from(inquiries).where(eq(inquiries.id, id)).get();
        if (!current) throw new Error("INQUIRY_NOT_FOUND");
        const now = Date.now();
        const updated = tx
          .update(inquiries)
          .set({ priority, updatedAt: now })
          .where(eq(inquiries.id, id))
          .returning()
          .get();
        tx.insert(auditLogs)
          .values(auditValues(actorId, "inquiry.priority.update", id, { from: current.priority, to: priority }, now))
          .run();
        return updated;
      });
    },

    transition(id: string, status: InquiryStatus, actorId: string) {
      return db.transaction((tx) => {
        const current = tx.select().from(inquiries).where(eq(inquiries.id, id)).get();
        if (!current) throw new Error("INQUIRY_NOT_FOUND");
        assertInquiryTransition(current.status as InquiryStatus, status);
        const now = Date.now();
        const closedAt = status === "closed" || status === "spam" ? now : null;
        const updated = tx
          .update(inquiries)
          .set({ status, updatedAt: now, closedAt })
          .where(eq(inquiries.id, id))
          .returning()
          .get();
        tx.insert(inquiryHistory)
          .values({
            id: crypto.randomUUID(),
            inquiryId: id,
            actorId,
            assigneeId: current.assigneeId,
            fromStatus: current.status,
            toStatus: status,
            createdAt: now,
          })
          .run();
        tx.insert(auditLogs)
          .values(auditValues(actorId, "inquiry.status.update", id, { from: current.status, to: status }, now))
          .run();
        return updated;
      });
    },

    addNote(inquiryId: string, authorId: string, body: string) {
      const normalized = body.trim();
      if (!normalized) throw new Error("INQUIRY_NOTE_REQUIRED");
      return db.transaction((tx) => {
        const current = tx
          .select({ id: inquiries.id })
          .from(inquiries)
          .where(eq(inquiries.id, inquiryId))
          .get();
        if (!current) throw new Error("INQUIRY_NOT_FOUND");
        const now = Date.now();
        const note = tx
          .insert(inquiryNotes)
          .values({ id: crypto.randomUUID(), inquiryId, authorId, body: normalized, createdAt: now })
          .returning()
          .get();
        tx.update(inquiries).set({ updatedAt: now }).where(eq(inquiries.id, inquiryId)).run();
        tx.insert(auditLogs)
          .values(auditValues(authorId, "inquiry.note.add", inquiryId, { noteId: note.id }, now))
          .run();
        return note;
      });
    },

    retryNotification(inquiryId: string, deliveryId: string, actorId: string) {
      return db.transaction((tx) => {
        const delivery = tx
          .select()
          .from(notificationDeliveries)
          .where(and(eq(notificationDeliveries.id, deliveryId), eq(notificationDeliveries.inquiryId, inquiryId)))
          .get();
        if (!delivery) throw new Error("NOTIFICATION_NOT_FOUND");
        if (delivery.status !== "failed") throw new Error("NOTIFICATION_NOT_RETRYABLE");
        const now = Date.now();
        const updated = tx
          .update(notificationDeliveries)
          .set({
            status: "pending",
            nextAttemptAt: now,
            workerId: null,
            claimedAt: null,
            sentAt: null,
            lastError: null,
          })
          .where(eq(notificationDeliveries.id, deliveryId))
          .returning()
          .get();
        tx.update(inquiries).set({ updatedAt: now }).where(eq(inquiries.id, inquiryId)).run();
        tx.insert(auditLogs)
          .values(auditValues(actorId, "inquiry.notification.retry", inquiryId, { deliveryId }, now))
          .run();
        return updated;
      });
    },

    exportCsv(filters: InquiryAdminFilters, actorId: string) {
      return db.transaction((tx) => {
        const conditions = filterConditions(filters);
        const query = tx.select().from(inquiries).orderBy(desc(inquiries.createdAt));
        const rows = conditions.length > 0 ? query.where(and(...conditions)).all() : query.all();
        const header = ["编号", "姓名", "公司", "邮箱", "电话", "运输需求", "状态", "优先级", "负责人", "提交时间"];
        const csvRows = rows.map((row) => [
          row.id,
          row.name,
          row.company,
          row.email,
          row.phone,
          row.transportNeed,
          row.status,
          row.priority,
          row.assigneeId,
          new Date(row.createdAt).toISOString(),
        ]);
        const now = Date.now();
        tx.insert(auditLogs)
          .values(auditValues(actorId, "inquiry.export", "filtered", { filters, count: rows.length }, now))
          .run();
        return [header, ...csvRows].map((row) => row.map(spreadsheetSafe).join(",")).join("\r\n");
      });
    },
  };
}

export type InquiryAdminRepository = ReturnType<typeof createInquiryAdminRepository>;
