import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh, replace, signOut } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(
    async (): Promise<{
      data: null;
      error: null | { message?: string };
    }> => ({ data: null, error: null }),
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/content/pages",
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("../../auth/client", () => ({
  authClient: { signOut },
}));

import { AdminSidebar, AdminMobileNavigation } from "./admin-sidebar";
import { ADMIN_NAVIGATION_REQUEST } from "./admin-navigation";
import { AdminTopbar } from "./admin-topbar";

const contentPermissions = ["content.read", "content.write"];

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  vi.clearAllMocks();
});

describe("AdminSidebar", () => {
  it("hides staff management from a content-only role", () => {
    render(<AdminSidebar permissions={contentPermissions} />);

    expect(screen.getByRole("link", { name: "页面" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "员工与角色" })).toBeNull();
    expect(screen.getByRole("link", { name: "页面" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows each authorized administration area", () => {
    render(
      <AdminSidebar
        permissions={[
          "content.read",
          "media.read",
          "inquiry.read",
          "staff.manage",
          "settings.manage",
          "audit.read",
        ]}
      />,
    );

    for (const label of [
      "工作台", "页面", "首屏轮播", "服务", "贸易航线", "特种货物", "案例", "文章", "合作伙伴", "资质证书", "证明指标", "导航项目", "媒体库", "询盘", "员工与角色", "站点设置", "审计日志",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }

    for (const section of ["工作", "内容", "业务", "系统"]) {
      expect(screen.getByText(section)).toBeVisible();
    }
    expect(screen.queryByText("Permission-aware workspace")).toBeNull();
    expect(screen.getByText("当前账号权限已生效")).toBeVisible();
  });
});

describe("AdminMobileNavigation", () => {
  it("manages focus, body scrolling, Escape, and 44px controls", () => {
    document.body.style.overflow = "clip";
    render(<AdminMobileNavigation permissions={contentPermissions} />);
    const trigger = screen.getByRole("button", { name: "打开导航" });

    expect(trigger).toHaveClass("size-11");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "管理后台导航",
    });
    const close = screen.getByRole("button", { name: "关闭导航" });
    expect(close).toHaveClass("size-11");
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: "导航项目" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("clip");
    expect(trigger).toHaveFocus();
  });
});

describe("AdminTopbar", () => {
  function openAccountMenu() {
    fireEvent.click(screen.getByRole("button", { name: "账号菜单" }));
  }

  it("shows Chinese breadcrumbs, help, and the account menu", () => {
    render(<AdminTopbar email="editor@anshow.example" />);

    const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
    expect(breadcrumb).toHaveTextContent("内容");
    expect(breadcrumb).toHaveTextContent("页面");
    expect(screen.getByRole("button", { name: "帮助" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "账号菜单" })).toBeVisible();
  });

  it("does not sign out when admin navigation is cancelled", async () => {
    const cancelNavigation = (event: Event) => event.preventDefault();
    window.addEventListener(ADMIN_NAVIGATION_REQUEST, cancelNavigation);
    render(<AdminTopbar email="editor@anshow.example" />);

    openAccountMenu();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(signOut).not.toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeEnabled();
    window.removeEventListener(
      ADMIN_NAVIGATION_REQUEST,
      cancelNavigation,
    );
  });

  it("shows the staff identity and signs out to the login route", async () => {
    render(<AdminTopbar email="editor@anshow.example" />);

    expect(screen.getByText("editor@anshow.example")).toBeVisible();
    openAccountMenu();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(replace).toHaveBeenCalledWith("/admin/login");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the shell open and reports a resolved sign-out error", async () => {
    signOut.mockResolvedValueOnce({
      data: null,
      error: { message: "Session service unavailable" },
    });
    render(<AdminTopbar email="editor@anshow.example" />);

    openAccountMenu();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "退出失败，请重试。",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeEnabled();
  });

  it("keeps the shell open and reports a rejected sign-out request", async () => {
    signOut.mockRejectedValueOnce(new Error("network unavailable"));
    render(<AdminTopbar email="editor@anshow.example" />);

    openAccountMenu();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "退出失败，请重试。",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeEnabled();
  });
});
