import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import {
  envelope,
  errorEnvelopeSchema,
} from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import { workflowStates } from "../../db/schema/workflow.js";
import {
  adminContentCollectionSchema,
  adminContentIdSchema,
  adminContentLocaleSchema,
  adminPublicationStateSchema,
  createContentInputSchema,
  proofContentCollectionSchema,
  publishableTranslationSchema,
  scheduleTranslationInputSchema,
  translationInputSchema,
  verificationInputSchema,
} from "../content/content-schema.js";
import {
  ContentRepositoryError,
  type AdminContentItem,
  type ContentRepository,
} from "../repositories/content-repository.js";

const AdminContentCollectionSchema = adminContentCollectionSchema.openapi(
  "AdminContentCollection",
);
const AdminContentLocaleSchema = adminContentLocaleSchema.openapi(
  "AdminContentLocale",
);
const ProofContentCollectionSchema = proofContentCollectionSchema.openapi(
  "ProofContentCollection",
);
const AdminPublicationStateSchema = adminPublicationStateSchema.openapi(
  "AdminPublicationState",
);
const AdminTranslationInputSchema = translationInputSchema.openapi(
  "AdminContentTranslationInput",
);
const PublishAdminContentInputSchema = publishableTranslationSchema.openapi(
  "PublishAdminContentInput",
);
const CreateAdminContentInputSchema = createContentInputSchema.openapi(
  "CreateAdminContentInput",
);
const ScheduleAdminContentInputSchema =
  scheduleTranslationInputSchema.openapi("ScheduleAdminContentInput");
const UpdateAdminContentVerificationInputSchema =
  verificationInputSchema.openapi("UpdateAdminContentVerificationInput");

const AdminContentTranslationSchema = AdminTranslationInputSchema.extend({
  locale: AdminContentLocaleSchema,
  status: AdminPublicationStateSchema,
  scheduledAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
}).openapi("AdminContentTranslation");

export const AdminContentItemSchema = z
  .object({
    id: adminContentIdSchema,
    code: z.string(),
    sortOrder: z.number().int(),
    archivedAt: z.string().datetime().nullable(),
    verified: z.boolean(),
    verificationSource: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    translations: z
      .object({
        en: AdminContentTranslationSchema.optional(),
        zh: AdminContentTranslationSchema.optional(),
        ru: AdminContentTranslationSchema.optional(),
      })
      .strict(),
    workflow: z.object({
      state: z.enum(workflowStates),
      ownerId: z.string().nullable(),
      version: z.number().int().positive(),
      submittedAt: z.string().datetime().nullable(),
      updatedAt: z.string().datetime(),
    }).strict(),
  })
  .openapi("AdminContentItem");

const CollectionParamsSchema = z.object({
  collection: AdminContentCollectionSchema,
});
const ContentParamsSchema = CollectionParamsSchema.extend({
  id: adminContentIdSchema,
});
const TranslationParamsSchema = ContentParamsSchema.extend({
  locale: AdminContentLocaleSchema,
});
const VerificationParamsSchema = z.object({
  collection: ProofContentCollectionSchema,
  id: adminContentIdSchema,
});

