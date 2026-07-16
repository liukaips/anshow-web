import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import { requirePermission, type PermissionMiddlewareDependencies } from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import type { PreviewService } from "../../preview/preview-service.js";

const createRouteDefinition = createRoute({
  method: "post",
  path: "/api/admin/previews",
  operationId: "createAdminPreview",
  tags: ["Administration Preview"],
  request: { body: { required: true, content: { "application/json": { schema: z.object({ expiresInHours: z.number().int().min(1).max(168).default(24) }).strict().openapi("CreateAdminPreviewInput") } } } },
  responses: {
    201: { description: "Immutable preview snapshot and one-time raw share token.", content: { "application/json": { schema: envelope("CreateAdminPreviewResponse", z.object({ snapshotId: z.string(), tokenId: z.string(), rawToken: z.string(), contentHash: z.string(), sourceVersions: z.array(z.object({ entityType: z.string(), entityId: z.string(), version: z.number() })), createdAt: z.coerce.date(), expiresAt: z.coerce.date() })) } } },
    401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Preview creation permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/previews",
  operationId: "listAdminPreviews",
  tags: ["Administration Preview"],
  responses: {
    200: { description: "Preview snapshot history.", content: { "application/json": { schema: envelope("AdminPreviewsResponse", z.array(z.object({ id: z.string(), contentHash: z.string(), sourceVersions: z.array(z.object({ entityType: z.string(), entityId: z.string(), version: z.number() })), createdBy: z.string(), createdAt: z.coerce.date(), expiresAt: z.coerce.date().nullable(), publishedAt: z.coerce.date().nullable(), payload: z.record(z.string(), z.unknown()) }))) } } },
  },
});

const revokeRoute = createRoute({
  method: "post",
  path: "/api/admin/previews/tokens/{id}/revoke",
  operationId: "revokeAdminPreviewToken",
  tags: ["Administration Preview"],
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: { 200: { description: "Preview token revoked.", content: { "application/json": { schema: envelope("RevokeAdminPreviewResponse", z.object({ revoked: z.literal(true) })) } } } },
});

const publishRoute = createRoute({
  method: "post",
  path: "/api/admin/previews/{id}/publish",
  operationId: "publishAdminPreview",
  tags: ["Administration Preview"],
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ expectedHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "已按确认的快照版本原子发布",
      content: {
        "application/json": {
          schema: envelope("PublishAdminPreviewResponse", z.object({
            snapshotId: z.string(),
            contentHash: z.string(),
            publishedAt: z.coerce.date(),
            publishedChanges: z.number().int().positive(),
          })),
        },
      },
    },
    401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Content publish permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    409: { description: "Snapshot is stale, expired, or not publishable.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

export type PreviewRouteDependencies = PermissionMiddlewareDependencies & { previewService: PreviewService };

export function registerPreviewRoutes(app: OpenAPIHono<AppEnv>, dependencies: PreviewRouteDependencies): void {
  app.use("/api/admin/previews", async (context, next) => {
    if (context.req.method === "POST") return requirePermission("preview.create", dependencies)(context, next);
    return requirePermission("preview.share", dependencies)(context, next);
  });
  app.use("/api/admin/previews/tokens/*", requirePermission("preview.revoke", dependencies));
  app.use("/api/admin/previews/:id/publish", requirePermission("content.publish", dependencies));
  app.openapi(createRouteDefinition, async (context) => {
    const actor = context.get("actor");
    if (!actor) throw new Error("Permission middleware did not provide an actor");
    const data = await dependencies.previewService.createSnapshot({ createdBy: actor.user.id, expiresInHours: context.req.valid("json").expiresInHours });
    return context.json({ data, error: null, requestId: context.get("requestId") }, 201);
  });
  app.openapi(listRoute, (context) => context.json({ data: dependencies.previewService.list(), error: null, requestId: context.get("requestId") }, 200));
  app.openapi(revokeRoute, (context) => {
    dependencies.previewService.revoke(context.req.valid("param").id);
    return context.json({ data: { revoked: true as const }, error: null, requestId: context.get("requestId") }, 200);
  });
  app.openapi(publishRoute, (context) => {
    const actor = context.get("actor");
    if (!actor) throw new Error("Permission middleware did not provide an actor");
    const data = dependencies.previewService.publishSnapshot({
      snapshotId: context.req.valid("param").id,
      expectedHash: context.req.valid("json").expectedHash,
      actorId: actor.user.id,
    });
    return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
  });
}
