import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createPreview = vi.hoisted(() => vi.fn());
const publishPreview = vi.hoisted(() => vi.fn());
const schedulePreview = vi.hoisted(() => vi.fn());
const cancelSchedule = vi.hoisted(() => vi.fn());
vi.mock("../../../api/admin-previews", () => ({ createAdminPreview: createPreview, publishAdminPreview: publishPreview, scheduleAdminPreview: schedulePreview, cancelScheduleAdminPreview: cancelSchedule }));
import { PublishCenter } from "./publish-center";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PublishCenter", () => {
  it("creates same-domain preview links for all locales", async () => {
    createPreview.mockResolvedValue({ rawToken: "preview-token", snapshotId: "snapshot-1", tokenId: "token-1", contentHash: "a".repeat(64), sourceVersions: [], createdAt: new Date().toISOString(), expiresAt: new Date().toISOString() });
    render(<PublishCenter />);
    fireEvent.click(screen.getByRole("button", { name: "生成整站预览" }));
    expect(await screen.findByRole("link", { name: "查看中文预览" })).toHaveAttribute("href", "/preview/preview-token/zh");
    expect(screen.getByRole("link", { name: "查看英文预览" })).toBeVisible();
    expect(screen.getByRole("link", { name: "查看俄文预览" })).toBeVisible();
  });

  it("publishes the exact preview hash only after the operator confirms it", async () => {
    createPreview.mockResolvedValue({ rawToken: "preview-token", snapshotId: "snapshot-1", tokenId: "token-1", contentHash: "a".repeat(64), sourceVersions: [{ entityType: "services", entityId: "service-1", version: 3 }], createdAt: new Date().toISOString(), expiresAt: new Date().toISOString() });
    publishPreview.mockResolvedValue({ snapshotId: "snapshot-1", contentHash: "a".repeat(64), publishedAt: new Date().toISOString(), publishedChanges: 1 });
    render(<PublishCenter canPublish />);
    fireEvent.click(screen.getByRole("button", { name: "生成整站预览" }));
    const publishButton = await screen.findByRole("button", { name: "发布已确认版本" });
    expect(publishButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "我已检查中文、英文和俄文预览" }));
    fireEvent.click(publishButton);
    expect(publishPreview).toHaveBeenCalledWith("snapshot-1", { expectedHash: "a".repeat(64) });
    expect(await screen.findByText("已成功发布 1 项内容变更")).toBeVisible();
  });

  it("schedules the immutable snapshot instead of a single translation", async () => {
    createPreview.mockResolvedValue({ rawToken: "preview-token", snapshotId: "snapshot-1", tokenId: "token-1", contentHash: "a".repeat(64), sourceVersions: [{ entityType: "services", entityId: "service-1", version: 3 }], createdAt: new Date().toISOString(), expiresAt: new Date().toISOString() });
    schedulePreview.mockResolvedValue({ snapshotId: "snapshot-1", contentHash: "a".repeat(64), scheduledAt: new Date("2099-07-16T04:00:00.000Z").toISOString(), changes: 1 });
    render(<PublishCenter canPublish />);
    fireEvent.click(screen.getByRole("button", { name: "生成整站预览" }));
    await screen.findByRole("link", { name: "查看中文预览" });
    fireEvent.change(screen.getByLabelText("定时发布时间"), { target: { value: "2099-07-16T04:00" } });
    fireEvent.click(screen.getByRole("button", { name: "安排定时发布" }));
    expect(schedulePreview).toHaveBeenCalledWith("snapshot-1", { expectedHash: "a".repeat(64), scheduledAt: new Date("2099-07-16T04:00").toISOString() });
  });
});
