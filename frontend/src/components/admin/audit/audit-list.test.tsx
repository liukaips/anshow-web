import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuditList } from "./audit-list";

afterEach(cleanup);

describe("AuditList", () => {
  it("renders human-readable Chinese events without exposing internal action codes", () => {
    render(<AuditList items={[{
      id: "audit-1",
      actorId: "staff-1",
      action: "content.publish",
      entityType: "services",
      entityId: "service-1",
      detail: { locale: "zh" },
      createdAt: "2026-07-15T04:00:00.000Z",
    }]} />);
    expect(screen.getAllByText("发布内容")[0]).toBeVisible();
    expect(screen.getAllByText("服务内容")[0]).toBeVisible();
    expect(screen.getAllByText("2026/07/15 12:00")[0]).toBeVisible();
    expect(screen.queryByText("content.publish")).toBeNull();
  });
});
