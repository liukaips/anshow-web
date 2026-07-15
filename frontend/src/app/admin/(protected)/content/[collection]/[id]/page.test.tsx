import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { contentEditor, getContent, getSession, redirect } = vi.hoisted(() => ({
  contentEditor: vi.fn(() => null),
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
  ContentEditor: contentEditor,
}));

import AdminContentEditorPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it("derives write and publish permissions independently", async () => {
    getSession.mockResolvedValueOnce({
      permissions: ["content.read", "content.publish"],
      user: { email: "publisher@example.test", id: "staff-1" },
    });
    getContent.mockResolvedValueOnce({ id: "content-1", code: "service" });

    render(
      await AdminContentEditorPage({
        params: Promise.resolve({ collection: "services", id: "content-1" }),
      }),
    );

    expect(contentEditor).toHaveBeenCalledWith(
      expect.objectContaining({ canPublish: true, canWrite: false }),
      undefined,
    );
  });
});
