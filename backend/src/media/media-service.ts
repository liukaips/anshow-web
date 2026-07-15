import sharp, { type Metadata } from "sharp";

import type {
  AdminMediaAsset,
  MediaMetadataInput,
  MediaRepository,
  PersistedMediaInput,
} from "../admin/repositories/media-repository.js";
import type { MediaStorage } from "./storage.js";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8_000;
const MAX_INPUT_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
const SOURCE_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const DERIVATIVE_WIDTHS = [480, 768, 1280, 1920] as const;

// Widths map to the public image pipeline's thumbnail, content, medium-hero,
// and desktop-hero byte budgets respectively.
export const DERIVATIVE_BUDGETS = [
  { maxWidth: 480, maxBytes: 35 * 1024 },
  { maxWidth: 768, maxBytes: 90 * 1024 },
  { maxWidth: 1280, maxBytes: 140 * 1024 },
  { maxWidth: 1920, maxBytes: 280 * 1024 },
] as const;

export type MediaUpload = Readonly<{
  name: string;
  type: string;
  bytes: Uint8Array;
}>;

export class MediaServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409 | 413 = 400,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "MediaServiceError";
  }
}

export type ValidatedUpload = Readonly<{
  bytes: Uint8Array;
  format: "jpeg" | "png" | "webp" | "avif";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  width: number;
  height: number;
  metadata: Metadata;
}>;

export type ProcessedMediaFile<
  Format extends "jpeg" | "png" | "webp" | "avif" =
    | "jpeg"
    | "png"
    | "webp"
    | "avif",
> = Readonly<{
  bytes: Uint8Array;
  format: Format;
  contentType: string;
  width: number;
  height: number;
  byteSize: number;
}>;

export type ProcessedMedia = Readonly<{
  width: number;
  height: number;
  mimeType: string;
  dominantColor: string;
  master: ProcessedMediaFile;
  derivatives: readonly ProcessedMediaFile<"avif" | "webp">[];
}>;

export interface MediaService {
  list(): Promise<AdminMediaAsset[]>;
  get(id: string): Promise<AdminMediaAsset>;
  upload(
    upload: MediaUpload,
    metadata: MediaMetadataInput,
    actorId: string,
  ): Promise<AdminMediaAsset>;
  updateMetadata(
    id: string,
    metadata: MediaMetadataInput,
    actorId: string,
  ): Promise<AdminMediaAsset>;
  replace(
    id: string,
    upload: MediaUpload,
    metadata: MediaMetadataInput,
    actorId: string,
  ): Promise<AdminMediaAsset>;
  delete(id: string, actorId: string): Promise<void>;
}

type MediaServiceDependencies = Readonly<{
  storage: MediaStorage;
  repository: MediaRepository;
  process?: (upload: MediaUpload) => Promise<ProcessedMedia>;
  createId?: () => string;
}>;

const MIME_TYPES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const;

export async function validateUpload(
  upload: MediaUpload,
): Promise<ValidatedUpload> {
  if (upload.bytes.byteLength === 0) {
    throw new MediaServiceError("INVALID_MEDIA", "The uploaded file is empty");
  }
  if (upload.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new MediaServiceError(
      "MEDIA_TOO_LARGE",
      "Media uploads must not exceed 20 MB",
      413,
    );
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(upload.bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new MediaServiceError(
      "INVALID_MEDIA",
      "The uploaded bytes are not a safe supported image",
    );
  }

  if (!metadata.format || !SOURCE_FORMATS.has(metadata.format)) {
    throw new MediaServiceError(
      "UNSUPPORTED_MEDIA",
      "Only JPEG, PNG, WebP, and AVIF images are supported",
    );
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new MediaServiceError(
      "UNSUPPORTED_MEDIA",
      "Animated and multipage images are not supported",
    );
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_IMAGE_DIMENSION ||
    metadata.height > MAX_IMAGE_DIMENSION
  ) {
    throw new MediaServiceError(
      "INVALID_MEDIA_DIMENSIONS",
      "Image dimensions must be between 1 and 8000 pixels",
    );
  }

  const rotated = metadata.orientation && metadata.orientation >= 5;
  const format = metadata.format as ValidatedUpload["format"];
  return {
    bytes: upload.bytes,
    format,
    mimeType: MIME_TYPES[format],
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height,
    metadata,
  };
}

function image(upload: ValidatedUpload) {
  return sharp(upload.bytes, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).rotate();
}

async function encodeMaster(upload: ValidatedUpload): Promise<ProcessedMediaFile> {
  const pipeline = image(upload);
  switch (upload.format) {
    case "jpeg":
      pipeline.jpeg({ quality: 90, mozjpeg: true });
      break;
    case "png":
      pipeline.png({ compressionLevel: 9, effort: 8 });
      break;
    case "webp":
      pipeline.webp({ quality: 90, effort: 5 });
      break;
    case "avif":
      pipeline.avif({ quality: 70, effort: 5 });
      break;
  }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    bytes: data,
    format: upload.format,
    contentType: MIME_TYPES[upload.format],
    width: info.width,
    height: info.height,
    byteSize: info.size,
  };
}

