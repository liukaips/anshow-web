import { describe, expect, it, vi } from "vitest";

import { processInquiryNotification } from "./notification-worker.js";

const inquiry = {
  id: "inquiry-1",
  locale: "zh" as const,
  sourceUrl: "/zh/contact",
  email: "visitor@example.test",
  phone: "+86 13800000000",
  transportNeed: "中俄铁路运输",
  message: "需要报价",
};

describe("inquiry notification worker", () => {
  it("sends sales and visitor messages before marking the delivery sent", async () => {
    const repository = {
      claimDue: vi.fn(() => ({ id: "delivery-1", inquiryId: inquiry.id, attempts: 1, idempotencyKey: "inquiry:inquiry-1:sales" })),
      get: vi.fn(() => inquiry),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    const mailer = { send: vi.fn(async () => undefined) };

    await processInquiryNotification(repository, mailer, "sales@example.test", "worker-1");

    expect(mailer.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: "sales@example.test", subject: "新的 AnShow 物流询盘" }));
    expect(mailer.send).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: "visitor@example.test", subject: "AnShow enquiry received" }));
    expect(repository.markSent).toHaveBeenCalledWith("delivery-1");
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("records a bounded failure for retry", async () => {
    const repository = {
      claimDue: vi.fn(() => ({ id: "delivery-1", inquiryId: inquiry.id, attempts: 1, idempotencyKey: "inquiry:inquiry-1:sales" })),
      get: vi.fn(() => inquiry),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    const mailer = { send: vi.fn(async () => { throw new Error("SMTP unavailable"); }) };

    await expect(
      processInquiryNotification(repository, mailer, "sales@example.test", "worker-1"),
    ).resolves.toMatchObject({ processed: true, status: "retry" });
    expect(repository.markFailed).toHaveBeenCalledWith("delivery-1", "SMTP unavailable");
    expect(repository.markSent).not.toHaveBeenCalled();
  });
});
