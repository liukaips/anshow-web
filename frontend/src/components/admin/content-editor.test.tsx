import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminContentItem } from "../../api/admin-content";

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

  it("clears dirty state when the pre-publish save succeeds even if publish fails", async () => {
    publishTranslation.mockRejectedValueOnce(new Error("Publish failed."));
    render(
      <ContentEditor canPublish collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Saved before publish" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Publish failed.");
    expect(saveDraft).toHaveBeenCalled();
    expect(publishTranslation).toHaveBeenCalled();

    const afterSavedPublishFailure = new Event("beforeunload", {
      cancelable: true,
    });
    window.dispatchEvent(afterSavedPublishFailure);
    expect(afterSavedPublishFailure.defaultPrevented).toBe(false);
  });
});
