import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StaffMember, StaffRole } from "@/api/admin-staff";
import { StaffForm } from "./staff-form";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const roles: StaffRole[] = [
  {
    id: "content-editor",
    name: "Content Editor",
    permissions: ["content.read", "content.write"],
  },
  {
    id: "content-reviewer",
    name: "Content Reviewer",
    permissions: ["content.read", "content.review"],
  },
];

function employee(
  overrides: Record<string, unknown> = {},
): StaffMember {
  return {
    id: "editor-1",
    name: "张敏",
    email: "editor@example.test",
    createdAt: "2026-07-16T08:00:00.000Z",
    roles: "Content Editor",
    enabled: true,
    roleIds: ["content-editor"],
    roleNames: ["Content Editor"],
    isSuperAdmin: false,
    ...overrides,
  } as unknown as StaffMember;
}

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("StaffForm", () => {
  it("creates a staff account with initial roles", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "liukai-id",
          name: "刘凯",
          email: "liukai@anshow.local",
          createdAt: "2026-07-19T13:00:00.000Z",
          roles: "Content Editor",
          enabled: true,
          roleIds: ["content-editor"],
          roleNames: ["Content Editor"],
          isSuperAdmin: false,
        },
      }),
    });

    render(<StaffForm currentUserId="admin-1" roles={roles} staff={[]} />);

    fireEvent.change(screen.getByLabelText("登录账号"), {
      target: { value: "liukai" },
    });
    fireEvent.change(screen.getByLabelText("员工姓名"), {
      target: { value: "刘凯" },
    });
    fireEvent.change(screen.getByLabelText("初始密码"), {
      target: { value: "liukaiok" },
    });
    fireEvent.click(screen.getByLabelText("新员工角色：内容编辑"));
    fireEvent.click(screen.getByRole("button", { name: "创建员工账号" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/staff",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            account: "liukai",
            name: "刘凯",
            password: "liukaiok",
            roleIds: ["content-editor"],
          }),
        }),
      ),
    );
    expect(screen.getByText("员工账号已创建，可使用初始密码登录")).toBeVisible();
    expect(screen.getByText("刘凯")).toBeVisible();
  });

  it("shows Chinese account status and role choices", () => {
    render(
      <StaffForm
        currentUserId="admin-1"
        roles={roles}
        staff={[employee()]}
      />,
    );

    expect(screen.getByText("正常使用")).toBeVisible();
    expect(screen.getByLabelText("内容编辑")).toBeChecked();
    expect(screen.getByLabelText("内容审核")).not.toBeChecked();
    expect(screen.queryByText("Content Editor")).toBeNull();
  });

  it("saves role assignments and explains that sessions are revoked", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { updated: true } }) });
    render(
      <StaffForm
        currentUserId="admin-1"
        roles={roles}
        staff={[employee()]}
      />,
    );

    fireEvent.click(screen.getByLabelText("内容审核"));
    fireEvent.click(screen.getByRole("button", { name: "保存角色" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/staff/editor-1/roles",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            roleIds: ["content-editor", "content-reviewer"],
          }),
        }),
      ),
    );
    expect(screen.getByText("角色已更新，该员工需要重新登录")).toBeVisible();
  });

  it("does not offer disabling the current signed-in account", () => {
    render(
      <StaffForm
        currentUserId="editor-1"
        roles={roles}
        staff={[employee()]}
      />,
    );

    expect(screen.getByText("当前登录账号")).toBeVisible();
    expect(screen.queryByRole("button", { name: "停用账号" })).toBeNull();
  });
});
