import { and, asc, eq, ne, sql } from "drizzle-orm";

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
import { contentWorkflow, type WorkflowState } from "../../db/schema/workflow.js";
import {
  ADMIN_CONTENT_LOCALES,
  createContentInputSchema,
  publishableTranslationSchema,
  scheduleTranslationInputSchema,
  translationInputSchema,
  verificationInputSchema,
  type AdminContentCollection,
  type AdminContentLocale,
  type AdminPublicationState,
  type PublishTranslationInput,
  type ProofContentCollection,
  type ScheduleTranslationInput,
  type TranslationInput,
  type VerificationInput,
} from "../content/content-schema.js";
import { slugFromTitle, uniqueIdentifier } from "../content/content-identifiers.js";
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
  workflow: {
    state: WorkflowState;
    ownerId: string | null;
    version: number;
    submittedAt: string | null;
    updatedAt: string;
  };
}>;

export type CreateAdminContentInput = Readonly<{
  titleZh: string;
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
  updateVerification(
    collection: ProofContentCollection,
    id: string,
    input: VerificationInput,
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
type WorkflowRow = typeof contentWorkflow.$inferSelect;
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
  workflowRow?: WorkflowRow,
): AdminContentItem {
  const translations: Partial<
    Record<AdminContentLocale, AdminContentTranslation>
  > = {};
  for (const translation of translationRows) {
    translations[translation.locale] = toTranslation(translation);
  }

  const derivedState: WorkflowState = row.archivedAt
    ? "archived"
    : translationRows.some((translation) => translation.status === "published")
      ? "published"
      : translationRows.some((translation) => translation.status === "scheduled")
        ? "scheduled"
        : "draft";
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
    workflow: workflowRow
      ? {
          state: workflowRow.state,
          ownerId: workflowRow.ownerId,
          version: workflowRow.version,
          submittedAt: iso(workflowRow.submittedAt),
          updatedAt: workflowRow.updatedAt.toISOString(),
        }
      : {
          state: derivedState,
          ownerId: null,
          version: 1,
          submittedAt: null,
          updatedAt: row.updatedAt.toISOString(),
        },
  };
}

function notFound(collection: AdminContentCollection, id: string) {
  return new ContentRepositoryError(
    "CONTENT_NOT_FOUND",
    `${collection} content ${id} was not found`,
  );
}

function isUniqueConstraintFor(
  error: unknown,
  columns: readonly string[],
): boolean {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "SQLITE_CONSTRAINT_UNIQUE"
  ) {
    return false;
  }
  return columns.every((column) => error.message.includes(`.${column}`));
}

function mapContentConstraint(error: unknown, code: string): never {
  if (isUniqueConstraintFor(error, ["code"])) {
    throw new ContentRepositoryError(
      "CONTENT_CONFLICT",
      `Code ${code} is already used`,
    );
  }
  throw error;
}