const errorResponses = {
  400: {
    description: "The request path or body is invalid.",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  401: {
    description: "No authenticated staff session.",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  403: {
    description: "The staff member lacks the required content permission.",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  404: {
    description: "The requested content item does not exist.",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
  409: {
    description: "The requested content state conflicts with publishing rules.",
    content: { "application/json": { schema: errorEnvelopeSchema } },
  },
} as const;

function actorId(context: Context<AppEnv>): string {
  const actor = context.get("actor");
  if (!actor) throw new Error("Permission middleware did not provide an actor");
  return actor.user.id;
}

function successEnvelope(context: Context<AppEnv>, data: AdminContentItem) {
  return {
    data,
    error: null,
    requestId: context.get("requestId"),
  };
}

function contentErrorEnvelope(
  context: Context<AppEnv>,
  error: ContentRepositoryError,
) {
  return {
    data: null,
    error: { code: error.code, message: error.message },
    requestId: context.get("requestId"),
  };
}

export type ContentRouteDependencies = PermissionMiddlewareDependencies & {
  contentRepository: ContentRepository;
};

export function registerContentRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: ContentRouteDependencies,
): void {
  const listRoute = createRoute({
    method: "get",
    path: "/api/admin/content/{collection}",
    operationId: "listAdminContent",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.read", dependencies)],
    request: { params: CollectionParamsSchema },
    responses: {
      200: {
        description: "Content items with all administration locale states.",
        content: {
          "application/json": {
            schema: envelope(
              "AdminContentListResponse",
              z.array(AdminContentItemSchema),
            ),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });
  const detailRoute = createRoute({
    method: "get",
    path: "/api/admin/content/{collection}/{id}",
    operationId: "getAdminContent",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.read", dependencies)],
    request: { params: ContentParamsSchema },
    responses: {
      200: {
        description: "A content item with independent locale states.",
        content: {
          "application/json": {
            schema: envelope("AdminContentDetailResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const createRouteDefinition = createRoute({
    method: "post",
    path: "/api/admin/content/{collection}",
    operationId: "createAdminContent",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.write", dependencies)],
    request: {
      params: CollectionParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": { schema: CreateAdminContentInputSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Created draft content shell.",
        content: {
          "application/json": {
            schema: envelope("CreateAdminContentResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const saveDraftRoute = createRoute({
    method: "put",
    path: "/api/admin/content/{collection}/{id}/translations/{locale}",
    operationId: "saveAdminContentDraft",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.write", dependencies)],
    request: {
      params: TranslationParamsSchema,
      body: {
        required: true,
        content: { "application/json": { schema: AdminTranslationInputSchema } },
      },
    },
    responses: {
      200: {
        description: "Saved locale draft, including incomplete draft fields.",
        content: {
          "application/json": {
            schema: envelope("SaveAdminContentDraftResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const publishRoute = createRoute({
    method: "post",
    path: "/api/admin/content/{collection}/{id}/translations/{locale}/publish",
    operationId: "publishAdminContentTranslation",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.publish", dependencies)],
    request: {
      params: TranslationParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": { schema: PublishAdminContentInputSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Published one complete locale independently.",
        content: {
          "application/json": {
            schema: envelope("PublishAdminContentResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const scheduleRoute = createRoute({
    method: "post",
    path: "/api/admin/content/{collection}/{id}/translations/{locale}/schedule",
    operationId: "scheduleAdminContentTranslation",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.publish", dependencies)],
    request: {
      params: TranslationParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": { schema: ScheduleAdminContentInputSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Scheduled one complete locale for future publication.",
        content: {
          "application/json": {
            schema: envelope("ScheduleAdminContentResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const archiveRoute = createRoute({
    method: "post",
    path: "/api/admin/content/{collection}/{id}/archive",
    operationId: "archiveAdminContent",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.write", dependencies)],
    request: { params: ContentParamsSchema },
    responses: {
      200: {
        description: "Archived content without exposing drafts publicly.",
        content: {
          "application/json": {
            schema: envelope("ArchiveAdminContentResponse", AdminContentItemSchema),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });
  const verificationRoute = createRoute({
    method: "put",
    path: "/api/admin/content/{collection}/{id}/verification",
    operationId: "updateAdminContentVerification",
    tags: ["Administration Content"],
    middleware: [requirePermission("content.write", dependencies)],
    request: {
      params: VerificationParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: UpdateAdminContentVerificationInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated proof verification metadata atomically.",
        content: {
          "application/json": {
            schema: envelope(
              "UpdateAdminContentVerificationResponse",
              AdminContentItemSchema,
            ),
          },
        },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });

  app.openapi(listRoute, async (context) => {
    const { collection } = context.req.valid("param");
    return context.json(
      {
        data: await dependencies.contentRepository.list(collection),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.openapi(detailRoute, async (context) => {
    const { collection, id } = context.req.valid("param");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.get(collection, id),
        ),
        200,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });

  app.openapi(createRouteDefinition, async (context) => {
    const { collection } = context.req.valid("param");
    const input = context.req.valid("json");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.create(
            collection,
            input,
            actorId(context),
          ),
        ),
        201,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });

  app.openapi(saveDraftRoute, async (context) => {
    const { collection, id, locale } = context.req.valid("param");
    const input = context.req.valid("json");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.saveDraft(
            collection,
            id,
            locale,
            input,
            actorId(context),
          ),
        ),
        200,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });

  app.openapi(publishRoute, async (context) => {
    return context.json(
      {
        data: null,
        error: {
          code: "SNAPSHOT_PUBLISH_REQUIRED",
          message: "请在“预览与发布”中检查三语页面后发布已审核版本",
        },
        requestId: context.get("requestId"),
      },
      409,
    );
  });

  app.openapi(scheduleRoute, async (context) => {
    const { collection, id, locale } = context.req.valid("param");
    const input = context.req.valid("json");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.schedule(
            collection,
            id,
            locale,
            input,
            actorId(context),
          ),
        ),
        200,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });

  app.openapi(verificationRoute, async (context) => {
    const { collection, id } = context.req.valid("param");
    const input = context.req.valid("json");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.updateVerification(
            collection,
            id,
            input,
            actorId(context),
          ),
        ),
        200,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });

  app.openapi(archiveRoute, async (context) => {
    const { collection, id } = context.req.valid("param");
    try {
      return context.json(
        successEnvelope(
          context,
          await dependencies.contentRepository.archive(
            collection,
            id,
            actorId(context),
          ),
        ),
        200,
      );
    } catch (error) {
      if (!(error instanceof ContentRepositoryError)) throw error;
      return error.code === "CONTENT_NOT_FOUND"
        ? context.json(contentErrorEnvelope(context, error), 404)
        : context.json(contentErrorEnvelope(context, error), 409);
    }
  });
}
