import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminContentItem } from "../../api/admin-content";

const { createContent, push } = vi.hoisted(() => ({
  createContent: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../../api/admin-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-content")>();
  return { ...actual, createAdminContent: createContent };
});

import { ContentCollectionList } from "./content-collection-list";

const created: AdminContentItem = {
  id: "content-1",
  code: "new-service",
  sortOrder: 0,
  archivedAt: null,
  verified: false,
  verificationSource: null,
  createdAt: "2026-07-15T04:00:00.000Z",
  updatedAt: "2026-07-15T04:00:00.000Z",
  translations: {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ContentCollectionList", () => {
  it("shows a real empty state and creates a draft shell through the browser API", async () => {
    createContent.mockResolvedValue(created);
    render(
      <ContentCollectionList
        canWrite
        collection="services"
        initialItems={[]}
      />,
    );

    expect(screen.getByText("暂无服务内容。")).toBeVisible();
    fireEvent.change(screen.getByLabelText("内容编码"), {
      target: { value: "new-service" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建内容" }));

    await waitFor(() =>
      expect(createContent).toHaveBeenCalledWith("services", {
        code: "new-service",
      }),
    );
    expect(push).toHaveBeenCalledWith("/admin/content/services/content-1");
  });

  it("keeps content readable without offering creation to read-only staff", () => {
    render(
      <ContentCollectionList
        canWrite={false}
        collection="services"
        initialItems={[created]}
      />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("new-service");
    expect(screen.queryByLabelText("Content code")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "创建内容" }),
    ).toBeNull();
  });
});
