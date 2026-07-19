import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminSettings } from "@/api/admin-settings.server";
import { SiteSettingsForm } from "./site-settings-form";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const settings: AdminSettings = {
  companyIdentity: {
    displayName: "AnShow",
    legalName: "AnShow Logistics",
    registrationNumber: "",
    address: "深圳市",
  },
  publicContacts: { email: "sales@anshow.com", phone: "+86 755" },
  privacyController: { name: "AnShow", email: "privacy@anshow.com" },
  smtpRecipient: { name: "客服团队", email: "ops@anshow.com" },
  localeDefaults: { defaultLocale: "en", enabledLocales: ["en", "zh", "ru"] },
  mediaMode: "local",
  featureFlags: {
    enquiriesEnabled: true,
    caseStudiesEnabled: true,
    insightsEnabled: true,
  },
  backup: {
    enabled: true,
    intervalHours: 24,
    retentionDays: 30,
    target: "local",
    cosBucket: "",
    cosRegion: "",
    encryptionConfigured: true,
  },
};

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("SiteSettingsForm", () => {
  it("groups site settings by what operators see on the public website", () => {
    render(<SiteSettingsForm settings={settings} />);

    expect(screen.getByRole("heading", { name: "公司与联系方式" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "语言与默认设置" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "询价通知" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "前台功能开关" })).toBeVisible();
    expect(screen.queryByText(/smtp|featureFlags|localeDefaults|mediaMode|JSON/i)).toBeNull();
  });

  it("saves editable settings without sending readonly backup encryption state", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<SiteSettingsForm settings={settings} />);

    fireEvent.change(screen.getByLabelText("官网显示名称"), {
      target: { value: "AnShow 国际物流" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存网站设置" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body.companyIdentity.displayName).toBe("AnShow 国际物流");
    expect(body.backup.encryptionConfigured).toBeUndefined();
    expect(await screen.findByText("网站设置已保存")).toBeVisible();
  });
});
