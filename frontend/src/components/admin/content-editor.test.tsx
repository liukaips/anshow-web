import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminContentItem } from "../../api/admin-content";
import { ApiError } from "../../api/http";

const {
  archiveContent,
  publishTranslation,
  saveDraft,
  scheduleTranslation,
} = vi.hoisted(() => ({
  archiveContent: vi.fn(),
  publishTranslation: vi.fn(),
  saveDraft: vi.fn(),
  scheduleTranslation: vi.fn(),
}));

vi.mock("../../api/admin-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-content")>();
  return {
    ...actual,
    archiveAdminContent: archiveContent,
    publishAdminContentTranslation: publishTranslation,
    saveAdminContentDraft: saveDraft,
    scheduleAdminContentTranslation: scheduleTranslation,
  };
});

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
};

beforeEach(() => {
  vi.clearAllMocks();
  saveDraft.mockResolvedValue(ITEM);
  publishTranslation.mockResolvedValue(ITEM);
  scheduleTranslation.mockResolvedValue(ITEM);
  archiveContent.mockResolvedValue(ITEM);
});

afterEach(cleanup);

describe("ContentEditor", () => {
  it("warns on unload and locale changes while dirty, then clears dirty state after save", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated title" },
    });
    const beforeSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeSave);
    expect(beforeSave.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /Russian/i }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /English/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");

    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it("locks all async commands while a save is pending", async () => {
    let resolveSave: ((item: AdminContentItem) => void) | undefined;
    saveDraft.mockReturnValue(
      new Promise<AdminContentItem>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();

    resolveSave?.(ITEM);
    await screen.findByText("Draft saved.");
  });

  it("renders publish errors inline and focuses the first invalid field", async () => {
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Title is required to publish.")).toBeVisible();
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
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Atomic published title" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText("Translation published.");

    expect(saveDraft).not.toHaveBeenCalled();
    expect(publishTranslation).toHaveBeenCalledWith(
      "services",
      ITEM.id,
      "en",
      expect.objectContaining({ title: "Atomic published title" }),
    );
    const afterPublish = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterPublish);
    expect(afterPublish.defaultPrevented).toBe(false);
  });

  it("keeps dirty state when the atomic publish command fails", async () => {
    publishTranslation.mockRejectedValueOnce(new Error("Publish failed."));
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Saved before publish" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Publish failed.");
    expect(saveDraft).not.toHaveBeenCalled();
    expect(publishTranslation).toHaveBeenCalled();

    const afterSavedPublishFailure = new Event("beforeunload", {
      cancelable: true,
    });
    window.dispatchEvent(afterSavedPublishFailure);
    expect(afterSavedPublishFailure.defaultPrevented).toBe(true);
  });

  it("guards internal document navigation while dirty and allows hash or clean navigation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <>
        <Link href="/admin/content/pages">Back to pages</Link>
        <a href="#content-preview">Jump to preview</a>
        <ContentEditor canPublish collection="services" initialItem={ITEM} />
      </>,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
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

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
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

  it("maps API validation fields inline and focuses the first invalid control", async () => {
    publishTranslation.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        fields: { seoTitle: ["SEO title failed server validation."] },
      }),
    );
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    const seoTitle = screen.getByLabelText("SEO title");
    expect(
      await screen.findByText("SEO title failed server validation."),
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
        collection="services"
        initialItem={publishedItem}
      />,
    );
    expect(screen.getByText("Published preview")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dirty published title" },
    });

    expect(screen.getByText("Unpublished preview")).toBeVisible();
  });
});
