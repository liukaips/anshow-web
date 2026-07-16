import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { InquiryAdminRepository } from "../repositories/inquiry-admin-repository.js";

function repository(): InquiryAdminRepository {
  return {
    list: vi.fn(() => []),
    detail: vi.fn(() => null),
    assign: vi.fn(() => ({ id: "inquiry-1", assigneeId: "staff-2" }) as never),
    setPriority: vi.fn(() => ({ id: "inquiry-1", priority: "urgent" }) as never),
    transition: vi.fn(() => ({ id: "inquiry-1", status: "in_progress" }) as never),
    addNote: vi.fn(() => ({ id: "note-1", inquiryId: "inquiry-1", authorId: "staff-1", body: "已联系", createdAt: Date.now() })),
    retryNotification: vi.fn(() => ({ id: "delivery-1", status: "pending" }) as never),
    exportCsv: vi.fn(() => '"编号"\r\n"inquiry-1"'),
  };
}

const session = async () => ({ user: { id: "staff-1", email: "staff@example.test" } });

describe("admin inquiry routes", () => {
  it("requires inquiry.read before listing inquiries", async () => {
    const inquiryRepository = repository();
    const app = createApp({ inquiryRepository, getSession: session, getPermissions: () => [] });

    const response = await app.request("/api/admin/inquiries");

    expect(response.status).toBe(403);
    expect(inquiryRepository.list).not.toHaveBeenCalled();
  });

  it("validates filters and returns the inquiry list", async () => {
    const inquiryRepository = repository();
    const app = createApp({
      inquiryRepository,
      getSession: session,
      getPermissions: () => ["inquiry.read"],
    });

    const response = await app.request(
      "/api/admin/inquiries?status=new&priority=urgent&search=Volga&limit=25&offset=0",
    );

    expect(response.status).toBe(200);
    expect(inquiryRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "new", priority: "urgent", search: "Volga", limit: 25, offset: 0 }),
    );
  });

  it("requires inquiry.assign and passes the authenticated actor", async () => {
    const inquiryRepository = repository();
    const blocked = createApp({
      inquiryRepository,
      getSession: session,
      getPermissions: () => ["inquiry.read"],
    });
    expect(
      (await blocked.request("/api/admin/inquiries/inquiry-1/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeId: "staff-2" }),
      })).status,
    ).toBe(403);
    expect(inquiryRepository.assign).not.toHaveBeenCalled();

    const allowed = createApp({
      inquiryRepository,
      getSession: session,
      getPermissions: () => ["inquiry.read", "inquiry.assign"],
    });
    const response = await allowed.request("/api/admin/inquiries/inquiry-1/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assigneeId: "staff-2" }),
    });
    expect(response.status).toBe(200);
    expect(inquiryRepository.assign).toHaveBeenCalledWith("inquiry-1", "staff-2", "staff-1");
  });

  it("exports CSV only with inquiry.export", async () => {
    const inquiryRepository = repository();
    const app = createApp({
      inquiryRepository,
      getSession: session,
      getPermissions: () => ["inquiry.read", "inquiry.export"],
    });

    const response = await app.request("/api/admin/inquiries/export?status=new");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("inquiries-");
    expect(inquiryRepository.exportCsv).toHaveBeenCalledWith(
      expect.objectContaining({ status: "new" }),
      "staff-1",
    );
  });
});
