import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import { inquiryPriorities } from "../../db/schema/inquiries.js";
import type { AppEnv } from "../../http/context.js";
import { INQUIRY_STATUSES } from "../../inquiries/state-machine.js";
import type { InquiryAdminRepository } from "../repositories/inquiry-admin-repository.js";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ data, error: z.null(), requestId: z.string() });
const errorSchema = z.object({
  data: z.null(),
  error: z.object({ code: z.string(), message: z.string() }),
  requestId: z.string(),
});
const idParams = z.object({ id: z.string().trim().min(1).max(200) });
const inquirySchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  email: z.string(),
  phone: z.string(),
  transportNeed: z.string(),
  message: z.string(),
  locale: z.string(),
  sourceUrl: z.string(),
  referrer: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  privacyVersion: z.string(),
  consentedAt: z.number(),
  assigneeId: z.string().nullable(),
  priority: z.enum(inquiryPriorities),
  status: z.enum(INQUIRY_STATUSES),
  createdAt: z.number(),
  updatedAt: z.number(),
  closedAt: z.number().nullable(),
});
const noteSchema = z.object({
  id: z.string(),
  inquiryId: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.number(),
});
const historySchema = z.object({
  id: z.string(),
  inquiryId: z.string(),
  actorId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  createdAt: z.number(),
});
const notificationSchema = z.object({
  id: z.string(),
  inquiryId: z.string(),
  status: z.string(),
  attempts: z.number(),
  nextAttemptAt: z.number(),
  workerId: z.string().nullable(),
  claimedAt: z.number().nullable(),
  sentAt: z.number().nullable(),
  lastError: z.string().nullable(),
  idempotencyKey: z.string(),
});
const detailSchema = inquirySchema.extend({
  notes: z.array(noteSchema),
  history: z.array(historySchema),
  notifications: z.array(notificationSchema),
});
const filtersSchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  priority: z.enum(inquiryPriorities).optional(),
  assigneeId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
const commonErrors = {
  401: { description: "未登录", content: { "application/json": { schema: errorSchema } } },
  403: { description: "无询盘操作权限", content: { "application/json": { schema: errorSchema } } },
} as const;

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/inquiries",
  operationId: "listAdminInquiries",
  tags: ["Administration"],
  request: { query: filtersSchema },
  responses: {
    200: { description: "询盘列表", content: { "application/json": { schema: envelope(z.array(inquirySchema)) } } },
    ...commonErrors,
  },
});
const detailRoute = createRoute({
  method: "get",
  path: "/api/admin/inquiries/{id}",
  operationId: "getAdminInquiry",
  tags: ["Administration"],
  request: { params: idParams },
  responses: {
    200: { description: "询盘详情", content: { "application/json": { schema: envelope(detailSchema) } } },
    404: { description: "询盘不存在", content: { "application/json": { schema: errorSchema } } },
    ...commonErrors,
  },
});
const exportRoute = createRoute({
  method: "get",
  path: "/api/admin/inquiries/export",
  operationId: "exportAdminInquiries",
  tags: ["Administration"],
  request: { query: filtersSchema },
  responses: {
    200: { description: "询盘 CSV 文件", content: { "text/csv": { schema: z.string() } } },
    ...commonErrors,
  },
});

function mutationRoute(
  suffix: "assign" | "priority" | "status" | "notes",
  operationId: "assignAdminInquiry" | "updateAdminInquiryPriority" | "updateAdminInquiryStatus" | "addAdminInquiryNote",
  body: z.ZodType,
  response: z.ZodType,
) {
  return createRoute({
    method: "post",
    path: `/api/admin/inquiries/{id}/${suffix}`,
    operationId,
    tags: ["Administration"],
    request: { params: idParams, body: { required: true, content: { "application/json": { schema: body } } } },
    responses: {
      200: { description: "询盘已更新", content: { "application/json": { schema: envelope(response) } } },
      404: { description: "询盘不存在", content: { "application/json": { schema: errorSchema } } },
      409: { description: "询盘当前状态不允许此操作", content: { "application/json": { schema: errorSchema } } },
      ...commonErrors,
    },
  });
}

const assignRoute = mutationRoute(
  "assign",
  "assignAdminInquiry",
  z.object({ assigneeId: z.string().trim().min(1).max(200).nullable() }).strict(),
  inquirySchema,
);
const priorityRoute = mutationRoute(
  "priority",
  "updateAdminInquiryPriority",
  z.object({ priority: z.enum(inquiryPriorities) }).strict(),
  inquirySchema,
);
const statusRoute = mutationRoute(
  "status",
  "updateAdminInquiryStatus",
  z.object({ status: z.enum(INQUIRY_STATUSES) }).strict(),
  inquirySchema,
);
const noteRoute = mutationRoute(
  "notes",
  "addAdminInquiryNote",
  z.object({ body: z.string().trim().min(1, "请输入跟进记录").max(2000) }).strict(),
  noteSchema,
);
const retryRoute = createRoute({
  method: "post",
  path: "/api/admin/inquiries/{id}/notifications/{deliveryId}/retry",
  operationId: "retryAdminInquiryNotification",
  tags: ["Administration"],
  request: { params: idParams.extend({ deliveryId: z.string().trim().min(1).max(200) }) },
  responses: {
    200: { description: "通知已重新排队", content: { "application/json": { schema: envelope(notificationSchema) } } },
    404: { description: "通知不存在", content: { "application/json": { schema: errorSchema } } },
    409: { description: "通知当前不可重试", content: { "application/json": { schema: errorSchema } } },
    ...commonErrors,
  },
});

