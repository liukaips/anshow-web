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

    expect(screen.getByRole("link", { name: "Pages" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Staff & Roles" })).toBeNull();
    expect(screen.getByRole("link", { name: "Pages" })).toHaveAttribute(
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
      "Dashboard",
      "Pages",
      "Hero Slides",
      "Services",
      "Trade Lanes",
      "Special Cargo",
      "Case Studies",
      "Articles",
      "Partners",
      "Certificates",
      "Proof Metrics",
      "Navigation Items",
      "Media Library",
      "Enquiries",
      "Staff & Roles",
      "Site Settings",
      "Audit Log",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }
  });
});

describe("AdminMobileNavigation", () => {
  it("manages focus, body scrolling, Escape, and 44px controls", () => {
    document.body.style.overflow = "clip";
    render(<AdminMobileNavigation permissions={contentPermissions} />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });

    expect(trigger).toHaveClass("size-11");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Administration navigation",
    });
    const close = screen.getByRole("button", { name: "Close navigation" });
    expect(close).toHaveClass("size-11");
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: "Navigation Items" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("clip");
    expect(trigger).toHaveFocus();
  });
});

describe("AdminTopbar", () => {
  it("shows the staff identity and signs out to the login route", async () => {
    render(<AdminTopbar email="editor@anshow.example" />);

    expect(screen.getByText("editor@anshow.example")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session service unavailable",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("keeps the shell open and reports a rejected sign-out request", async () => {
    signOut.mockRejectedValueOnce(new Error("network unavailable"));
    render(<AdminTopbar email="editor@anshow.example" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign out. Try again.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
