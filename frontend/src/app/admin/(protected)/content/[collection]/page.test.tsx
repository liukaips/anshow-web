import { describe, expect, it, vi } from "vitest";

const { getSession, listContent, redirect } = vi.hoisted(() => ({
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
  ContentCollectionList: () => null,
  collectionLabels: { services: "Services" },
}));

import AdminContentCollectionPage from "./page";

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
});
