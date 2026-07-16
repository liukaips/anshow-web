import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminDashboard } from "./admin-dashboard";

const data = {
  newInquiries: 2,
  highPriorityInquiries: 1,
  reviewPending: 3,
  translationPending: 1,
  publishedThisWeek: 4,
  tasks: {
    inquiries: [
      {
        id: "inquiry-1",
        name: "Elena Petrova",
        company: "Volga Trade",
        priority: "urgent" as const,
        status: "new" as const,
        updatedAt: 1784190000000,
      },
    ],
    reviews: [
      {
        id: "review-1",
        entityType: "services",
        entityId: "service-1",
        sourceVersion: 3,
        submittedBy: "editor-1",
        submittedAt: "2026-07-16T04:00:00.000Z",
      },
    ],
  },
  recentAuditEvents: [],
  systemHealth: "warning" as const,
  systemHealthIssues: ["最近一次异地备份失败"],
};

afterEach(cleanup);

describe("AdminDashboard", () => {
  it("shows truthful operational metrics and direct task links", () => {
    render(<AdminDashboard data={data} />);

    expect(screen.getByText("今日工作")).toBeVisible();
    expect(screen.getByText("高优先级")).toBeVisible();
    expect(screen.getByRole("link", { name: /新询盘 2/ })).toHaveAttribute(
      "href",
      "/admin/inquiries?status=new",
    );
    expect(screen.getByRole("link", { name: /Elena Petrova/ })).toHaveAttribute(
      "href",
      "/admin/inquiries?selected=inquiry-1",
    );
    expect(screen.getByRole("link", { name: /待审核 3/ })).toHaveAttribute(
      "href",
      "/admin/reviews",
    );
    expect(screen.getByText("部分服务需要处理")).toBeVisible();
    expect(screen.getByText("最近一次异地备份失败")).toBeVisible();
  });

  it("does not invent task rows when permissions hide details", () => {
    render(
      <AdminDashboard
        data={{ ...data, tasks: { inquiries: [], reviews: [] }, systemHealth: "normal", systemHealthIssues: [] }}
      />,
    );
    expect(screen.getByText("当前没有分配给你的待办")).toBeVisible();
    expect(screen.getByText("运行正常")).toBeVisible();
  });
});
