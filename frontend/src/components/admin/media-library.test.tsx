import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminMediaAsset } from "../../api/admin-media";
import { ApiError } from "../../api/http";

const mediaApi = vi.hoisted(() => ({
  upload: vi.fn(),
  update: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../api/admin-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/admin-media")>();
  return {
    ...actual,
    uploadAdminMedia: mediaApi.upload,
    updateAdminMediaMetadata: mediaApi.update,
    replaceAdminMedia: mediaApi.replace,
    deleteAdminMedia: mediaApi.remove,
  };
});

import { MediaLibrary } from "./media-library";

const asset: AdminMediaAsset = {
  id: "11111111-1111-4111-8111-111111111111",
  storageKey: "media/generation/master.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  dominantColor: "#334455",
  focalX: 0.5,
  focalY: 0.5,
  alt: { en: "Truck at warehouse", zh: "仓库中的卡车", ru: "Грузовик на складе" },
  derivatives: [
    {
      id: "derivative-1",
      storageKey: "media/generation/480.webp",
      url: "/media/media/generation/480.webp",
      format: "webp",
      width: 480,
      height: 320,
      byteSize: 12000,
    },
  ],
  createdAt: "2026-07-15T04:00:00.000Z",
  replacedAt: null,
  references: [],
  referenceCount: 0,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MediaLibrary", () => {
  it("keeps localized metadata and references visible but hides mutations for read-only staff", () => {
    render(<MediaLibrary canWrite={false} initialItems={[asset]} />);

    expect(screen.getByText("Truck at warehouse")).toBeVisible();
    expect(screen.getByText("仓库中的卡车")).toBeVisible();
    expect(screen.getByText("Грузовик на складе")).toBeVisible();
    expect(screen.queryByRole("button", { name: /upload/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /save metadata/i })).toBeNull();
  });

  it("offers upload from the empty state and filters without changing view controls", () => {
    const { unmount } = render(<MediaLibrary canWrite initialItems={[]} />);
    expect(screen.getByText("No media assets yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload media" })).toBeVisible();

    unmount();
    render(<MediaLibrary canWrite initialItems={[asset]} />);
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "no-match" },
    });
    expect(screen.getByText("No media matches this search")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("announces upload phases, reports progress, and locks controls while pending", async () => {
    let resolveUpload!: (value: AdminMediaAsset) => void;
    mediaApi.upload.mockImplementation(
      (_input: unknown, progress: { onUploadProgress(value: number): void; onUploadComplete(): void }) =>
        new Promise<AdminMediaAsset>((resolve) => {
          resolveUpload = resolve;
          progress.onUploadProgress(45);
        }),
    );
    render(<MediaLibrary canWrite initialItems={[]} />);

    fireEvent.change(screen.getByLabelText("Image file"), {
      target: { files: [new File(["image"], "yard.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("Upload alt text (EN)"), { target: { value: "Truck" } });
    fireEvent.change(screen.getByLabelText("Upload alt text (ZH)"), { target: { value: "卡车" } });
    fireEvent.change(screen.getByLabelText("Upload alt text (RU)"), { target: { value: "Грузовик" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload media" }));

    await waitFor(() => expect(screen.getByText("Uploading 45%")).toBeVisible());
    expect(screen.getByRole("button", { name: "Upload media" })).toBeDisabled();

    resolveUpload(asset);
    await waitFor(() => expect(screen.getByText("Saved")).toBeVisible());
    expect(screen.getByLabelText("Alt text (EN)")).toHaveValue(
      "Truck at warehouse",
    );
  });

  it("submits visible upload focal coordinates instead of hardcoded defaults", async () => {
    mediaApi.upload.mockResolvedValue(asset);
    render(<MediaLibrary canWrite initialItems={[]} />);
    fireEvent.change(screen.getByLabelText("Image file"), {
      target: { files: [new File(["image"], "yard.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("Upload alt text (EN)"), { target: { value: "Truck" } });
    fireEvent.change(screen.getByLabelText("Upload alt text (ZH)"), { target: { value: "卡车" } });
    fireEvent.change(screen.getByLabelText("Upload alt text (RU)"), { target: { value: "Грузовик" } });
    fireEvent.change(screen.getByLabelText("Upload focal X"), { target: { value: "0.2" } });
    fireEvent.change(screen.getByLabelText("Upload focal Y"), { target: { value: "0.8" } });

    fireEvent.click(screen.getByRole("button", { name: "Upload media" }));

    await waitFor(() => expect(mediaApi.upload).toHaveBeenCalledWith(
      expect.objectContaining({ focalX: 0.2, focalY: 0.8 }),
      expect.anything(),
    ));
  });

  it("focuses the first invalid localized metadata field", async () => {
    render(<MediaLibrary canWrite initialItems={[asset]} />);
    const english = screen.getByLabelText("Alt text (EN)");
    fireEvent.change(english, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));

    expect(await screen.findByText("English alt text is required.")).toBeVisible();
    expect(english).toHaveFocus();
    expect(mediaApi.update).not.toHaveBeenCalled();
  });

  it("disables deletion for referenced media and shows the blocking references", () => {
    render(
      <MediaLibrary
        canWrite
        initialItems={[
          {
            ...asset,
            referenceCount: 1,
            references: [
              { entityType: "hero-slide", entityId: "hero-1", field: "image" },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("hero-slide / hero-1 / image")).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete media" })).toBeDisabled();
  });

  it("shows references returned by a raced 409 deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mediaApi.remove.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "MEDIA_IN_USE",
        message: "Media is referenced and cannot be deleted",
        details: {
          references: [
            { entityType: "article", entityId: "article-2", field: "leadImage" },
          ],
        },
      }),
    );
    render(<MediaLibrary canWrite initialItems={[asset]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete media" }));

    expect(await screen.findByText("article / article-2 / leadImage")).toBeVisible();
    const deleteButton = screen.getByRole("button", { name: "Delete media" });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Remove references before deleting");
    fireEvent.click(deleteButton);
    expect(mediaApi.remove).toHaveBeenCalledTimes(1);
  });

  it("shows read-only focal metadata and uses mobile-safe body text", () => {
    render(
      <MediaLibrary
        canWrite={false}
        initialItems={[{
          ...asset,
          references: [{ entityType: "article", entityId: "article-1", field: "leadImage" }],
          referenceCount: 1,
        }]}
      />,
    );

    expect(screen.getAllByText("0.5", { selector: "dd" })).toHaveLength(2);
    for (const focalValue of screen.getAllByText("0.5", { selector: "dd" })) {
      expect(focalValue).toHaveClass("text-base");
    }
    expect(screen.getByText("Truck at warehouse")).toHaveClass("text-base");
    expect(screen.getByText("article / article-1 / leadImage")).toHaveClass("text-base");
    expect(screen.getByText("1200 x 800 · JPEG")).toHaveClass("text-base");
  });
});
