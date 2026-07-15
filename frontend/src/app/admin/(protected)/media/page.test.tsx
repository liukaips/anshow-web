import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/admin-media.server", () => ({
  listAdminMedia: vi.fn(async () => []),
}));
vi.mock("@/api/server", () => ({
  getAdminSession: vi.fn(async () => ({
    user: { id: "staff-1", email: "staff@example.test" },
    permissions: ["media.read"],
  })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import AdminMediaPage from "./page";

afterEach(cleanup);

describe("AdminMediaPage", () => {
  it("uses mobile-safe body text for the workspace description", async () => {
    render(await AdminMediaPage());

    expect(
      screen.getByText(/管理优化后的图片版本/),
    ).toHaveClass("text-base");
  });
});
