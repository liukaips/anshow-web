import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import {
  MAX_UPLOAD_BYTES,
  MediaServiceError,
  type MediaService,
  type MediaUpload,
} from "../../media/media-service.js";
import {
  mediaMetadataSchema,
  MediaRepositoryError,
  type AdminMediaAsset,
  type MediaMetadataInput,
} from "../repositories/media-repository.js";

const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const MediaReferenceSchema = z
  .object({
    entityType: z.string(),
    entityId: z.string(),
    field: z.string(),
  })
  .openapi("AdminMediaReference");

const MediaDerivativeSchema = z
  .object({
    id: z.string(),
    storageKey: z.string(),
    url: z.string(),
    format: z.enum(["avif", "webp"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    byteSize: z.number().int().positive(),
  })
  .openapi("AdminMediaDerivative");

const MediaAltSchema = z
  .object({ en: z.string(), zh: z.string(), ru: z.string() })
  .openapi("AdminMediaAltText");

const MediaAssetSchema = z
  .object({
    id: z.uuid(),
    storageKey: z.string(),
    mimeType: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    dominantColor: z.string(),
    focalX: z.number().min(0).max(1),
    focalY: z.number().min(0).max(1),
    alt: MediaAltSchema,
    derivatives: z.array(MediaDerivativeSchema),
    createdAt: z.string().datetime(),
    replacedAt: z.string().datetime().nullable(),
    references: z.array(MediaReferenceSchema),
    referenceCount: z.number().int().nonnegative(),
  })
  .openapi("AdminMediaAsset");
type MediaAssetResponse = z.infer<typeof MediaAssetSchema>;

const MediaIdSchema = z.uuid().openapi("AdminMediaId");
const MediaPathSchema = z.object({ id: MediaIdSchema });
const MediaMetadataInputSchema = mediaMetadataSchema.openapi(
  "AdminMediaMetadataInput",
);
const MediaMultipartInputSchema = z
  .object({
    file: z
      .custom<File>((value) => value instanceof File, {
        message: "An image file is required",
      })
      .openapi({ type: "string", format: "binary" }),
    altEn: z.string(),
    altZh: z.string(),
    altRu: z.string(),
    focalX: z.string(),
    focalY: z.string(),
  })
  .openapi("AdminMediaMultipartInput");

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/media",
  operationId: "listAdminMedia",
  tags: ["Administration Media"],
  responses: {
    200: {
      description: "Media library assets with derivatives and references.",
      content: {
        "application/json": {
          schema: envelope("AdminMediaListResponse", z.array(MediaAssetSchema)),
        },
      },
    },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.read.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/admin/media/{id}",
  operationId: "getAdminMedia",
  tags: ["Administration Media"],
  request: { params: MediaPathSchema },
  responses: {
    200: { description: "Media detail.", content: { "application/json": { schema: envelope("AdminMediaDetailResponse", MediaAssetSchema) } } },
    400: { description: "Invalid media ID.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.read.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    404: { description: "Media not found.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const uploadRoute = createRoute({
  method: "post",
  path: "/api/admin/media",
  operationId: "createAdminMedia",
  tags: ["Administration Media"],
  request: {
    body: {
      required: true,
      content: { "multipart/form-data": { schema: MediaMultipartInputSchema } },
    },
  },
  responses: {
    201: { description: "Processed media asset.", content: { "application/json": { schema: envelope("CreateAdminMediaResponse", MediaAssetSchema) } } },
    400: { description: "Invalid media or metadata.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.write.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    413: { description: "Upload exceeds 20 MB.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const updateMetadataRoute = createRoute({
  method: "put",
  path: "/api/admin/media/{id}",
  operationId: "updateAdminMediaMetadata",
  tags: ["Administration Media"],
  request: {
    params: MediaPathSchema,
    body: { required: true, content: { "application/json": { schema: MediaMetadataInputSchema } } },
  },
  responses: {
    200: { description: "Updated media metadata.", content: { "application/json": { schema: envelope("UpdateAdminMediaResponse", MediaAssetSchema) } } },
    400: { description: "Invalid ID or metadata.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.write.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    404: { description: "Media not found.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const replaceRoute = createRoute({
  method: "post",
  path: "/api/admin/media/{id}/replacement",
  operationId: "replaceAdminMedia",
  tags: ["Administration Media"],
  request: {
    params: MediaPathSchema,
    body: { required: true, content: { "multipart/form-data": { schema: MediaMultipartInputSchema } } },
  },
  responses: {
    200: { description: "Replaced media bytes while preserving the media ID.", content: { "application/json": { schema: envelope("ReplaceAdminMediaResponse", MediaAssetSchema) } } },
    400: { description: "Invalid media, ID, or metadata.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.write.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    404: { description: "Media not found.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    413: { description: "Upload exceeds 20 MB.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/api/admin/media/{id}",
  operationId: "deleteAdminMedia",
  tags: ["Administration Media"],
  request: { params: MediaPathSchema },
  responses: {
    200: { description: "Deleted unused media.", content: { "application/json": { schema: envelope("DeleteAdminMediaResponse", z.object({ id: MediaIdSchema, deleted: z.literal(true) })) } } },
    400: { description: "Invalid media ID.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.write.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    404: { description: "Media not found.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    409: { description: "Media is referenced.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const retryCleanupRoute = createRoute({
  method: "post",
  path: "/api/admin/media/cleanup/retry",
  operationId: "retryAdminMediaCleanup",
  tags: ["Administration Media"],
  responses: {
    200: {
      description: "Retried due media cleanup jobs.",
      content: {
        "application/json": {
          schema: envelope(
            "RetryAdminMediaCleanupResponse",
            z.object({
              attempted: z.number().int().nonnegative(),
              remaining: z.number().int().nonnegative(),
            }),
          ),
        },
      },
    },
    401: { description: "No staff session.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Missing media.write.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

export type MediaRouteDependencies = PermissionMiddlewareDependencies & {
  mediaService: MediaService;
};

function errorResponse(context: Parameters<Parameters<OpenAPIHono<AppEnv>["onError"]>[0]>[1], error: unknown) {
  const requestId = context.get("requestId");
  if (error instanceof MediaRepositoryError) {
    const status = error.code === "MEDIA_NOT_FOUND" ? 404 : 409;
    return context.json({
      data: null,
      error: {
        code: error.code,
        message: error.message,
        ...(error.references.length > 0
          ? {
              details: {
                references: error.references.map((reference) => ({
                  ...reference,
                })),
              },
            }
          : {}),
      },
      requestId,
    }, status);
  }
  if (error instanceof MediaServiceError) {
    return context.json({
      data: null,
      error: { code: error.code, message: error.message },
      requestId,
    }, error.status);
  }
  if (error instanceof z.ZodError) {
    const fields = Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).map(([field, messages]) => [field, messages ?? []]),
    );
    return context.json({ data: null, error: { code: "VALIDATION_ERROR", message: "The media metadata is invalid.", fields }, requestId }, 400);
  }
  throw error;
}

function serviceErrorEnvelope(
  context: Parameters<Parameters<OpenAPIHono<AppEnv>["onError"]>[0]>[1],
  error: MediaServiceError,
) {
  return {
    data: null,
    error: { code: error.code, message: error.message },
    requestId: context.get("requestId"),
  } as const;
}

function repositoryErrorEnvelope(
  context: Parameters<Parameters<OpenAPIHono<AppEnv>["onError"]>[0]>[1],
  error: MediaRepositoryError,
) {
  return {
    data: null,
    error: {
      code: error.code,
      message: error.message,
      ...(error.references.length > 0
        ? { details: { references: error.references.map((reference) => ({ ...reference })) } }
        : {}),
    },
    requestId: context.get("requestId"),
  };
}

function validationErrorResponse(
  context: Parameters<Parameters<OpenAPIHono<AppEnv>["onError"]>[0]>[1],
  error: z.ZodError,
) {
  const fields = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).map(([field, messages]) => [field, messages ?? []]),
  );
  return context.json({
    data: null,
    error: { code: "VALIDATION_ERROR", message: "The media metadata is invalid.", fields },
    requestId: context.get("requestId"),
  }, 400);
}

function toMediaResponse(asset: AdminMediaAsset): MediaAssetResponse {
  return {
    ...asset,
    alt: { ...asset.alt },
    derivatives: asset.derivatives.map((derivative) => ({ ...derivative })),
    references: asset.references.map((reference) => ({ ...reference })),
  };
}

function actorId(context: { get(key: "actor"): AppEnv["Variables"]["actor"] }) {
  const actor = context.get("actor");
  if (!actor) throw new Error("Permission middleware did not provide an actor");
  return actor.user.id;
}

async function multipartInput(form: Record<string, unknown>): Promise<{ upload: MediaUpload; metadata: MediaMetadataInput }> {
  const file = form.file;
  if (!(file instanceof File)) {
    throw new MediaServiceError("INVALID_MEDIA", "An image file is required");
  }
  const metadata = mediaMetadataSchema.parse({
    alt: { en: form.altEn, zh: form.altZh, ru: form.altRu },
    focalX: Number(form.focalX),
    focalY: Number(form.focalY),
  });
  return {
    upload: { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
    metadata,
  };
}

export function registerMediaRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: MediaRouteDependencies,
): void {
  const permission = async (context: Parameters<ReturnType<typeof requirePermission>>[0], next: Parameters<ReturnType<typeof requirePermission>>[1]) => {
    const required = context.req.method === "GET" ? "media.read" : "media.write";
    return requirePermission(required, dependencies)(context, next);
  };
  app.use("/api/admin/media/*", permission);

  const streamedLimit = bodyLimit({
    maxSize: MAX_MULTIPART_BYTES,
    onError: (context) =>
      errorResponse(
        context,
        new MediaServiceError(
          "MEDIA_TOO_LARGE",
          "Media uploads must not exceed 20 MB",
          413,
        ),
      ),
  });
  app.use("/api/admin/media/*", async (context, next) => {
    if (context.req.method !== "POST") {
      await next();
      return;
    }

    const declaredLength = Number(context.req.header("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      return errorResponse(context, new MediaServiceError("MEDIA_TOO_LARGE", "Media uploads must not exceed 20 MB", 413));
    }

    const request = context.req.raw;
    if (request.body && request.headers.has("content-length")) {
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      context.req.raw = new Request(request, {
        body: request.body,
        headers,
        duplex: "half",
      } as RequestInit & { duplex: "half" });
    }
    return streamedLimit(context, next);
  });

  app.openapi(listRoute, async (context) => context.json({ data: (await dependencies.mediaService.list()).map(toMediaResponse), error: null, requestId: context.get("requestId") }, 200));
  app.openapi(retryCleanupRoute, async (context) =>
    context.json({
      data: await dependencies.mediaService.retryCleanup(),
      error: null,
      requestId: context.get("requestId"),
    }, 200),
  );
  app.openapi(detailRoute, async (context) => {
    try {
      return context.json({ data: toMediaResponse(await dependencies.mediaService.get(context.req.valid("param").id)), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      if (error instanceof MediaRepositoryError) {
        return context.json(repositoryErrorEnvelope(context, error), 404);
      }
      throw error;
    }
  });
  app.openapi(uploadRoute, async (context) => {
    try {
      const { upload, metadata } = await multipartInput(context.req.valid("form"));
      return context.json({ data: toMediaResponse(await dependencies.mediaService.upload(upload, metadata, actorId(context))), error: null, requestId: context.get("requestId") }, 201);
    } catch (error) {
      if (error instanceof MediaServiceError) {
        return error.status === 413
          ? context.json(serviceErrorEnvelope(context, error), 413)
          : context.json(serviceErrorEnvelope(context, error), 400);
      }
      if (error instanceof z.ZodError) return validationErrorResponse(context, error);
      throw error;
    }
  });
  app.openapi(updateMetadataRoute, async (context) => {
    try {
      return context.json({ data: toMediaResponse(await dependencies.mediaService.updateMetadata(context.req.valid("param").id, context.req.valid("json"), actorId(context))), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      if (error instanceof MediaRepositoryError) {
        return context.json(repositoryErrorEnvelope(context, error), 404);
      }
      throw error;
    }
  });
  app.openapi(replaceRoute, async (context) => {
    try {
      const { upload, metadata } = await multipartInput(context.req.valid("form"));
      return context.json({ data: toMediaResponse(await dependencies.mediaService.replace(context.req.valid("param").id, upload, metadata, actorId(context))), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      if (error instanceof MediaServiceError) {
        return error.status === 413
          ? context.json(serviceErrorEnvelope(context, error), 413)
          : context.json(serviceErrorEnvelope(context, error), 400);
      }
      if (error instanceof MediaRepositoryError) {
        return context.json(repositoryErrorEnvelope(context, error), 404);
      }
      if (error instanceof z.ZodError) return validationErrorResponse(context, error);
      throw error;
    }
  });
  app.openapi(deleteRoute, async (context) => {
    const id = context.req.valid("param").id;
    try {
      await dependencies.mediaService.delete(id, actorId(context));
      return context.json({ data: { id, deleted: true as const }, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      if (error instanceof MediaRepositoryError) {
        return error.code === "MEDIA_NOT_FOUND"
          ? context.json(repositoryErrorEnvelope(context, error), 404)
          : context.json(repositoryErrorEnvelope(context, error), 409);
      }
      throw error;
    }
  });
}
