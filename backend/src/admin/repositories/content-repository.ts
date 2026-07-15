import { and, asc, eq, ne } from "drizzle-orm";

import type { AppDatabase } from "../../db/client.js";
import {
  articles,
  articleTranslations,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  certificates,
  certificateTranslations,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  partners,
  partnerTranslations,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../../db/schema/content.js";
import {
  publishableTranslationSchema,
  scheduleTranslationInputSchema,
  translationInputSchema,
  type AdminContentCollection,
  type AdminContentLocale,
  type AdminPublicationState,
  type PublishTranslationInput,
  type ScheduleTranslationInput,
  type TranslationInput,
} from "../content/content-schema.js";
import { createAuditRepository } from "./audit-repository.js";

type BaseTable = typeof services;
type TranslationTable = typeof serviceTranslations;

type CollectionConfig = Readonly<{
  base: BaseTable;
  translations: TranslationTable;
  requiresVerification: boolean;
}>;

const collectionConfig: Record<AdminContentCollection, CollectionConfig> = {
  pages: { base: pages, translations: pageTranslations, requiresVerification: false },
  "hero-slides": {
    base: heroSlides,
    translations: heroSlideTranslations,
    requiresVerification: false,
  },
  services: {
    base: services,
    translations: serviceTranslations,
    requiresVerification: false,
  },
  "trade-lanes": {
    base: tradeLanes,
    translations: tradeLaneTranslations,
    requiresVerification: false,
  },
  "cargo-types": {
    base: cargoTypes,
    translations: cargoTypeTranslations,
    requiresVerification: false,
  },
  "case-studies": {
    base: caseStudies,
    translations: caseStudyTranslations,
    requiresVerification: false,
  },
  articles: {
    base: articles,
    translations: articleTranslations,
    requiresVerification: false,
  },
  partners: {
    base: partners,
    translations: partnerTranslations,
    requiresVerification: true,
  },
  certificates: {
    base: certificates,
    translations: certificateTranslations,
    requiresVerification: true,
  },
  "proof-metrics": {
    base: proofMetrics,
    translations: proofMetricTranslations,
    requiresVerification: true,
  },
  "navigation-items": {
    base: navigationItems,
    translations: navigationItemTranslations,
    requiresVerification: false,
  },
};

export type AdminContentTranslation = Readonly<
  TranslationInput & {
    locale: AdminContentLocale;
    status: AdminPublicationState;
    scheduledAt: string | null;
    publishedAt: string | null;
    updatedAt: string;
  }
>;

export type AdminContentItem = Readonly<{
  id: string;
  code: string;
  sortOrder: number;
  archivedAt: string | null;
  verified: boolean;
  verificationSource: string | null;
  createdAt: string;
  updatedAt: string;
  translations: Partial<Record<AdminContentLocale, AdminContentTranslation>>;
}>;

export type CreateAdminContentInput = Readonly<{
  code: string;
  sortOrder?: number;
  verified?: boolean;
  verificationSource?: string | null;
}>;

export const CONTENT_REPOSITORY_ERROR_CODES = [
  "CONTENT_NOT_FOUND",
  "CONTENT_CONFLICT",
  "SLUG_CONFLICT",
  "CONTENT_ARCHIVED",
  "INCOMPLETE_TRANSLATION",
  "SCHEDULE_NOT_FUTURE",
  "PROOF_NOT_VERIFIED",
] as const;

export type ContentRepositoryErrorCode =
  (typeof CONTENT_REPOSITORY_ERROR_CODES)[number];

export class ContentRepositoryError extends Error {
  readonly code: ContentRepositoryErrorCode;

  constructor(code: ContentRepositoryErrorCode, message: string) {
    super(message);
    this.name = "ContentRepositoryError";
    this.code = code;
  }
}

export interface ContentRepository {
  list(collection: AdminContentCollection): Promise<AdminContentItem[]>;
  get(
    collection: AdminContentCollection,
    id: string,
  ): Promise<AdminContentItem>;
  create(
    collection: AdminContentCollection,
    input: CreateAdminContentInput,
    actorId: string,
  ): Promise<AdminContentItem>;
  saveDraft(
    collection: AdminContentCollection,
    id: string,
    locale: AdminContentLocale,
    input: TranslationInput,
    actorId: string,
  ): Promise<AdminContentItem>;
  publish(
    collection: AdminContentCollection,
    id: string,
    locale: AdminContentLocale,
    input: PublishTranslationInput,
    actorId: string,
  ): Promise<AdminContentItem>;
  schedule(
    collection: AdminContentCollection,
    id: string,
    locale: AdminContentLocale,
    input: ScheduleTranslationInput,
    actorId: string,
  ): Promise<AdminContentItem>;
  archive(
    collection: AdminContentCollection,
    id: string,
    actorId: string,
  ): Promise<AdminContentItem>;
}

type ContentRepositoryOptions = {
  createId?: () => string;
  createAuditId?: () => string;
  now?: () => Date;
};

type BaseRow = typeof services.$inferSelect;
type TranslationRow = typeof serviceTranslations.$inferSelect;
type ContentTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

function toTranslation(row: TranslationRow): AdminContentTranslation {
  return {
    locale: row.locale,
    status: row.status,
    scheduledAt: iso(row.scheduledAt),
    publishedAt: iso(row.publishedAt),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    altText: row.altText,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toItem(
  row: BaseRow,
  translationRows: readonly TranslationRow[],
): AdminContentItem {
  const translations: Partial<
    Record<AdminContentLocale, AdminContentTranslation>
  > = {};
  for (const translation of translationRows) {
    translations[translation.locale] = toTranslation(translation);
  }

  return {
    id: row.id,
    code: row.code,
    sortOrder: row.sortOrder,
    archivedAt: iso(row.archivedAt),
    verified: row.verifiedAt !== null,
    verificationSource: row.verificationSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    translations,
  };
}

function notFound(collection: AdminContentCollection, id: string) {
  return new ContentRepositoryError(
    "CONTENT_NOT_FOUND",
    `${collection} content ${id} was not found`,
  );
}

function readBase(
  database: AppDatabase | ContentTransaction,
  config: CollectionConfig,
  id: string,
): BaseRow | undefined {
  return database
    .select()
    .from(config.base)
    .where(eq(config.base.id, id))
    .get();
}

function assertMutable(row: BaseRow, collection: AdminContentCollection) {
  if (row.archivedAt) {
    throw new ContentRepositoryError(
      "CONTENT_ARCHIVED",
      `${collection} content ${row.id} is archived`,
    );
  }
}

function assertSlugAvailable(
  transaction: ContentTransaction,
  config: CollectionConfig,
  ownerId: string,
  locale: AdminContentLocale,
  slug: string,
) {
  if (slug === "") return;
  const collision = transaction
    .select({ ownerId: config.translations.ownerId })
    .from(config.translations)
    .where(
      and(
        eq(config.translations.locale, locale),
        eq(config.translations.slug, slug),
        ne(config.translations.ownerId, ownerId),
      ),
    )
    .get();
  if (collision) {
    throw new ContentRepositoryError(
      "SLUG_CONFLICT",
      `Slug ${slug} is already used for ${locale}`,
    );
  }
}

function assertProofVerified(
  config: CollectionConfig,
  base: BaseRow,
) {
  if (
    config.requiresVerification &&
    (!base.verifiedAt || !base.verificationSource?.trim())
  ) {
    throw new ContentRepositoryError(
      "PROOF_NOT_VERIFIED",
      "Verified proof and a source note are required before publication",
    );
  }
}

function upsertTranslation(
  transaction: ContentTransaction,
  config: CollectionConfig,
  ownerId: string,
  locale: AdminContentLocale,
  translation: PublishTranslationInput,
  publication: {
    status: "published" | "scheduled";
    scheduledAt: Date | null;
    publishedAt: Date | null;
  },
  updatedAt: Date,
) {
  transaction
    .insert(config.translations)
    .values({
      ownerId,
      locale,
      ...translation,
      ...publication,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [config.translations.ownerId, config.translations.locale],
      set: { ...translation, ...publication, updatedAt },
    })
    .run();
}

export function createContentRepository(
  database: AppDatabase,
  options: ContentRepositoryOptions = {},
): ContentRepository {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const createAuditId = options.createAuditId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  const audit = (transaction: ContentTransaction) =>
    createAuditRepository(transaction, {
      createId: createAuditId,
      now,
    });

  async function get(
    collection: AdminContentCollection,
    id: string,
  ): Promise<AdminContentItem> {
    const config = collectionConfig[collection];
    const row = readBase(database, config, id);
    if (!row) throw notFound(collection, id);
    const translations = database
      .select()
      .from(config.translations)
      .where(eq(config.translations.ownerId, id))
      .orderBy(asc(config.translations.locale))
      .all();
    return toItem(row, translations);
  }

  return {
    async list(collection) {
      const config = collectionConfig[collection];
      const rows = database
        .select()
        .from(config.base)
        .orderBy(asc(config.base.sortOrder), asc(config.base.id))
        .all();
      return Promise.all(rows.map((row) => get(collection, row.id)));
    },

    get,

    async create(collection, input, actorId) {
      const config = collectionConfig[collection];
      const id = createId();
      const timestamp = now();
      const verificationSource = input.verificationSource?.trim() || null;

      database.transaction((transaction) => {
        const codeCollision = transaction
          .select({ id: config.base.id })
          .from(config.base)
          .where(eq(config.base.code, input.code))
          .get();
        if (codeCollision) {
          throw new ContentRepositoryError(
            "CONTENT_CONFLICT",
            `Code ${input.code} is already used`,
          );
        }

        transaction
          .insert(config.base)
          .values({
            id,
            code: input.code,
            sortOrder: input.sortOrder ?? 0,
            verifiedAt: input.verified ? timestamp : null,
            verificationSource,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .run();
        audit(transaction).record({
          actorId,
          action: "content.create",
          entityType: collection,
          entityId: id,
          detail: { code: input.code },
        });
      });

      return get(collection, id);
    },

    async saveDraft(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const translation = translationInputSchema.parse(input);
      const timestamp = now();

      database.transaction((transaction) => {
        const base = readBase(transaction, config, id);
        if (!base) throw notFound(collection, id);
        assertMutable(base, collection);
        assertSlugAvailable(transaction, config, id, locale, translation.slug);

        transaction
          .insert(config.translations)
          .values({
            ownerId: id,
            locale,
            status: "draft",
            scheduledAt: null,
            publishedAt: null,
            ...translation,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: [config.translations.ownerId, config.translations.locale],
            set: {
              status: "draft",
              scheduledAt: null,
              publishedAt: null,
              ...translation,
              updatedAt: timestamp,
            },
          })
          .run();
        audit(transaction).record({
          actorId,
          action: "content.translation.save-draft",
          entityType: collection,
          entityId: id,
          detail: { locale },
        });
      });

      return get(collection, id);
    },

    async publish(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const timestamp = now();

      database.transaction((transaction) => {
        const translation = publishableTranslationSchema.parse(input);
        const base = readBase(transaction, config, id);
        if (!base) throw notFound(collection, id);
        assertMutable(base, collection);
        assertProofVerified(config, base);
        assertSlugAvailable(transaction, config, id, locale, translation.slug);
        upsertTranslation(
          transaction,
          config,
          id,
          locale,
          translation,
          { status: "published", scheduledAt: null, publishedAt: timestamp },
          timestamp,
        );
        audit(transaction).record({
          actorId,
          action: "content.translation.publish",
          entityType: collection,
          entityId: id,
          detail: { locale },
        });
      });

      return get(collection, id);
    },

    async schedule(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const timestamp = now();

      database.transaction((transaction) => {
        const { scheduledAt, ...translation } =
          scheduleTranslationInputSchema.parse(input);
        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate.getTime() <= timestamp.getTime()) {
          throw new ContentRepositoryError(
            "SCHEDULE_NOT_FUTURE",
            "The scheduled publication time must be in the future",
          );
        }
        const base = readBase(transaction, config, id);
        if (!base) throw notFound(collection, id);
        assertMutable(base, collection);
        assertProofVerified(config, base);
        assertSlugAvailable(transaction, config, id, locale, translation.slug);
        upsertTranslation(
          transaction,
          config,
          id,
          locale,
          translation,
          { status: "scheduled", scheduledAt: scheduledDate, publishedAt: null },
          timestamp,
        );
        audit(transaction).record({
          actorId,
          action: "content.translation.schedule",
          entityType: collection,
          entityId: id,
          detail: { locale, scheduledAt: scheduledDate.toISOString() },
        });
      });

      return get(collection, id);
    },

    async archive(collection, id, actorId) {
      const config = collectionConfig[collection];
      const timestamp = now();

      database.transaction((transaction) => {
        const base = readBase(transaction, config, id);
        if (!base) throw notFound(collection, id);
        transaction
          .update(config.base)
          .set({ archivedAt: timestamp, updatedAt: timestamp })
          .where(eq(config.base.id, id))
          .run();
        audit(transaction).record({
          actorId,
          action: "content.archive",
          entityType: collection,
          entityId: id,
          detail: {},
        });
      });

      return get(collection, id);
    },
  };
}
