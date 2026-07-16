import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { DashboardRepository } from "../repositories/dashboard-repository.js";

const dashboardSummary = {
  newInquiries: 2,
  highPriorityInquiries: 1,
  reviewPending: 3,
  translationPending: 1,
  publishedThisWeek: 4,
  tasks: {
    inquiries: [{ id: "inquiry-1", name: "Alice", company: "Acme", priority: "high" as const, status: "new" as const, updatedAt: 1 }],
    reviews: [{ id: "review-1", entityType: "services", entityId: "service-1", sourceVersion: 2, submittedBy: "editor-1", submittedAt: new Date("2026-07-16T04:00:00.000Z") }],
  },
  recentAuditEvents: [{ id: "audit-1", actorId: "staff-1", action: "content.update", entityType: "services", entityId: "service-1", detail: {}, createdAt: new Date("2026-07-16T04:00:00.000Z") }],
  systemHealth: "normal" as const,
};

describe("admin dashboard route", () => {
  it("requires an authenticated employee without requiring a business permission", async () => {
    const summary = vi.fn(() => dashboardSummary);
    const dashboardRepository = { summary } as DashboardRepository;
    const unauthenticated = createApp({ dashboardRepository, getSession: async () => null });

    expect((await unauthenticated.request("/api/admin/dashboard")).status).toBe(401);
    expect(summary).not.toHaveBeenCalled();

    const authenticated = createApp({
      dashboardRepository,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => [],
    });
    const response = await authenticated.request("/api/admin/dashboard");

    expect(response.status).toBe(200);
    expect(summary).toHaveBeenCalledWith("staff-1");
  });

  it("filters task and audit details using the employee's granted permissions", async () => {
    const dashboardRepository = { summary: vi.fn(() => dashboardSummary) } as DashboardRepository;
    const app = createApp({
      dashboardRepository,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => ["inquiry.read"],
    });

    const response = await app.request("/api/admin/dashboard");
    const body = await response.json() as {
      data: typeof dashboardSummary;
    };

    expect(response.status).toBe(200);
    expect(body.data.tasks.inquiries).toHaveLength(1);
    expect(body.data.tasks.reviews).toEqual([]);
    expect(body.data.recentAuditEvents).toEqual([]);
    expect(body.data.reviewPending).toBe(3);
  });
});
