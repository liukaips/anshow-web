import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminContentItem } from "../../api/admin-content";
import { ApiError } from "../../api/http";

const {
  archiveContent,
  generateTranslations,
  publishTranslation,
  saveDraft,
  scheduleTranslation,
  submitReview,
  updateVerification,
} = vi.hoisted(() => ({
  archiveContent: vi.fn(),
  generateTranslations: vi.fn(),
  publishTranslation: vi.fn(),
  saveDraft: vi.fn(),
  scheduleTranslation: vi.fn(),
  submitReview: vi.fn(),
  updateVerification: vi.fn(),
}));

vi.mock("../../api/admin-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-content")>();
  return {
    ...actual,
    archiveAdminContent: archiveContent,
    generateAdminContentTranslations: generateTranslations,
    publishAdminContentTranslation: publishTranslation,
    saveAdminContentDraft: saveDraft,
    scheduleAdminContentTranslation: scheduleTranslation,
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
  publishTranslation.mockResolvedValue(ITEM);
  scheduleTranslation.mockResolvedValue(ITEM);
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
    expect(screen.getByRole("button", { name: "发布" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "定时发布" })).toBeDisabled();

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
    expect(screen.getByLabelText("发布时间")).toBeDisabled();
    expect(screen.getByRole("tab", { name: /俄文/i })).toBeDisabled();
    fireEvent.change(title, { target: { value: "Newer local title" } });
    expect(title).toHaveValue(" Submitted title ");

    resolveSave?.(persisted);
    await screen.findByText("草稿已保存。");
    expect(title).toHaveValue("Canonical title");
  });

  it("renders publish errors inline and focuses the first invalid field", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    const title = screen.getByLabelText("标题");
    fireEvent.change(title, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "发布" }));

    expect(await screen.findByText("发布前必须填写标题。")).toBeVisible();
    expect(title).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(publishTranslation).not.toHaveBeenCalled();
  });

  it("publishes current input in one command and clears dirty only after success", async () => {
    const published = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: { ...ITEM.translations.en!, status: "published" as const },
      },
    };
    publishTranslation.mockResolvedValueOnce(published);
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Atomic published title" },
    });

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByText("翻译已发布。");

    expect(saveDraft).not.toHaveBeenCalled();
    expect(publishTranslation).toHaveBeenCalledWith(
      "services",
      ITEM.id,
      "en",
      expect.objectContaining({ title: "Atomic published title" }),
    );
    await waitFor(() => {
      const afterPublish = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(afterPublish);
      expect(afterPublish.defaultPrevented).toBe(false);
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps dirty state when the atomic publish command fails", async () => {
    publishTranslation.mockRejectedValueOnce(new Error("发布失败。"));
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Saved before publish" },
    });

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("发布失败。");
    expect(saveDraft).not.toHaveBeenCalled();
    expect(publishTranslation).toHaveBeenCalled();

    const afterSavedPublishFailure = new Event("beforeunload", {
      cancelable: true,
    });
    window.dispatchEvent(afterSavedPublishFailure);
    expect(afterSavedPublishFailure.defaultPrevented).toBe(true);
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

  it("keeps an edited schedule time dirty after saving the translation", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存。");

    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(true);
  });

  it("clears a clean persisted schedule and applies canonical draft values on save", async () => {
    const scheduledAt = "2099-07-16T12:00:00.000Z";
    const scheduledItem: AdminContentItem = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: {
          ...ITEM.translations.en!,
          scheduledAt,
          status: "scheduled",
        },
      },
    };
    const savedItem: AdminContentItem = {
      ...scheduledItem,
      translations: {
        ...scheduledItem.translations,
        en: {
          ...scheduledItem.translations.en!,
          scheduledAt: null,
          status: "draft",
          title: "Server-trimmed title",
        },
      },
    };
    saveDraft.mockResolvedValueOnce(savedItem);
    render(
      <ContentEditor
        canPublish
        canWrite
        collection="services"
        initialItem={scheduledItem}
      />,
    );
    expect(screen.getByLabelText("发布时间")).not.toHaveValue(
      "",
    );

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存。");

    expect(screen.getByLabelText("标题")).toHaveValue("Server-trimmed title");
    expect(screen.getByLabelText("发布时间")).toHaveValue("");
  });

  it("preserves an independently dirty schedule while reconciling a save", async () => {
    const persisted: AdminContentItem = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: { ...ITEM.translations.en!, title: "Canonical save", scheduledAt: null },
      },
    };
    saveDraft.mockResolvedValueOnce(persisted);
    render(
      <ContentEditor
        canPublish
        canWrite
        collection="services"
        initialItem={ITEM}
      />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: " Canonical save " },
    });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存。");

    expect(screen.getByLabelText("标题")).toHaveValue("Canonical save");
    expect(screen.getByLabelText("发布时间")).toHaveValue(
      "2099-07-16T12:00",
    );
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
  });

  it("clears persisted and dirty schedule state when publishing", async () => {
    const scheduledItem: AdminContentItem = {
      ...ITEM,
      translations: {
        ...ITEM.translations,
        en: {
          ...ITEM.translations.en!,
          scheduledAt: "2099-07-16T12:00:00.000Z",
          status: "scheduled",
        },
      },
    };
    const publishedItem: AdminContentItem = {
      ...scheduledItem,
      translations: {
        ...scheduledItem.translations,
        en: {
          ...scheduledItem.translations.en!,
          scheduledAt: null,
          status: "published",
          title: "Canonical publish",
        },
      },
    };
    publishTranslation.mockResolvedValueOnce(publishedItem);
    render(
      <ContentEditor
        canPublish
        canWrite
        collection="services"
        initialItem={scheduledItem}
      />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: " Canonical publish " },
    });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2099-08-17T13:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByText("翻译已发布。");

    expect(screen.getByLabelText("标题")).toHaveValue("Canonical publish");
    expect(screen.getByLabelText("发布时间")).toHaveValue("");
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
  });

  it("clears translation and schedule dirtiness only after schedule succeeds", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "Scheduled title" },
    });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "定时发布" }));
    await screen.findByText("翻译已设置定时发布。");

    const afterSchedule = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSchedule);
    expect(afterSchedule.defaultPrevented).toBe(false);
  });

  it("keeps the schedule time dirty when scheduling fails", async () => {
    scheduleTranslation.mockRejectedValueOnce(new Error("定时发布失败。"));
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "定时发布" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "定时发布失败。",
    );

    const afterFailure = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterFailure);
    expect(afterFailure.defaultPrevented).toBe(true);
  });

  it("prompts for dirty schedule times and keeps a draft per locale", () => {
    confirm.mockReturnValue(true);
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    const scheduledAt = screen.getByLabelText("发布时间");
    fireEvent.change(scheduledAt, {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("tab", { name: /俄文/i }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(scheduledAt).toHaveValue("");
    fireEvent.change(scheduledAt, {
      target: { value: "2099-08-17T13:30" },
    });

    fireEvent.click(screen.getByRole("tab", { name: /英文/i }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(scheduledAt).toHaveValue("2099-07-16T12:00");
  });

  it("maps API validation fields inline and focuses the first invalid control", async () => {
    publishTranslation.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        fields: { seoTitle: ["SEO 标题 failed server validation."] },
      }),
    );
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发布" }));

    const seoTitle = screen.getByLabelText("SEO 标题");
    expect(
      await screen.findByText("SEO 标题 failed server validation."),
    ).toBeVisible();
    expect(seoTitle).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(document.activeElement).toBe(seoTitle));
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
    expect(screen.getByRole("button", { name: "发布" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "定时发布" })).toBeDisabled();
  });

  it("lets a publish-only actor edit atomic commands without draft actions", () => {
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
    expect(screen.getByRole("button", { name: "发布" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "定时发布" })).toBeEnabled();
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
