import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { auditLogs } from "../../db/schema/settings.js";
import { createAuditQueryRepository } from "./audit-query-repository.js";

describe("audit query repository", () => {
  it("filters and paginates audit events newest first", () => {
    const context = createTestDatabase();
    try {
      context.db.insert(auditLogs).values([
        { id: "a-1", actorId: "staff-1", action: "content.save", entityType: "services", entityId: "s-1", detail: "{}", createdAt: new Date("2026-07-15T01:00:00Z") },
        { id: "a-2", actorId: "staff-2", action: "content.publish", entityType: "services", entityId: "s-1", detail: "{}", createdAt: new Date("2026-07-15T02:00:00Z") },
        { id: "a-3", actorId: "staff-2", action: "content.publish", entityType: "articles", entityId: "a-1", detail: "{}", createdAt: new Date("2026-07-15T03:00:00Z") },
      ]).run();

      const result = createAuditQueryRepository(context.db).list({
        actorId: "staff-2",
        action: "content.publish",
        entityType: "services",
        page: 1,
        pageSize: 20,
      });
      expect(result.total).toBe(1);
      expect(result.items.map((item) => item.id)).toEqual(["a-2"]);
    } finally {
      context.close();
    }
  });

  it("redacts secret-looking detail fields recursively", () => {
    const context = createTestDatabase();
    try {
      context.db.insert(auditLogs).values({
        id: "a-secret",
        actorId: "staff-1",
        action: "settings.update",
        entityType: "settings",
        entityId: "site",
        detail: JSON.stringify({ password: "plain", nested: { apiToken: "token-value", safe: "保留" } }),
        createdAt: new Date("2026-07-15T04:00:00Z"),
      }).run();

      const detail = createAuditQueryRepository(context.db).detail("a-secret");
      expect(detail?.detail).toEqual({ password: "[已隐藏]", nested: { apiToken: "[已隐藏]", safe: "保留" } });
      expect(JSON.stringify(detail)).not.toContain("token-value");
      expect(JSON.stringify(detail)).not.toContain("plain");
    } finally {
      context.close();
    }
  });
});
