import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import type { AuditQueryRepository } from "../repositories/audit-query-repository.js";

const AuditEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
}).openapi("AdminAuditEvent");

const querySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/audit",
  operationId: "listAdminAuditEvents",
  tags: ["Administration"],
  request: { query: querySchema },
  responses: {
    200: {
      description: "Filtered audit history with sensitive detail redacted.",
      content: { "application/json": { schema: envelope("AdminAuditEventsResponse", z.object({ items: z.array(AuditEventSchema), page: z.number(), pageSize: z.number(), total: z.number() })) } },
    },
    401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
    403: { description: "Audit permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/admin/audit/{id}",
  operationId: "getAdminAuditEvent",
  tags: ["Administration"],
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: { description: "Redacted audit event detail.", content: { "application/json": { schema: envelope("AdminAuditEventResponse", AuditEventSchema) } } },
    404: { description: "Audit event not found.", content: { "application/json": { schema: errorEnvelopeSchema } } },
  },
});

export type AuditRouteDependencies = PermissionMiddlewareDependencies & {
  auditRepository: AuditQueryRepository;
};

export function registerAuditRoutes(app: OpenAPIHono<AppEnv>, dependencies: AuditRouteDependencies): void {
  app.use("/api/admin/audit", requirePermission("audit.read", dependencies));
  app.use("/api/admin/audit/*", requirePermission("audit.read", dependencies));
  app.openapi(listRoute, (context) => {
    const query = context.req.valid("query");
    const data = dependencies.auditRepository.list({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
  });
  app.openapi(detailRoute, (context) => {
    const data = dependencies.auditRepository.detail(context.req.valid("param").id);
    if (!data) {
      return context.json({ data: null, error: { code: "AUDIT_NOT_FOUND", message: "审计记录不存在" }, requestId: context.get("requestId") }, 404);
    }
    return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
  });
}
