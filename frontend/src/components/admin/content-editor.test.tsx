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
  updateVerification,
} = vi.hoisted(() => ({
  archiveContent: vi.fn(),
  publishTranslation: vi.fn(),
  saveDraft: vi.fn(),
  scheduleTranslation: vi.fn(),
  updateVerification: vi.fn(),
}));

vi.mock("../../api/admin-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-content")>();
  return {
    ...actual,
    archiveAdminContent: archiveContent,
    publishAdminContentTranslation: publishTranslation,
    saveAdminContentDraft: saveDraft,
    scheduleAdminContentTranslation: scheduleTranslation,
    updateAdminContentVerification: updateVerification,
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
const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockReturnValue(false);
  saveDraft.mockResolvedValue(ITEM);
  publishTranslation.mockResolvedValue(ITEM);
  scheduleTranslation.mockResolvedValue(ITEM);
  archiveContent.mockResolvedValue(ITEM);
  updateVerification.mockResolvedValue(ITEM);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("ContentEditor", () => {
  it("warns on unload and locale changes while dirty, then clears dirty state after save", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
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

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();

    resolveSave?.(ITEM);
    await screen.findByText("Draft saved.");
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
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: " Submitted title " } });

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce());

    expect(title).toBeDisabled();
    expect(screen.getByLabelText("Publication date and time")).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Russian/i })).toBeDisabled();
    fireEvent.change(title, { target: { value: "Newer local title" } });
    expect(title).toHaveValue(" Submitted title ");

    resolveSave?.(persisted);
    await screen.findByText("Draft saved.");
    expect(title).toHaveValue("Canonical title");
  });

  it("renders publish errors inline and focuses the first invalid field", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
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
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
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
    await waitFor(() => {
      const afterPublish = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(afterPublish);
      expect(afterPublish.defaultPrevented).toBe(false);
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps dirty state when the atomic publish command fails", async () => {
    publishTranslation.mockRejectedValueOnce(new Error("Publish failed."));
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
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
    render(
      <>
        <Link href="/admin/content/pages">Back to pages</Link>
        <a href="#content-preview">Jump to preview</a>
        <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Title"), {
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
    fireEvent.change(screen.getByLabelText("Publication date and time"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");

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
    expect(screen.getByLabelText("Publication date and time")).not.toHaveValue(
      "",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");

    expect(screen.getByLabelText("Title")).toHaveValue("Server-trimmed title");
    expect(screen.getByLabelText("Publication date and time")).toHaveValue("");
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
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: " Canonical save " },
    });
    fireEvent.change(screen.getByLabelText("Publication date and time"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");

    expect(screen.getByLabelText("Title")).toHaveValue("Canonical save");
    expect(screen.getByLabelText("Publication date and time")).toHaveValue(
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
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: " Canonical publish " },
    });
    fireEvent.change(screen.getByLabelText("Publication date and time"), {
      target: { value: "2099-08-17T13:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText("Translation published.");

    expect(screen.getByLabelText("Title")).toHaveValue("Canonical publish");
    expect(screen.getByLabelText("Publication date and time")).toHaveValue("");
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
  });

  it("clears translation and schedule dirtiness only after schedule succeeds", async () => {
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Scheduled title" },
    });
    fireEvent.change(screen.getByLabelText("Publication date and time"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await screen.findByText("Translation scheduled.");

    const afterSchedule = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSchedule);
    expect(afterSchedule.defaultPrevented).toBe(false);
  });

  it("keeps the schedule time dirty when scheduling fails", async () => {
    scheduleTranslation.mockRejectedValueOnce(new Error("Schedule failed."));
    render(
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
    );
    fireEvent.change(screen.getByLabelText("Publication date and time"), {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Schedule failed.",
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
    const scheduledAt = screen.getByLabelText("Publication date and time");
    fireEvent.change(scheduledAt, {
      target: { value: "2099-07-16T12:00" },
    });

    fireEvent.click(screen.getByRole("tab", { name: /Russian/i }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(scheduledAt).toHaveValue("");
    fireEvent.change(scheduledAt, {
      target: { value: "2099-08-17T13:30" },
    });

    fireEvent.click(screen.getByRole("tab", { name: /English/i }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(scheduledAt).toHaveValue("2099-07-16T12:00");
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
      <ContentEditor canPublish canWrite collection="services" initialItem={ITEM} />,
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
        canWrite
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

  it("renders translation controls read-only for a viewer", () => {
    render(
      <ContentEditor
        canPublish={false}
        canWrite={false}
        collection="services"
        initialItem={ITEM}
      />,
    );

    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();
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

    expect(screen.getByLabelText("Title")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeEnabled();
  });

  it("updates official proof verification for writers", async () => {
    const verifiedItem = {
      ...ITEM,
      verified: true,
      verificationSource: "Official registry record",
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
    fireEvent.click(screen.getByLabelText("Verified proof"));
    fireEvent.change(screen.getByLabelText("Official verification source"), {
      target: { value: "Official registry record" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save verification" }));

    await waitFor(() =>
      expect(updateVerification).toHaveBeenCalledWith(
        "partners",
        ITEM.id,
        {
          verified: true,
          verificationSource: "Official registry record",
        },
      ),
    );
    expect(await screen.findByText("Verification saved.")).toBeVisible();
  });
});
