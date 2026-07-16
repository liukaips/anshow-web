import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminContentItem } from "../../api/admin-content";
const {
  archiveContent,
  generateTranslations,
  saveDraft,
  submitReview,
  updateVerification,
} = vi.hoisted(() => ({
  archiveContent: vi.fn(),
  generateTranslations: vi.fn(),
  saveDraft: vi.fn(),
  submitReview: vi.fn(),
  updateVerification: vi.fn(),
}));

vi.mock("../../api/admin-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-content")>();
  return {
    ...actual,
    archiveAdminContent: archiveContent,
    generateAdminContentTranslations: generateTranslations,
    saveAdminContentDraft: saveDraft,
    updateAdminContentVerification: updateVerification,
  };
});
vi.mock("../../api/admin-reviews", () => ({ submitAdminReview: submitReview }));

import { ContentEditor } from "./content-editor";

const ITEM: AdminContentItem = {
  id: "content-1",
  code: "freight-service",
  sortOrder: 0,
  archivedAt: null,
  verified: false,
  verificationSource: null,
  createdAt: "2026-07-15T04:00:00.000Z",
  updatedAt: "2026-07-15T04:00:00.000Z",
  translations: {
    en: {
      locale: "en",
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      title: "Freight service",
      slug: "freight-service",
      summary: "A complete summary.",
      body: "A complete body.",
      seoTitle: "Freight service",
      seoDescription: "A complete search description.",
      altText: "Cargo being handled at a terminal",
      updatedAt: "2026-07-15T04:00:00.000Z",
    },
  },
  workflow: { state: "draft", ownerId: "staff-1", version: 1, submittedAt: null, updatedAt: "2026-07-15T04:00:00.000Z" },
};
const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockReturnValue(false);
  saveDraft.mockResolvedValue(ITEM);
  archiveContent.mockResolvedValue(ITEM);
  updateVerification.mockResolvedValue(ITEM);
  generateTranslations.mockResolvedValue({ sourceVersion: 1, jobs: [], item: ITEM });
  submitReview.mockResolvedValue({ id: "review-1", entityType: "services", entityId: "content-1", sourceVersion: 2, submittedBy: "staff-1", reviewerId: null, decision: "pending", reason: null, submittedAt: "2026-07-15T05:00:00.000Z", decidedAt: null });
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("ContentEditor", () => {
  it("generates editable English and Russian drafts from Chinese content", async () => {
    render(<ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />);
    fireEvent.click(screen.getByRole("button", { name: "自动生成英文和俄文" }));
    await waitFor(() => expect(generateTranslations).toHaveBeenCalledWith("services", "content-1", { targets: ["en", "ru"], sourceVersion: 1 }));
    expect(await screen.findByText("英文和俄文草稿已生成，请检查后再提交审核。")).toBeVisible();
  });

  it("submits the current saved version for review", async () => {
    render(<ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />);
    fireEvent.click(screen.getByRole("button", { name: "提交审核" }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith({ collection: "services", id: "content-1", expectedVersion: 1 }));
    expect(await screen.findByText("内容已提交审核。")).toBeVisible();
  });

  it("warns on unload and locale changes while dirty, then clears dirty state after save", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Updated title" },
    });
    const beforeSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeSave);
    expect(beforeSave.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /俄文/i }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /英文/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存。");

    await waitFor(() => {
      const afterSave = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(afterSave);
      expect(afterSave.defaultPrevented).toBe(false);
    });
  });

  it("locks all async commands while a save is pending", async () => {
    let resolveSave: ((item: AdminContentItem) => void) | undefined;
    saveDraft.mockReturnValue(
      new Promise<AdminContentItem>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "前往预览发布" })).toHaveAttribute(
      "href",
      "/admin/publish",
    );

    resolveSave?.(ITEM);
    await screen.findByText("草稿已保存。");
  });

  it("locks editable controls and applies the persisted response while saving", async () => {
    let resolveSave: ((item: AdminContentItem) => void) | undefined;
    saveDraft.mockReturnValueOnce(
      new Promise<AdminContentItem>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const persisted = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: { ...ITEM.translations.en!, title: "Canonical title" },
      },
    };
    render(
      <ContentEditor
        canPublish
        canWrite
        collection="services"
        initialItem={ITEM}
      />,
    );
    const title = screen.getByLabelText("标题");
    fireEvent.change(title, { target: { value: " Submitted title " } });

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce());

    expect(title).toBeDisabled();
    expect(screen.getByRole("tab", { name: /俄文/i })).toBeDisabled();
    fireEvent.change(title, { target: { value: "Newer local title" } });
    expect(title).toHaveValue(" Submitted title ");

    resolveSave?.(persisted);
    await screen.findByText("草稿已保存。");
    expect(title).toHaveValue("Canonical title");
  });

  it("guards internal document navigation while dirty and allows hash or clean navigation", async () => {
    render(
      <>
        <Link href="/admin/content/pages">Back to pages</Link>
        <a href="#content-preview">Jump to preview</a>
        <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />
      </>,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Dirty navigation" },
    });

    const internal = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link", { name: "Back to pages" }).dispatchEvent(internal);
    expect(internal.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();

    const hash = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link", { name: "Jump to preview" }).dispatchEvent(hash);
    expect(hash.defaultPrevented).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存。");
    const backLink = screen.getByRole("link", { name: "Back to pages" });
    let preventedBeforeBubble = true;
    backLink.addEventListener(
      "click",
      (event) => {
        preventedBeforeBubble = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    const clean = new MouseEvent("click", { bubbles: true, cancelable: true });
    backLink.dispatchEvent(clean);
    expect(preventedBeforeBubble).toBe(false);
  });

  it("restores the editor history entry when dirty back navigation is cancelled", () => {
    window.history.replaceState(
      { page: "editor" },
      "",
      "/admin/content/services/content-1",
    );
    const downstreamPopstate = vi.fn();
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Dirty before back" },
    });
    window.addEventListener("popstate", downstreamPopstate);

    window.history.replaceState(
      { page: "list" },
      "",
      "/admin/content/services",
    );
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: { page: "list" } }),
    );

    expect(confirm).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe(
      "/admin/content/services/content-1",
    );
    expect(window.history.state).toEqual({ page: "editor" });
    expect(downstreamPopstate).not.toHaveBeenCalled();
    window.removeEventListener("popstate", downstreamPopstate);
  });

  it("allows dirty back navigation after confirmation", () => {
    window.history.replaceState(
      { page: "editor" },
      "",
      "/admin/content/services/content-1",
    );
    confirm.mockReturnValue(true);
    const downstreamPopstate = vi.fn();
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Dirty before back" },
    });
    window.addEventListener("popstate", downstreamPopstate);

    window.history.replaceState(
      { page: "list" },
      "",
      "/admin/content/services",
    );
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: { page: "list" } }),
    );

    expect(confirm).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/admin/content/services");
    expect(downstreamPopstate).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", downstreamPopstate);
  });

  it("labels a dirty persisted publication as an unpublished preview", () => {
    const publishedItem: AdminContentItem = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: { ...ITEM.translations.en!, status: "published" },
      },
    };
    render(
      <ContentEditor
        canPublish
        canWrite
        collection="services"
        initialItem={publishedItem}
      />,
    );
    expect(screen.getByText("已发布预览")).toBeVisible();

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Dirty published title" },
    });

    expect(screen.getByText("未发布预览")).toBeVisible();
  });

  it("renders translation controls read-only for a viewer", () => {
    render(
      <ContentEditor
        canPublish={false}
        canWrite={false}
        collection="services"
        initialItem={ITEM}
      />,
    );

    expect(screen.getByLabelText("标题")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "保存草稿" })).toBeNull();
    expect(screen.queryByRole("button", { name: "归档" })).toBeNull();
    expect(screen.queryByRole("link", { name: "前往预览发布" })).toBeNull();
    expect(screen.queryByRole("button", { name: "定时发布" })).toBeNull();
    expect(screen.queryByLabelText("发布时间")).toBeNull();
    expect(screen.getByText("需要 content.publish 权限才能发布。")).toBeVisible();
  });

  it("routes a publish-only actor to snapshot publication without legacy locale scheduling", () => {
    render(
      <ContentEditor
        canPublish
        canWrite={false}
        collection="services"
        initialItem={ITEM}
      />,
    );

    expect(screen.getByLabelText("标题")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "保存草稿" })).toBeNull();
    expect(screen.queryByRole("button", { name: "归档" })).toBeNull();
    expect(screen.getByRole("link", { name: "前往预览发布" })).toHaveAttribute(
      "href",
      "/admin/publish",
    );
    expect(screen.queryByRole("button", { name: "定时发布" })).toBeNull();
    expect(screen.queryByLabelText("发布时间")).toBeNull();
  });

  it("updates official proof verification for writers", async () => {
    const verifiedItem = {
      ...ITEM,
      verified: true,
      verificationSource: "官方登记记录",
    };
    updateVerification.mockResolvedValueOnce(verifiedItem);
    render(
      <ContentEditor
        canPublish={false}
        canWrite
        collection="partners"
        initialItem={ITEM}
      />,
    );
    fireEvent.click(screen.getByLabelText("已核验证明"));
    fireEvent.change(screen.getByLabelText("官方核验来源"), {
      target: { value: "官方登记记录" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存核验信息" }));

    await waitFor(() =>
      expect(updateVerification).toHaveBeenCalledWith(
        "partners",
        ITEM.id,
        {
          verified: true,
          verificationSource: "官方登记记录",
        },
      ),
    );
    expect(await screen.findByText("核验信息已保存。")).toBeVisible();
  });
});
