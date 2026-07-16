import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import {
  BackupManagerError,
  type BackupManager,
  type BackupRun,
} from "../../backup/backup-manager.js";
import { backupRunStatuses, backupTargets } from "../../db/schema/backups.js";
import type { AppEnv } from "../../http/context.js";

const backupRunSchema = z.object({
  id: z.string(),
  status: z.enum(backupRunStatuses),
  target: z.enum(backupTargets),
  storageKey: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  sha256: z.string().nullable(),
  actorId: z.string(),
  startedAt: z.number().int(),
  completedAt: z.number().int().nullable(),
  verifiedAt: z.number().int().nullable(),
  restoreStagedAt: z.number().int().nullable(),
  error: z.string().nullable(),
}).openapi("AdminBackupRun");
const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ data, error: z.null(), requestId: z.string() });
const errorSchema = z.object({
  data: z.null(),
  error: z.object({ code: z.string(), message: z.string() }),
  requestId: z.string(),
});
const commonErrors = {
  401: { description: "未登录", content: { "application/json": { schema: errorSchema } } },
  403: { description: "无系统设置权限", content: { "application/json": { schema: errorSchema } } },
  409: { description: "备份配置或运行状态冲突", content: { "application/json": { schema: errorSchema } } },
  500: { description: "备份运行或验证失败", content: { "application/json": { schema: errorSchema } } },
} as const;
const notFoundError = {
  404: { description: "备份记录不存在", content: { "application/json": { schema: errorSchema } } },
} as const;

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/backups",
  operationId: "listAdminBackups",
  tags: ["Administration"],
  request: { query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }) },
  responses: {
    200: { description: "备份运行历史", content: { "application/json": { schema: envelope(z.array(backupRunSchema)) } } },
    ...commonErrors,
  },
});
const runRoute = createRoute({
  method: "post",
  path: "/api/admin/backups/run",
  operationId: "runAdminBackup",
  tags: ["Administration"],
  responses: {
    200: { description: "备份已完成", content: { "application/json": { schema: envelope(backupRunSchema) } } },
    ...notFoundError,
    ...commonErrors,
  },
});
const verifyRoute = createRoute({
  method: "post",
  path: "/api/admin/backups/{id}/verify",
  operationId: "verifyAdminBackup",
  tags: ["Administration"],
  request: { params: z.object({ id: z.string().trim().min(1).max(200) }) },
  responses: {
    200: { description: "备份已在隔离目录验证", content: { "application/json": { schema: envelope(backupRunSchema) } } },
    ...notFoundError,
    ...commonErrors,
  },
});
const stageRestoreRoute = createRoute({
  method: "post",
  path: "/api/admin/backups/{id}/stage-restore",
  operationId: "stageAdminBackupRestore",
  tags: ["Administration"],
  request: { params: z.object({ id: z.string().trim().min(1).max(200) }) },
  responses: {
    200: { description: "已准备经过验证的离线恢复包", content: { "application/json": { schema: envelope(backupRunSchema) } } },
    ...notFoundError,
    ...commonErrors,
  },
});

export type BackupRouteDependencies = PermissionMiddlewareDependencies & {
  backupManager: Pick<BackupManager, "list" | "runNow" | "verify" | "stageRestore">;
};

function serialize(run: BackupRun) {
  return {
    ...run,
    startedAt: run.startedAt.getTime(),
    completedAt: run.completedAt?.getTime() ?? null,
    verifiedAt: run.verifiedAt?.getTime() ?? null,
    restoreStagedAt: run.restoreStagedAt?.getTime() ?? null,
  };
}

function actorId(context: Context<AppEnv>): string {
  return context.get("actor")!.user.id;
}

function backupError(context: Context<AppEnv>, error: unknown) {
  const known = error instanceof BackupManagerError;
  const code = known ? error.code : "BACKUP_OPERATION_FAILED";
  const message = known ? error.message : "备份操作失败，请稍后重试";
  const body = {
    data: null,
    error: { code, message },
    requestId: context.get("requestId"),
  };
  if (code === "BACKUP_RUN_NOT_FOUND") return context.json(body, 404);
  if (code === "BACKUP_RUN_FAILED" || code === "BACKUP_VERIFY_FAILED") {
    return context.json(body, 500);
  }
  return context.json(body, 409);
}

export function registerBackupRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: BackupRouteDependencies,
): void {
  app.use("/api/admin/backups", requirePermission("settings.manage", dependencies));
  app.use("/api/admin/backups/*", requirePermission("settings.manage", dependencies));

  app.openapi(listRoute, (context) =>
    context.json({
      data: dependencies.backupManager.list(context.req.valid("query").limit).map(serialize),
      error: null,
      requestId: context.get("requestId"),
    }, 200),
  );
  app.openapi(runRoute, async (context) => {
    try {
      const run = await dependencies.backupManager.runNow(actorId(context));
      return context.json({ data: serialize(run), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      return backupError(context, error) as never;
    }
  });
  app.openapi(verifyRoute, async (context) => {
    try {
      const run = await dependencies.backupManager.verify(
        context.req.valid("param").id,
        actorId(context),
      );
      return context.json({ data: serialize(run), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      return backupError(context, error) as never;
    }
  });
  app.openapi(stageRestoreRoute, async (context) => {
    try {
      const run = await dependencies.backupManager.stageRestore(
        context.req.valid("param").id,
        actorId(context),
      );
      return context.json({ data: serialize(run), error: null, requestId: context.get("requestId") }, 200);
    } catch (error) {
      return backupError(context, error) as never;
    }
  });
}
