import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AppDatabase } from "../db/client.js";
import {
  mediaAssets,
  mediaAssetTranslations,
  mediaDerivatives,
} from "../db/schema/index.js";
import { LOCALES } from "./types.js";

type ManifestVariant = {
  width: number;
  height: number;
  format: "avif" | "webp";
  byteSize: number;
  url: string;
  role: "desktop" | "mobile" | "thumbnail";
};

type ManifestRecord = {
  id: string;
  width: number;
  height: number;
  dominantColor: string;
  variants: ManifestVariant[];
};

type SeedManifestMediaAssetsOptions = {
  manifestPath?: string;
  now?: Date;
};

export type SeedManifestMediaAssetsResult = {
  assets: number;
  derivatives: number;
};

const defaultManifestPaths = () => [
  path.resolve(process.cwd(), "content/assets/manifest.json"),
  path.resolve(process.cwd(), "../content/assets/manifest.json"),
];

async function readManifest(manifestPath?: string): Promise<ManifestRecord[]> {
  const paths = manifestPath ? [manifestPath] : defaultManifestPaths();
  for (const candidate of paths) {
    try {
      return JSON.parse(await readFile(candidate, "utf8")) as ManifestRecord[];
    } catch (error) {
      if (manifestPath) throw error;
    }
  }
  return [];
}

function derivativeId(record: ManifestRecord, variant: ManifestVariant) {
  return `${record.id}:${variant.role}:${variant.format}:${variant.width}x${variant.height}`;
}

export async function seedManifestMediaAssets(
  db: AppDatabase,
  options: SeedManifestMediaAssetsOptions = {},
): Promise<SeedManifestMediaAssetsResult> {
  const records = await readManifest(options.manifestPath);
  const now = options.now ?? new Date();

  return db.transaction((tx) => {
    let derivatives = 0;

    for (const record of records) {
      tx.insert(mediaAssets)
        .values({
          id: record.id,
          storageKey: `builtin/${record.id}`,
          mimeType: "image/webp",
          width: record.width,
          height: record.height,
          dominantColor: record.dominantColor,
          focalX: 0.5,
          focalY: 0.5,
          createdAt: now,
          replacedAt: null,
        })
        .onConflictDoUpdate({
          target: mediaAssets.id,
          set: {
            storageKey: `builtin/${record.id}`,
            mimeType: "image/webp",
            width: record.width,
            height: record.height,
            dominantColor: record.dominantColor,
            focalX: 0.5,
            focalY: 0.5,
            replacedAt: null,
          },
        })
        .run();

      for (const locale of LOCALES) {
        tx.insert(mediaAssetTranslations)
          .values({
            mediaId: record.id,
            locale,
            altText: `AnShow built-in website image: ${record.id}`,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              mediaAssetTranslations.mediaId,
              mediaAssetTranslations.locale,
            ],
            set: {
              altText: `AnShow built-in website image: ${record.id}`,
              updatedAt: now,
            },
          })
          .run();
      }

      for (const variant of record.variants) {
        derivatives += 1;
        tx.insert(mediaDerivatives)
          .values({
            id: derivativeId(record, variant),
            mediaId: record.id,
            format: variant.format,
            width: variant.width,
            height: variant.height,
            byteSize: variant.byteSize,
            url: variant.url,
          })
          .onConflictDoUpdate({
            target: mediaDerivatives.id,
            set: {
              mediaId: record.id,
              format: variant.format,
              width: variant.width,
              height: variant.height,
              byteSize: variant.byteSize,
              url: variant.url,
            },
          })
          .run();
      }
    }

    return { assets: records.length, derivatives };
  });
}
