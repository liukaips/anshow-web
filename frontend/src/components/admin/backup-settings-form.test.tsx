import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminSettings } from "@/api/admin-settings.server";
import { BackupSettingsForm } from "./backup-settings-form";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

function settings(encryptionConfigured = true): AdminSettings {
  return {
    backup: {
      enabled: false,
      intervalHours: 24,
      retentionDays: 30,
      target: "local",
      cosBucket: "",
      cosRegion: "",
      encryptionConfigured,
    },
  };
}

describe("BackupSettingsForm", () => {
  it("keeps COS fields hidden until COS is selected", () => {
    render(<BackupSettingsForm settings={settings()} />);
    expect(screen.queryByLabelText("COS 存储桶")).toBeNull();

    fireEvent.change(screen.getByLabelText("存储位置"), {
      target: { value: "cos" },
    });

    expect(screen.getByLabelText("COS 存储桶")).toBeVisible();
    expect(screen.getByLabelText("COS 地域")).toBeVisible();
  });

  it("prevents enabling backups until encryption is configured", async () => {
    render(<BackupSettingsForm settings={settings(false)} />);
    fireEvent.click(screen.getByLabelText("启用自动备份"));
    fireEvent.click(screen.getByRole("button", { name: "保存备份设置" }));

    expect(
      await screen.findByText("请先在部署环境中配置备份加密密钥。"),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports save results entirely in Chinese", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<BackupSettingsForm settings={settings()} />);

    fireEvent.click(screen.getByRole("button", { name: "保存备份设置" }));

    await waitFor(() =>
      expect(screen.getByText("备份设置已保存")).toBeVisible(),
    );
    expect(screen.queryByText(/Backup|Could not/i)).toBeNull();
  });
});
