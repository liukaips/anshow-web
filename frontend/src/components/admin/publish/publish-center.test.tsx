import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createPreview = vi.hoisted(() => vi.fn());
vi.mock("../../../api/admin-previews", () => ({ createAdminPreview: createPreview }));
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
});