function mapSlugConstraint(
  error: unknown,
  locale: AdminContentLocale,
  slug: string,
): never {
  if (isUniqueConstraintFor(error, ["locale", "slug"])) {
    throw new ContentRepositoryError(
      "SLUG_CONFLICT",
      `Slug ${slug} is already used for ${locale}`,
    );
  }
  throw error;
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

function readWorkflow(
  database: AppDatabase | ContentTransaction,
  collection: AdminContentCollection,
  id: string,
): WorkflowRow | undefined {
  return database.select().from(contentWorkflow).where(and(
    eq(contentWorkflow.entityType, collection),
    eq(contentWorkflow.entityId, id),
  )).get();
}

function bumpWorkflow(
  transaction: ContentTransaction,
  collection: AdminContentCollection,
  id: string,
  actorId: string,
  state: WorkflowState,
  timestamp: Date,
): void {
  transaction.insert(contentWorkflow).values({
    entityType: collection,
    entityId: id,
    state: "draft",
    ownerId: actorId,
    version: 1,
    updatedAt: timestamp,
  }).onConflictDoNothing().run();
  transaction.update(contentWorkflow).set({
    state,
    ownerId: actorId,
    version: sql`${contentWorkflow.version} + 1`,
    updatedAt: timestamp,
  }).where(and(
    eq(contentWorkflow.entityType, collection),
    eq(contentWorkflow.entityId, id),
  )).run();
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
    return toItem(row, translations, readWorkflow(database, collection, id));
  }

  return {
    async list(collection) {
      const config = collectionConfig[collection];
      const rows = database
        .select()
        .from(config.base)
        .orderBy(asc(config.base.sortOrder), asc(config.base.id))
        .all();
      const translations = database
        .select()
        .from(config.translations)
        .orderBy(
          asc(config.translations.ownerId),
          asc(config.translations.locale),
        )
        .all();
      const translationsByOwner = new Map<string, TranslationRow[]>();
      for (const translation of translations) {
        const grouped = translationsByOwner.get(translation.ownerId) ?? [];
        grouped.push(translation);
        translationsByOwner.set(translation.ownerId, grouped);
      }
      const workflows = new Map(
        database.select().from(contentWorkflow).where(eq(contentWorkflow.entityType, collection)).all()
          .map((workflow) => [workflow.entityId, workflow]),
      );
      return rows.map((row) =>
        toItem(row, translationsByOwner.get(row.id) ?? [], workflows.get(row.id)),
      );
    },

    get,

    async create(collection, input, actorId) {
      const config = collectionConfig[collection];
      const parsedInput = createContentInputSchema.parse(input);
      const id = createId();
      const timestamp = now();

      try {
        database.transaction((transaction) => {
          const existingCodes = new Set(
            transaction
              .select({ code: config.base.code })
              .from(config.base)
              .all()
              .map((row) => row.code),
          );
          const code = uniqueIdentifier(parsedInput.titleZh, existingCodes);
          const existingChineseSlugs = new Set(
            transaction
              .select({ slug: config.translations.slug })
              .from(config.translations)
              .where(eq(config.translations.locale, "zh"))
              .all()
              .map((row) => row.slug)
              .filter(Boolean),
          );
          const preferredSlug = slugFromTitle(parsedInput.titleZh, "zh");
          const slug = existingChineseSlugs.has(preferredSlug)
            ? code
            : preferredSlug;

          transaction
            .insert(config.base)
            .values({
              id,
              code,
              sortOrder: 0,
              verifiedAt: null,
              verificationSource: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .run();
          transaction
            .insert(config.translations)
            .values(
              ADMIN_CONTENT_LOCALES.map((locale) => ({
                ownerId: id,
                locale,
                status: "draft" as const,
                scheduledAt: null,
                publishedAt: null,
                slug: locale === "zh" ? slug : "",
                title: locale === "zh" ? parsedInput.titleZh : "",
                summary: "",
                body: "",
                seoTitle: "",
                seoDescription: "",
                altText: "",
                updatedAt: timestamp,
              })),
            )
            .run();
          transaction.insert(contentWorkflow).values({
            entityType: collection,
            entityId: id,
            state: "draft",
            ownerId: actorId,
            version: 1,
            updatedAt: timestamp,
          }).run();
          audit(transaction).record({
            actorId,
            action: "content.create",
            entityType: collection,
            entityId: id,
            detail: { code },
          });
        });
      } catch (error) {
        mapContentConstraint(error, parsedInput.titleZh);
      }

      return get(collection, id);
    },

    async saveDraft(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const translation = translationInputSchema.parse(input);
      const timestamp = now();

      try {
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
          bumpWorkflow(transaction, collection, id, actorId, "draft", timestamp);
          audit(transaction).record({
            actorId,
            action: "content.translation.save-draft",
            entityType: collection,
            entityId: id,
            detail: { locale },
          });
        });
      } catch (error) {
        mapSlugConstraint(error, locale, translation.slug);
      }

      return get(collection, id);
    },

    async publish(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const timestamp = now();

      const translation = publishableTranslationSchema.parse(input);
      try {
        database.transaction((transaction) => {
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
          bumpWorkflow(transaction, collection, id, actorId, "published", timestamp);
          audit(transaction).record({
            actorId,
            action: "content.translation.publish",
            entityType: collection,
            entityId: id,
            detail: { locale },
          });
        });
      } catch (error) {
        mapSlugConstraint(error, locale, translation.slug);
      }

      return get(collection, id);
    },

    async schedule(collection, id, locale, input, actorId) {
      const config = collectionConfig[collection];
      const timestamp = now();

      const { scheduledAt, ...translation } =
        scheduleTranslationInputSchema.parse(input);
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate.getTime() <= timestamp.getTime()) {
        throw new ContentRepositoryError(
          "SCHEDULE_NOT_FUTURE",
          "The scheduled publication time must be in the future",
        );
      }
      try {
        database.transaction((transaction) => {
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
          bumpWorkflow(transaction, collection, id, actorId, "scheduled", timestamp);
          audit(transaction).record({
            actorId,
            action: "content.translation.schedule",
            entityType: collection,
            entityId: id,
            detail: { locale, scheduledAt: scheduledDate.toISOString() },
          });
        });
      } catch (error) {
        mapSlugConstraint(error, locale, translation.slug);
      }

      return get(collection, id);
    },

    async updateVerification(collection, id, input, actorId) {
      const config = collectionConfig[collection];
      const verification = verificationInputSchema.parse(input);
      const timestamp = now();
      const verificationSource =
        verification.verificationSource?.trim() || null;

      database.transaction((transaction) => {
        const base = readBase(transaction, config, id);
        if (!base) throw notFound(collection, id);
        assertMutable(base, collection);
        transaction
          .update(config.base)
          .set({
            verifiedAt: verification.verified ? timestamp : null,
            verificationSource,
            updatedAt: timestamp,
          })
          .where(eq(config.base.id, id))
          .run();
        bumpWorkflow(transaction, collection, id, actorId, "draft", timestamp);
        audit(transaction).record({
          actorId,
          action: "content.verification.update",
          entityType: collection,
          entityId: id,
          detail: {
            verified: verification.verified,
            verificationSource,
          },
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
        if (base.archivedAt) return;
        transaction
          .update(config.base)
          .set({ archivedAt: timestamp, updatedAt: timestamp })
          .where(eq(config.base.id, id))
          .run();
        bumpWorkflow(transaction, collection, id, actorId, "archived", timestamp);
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
