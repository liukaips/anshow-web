import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../../db/test-db.js";
import { auditLogs, siteSettings } from "../../db/schema/index.js";
import {
  DEFAULT_SITE_SETTINGS,
  createSettingsRepository,
  orderEnabledChannels,
  type SiteSettings,
} from "./settings-repository.js";

const NOW = new Date("2026-07-15T02:00:00.000Z");

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

describe("orderEnabledChannels", () => {
  it("filters disabled channels and sorts enabled channels by sort order without mutating input", () => {
    const channels = [
      {
        id: "email",
        kind: "email" as const,
        label: "Email",
        value: "contact@example.test",
        enabled: true,
        sortOrder: 20,
      },
      {
        id: "phone",
        kind: "phone" as const,
        label: "Phone",
        value: "+1 555 0100",
        enabled: false,
        sortOrder: 0,
      },
      {
        id: "telegram",
        kind: "telegram" as const,
        label: "Telegram",
        value: "@example",
        enabled: true,
        sortOrder: 10,
      },
    ] as const;
    const originalOrder = channels.map((channel) => channel.id);

    expect(orderEnabledChannels(channels).map((channel) => channel.id)).toEqual([
      "telegram",
      "email",
    ]);
    expect(channels.map((channel) => channel.id)).toEqual(originalOrder);
  });
});

describe("createSettingsRepository", () => {
  it("returns safe typed defaults without fabricating company or contact data", async () => {
    const testDatabase = createTestDatabase();

    try {
      const repository = createSettingsRepository(testDatabase.db);

      await expect(repository.getSettings()).resolves.toEqual(
        DEFAULT_SITE_SETTINGS,
      );
      expect(DEFAULT_SITE_SETTINGS.companyIdentity.legalName).toBe("");
      expect(DEFAULT_SITE_SETTINGS.publicContacts).toEqual({
        email: "",
        phone: "",
      });
    } finally {
      testDatabase.close();
    }
  });

  it("saves settings and an actor-linked audit row in one transaction", async () => {
    const testDatabase = createTestDatabase();

    try {
      const repository = createSettingsRepository(testDatabase.db, {
        createId: () => "audit-settings",
        now: () => NOW,
      });

      await expect(
        repository.saveSettings(SETTINGS, "actor-settings"),
      ).resolves.toEqual(SETTINGS);
      await expect(repository.getSettings()).resolves.toEqual(SETTINGS);
      expect(testDatabase.db.select().from(siteSettings).all()).toHaveLength(7);
      expect(testDatabase.db.select().from(auditLogs).all()).toEqual([
        expect.objectContaining({
          id: "audit-settings",
          actorId: "actor-settings",
          action: "settings.update",
          entityType: "settings",
          entityId: "site-settings",
          createdAt: NOW,
        }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("keeps disabled contact channels visible to administrators", async () => {
    const testDatabase = createTestDatabase();

    try {
      const repository = createSettingsRepository(testDatabase.db, {
        createId: () => "generated-channel-or-audit",
        now: () => NOW,
      });
      const channels = [
        {
          id: "channel-disabled",
          kind: "phone" as const,
          label: "Phone",
          value: "+1 555 0100",
          enabled: false,
          sortOrder: 1,
        },
        {
          id: "channel-enabled",
          kind: "email" as const,
          label: "Email",
          value: "hello@example.test",
          enabled: true,
          sortOrder: 2,
        },
      ];

      await expect(
        repository.saveContactChannels(channels, "actor-channels"),
      ).resolves.toEqual(channels);
      await expect(repository.listContactChannels()).resolves.toEqual(channels);
      expect(
        orderEnabledChannels(await repository.listContactChannels()),
      ).toEqual([channels[1]]);
      expect(testDatabase.db.select().from(auditLogs).all()).toEqual([
        expect.objectContaining({
          actorId: "actor-channels",
          action: "settings.channels.update",
          entityId: "contact-channels",
        }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("rolls back settings when the audit row cannot be written", async () => {
    const testDatabase = createTestDatabase();

    try {
      testDatabase.db.run(sql.raw(`
        CREATE TRIGGER reject_settings_audit
        BEFORE INSERT ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'audit rejected');
        END
      `));
      const repository = createSettingsRepository(testDatabase.db);

      await expect(
        repository.saveSettings(SETTINGS, "actor-settings"),
      ).rejects.toThrow(/audit rejected/);
      expect(testDatabase.db.select().from(siteSettings).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });
});
