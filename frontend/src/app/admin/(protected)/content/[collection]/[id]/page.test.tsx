import { describe, expect, it, vi } from "vitest";

const { getContent, getSession, redirect } = vi.hoisted(() => ({
  getContent: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect }));
vi.mock("@/api/admin-content", () => ({
  isAdminContentCollection: () => true,
}));
vi.mock("@/api/admin-content.server", () => ({
  getAdminContent: getContent,
}));
vi.mock("@/api/http", () => ({
  ApiError: class ApiError extends Error {},
}));
vi.mock("@/api/server", () => ({ getAdminSession: getSession }));
vi.mock("@/components/admin/content-collection-list", () => ({
  collectionLabels: { services: "Services" },
}));
vi.mock("@/components/admin/content-editor", () => ({
  ContentEditor: () => null,
}));

import AdminContentEditorPage from "./page";

describe("AdminContentEditorPage", () => {
  it("redirects before protected content reads when the page has no session", async () => {
    getSession.mockResolvedValueOnce(null);

    await expect(
      AdminContentEditorPage({
        params: Promise.resolve({ collection: "services", id: "content-1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
    expect(getContent).not.toHaveBeenCalled();
  });
});
