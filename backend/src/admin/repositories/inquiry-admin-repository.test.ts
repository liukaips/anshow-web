import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { auditLogs } from "../../db/schema/settings.js";
import { notificationDeliveries } from "../../db/schema/inquiries.js";
import { createInquiryRepository } from "../../inquiries/repository.js";
import { createInquiryAdminRepository } from "./inquiry-admin-repository.js";

const inquiryInput = {
  name: "=HYPERLINK(\"https://attacker.test\")",
  company: "Volga Trade",
  email: "elena@example.test",
  phone: "+7 900 000 0000",
  transportNeed: "中俄铁路运输",
  message: "需要从上海运输工业设备到莫斯科。",
  consent: true as const,
  privacyVersion: "2026-07",
  locale: "zh" as const,
  sourceUrl: "https://example.test/zh/contact",
};

describe("inquiry admin repository", () => {
  it("keeps assignment, priority, state, notes, and audit history consistent", () => {
    const context = createTestDatabase();
    try {
      const inquiry = createInquiryRepository(context.db).createWithNotification(inquiryInput);
      const repository = createInquiryAdminRepository(context.db);

      expect(repository.assign(inquiry.id, "staff-2", "staff-1").assigneeId).toBe("staff-2");
      expect(repository.setPriority(inquiry.id, "urgent", "staff-1").priority).toBe("urgent");
      expect(repository.transition(inquiry.id, "in_progress", "staff-2").status).toBe("in_progress");
      expect(repository.addNote(inquiry.id, "staff-2", "已电话联系客户").body).toBe("已电话联系客户");

      expect(repository.detail(inquiry.id)).toMatchObject({
        id: inquiry.id,
        assigneeId: "staff-2",
        priority: "urgent",
        status: "in_progress",
        notes: [expect.objectContaining({ body: "已电话联系客户" })],
      });
      expect(context.db.select().from(auditLogs).all().map((event) => event.action)).toEqual([
        "inquiry.assign",
        "inquiry.priority.update",
        "inquiry.status.update",
        "inquiry.note.add",
      ]);
    } finally {
      context.close();
    }
  });

  it("requeues a failed notification and records the retry", () => {
    const context = createTestDatabase();
    try {
      const inquiry = createInquiryRepository(context.db).createWithNotification(inquiryInput);
      const delivery = context.db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.inquiryId, inquiry.id))
        .get()!;
      context.db
        .update(notificationDeliveries)
        .set({ status: "failed", attempts: 5, lastError: "SMTP unavailable" })
        .where(eq(notificationDeliveries.id, delivery.id))
        .run();

      const retried = createInquiryAdminRepository(context.db).retryNotification(
        inquiry.id,
        delivery.id,
        "staff-1",
      );

      expect(retried).toMatchObject({ status: "pending", lastError: null, workerId: null, claimedAt: null });
      expect(context.db.select().from(auditLogs).get()?.action).toBe("inquiry.notification.retry");
    } finally {
      context.close();
    }
  });

  it("exports filtered rows without allowing spreadsheet formulas", () => {
    const context = createTestDatabase();
    try {
      createInquiryRepository(context.db).createWithNotification(inquiryInput);
      const csv = createInquiryAdminRepository(context.db).exportCsv({ status: "new" }, "staff-1");

      expect(csv).toContain("'\u003dHYPERLINK");
      expect(csv).not.toContain("\n=HYPERLINK");
      expect(context.db.select().from(auditLogs).get()?.action).toBe("inquiry.export");
    } finally {
      context.close();
    }
  });
});
