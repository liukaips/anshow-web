import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { createInquiryRepository } from "./repository.js";

const input = {
  name: "Elena Petrova",
  company: "Volga Trade",
  email: "elena@example.test",
  phone: "",
  transportNeed: "中俄铁路运输",
  message: "需要从上海运输工业设备到莫斯科。",
  consent: true as const,
  privacyVersion: "2026-07",
  locale: "zh" as const,
  sourceUrl: "https://example.test/zh/contact",
};

describe("inquiry repository operations", () => {
  it("assigns, transitions and records follow-up notes", () => {
    const context = createTestDatabase();
    try {
      const repository = createInquiryRepository(context.db);
      const created = repository.createWithNotification(input);
      expect(created).toMatchObject({ priority: "normal", updatedAt: expect.any(Number), closedAt: null });
      expect(repository.assign(created.id, "staff-2", "staff-1").assigneeId).toBe("staff-2");
      expect(repository.updateStatus(created.id, "in_progress", "staff-2").status).toBe("in_progress");
      expect(repository.addNote(created.id, "staff-2", "已电话联系客户").body).toBe("已电话联系客户");
      expect(repository.history(created.id)).toHaveLength(3);
    } finally {
      context.close();
    }
  });

  it("rejects invalid business transitions", () => {
    const context = createTestDatabase();
    try {
      const repository = createInquiryRepository(context.db);
      const created = repository.createWithNotification(input);
      expect(() => repository.updateStatus(created.id, "completed", "staff-1")).toThrowError("不允许从当前状态变更为目标状态");
      expect(repository.get(created.id)?.status).toBe("new");
    } finally {
      context.close();
    }
  });
});
