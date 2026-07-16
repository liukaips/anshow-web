import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { AuditQueryRepository } from "../repositories/audit-query-repository.js";

const EVENT = {
  id: "audit-1",
  actorId: "staff-1",
  action: "content.publish",
  entityType: "services",
  entityId: "service-1",
  detail: { locale: "zh" },
  createdAt: new Date("2026-07-15T04:00:00Z"),
};

function repository(): AuditQueryRepository {
  return {
    list: vi.fn(() => ({ items: [EVENT], page: 1, pageSize: 20, total: 1 })),
    detail: vi.fn(() => EVENT),
  };
}

describe("admin audit routes", () => {
  it("requires audit.read before querying", async () => {
    const auditRepository = repository();
    const app = createApp({
      auditRepository,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => [],
    });
    const response = await app.request("/api/admin/audit");
    expect(response.status).toBe(403);
    expect(auditRepository.list).not.toHaveBeenCalled();
  });

  it("passes validated filters and returns detail", async () => {
    const auditRepository = repository();
    const app = createApp({
      auditRepository,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => ["audit.read"],
    });
    const listResponse = await app.request("/api/admin/audit?action=content.publish&page=1&pageSize=20");
    expect(listResponse.status).toBe(200);
    expect(auditRepository.list).toHaveBeenCalledWith(expect.objectContaining({ action: "content.publish", page: 1, pageSize: 20 }));

    const detailResponse = await app.request("/api/admin/audit/audit-1");
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({ data: { id: "audit-1", detail: { locale: "zh" } }, error: null });
  });
});
