import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import { envelope, errorEnvelopeSchema, homeSchema, localeSchema, publicItemSchema } from "../content/public-contract.js";
import { PUBLIC_COLLECTIONS } from "../content/types.js";
import type { AppEnv } from "../http/context.js";
import type { PreviewService } from "../preview/preview-service.js";

const collectionsSchema = z.object(Object.fromEntries(PUBLIC_COLLECTIONS.map((collection) => [collection, z.array(publicItemSchema)])) as Record<(typeof PUBLIC_COLLECTIONS)[number], z.ZodArray<typeof publicItemSchema>>);
const route = createRoute({
  method: "get",
  path: "/api/public/preview/{token}/{locale}",
  operationId: "getPublicPreview",
  tags: ["Public preview"],
  request: { params: z.object({ token: z.string().min(1).max(500), locale: localeSchema }) },
  responses: {
    200: { description: "One locale from an immutable preview snapshot.", content: { "application/json": { schema: envelope("PublicPreviewResponse", z.object({ snapshotId: z.string(), home: homeSchema, collections: collectionsSchema, expiresAt: z.coerce.date().nullable() })) } } },
    404: { description: "Preview expired, revoked, or missing.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

export function registerPublicPreviewRoutes(app: OpenAPIHono<AppEnv>, service: PreviewService): void {
  app.openapi(route, (context) => {
    const { token, locale } = context.req.valid("param");
    const snapshot = service.readSnapshot(token);
    context.header("cache-control", "private, no-store");
    context.header("x-robots-tag", "noindex, noarchive");
    if (!snapshot) return context.json({ data: null, error: { code: "PREVIEW_NOT_FOUND", message: "预览链接无效、已过期或已撤销" }, requestId: context.get("requestId") }, 404);
    const collections = Object.fromEntries(PUBLIC_COLLECTIONS.map((collection) => [collection, snapshot.payload.collections[collection][locale]])) as Record<(typeof PUBLIC_COLLECTIONS)[number], (typeof snapshot.payload.collections)["services"][typeof locale]>;
    return context.json({ data: { snapshotId: snapshot.id, home: snapshot.payload.homes[locale], collections, expiresAt: snapshot.expiresAt }, error: null, requestId: context.get("requestId") }, 200);
  });
}
