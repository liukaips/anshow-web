import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import type { PermissionKey } from "../../auth/permissions.js";
import type { PermissionMiddlewareDependencies } from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import { inquiryPriorities, inquiryStatuses } from "../../db/schema/inquiries.js";
import type { AppEnv } from "../../http/context.js";
import type { DashboardRepository } from "../repositories/dashboard-repository.js";

const inquiryTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  priority: z.enum(inquiryPriorities),
  status: z.enum(inquiryStatuses),
  updatedAt: z.number(),
});
const reviewTaskSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  sourceVersion: z.number().int().positive(),
  submittedBy: z.string(),
  submittedAt: z.string().datetime(),
});
const auditEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});
const dashboardSchema = z
  .object({
    newInquiries: z.number().int().nonnegative(),
    highPriorityInquiries: z.number().int().nonnegative(),
    reviewPending: z.number().int().nonnegative(),
    translationPending: z.number().int().nonnegative(),
    publishedThisWeek: z.number().int().nonnegative(),
    tasks: z.object({
      inquiries: z.array(inquiryTaskSchema),
      reviews: z.array(reviewTaskSchema),
    }),
    recentAuditEvents: z.array(auditEventSchema),
    systemHealth: z.enum(["normal", "warning", "unavailable"]),
  })
  .openapi("AdminDashboard");

const dashboardRoute = createRoute({
  method: "get",
  path: "/api/admin/dashboard",
  operationId: "getAdminDashboard",
  tags: ["Administration Dashboard"],
  responses: {
    200: {
      description: "Real operational summary for the authenticated employee.",
      content: {
        "application/json": {
          schema: envelope("AdminDashboardResponse", dashboardSchema),
        },
      },
    },
    401: {
      description: "Authentication required.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

export type DashboardRouteDependencies = PermissionMiddlewareDependencies & {
  dashboardRepository: DashboardRepository;
};

function hasPermission(
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
): boolean {
  return permissions.includes(permission);
}

export function registerDashboardRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: DashboardRouteDependencies,
): void {
  app.use("/api/admin/dashboard", async (context, next) => {
    const session = await dependencies.getSession(context.req.raw.headers);
    if (!session) {
      return context.json(
        {
          data: null,
          error: { code: "UNAUTHENTICATED" as const, message: "Authentication required" },
          requestId: context.get("requestId"),
        },
        401,
      );
    }
    const permissions = await dependencies.getPermissions(session.user.id);
    context.set("actor", {
      user: session.user,
      permissions: [...permissions],
    });
    await next();
  });

  app.openapi(dashboardRoute, (context) => {
    const actor = context.get("actor")!;
    const summary = dependencies.dashboardRepository.summary(actor.user.id);
    const data = {
      ...summary,
      tasks: {
        inquiries: hasPermission(actor.permissions, "inquiry.read")
          ? summary.tasks.inquiries
          : [],
        reviews: hasPermission(actor.permissions, "content.review")
          ? summary.tasks.reviews.map((review) => ({
              ...review,
              submittedAt: review.submittedAt.toISOString(),
            }))
          : [],
      },
      recentAuditEvents: hasPermission(actor.permissions, "audit.read")
        ? summary.recentAuditEvents.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          }))
        : [],
    };
    return context.json(
      { data, error: null, requestId: context.get("requestId") },
      200,
    );
  });
}
