import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "../../db/client.js";
import {
  mediaAssetTranslations,
  mediaAssets,
  mediaDerivatives,
  mediaUsage,
} from "../../db/schema/content.js";
import { createAuditRepository } from "./audit-repository.js";

export const mediaAltSchema = z
  .object({
    en: z.string().trim().min(1).max(1_000),
    zh: z.string().trim().min(1).max(1_000),
    ru: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const mediaMetadataSchema = z
  .object({
    alt: mediaAltSchema,
    focalX: z.number().min(0).max(1),
    focalY: z.number().min(0).max(1),
  })
  .strict();

export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>;
export type MediaReference = Readonly<{
  entityType: string;
  entityId: string;
  field: string;
}>;
export type MediaDerivativeRecord = Readonly<{
  id: string;
  storageKey: string;
  url: string;
  format: "avif" | "webp";
  width: number;
  height: number;
  byteSize: number;
}>;
export type PersistedMediaInput = Readonly<
  MediaMetadataInput & {
    id: string;
    storageKey: string;
    mimeType: string;
    width: number;
    height: number;
    dominantColor: string;
    derivatives: readonly MediaDerivativeRecord[];
  }
>;
export type AdminMediaAsset = Readonly<
  PersistedMediaInput & {
    createdAt: string;
    replacedAt: string | null;
    references: readonly MediaReference[];
    referenceCount: number;
  }
>;

export class MediaRepositoryError extends Error {
  constructor(
    readonly code: "MEDIA_NOT_FOUND" | "MEDIA_IN_USE",
    message: string,
    readonly references: readonly MediaReference[] = [],
  ) {
    super(message);
    this.name = "MediaRepositoryError";
  }
}

export interface MediaRepository {
  list(): Promise<AdminMediaAsset[]>;
  get(id: string): Promise<AdminMediaAsset>;
  insert(input: PersistedMediaInput, actorId: string): Promise<AdminMediaAsset>;
  updateMetadata(
    id: string,
    metadata: MediaMetadataInput,
    actorId: string,
  ): Promise<AdminMediaAsset>;
  replace(
    id: string,
    input: PersistedMediaInput,
    actorId: string,
  ): Promise<AdminMediaAsset>;
  references(id: string): Promise<MediaReference[]>;
  deleteWithAudit(
    id: string,
    actorId: string,
  ): Promise<{ storageKeys: string[] }>;
}

type MediaRepositoryOptions = Readonly<{
  createAuditId?: () => string;
  now?: () => Date;
}>;

type MediaTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

const LOCALES = ["en", "zh", "ru"] as const;

function storageKeyFromUrl(url: string) {
  if (!url.startsWith("/media/")) {
    throw new Error("Media derivative URL does not contain a local storage key");
  }
  return url
    .slice("/media/".length)
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function notFound(id: string) {
  return new MediaRepositoryError("MEDIA_NOT_FOUND", `Media asset ${id} was not found`);
}

function insertTranslations(
  transaction: MediaTransaction,
  mediaId: string,
  alt: MediaMetadataInput["alt"],
  updatedAt: Date,
) {
  transaction
    .insert(mediaAssetTranslations)
    .values(
      LOCALES.map((locale) => ({
        mediaId,
        locale,
        altText: alt[locale],
        updatedAt,
      })),
    )
    .run();
}

function insertDerivatives(
  transaction: MediaTransaction,
  mediaId: string,
  derivatives: readonly MediaDerivativeRecord[],
) {
  if (derivatives.length === 0) return;
  transaction
    .insert(mediaDerivatives)
    .values(
      derivatives.map((derivative) => ({
        id: derivative.id,
        mediaId,
        format: derivative.format,
        width: derivative.width,
        height: derivative.height,
        byteSize: derivative.byteSize,
        url: derivative.url,
      })),
    )
    .run();
}

export function createMediaRepository(
  database: AppDatabase,
  options: MediaRepositoryOptions = {},
): MediaRepository {
  const now = options.now ?? (() => new Date());
  const createAuditId = options.createAuditId ?? (() => crypto.randomUUID());
  const audit = (transaction: MediaTransaction) =>
    createAuditRepository(transaction, { createId: createAuditId, now });

  async function references(id: string): Promise<MediaReference[]> {
    return database
      .select({
        entityType: mediaUsage.entityType,
        entityId: mediaUsage.entityId,
        field: mediaUsage.field,
      })
      .from(mediaUsage)
      .where(eq(mediaUsage.mediaId, id))
      .orderBy(asc(mediaUsage.entityType), asc(mediaUsage.entityId), asc(mediaUsage.field))
      .all();
  }

  async function get(id: string): Promise<AdminMediaAsset> {
    const asset = database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .get();
    if (!asset) throw notFound(id);
    const translations = database
      .select()
      .from(mediaAssetTranslations)
      .where(eq(mediaAssetTranslations.mediaId, id))
      .all();
    const alt = Object.fromEntries(
      translations.map((translation) => [translation.locale, translation.altText]),
    );
    const parsedAlt = mediaAltSchema.parse(alt);
    const derivativeRows = database
      .select()
      .from(mediaDerivatives)
      .where(eq(mediaDerivatives.mediaId, id))
      .orderBy(asc(mediaDerivatives.width), asc(mediaDerivatives.format))
      .all();
    const assetReferences = await references(id);
    return {
      ...asset,
      alt: parsedAlt,
      derivatives: derivativeRows.map((derivative) => ({
        id: derivative.id,
        format: derivative.format,
        width: derivative.width,
        height: derivative.height,
        byteSize: derivative.byteSize,
        url: derivative.url,
        storageKey: storageKeyFromUrl(derivative.url),
      })),
      createdAt: asset.createdAt.toISOString(),
      replacedAt: asset.replacedAt?.toISOString() ?? null,
      references: assetReferences,
      referenceCount: assetReferences.length,
    };
  }

  return {
    async list() {
      const rows = database
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .orderBy(asc(mediaAssets.createdAt), asc(mediaAssets.id))
        .all();
      return Promise.all(rows.map(({ id }) => get(id)));
    },
    get,
    references,

    async insert(input, actorId) {
      const parsedMetadata = mediaMetadataSchema.parse({
        alt: input.alt,
        focalX: input.focalX,
        focalY: input.focalY,
      });
      const timestamp = now();
      database.transaction((transaction) => {
        transaction
          .insert(mediaAssets)
          .values({
            id: input.id,
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            width: input.width,
            height: input.height,
            dominantColor: input.dominantColor,
            focalX: parsedMetadata.focalX,
            focalY: parsedMetadata.focalY,
            createdAt: timestamp,
          })
          .run();
        insertTranslations(transaction, input.id, parsedMetadata.alt, timestamp);
        insertDerivatives(transaction, input.id, input.derivatives);
        audit(transaction).record({
          actorId,
          action: "media.create",
          entityType: "media",
          entityId: input.id,
          detail: { mimeType: input.mimeType, width: input.width, height: input.height },
        });
      });
      return get(input.id);
    },

    async updateMetadata(id, metadata, actorId) {
      const parsed = mediaMetadataSchema.parse(metadata);
      const timestamp = now();
      database.transaction((transaction) => {
        const asset = transaction
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, id))
          .get();
        if (!asset) throw notFound(id);
        transaction
          .update(mediaAssets)
          .set({ focalX: parsed.focalX, focalY: parsed.focalY })
          .where(eq(mediaAssets.id, id))
          .run();
        transaction.delete(mediaAssetTranslations).where(eq(mediaAssetTranslations.mediaId, id)).run();
        insertTranslations(transaction, id, parsed.alt, timestamp);
        audit(transaction).record({
          actorId,
          action: "media.metadata.update",
          entityType: "media",
          entityId: id,
          detail: { locales: LOCALES, focalX: parsed.focalX, focalY: parsed.focalY },
        });
      });
      return get(id);
    },

    async replace(id, input, actorId) {
      if (input.id !== id) throw new Error("Replacement media ID must be preserved");
      const parsedMetadata = mediaMetadataSchema.parse({
        alt: input.alt,
        focalX: input.focalX,
        focalY: input.focalY,
      });
      const timestamp = now();
      database.transaction((transaction) => {
        const asset = transaction
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, id))
          .get();
        if (!asset) throw notFound(id);
        transaction
          .update(mediaAssets)
          .set({
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            width: input.width,
            height: input.height,
            dominantColor: input.dominantColor,
            focalX: parsedMetadata.focalX,
            focalY: parsedMetadata.focalY,
            replacedAt: timestamp,
          })
          .where(eq(mediaAssets.id, id))
          .run();
        transaction.delete(mediaDerivatives).where(eq(mediaDerivatives.mediaId, id)).run();
        transaction.delete(mediaAssetTranslations).where(eq(mediaAssetTranslations.mediaId, id)).run();
        insertTranslations(transaction, id, parsedMetadata.alt, timestamp);
        insertDerivatives(transaction, id, input.derivatives);
        audit(transaction).record({
          actorId,
          action: "media.replace",
          entityType: "media",
          entityId: id,
          detail: { mimeType: input.mimeType, width: input.width, height: input.height },
        });
      });
      return get(id);
    },

    async deleteWithAudit(id, actorId) {
      const asset = await get(id);
      if (asset.references.length > 0) {
        throw new MediaRepositoryError(
          "MEDIA_IN_USE",
          "Media is referenced and cannot be deleted",
          asset.references,
        );
      }
      database.transaction((transaction) => {
        const currentReferences = transaction
          .select({ entityId: mediaUsage.entityId })
          .from(mediaUsage)
          .where(eq(mediaUsage.mediaId, id))
          .all();
        if (currentReferences.length > 0) {
          throw new MediaRepositoryError(
            "MEDIA_IN_USE",
            "Media became referenced and cannot be deleted",
          );
        }
        transaction.delete(mediaAssets).where(eq(mediaAssets.id, id)).run();
        audit(transaction).record({
          actorId,
          action: "media.delete",
          entityType: "media",
          entityId: id,
          detail: {},
        });
      });
      return {
        storageKeys: [
          asset.storageKey,
          ...asset.derivatives.map(({ storageKey }) => storageKey),
        ],
      };
    },
  };
}