function budgetFor(width: number) {
  return DERIVATIVE_BUDGETS.find((tier) => width <= tier.maxWidth)?.maxBytes ??
    DERIVATIVE_BUDGETS.at(-1)!.maxBytes;
}

async function encodeDerivative(
  upload: ValidatedUpload,
  width: number,
  format: "avif" | "webp",
): Promise<ProcessedMediaFile<"avif" | "webp">> {
  const startingQuality = format === "avif" ? 55 : 72;
  const qualities = Array.from(
    new Set([startingQuality, startingQuality - 10, startingQuality - 20, 25, 18]),
  );
  const maxBytes = budgetFor(width);

  for (const quality of qualities) {
    const pipeline = image(upload).resize({ width, withoutEnlargement: true });
    if (format === "avif") {
      pipeline.avif({ quality, effort: 5 });
    } else {
      pipeline.webp({ quality, effort: 5 });
    }
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (info.size <= maxBytes) {
      return {
        bytes: data,
        format,
        contentType: MIME_TYPES[format],
        width: info.width,
        height: info.height,
        byteSize: info.size,
      };
    }
  }

  throw new MediaServiceError(
    "MEDIA_BUDGET_EXCEEDED",
    `The ${width}px derivative cannot meet its ${maxBytes} byte budget`,
  );
}

export async function processUpload(upload: MediaUpload): Promise<ProcessedMedia> {
  const validated = await validateUpload(upload);
  const master = await encodeMaster(validated);
  const widths = [
    ...new Set([
      ...DERIVATIVE_WIDTHS.filter((width) => width < master.width),
      Math.min(master.width, DERIVATIVE_WIDTHS.at(-1)!),
    ]),
  ];
  const derivatives: ProcessedMediaFile<"avif" | "webp">[] = [];
  for (const width of widths) {
    derivatives.push(await encodeDerivative(validated, width, "avif"));
    derivatives.push(await encodeDerivative(validated, width, "webp"));
  }

  const { dominant } = await sharp(master.bytes).stats();
  const dominantColor = `#${[dominant.r, dominant.g, dominant.b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

  return {
    width: master.width,
    height: master.height,
    mimeType: master.contentType,
    dominantColor,
    master,
    derivatives,
  };
}

const MASTER_EXTENSIONS = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
} as const;

export function createMediaService(
  dependencies: MediaServiceDependencies,
): MediaService {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const process = dependencies.process ?? processUpload;

  async function cleanup(keys: readonly string[]) {
    for (const key of [...keys].reverse()) {
      await dependencies.storage.delete(key).catch(() => undefined);
    }
  }

  async function writeGeneration(
    id: string,
    processed: ProcessedMedia,
    metadata: MediaMetadataInput,
  ): Promise<{ input: PersistedMediaInput; writtenKeys: string[] }> {
    const generation = createId();
    const prefix = `${id}/${generation}`;
    const writtenKeys: string[] = [];
    try {
      const masterKey = `${prefix}/master.${MASTER_EXTENSIONS[processed.master.format]}`;
      await dependencies.storage.put(
        masterKey,
        processed.master.bytes,
        processed.master.contentType,
      );
      writtenKeys.push(masterKey);

      const derivatives = [];
      for (const derivative of processed.derivatives) {
        const storageKey = `${prefix}/${derivative.width}.${derivative.format}`;
        const url = await dependencies.storage.put(
          storageKey,
          derivative.bytes,
          derivative.contentType,
        );
        writtenKeys.push(storageKey);
        derivatives.push({
          id: createId(),
          storageKey,
          url,
          format: derivative.format,
          width: derivative.width,
          height: derivative.height,
          byteSize: derivative.byteSize,
        });
      }

      return {
        writtenKeys,
        input: {
          id,
          storageKey: masterKey,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          dominantColor: processed.dominantColor,
          ...metadata,
          derivatives,
        },
      };
    } catch (error) {
      await cleanup(writtenKeys);
      throw error;
    }
  }

  return {
    list: () => dependencies.repository.list(),
    get: (id) => dependencies.repository.get(id),

    async upload(upload, metadata, actorId) {
      const processed = await process(upload);
      const id = createId();
      const generation = await writeGeneration(id, processed, metadata);
      try {
        return await dependencies.repository.insert(generation.input, actorId);
      } catch (error) {
        await cleanup(generation.writtenKeys);
        throw error;
      }
    },

    updateMetadata: (id, metadata, actorId) =>
      dependencies.repository.updateMetadata(id, metadata, actorId),

    async replace(id, upload, metadata, actorId) {
      const existing = await dependencies.repository.get(id);
      const processed = await process(upload);
      const generation = await writeGeneration(id, processed, metadata);
      let saved: AdminMediaAsset;
      try {
        saved = await dependencies.repository.replace(
          id,
          generation.input,
          actorId,
        );
      } catch (error) {
        await cleanup(generation.writtenKeys);
        throw error;
      }

      await cleanup([
        existing.storageKey,
        ...existing.derivatives.map(({ storageKey }) => storageKey),
      ]);
      return saved;
    },

    async delete(id, actorId) {
      const deleted = await dependencies.repository.deleteWithAudit(id, actorId);
      await cleanup(deleted.storageKeys);
    },
  };
}
