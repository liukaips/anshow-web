import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as inquiryApi from "@/api/admin-inquiries";
import { InquiryDetail } from "./inquiry-detail";
import { InquiryList } from "./inquiry-list";

vi.mock("@/api/admin-inquiries", async () => {
  const actual = await vi.importActual<typeof import("@/api/admin-inquiries")>("@/api/admin-inquiries");
  return { ...actual, getAdminInquiry: vi.fn() };
});

const inquiry = {
  id: "inquiry-1",
  name: "Elena Petrova",
  company: "Volga Trade",
  email: "elena@example.test",
  phone: "+7 900 000 0000",
  transportNeed: "中俄铁路运输",
  message: "需要从上海运输工业设备到莫斯科。",
  locale: "zh",
  sourceUrl: "https://example.test/zh/contact",
  referrer: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  privacyVersion: "2026-07",
  consentedAt: 1784190000000,
  assigneeId: null,
  priority: "urgent" as const,
  status: "new" as const,
  createdAt: 1784190000000,
  updatedAt: 1784190000000,
  closedAt: null,
};

const detail = {
  ...inquiry,
  notes: [],
  history: [
    {
      id: "history-1",
      inquiryId: inquiry.id,
      actorId: null,
      assigneeId: null,
      fromStatus: null,
      toStatus: "new",
      createdAt: inquiry.createdAt,
    },
  ],
  notifications: [
    {
      id: "delivery-1",
      inquiryId: inquiry.id,
      status: "failed",
      attempts: 5,
      nextAttemptAt: inquiry.createdAt,
      workerId: null,
      claimedAt: null,
      sentAt: null,
      lastError: "SMTP unavailable",
      idempotencyKey: "inquiry:inquiry-1:sales",
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InquiryList", () => {
  it("renders an operator-facing desktop table and opens the detail drawer", async () => {
    vi.mocked(inquiryApi.getAdminInquiry).mockResolvedValue(detail);
    render(
      <InquiryList
        canExport
        initialItems={[inquiry]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "客户与公司" })).toBeVisible();
    expect(screen.getAllByText("Elena Petrova").length).toBeGreaterThan(0);
    expect(screen.getAllByText("紧急").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "导出当前结果" })).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "查看详情" })[0]!);
    expect(await screen.findByRole("dialog", { name: "询盘详情" })).toBeVisible();
    expect(screen.getByText("需要从上海运输工业设备到莫斯科。")).toBeVisible();
  });

  it("filters the visible list with business text", () => {
    render(<InquiryList canExport={false} initialItems={[inquiry]} />);
    fireEvent.change(screen.getByLabelText("搜索询盘"), { target: { value: "不存在" } });
    expect(screen.getByText("没有符合条件的询盘")).toBeVisible();
  });

  it("opens a task linked from the workbench", async () => {
    render(
      <InquiryList
        canExport={false}
        initialDetail={detail}
        initialItems={[inquiry]}
      />,
    );
    expect(await screen.findByRole("dialog", { name: "询盘详情" })).toBeVisible();
  });
});

describe("InquiryDetail", () => {
  it("shows permitted follow-up commands and hides technical delivery fields", async () => {
    render(
      <InquiryDetail
        canAddNote
        canAssign
        canChangeStatus
        canRetry
        inquiry={detail}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "分配负责人" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("新增记录"), {
      target: { value: "已确认客户收货地址" },
    });
    expect(screen.getByRole("button", { name: "添加跟进记录" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重新发送通知" })).toBeEnabled();
    expect(screen.queryByText("idempotencyKey")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "关闭询盘详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
