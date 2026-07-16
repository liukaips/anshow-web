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
    expect(screen.queryByRole("button", { name: "上传媒体" })).toBeNull();
    expect(screen.queryByRole("button", { name: "删除图片" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存图片信息" })).toBeNull();
  });

  it("offers upload from the empty state and filters without changing view controls", () => {
    const { unmount } = render(<MediaLibrary canWrite initialItems={[]} />);
    expect(screen.getByText("暂无媒体资产")).toBeVisible();
    expect(screen.getByRole("button", { name: "上传媒体" })).toBeVisible();

    unmount();
    render(<MediaLibrary canWrite initialItems={[asset]} />);
    fireEvent.change(screen.getByLabelText("搜索媒体"), {
      target: { value: "no-match" },
    });
    expect(screen.getByText("没有匹配的媒体")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    expect(screen.getByRole("button", { name: "列表视图" })).toHaveAttribute(
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

    fireEvent.change(screen.getByLabelText("图片文件"), {
      target: { files: [new File(["image"], "yard.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("新图片英文图片说明"), { target: { value: "Truck" } });
    fireEvent.change(screen.getByLabelText("新图片中文图片说明"), { target: { value: "卡车" } });
    fireEvent.change(screen.getByLabelText("新图片俄文图片说明"), { target: { value: "Грузовик" } });
    fireEvent.click(screen.getByRole("button", { name: "上传媒体" }));

    await waitFor(() => expect(screen.getByText("正在上传 45%")).toBeVisible());
    expect(screen.getByText("正在上传 45%")).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: "上传媒体" })).toBeDisabled();

    resolveUpload(asset);
    await waitFor(() => expect(screen.getByText("上传完成")).toBeVisible());
    expect(screen.getByLabelText("英文图片说明")).toHaveValue(
      "Truck at warehouse",
    );
  });

  it("submits visible upload focal coordinates instead of hardcoded defaults", async () => {
    mediaApi.upload.mockResolvedValue(asset);
    render(<MediaLibrary canWrite initialItems={[]} />);
    fireEvent.change(screen.getByLabelText("图片文件"), {
      target: { files: [new File(["image"], "yard.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("新图片英文图片说明"), { target: { value: "Truck" } });
    fireEvent.change(screen.getByLabelText("新图片中文图片说明"), { target: { value: "卡车" } });
    fireEvent.change(screen.getByLabelText("新图片俄文图片说明"), { target: { value: "Грузовик" } });
    fireEvent.change(screen.getByLabelText("新图片横向主体位置"), { target: { value: "0.2" } });
    fireEvent.change(screen.getByLabelText("新图片纵向主体位置"), { target: { value: "0.8" } });

    fireEvent.click(screen.getByRole("button", { name: "上传媒体" }));

    await waitFor(() => expect(mediaApi.upload).toHaveBeenCalledWith(
      expect.objectContaining({ focalX: 0.2, focalY: 0.8 }),
      expect.anything(),
    ));
  });

  it("translates technical media API errors into Chinese recovery guidance", async () => {
    mediaApi.upload.mockRejectedValueOnce(
      new ApiError({
        status: 413,
        code: "MEDIA_TOO_LARGE",
        message: "Media uploads must not exceed 20 MB",
      }),
    );
    render(<MediaLibrary canWrite initialItems={[]} />);
    fireEvent.change(screen.getByLabelText("图片文件"), {
      target: { files: [new File(["image"], "large.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("新图片英文图片说明"), { target: { value: "Truck" } });
    fireEvent.change(screen.getByLabelText("新图片中文图片说明"), { target: { value: "卡车" } });
    fireEvent.change(screen.getByLabelText("新图片俄文图片说明"), { target: { value: "Грузовик" } });

    fireEvent.click(screen.getByRole("button", { name: "上传媒体" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "图片不能超过 20 MB，请压缩后重试。",
    );
  });

  it("focuses the first invalid localized metadata field", async () => {
    render(<MediaLibrary canWrite initialItems={[asset]} />);
    const english = screen.getByLabelText("英文图片说明");
    fireEvent.change(english, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存图片信息" }));

    expect(await screen.findByText("请填写英文图片说明。")).toBeVisible();
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

    expect(screen.getByText("首页轮播图 · 图片")).toBeVisible();
    expect(screen.getByRole("button", { name: "删除图片" })).toBeDisabled();
  });

  it("shows references returned by a raced 409 deletion", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "删除图片" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(await screen.findByText("文章 · 主图")).toBeVisible();
    const deleteButton = screen.getByRole("button", { name: "删除图片" });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "请先解除内容引用");
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

    expect(screen.getByText("主体位置：水平居中、垂直居中")).toHaveClass("text-base");
    expect(screen.getByText("Truck at warehouse")).toHaveClass("text-base");
    expect(screen.getByText("文章 · 主图")).toHaveClass("text-base");
    expect(screen.getByText("1200 × 800 · JPEG")).toHaveClass("text-base");
  });

  it("uses natural-language range controls for the image subject position", () => {
    render(<MediaLibrary canWrite initialItems={[asset]} />);

    const horizontal = screen.getByLabelText("横向主体位置");
    const vertical = screen.getByLabelText("纵向主体位置");
    expect(horizontal).toHaveAttribute("type", "range");
    expect(vertical).toHaveAttribute("type", "range");

    fireEvent.change(horizontal, { target: { value: "0.2" } });
    fireEvent.change(vertical, { target: { value: "0.8" } });
    expect(screen.getByText("当前：偏左")).toBeVisible();
    expect(screen.getByText("当前：偏下")).toBeVisible();
  });
});
