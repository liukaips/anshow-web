import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import {
  orderEnabledChannels,
  type ContactChannel,
  type SettingsRepository,
  type SiteSettings,
} from "../repositories/settings-repository.js";

const SETTINGS: SiteSettings = {
  companyIdentity: {
    displayName: "Configured Company",
    legalName: "Configured Company Limited",
    registrationNumber: "REG-TEST",
    address: "Configured address",
  },
  publicContacts: {
    email: "hello@example.test",
    phone: "+1 555 0100",
  },
  privacyController: {
    name: "Privacy Team",
    email: "privacy@example.test",
  },
  smtpRecipient: {
    name: "Enquiry Team",
    email: "enquiries@example.test",
  },
  localeDefaults: {
    defaultLocale: "en",
    enabledLocales: ["en", "zh"],
  },
  mediaMode: "local",
  featureFlags: {
    enquiriesEnabled: true,
    caseStudiesEnabled: false,
    insightsEnabled: true,
  },
};

const CHANNELS: ContactChannel[] = [
  {
    id: "disabled-phone",
    kind: "phone",
    label: "Phone",
    value: "+1 555 0100",
    enabled: false,
    sortOrder: 1,
  },
  {
    id: "public-email",
    kind: "email",
    label: "Email",
    value: "hello@example.test",
    enabled: true,
    sortOrder: 2,
  },
];

function createFakeRepository(): SettingsRepository & {
  getSettings: ReturnType<typeof vi.fn<SettingsRepository["getSettings"]>>;
  listContactChannels: ReturnType<
    typeof vi.fn<SettingsRepository["listContactChannels"]>
  >;
  saveContactChannels: ReturnType<
    typeof vi.fn<SettingsRepository["saveContactChannels"]>
  >;
  saveSettings: ReturnType<typeof vi.fn<SettingsRepository["saveSettings"]>>;
} {
  return {
    getSettings: vi.fn(async () => SETTINGS),
    saveSettings: vi.fn(async (settings) => ({
      ...settings,
      backup: settings.backup
        ? { ...settings.backup, encryptionConfigured: false }
        : undefined,
    })),
    listContactChannels: vi.fn(async () => CHANNELS),
    saveContactChannels: vi.fn(async (channels) => [...channels]),
  };
}

const authenticatedDependencies = {
  getSession: async () => ({
    user: { id: "staff-1", email: "staff@example.test" },
  }),
  getPermissions: () => ["settings.manage" as const],
};

function putJson(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("administration settings routes", () => {
  it.each([
    ["GET", "/api/admin/settings", undefined],
    ["PUT", "/api/admin/settings", SETTINGS],
    ["GET", "/api/admin/contact-channels", undefined],
    ["PUT", "/api/admin/contact-channels", { channels: CHANNELS }],
  ])("blocks unauthenticated %s %s before repository calls", async (method, path, body) => {
    const repository = createFakeRepository();
    const app = createApp({ settingsRepository: repository });
    const response = await app.request(
      method === "PUT" ? putJson(path, body) : path,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "UNAUTHENTICATED" },
      requestId: response.headers.get("x-request-id"),
    });
    expect(repository.getSettings).not.toHaveBeenCalled();
    expect(repository.saveSettings).not.toHaveBeenCalled();
    expect(repository.listContactChannels).not.toHaveBeenCalled();
    expect(repository.saveContactChannels).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/admin/settings", undefined],
    ["PUT", "/api/admin/settings", SETTINGS],
    ["GET", "/api/admin/contact-channels", undefined],
    ["PUT", "/api/admin/contact-channels", { channels: CHANNELS }],
  ])("blocks forbidden %s %s before repository calls", async (method, path, body) => {
    const repository = createFakeRepository();
    const app = createApp({
      settingsRepository: repository,
      getSession: authenticatedDependencies.getSession,
      getPermissions: () => [],
    });
    const response = await app.request(
      method === "PUT" ? putJson(path, body) : path,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "FORBIDDEN" },
      requestId: response.headers.get("x-request-id"),
    });
    expect(repository.getSettings).not.toHaveBeenCalled();
    expect(repository.saveSettings).not.toHaveBeenCalled();
    expect(repository.listContactChannels).not.toHaveBeenCalled();
    expect(repository.saveContactChannels).not.toHaveBeenCalled();
  });

  it("returns settings and saves validated settings with the authenticated actor", async () => {
    const repository = createFakeRepository();
    const app = createApp({
      ...authenticatedDependencies,
      settingsRepository: repository,
    });

    const getResponse = await app.request("/api/admin/settings");
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      data: SETTINGS,
      error: null,
      requestId: getResponse.headers.get("x-request-id"),
    });

    const putResponse = await app.request(
      putJson("/api/admin/settings", SETTINGS),
    );
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      data: SETTINGS,
      error: null,
      requestId: putResponse.headers.get("x-request-id"),
    });
    expect(repository.saveSettings).toHaveBeenCalledWith(SETTINGS, "staff-1");
  });

  it.each([
    ["an invalid value", { ...SETTINGS, mediaMode: "s3" }],
    ["an extra key", { ...SETTINGS, smtpPassword: "must-not-be-stored" }],
  ])("rejects settings with %s", async (_case, settings) => {
    const repository = createFakeRepository();
    const app = createApp({
      ...authenticatedDependencies,
      settingsRepository: repository,
    });

    const response = await app.request(
      putJson("/api/admin/settings", settings),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "VALIDATION_ERROR" },
      requestId: response.headers.get("x-request-id"),
    });
    expect(repository.saveSettings).not.toHaveBeenCalled();
  });

  it("keeps disabled channels in admin reads and audits saves with the actor", async () => {
    const repository = createFakeRepository();
    const app = createApp({
      ...authenticatedDependencies,
      settingsRepository: repository,
    });

    const getResponse = await app.request("/api/admin/contact-channels");
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      data: CHANNELS,
      error: null,
      requestId: getResponse.headers.get("x-request-id"),
    });
    expect(orderEnabledChannels(CHANNELS)).toEqual([CHANNELS[1]]);

    const putResponse = await app.request(
      putJson("/api/admin/contact-channels", { channels: CHANNELS }),
    );
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      data: CHANNELS,
      error: null,
      requestId: putResponse.headers.get("x-request-id"),
    });
    expect(repository.saveContactChannels).toHaveBeenCalledWith(
      CHANNELS,
      "staff-1",
    );
  });
});
