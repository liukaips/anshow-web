import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import { requirePermission, type PermissionMiddlewareDependencies } from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import type { TranslationService } from "../../translation/translation-service.js";
import { adminContentCollectionSchema, adminContentIdSchema } from "../content/content-schema.js";
import { AdminContentItemSchema } from "./content.js";

const paramsSchema = z.object({ collection: adminContentCollectionSchema, id: adminContentIdSchema });
const jobSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  sourceVersion: z.number().int().positive(),
  targetLocale: z.enum(["en", "ru"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).openapi("AdminTranslationJob");

const generateRoute = createRoute({
  method: "post",
  path: "/api/admin/content/{collection}/{id}/translations/generate",
  operationId: "generateAdminContentTranslations",
  tags: ["Administration Content"],
  middleware: [],
  request: {
    params: paramsSchema,
    body: { required: true, content: { "application/json": { schema: z.object({ targets: z.array(z.enum(["en", "ru"])).min(1).max(2), sourceVersion: z.number().int().positive().optional() }).strict().openapi("GenerateAdminTranslationsInput") } } },
  },
  responses: {
    200: { description: "Generated editable translation drafts.", content: { "application/json": { schema: envelope("GenerateAdminTranslationsResponse", z.object({ sourceVersion: z.number(), jobs: z.array(jobSchema), item: AdminContentItemSchema })) } } },
    400: { description: "Chinese source content is incomplete.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Content write permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const jobsRoute = createRoute({
  method: "get",
  path: "/api/admin/content/{collection}/{id}/translations/jobs",
  operationId: "listAdminTranslationJobs",
  tags: ["Administration Content"],
  request: { params: paramsSchema },
  responses: {
    200: { description: "Translation generation jobs.", content: { "application/json": { schema: envelope("AdminTranslationJobsResponse", z.array(jobSchema)) } } },
    401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Content read permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

export type TranslationRouteDependencies = PermissionMiddlewareDependencies & { translationService: TranslationService };

export function registerTranslationRoutes(app: OpenAPIHono<AppEnv>, dependencies: TranslationRouteDependencies): void {
  app.use("/api/admin/content/:collection/:id/translations/generate", requirePermission("content.write", dependencies));
  app.use("/api/admin/content/:collection/:id/translations/jobs", requirePermission("content.read", dependencies));
  app.openapi(generateRoute, async (context) => {
    const actor = context.get("actor");
    if (!actor) throw new Error("Permission middleware did not provide an actor");
    const params = context.req.valid("param");
    const body = context.req.valid("json");
    const data = await dependencies.translationService.generate({ ...params, ...body, actorId: actor.user.id });
    return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
  });
  app.openapi(jobsRoute, (context) => {
    const { collection, id } = context.req.valid("param");
    return context.json({ data: dependencies.translationService.listJobs(collection, id), error: null, requestId: context.get("requestId") }, 200);
  });
}