export type InquiryRouteDependencies = PermissionMiddlewareDependencies & {
  inquiryRepository: InquiryAdminRepository;
};

function actorId(context: Context<AppEnv>): string {
  return context.get("actor")!.user.id;
}

function domainError(context: Context<AppEnv>, error: unknown) {
  const code = error instanceof Error ? error.message : "INQUIRY_OPERATION_FAILED";
  const notFound = code === "INQUIRY_NOT_FOUND" || code === "NOTIFICATION_NOT_FOUND";
  const message: Record<string, string> = {
    INQUIRY_NOT_FOUND: "询盘不存在",
    NOTIFICATION_NOT_FOUND: "通知记录不存在",
    NOTIFICATION_NOT_RETRYABLE: "只有发送失败的通知可以重试",
  };
  return context.json(
    { data: null, error: { code, message: message[code] ?? (error instanceof Error ? error.message : "询盘操作失败") }, requestId: context.get("requestId") },
    notFound ? 404 : 409,
  );
}

export function registerInquiryRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: InquiryRouteDependencies,
): void {
  app.use("/api/admin/inquiries", requirePermission("inquiry.read", dependencies));
  app.use("/api/admin/inquiries/export", requirePermission("inquiry.export", dependencies));
  app.use("/api/admin/inquiries/:id", requirePermission("inquiry.read", dependencies));
  app.use("/api/admin/inquiries/:id/assign", requirePermission("inquiry.assign", dependencies));
  app.use("/api/admin/inquiries/:id/priority", requirePermission("inquiry.status", dependencies));
  app.use("/api/admin/inquiries/:id/status", requirePermission("inquiry.status", dependencies));
  app.use("/api/admin/inquiries/:id/notes", requirePermission("inquiry.note", dependencies));
  app.use("/api/admin/inquiries/:id/notifications/:deliveryId/retry", requirePermission("inquiry.retry", dependencies));

  app.openapi(listRoute, (context) =>
    context.json({ data: dependencies.inquiryRepository.list(context.req.valid("query")), error: null, requestId: context.get("requestId") }, 200),
  );
  app.openapi(exportRoute, (context) => {
    const csv = dependencies.inquiryRepository.exportCsv(context.req.valid("query"), actorId(context));
    context.header("Content-Type", "text/csv; charset=utf-8");
    context.header("Content-Disposition", `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    return context.body(`\uFEFF${csv}`, 200);
  });
  app.openapi(detailRoute, (context) => {
    const data = dependencies.inquiryRepository.detail(context.req.valid("param").id);
    return data
      ? context.json({ data, error: null, requestId: context.get("requestId") }, 200)
      : context.json({ data: null, error: { code: "INQUIRY_NOT_FOUND", message: "询盘不存在" }, requestId: context.get("requestId") }, 404);
  });
  app.openapi(assignRoute, (context) => {
    try {
      const input = context.req.valid("json") as { assigneeId: string | null };
      const data = dependencies.inquiryRepository.assign(context.req.valid("param").id, input.assigneeId, actorId(context));
      return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) { return domainError(context, error); }
  });
  app.openapi(priorityRoute, (context) => {
    try {
      const input = context.req.valid("json") as { priority: (typeof inquiryPriorities)[number] };
      const data = dependencies.inquiryRepository.setPriority(context.req.valid("param").id, input.priority, actorId(context));
      return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) { return domainError(context, error); }
  });
  app.openapi(statusRoute, (context) => {
    try {
      const input = context.req.valid("json") as { status: (typeof INQUIRY_STATUSES)[number] };
      const data = dependencies.inquiryRepository.transition(context.req.valid("param").id, input.status, actorId(context));
      return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) { return domainError(context, error); }
  });
  app.openapi(noteRoute, (context) => {
    try {
      const input = context.req.valid("json") as { body: string };
      const data = dependencies.inquiryRepository.addNote(context.req.valid("param").id, actorId(context), input.body);
      return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) { return domainError(context, error); }
  });
  app.openapi(retryRoute, (context) => {
    try {
      const params = context.req.valid("param");
      const data = dependencies.inquiryRepository.retryNotification(params.id, params.deliveryId, actorId(context));
      return context.json({ data, error: null, requestId: context.get("requestId") }, 200);
    } catch (error) { return domainError(context, error); }
  });
}
