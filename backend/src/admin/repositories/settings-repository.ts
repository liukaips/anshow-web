import { asc } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "../../db/client.js";
import {
  contactChannelKinds,
  contactChannels,
  siteSettings,
} from "../../db/schema/settings.js";
import { createAuditRepository } from "./audit-repository.js";

export const CONTACT_CHANNEL_KINDS = contactChannelKinds;

export type ContactChannelKind = (typeof CONTACT_CHANNEL_KINDS)[number];

export type ContactChannel = Readonly<{
  id: string;
  kind: ContactChannelKind;
  label: string;
  value: string;
  enabled: boolean;
  sortOrder: number;
}>;

const localeSchema = z.enum(["en", "zh", "ru"]);
const emptyOrEmailSchema = z.union([z.literal(""), z.email()]);
const shortTextSchema = z.string().trim().max(300);

export const siteSettingsSchema = z
  .object({
    companyIdentity: z
      .object({
        displayName: shortTextSchema,
        legalName: shortTextSchema,
        registrationNumber: shortTextSchema,
        address: z.string().trim().max(1_000),
      })
      .strict(),
    publicContacts: z
      .object({
        email: emptyOrEmailSchema,
        phone: shortTextSchema,
      })
      .strict(),
    privacyController: z
      .object({
        name: shortTextSchema,
        email: emptyOrEmailSchema,
      })
      .strict(),
    smtpRecipient: z
      .object({
        name: shortTextSchema,
        email: emptyOrEmailSchema,
      })
      .strict(),
    localeDefaults: z
      .object({
        defaultLocale: localeSchema,
        enabledLocales: z.array(localeSchema).min(1).max(3),
      })
      .strict()
      .refine(
        ({ defaultLocale, enabledLocales }) =>
          enabledLocales.includes(defaultLocale) &&
          new Set(enabledLocales).size === enabledLocales.length,
        { message: "Enabled locales must be unique and include the default" },
      ),
    mediaMode: z.enum(["local", "cos"]),
    featureFlags: z
      .object({
        enquiriesEnabled: z.boolean(),
        caseStudiesEnabled: z.boolean(),
        insightsEnabled: z.boolean(),
      })
      .strict(),
    backup: z.object({
      enabled: z.boolean(), intervalHours: z.number().int().min(1).max(168),
      retentionDays: z.number().int().min(1).max(3650), target: z.enum(["local", "cos"]),
      cosBucket: z.string().trim().max(200), cosRegion: z.string().trim().max(100), encryptionConfigured: z.boolean(),
    }).strict().optional(),
  })
  .strict();

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  companyIdentity: {
    displayName: "",
    legalName: "",
    registrationNumber: "",
    address: "",
  },
  publicContacts: { email: "", phone: "" },
  privacyController: { name: "", email: "" },
  smtpRecipient: { name: "", email: "" },
  localeDefaults: {
    defaultLocale: "en",
    enabledLocales: ["en", "zh", "ru"],
  },
  mediaMode: "local",
  featureFlags: {
    enquiriesEnabled: false,
    caseStudiesEnabled: false,
    insightsEnabled: false,
  },
};

const SITE_SETTING_KEYS = [
  "companyIdentity",
  "publicContacts",
  "privacyController",
  "smtpRecipient",
  "localeDefaults",
  "mediaMode",
  "featureFlags",
  "backup",
] as const satisfies readonly (keyof SiteSettings)[];

export interface SettingsRepository {
  getSettings(): Promise<SiteSettings>;
  saveSettings(settings: SiteSettings, actorId: string): Promise<SiteSettings>;
  listContactChannels(): Promise<ContactChannel[]>;
  saveContactChannels(
    channels: readonly ContactChannel[],
    actorId: string,
  ): Promise<ContactChannel[]>;
}

type SettingsRepositoryOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function orderEnabledChannels(
  channels: readonly ContactChannel[],
): ContactChannel[] {
  return [...channels.filter((channel) => channel.enabled)].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

export function createSettingsRepository(
  database: AppDatabase,
  options: SettingsRepositoryOptions = {},
): SettingsRepository {
  const now = options.now ?? (() => new Date());

  return {
    async getSettings() {
      const storedValues: Partial<Record<keyof SiteSettings, unknown>> = {};

      for (const row of database.select().from(siteSettings).all()) {
        if (SITE_SETTING_KEYS.includes(row.key as keyof SiteSettings)) {
          storedValues[row.key as keyof SiteSettings] = JSON.parse(row.value);
        }
      }

      return siteSettingsSchema.parse({
        ...DEFAULT_SITE_SETTINGS,
        ...storedValues,
      });
    },

    async saveSettings(settings, actorId) {
      const validatedSettings = siteSettingsSchema.parse(settings);
      const updatedAt = now();

      return database.transaction((transaction) => {
        transaction.delete(siteSettings).run();
        transaction
          .insert(siteSettings)
          .values(
            SITE_SETTING_KEYS.filter((key) => validatedSettings[key] !== undefined).map((key) => ({
              key,
              value: JSON.stringify(validatedSettings[key]),
              updatedAt,
              updatedBy: actorId,
            })),
          )
          .run();
        createAuditRepository(transaction, options).record({
          actorId,
          action: "settings.update",
          entityType: "settings",
          entityId: "site-settings",
          detail: { keys: SITE_SETTING_KEYS },
        });

        return validatedSettings;
      });
    },

    async listContactChannels() {
      return database
        .select()
        .from(contactChannels)
        .orderBy(asc(contactChannels.sortOrder), asc(contactChannels.id))
        .all();
    },

    async saveContactChannels(channels, actorId) {
      const savedChannels = channels.map((channel) => ({ ...channel }));

      return database.transaction((transaction) => {
        transaction.delete(contactChannels).run();
        if (savedChannels.length > 0) {
          transaction.insert(contactChannels).values(savedChannels).run();
        }
        createAuditRepository(transaction, options).record({
          actorId,
          action: "settings.channels.update",
          entityType: "settings",
          entityId: "contact-channels",
          detail: { count: savedChannels.length },
        });

        return savedChannels;
      });
    },
  };
}
