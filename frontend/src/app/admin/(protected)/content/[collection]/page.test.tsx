import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { contentList, getSession, listContent, redirect } = vi.hoisted(() => ({
  contentList: vi.fn(() => null),
  getSession: vi.fn(),
  listContent: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect }));
vi.mock("@/api/admin-content", () => ({
  isAdminContentCollection: () => true,
}));
vi.mock("@/api/admin-content.server", () => ({
  listAdminContent: listContent,
}));
vi.mock("@/api/server", () => ({ getAdminSession: getSession }));
vi.mock("@/components/admin/content-collection-list", () => ({
  ContentCollectionList: contentList,
  collectionLabels: { services: "Services" },
}));

import AdminContentCollectionPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminContentCollectionPage", () => {
  it("redirects before protected content reads when the page has no session", async () => {
    getSession.mockResolvedValueOnce(null);

    await expect(
      AdminContentCollectionPage({
        params: Promise.resolve({ collection: "services" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
    expect(listContent).not.toHaveBeenCalled();
  });

  it.each([
    [["content.read", "content.write"], true],
    [["content.read"], false],
  ])("derives canWrite from session permissions", async (permissions, canWrite) => {
    getSession.mockResolvedValueOnce({
      permissions,
      user: { email: "editor@example.test", id: "staff-1" },
    });
    listContent.mockResolvedValueOnce([]);

    render(
      await AdminContentCollectionPage({
        params: Promise.resolve({ collection: "services" }),
      }),
    );

    expect(contentList).toHaveBeenCalledWith(
      expect.objectContaining({ canWrite, collection: "services" }),
      undefined,
    );
  });
});
