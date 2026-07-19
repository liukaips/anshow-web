import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import type { AppEnv } from "../../http/context.js";
import {
  StaffRepositoryError,
  type StaffRepository,
} from "../repositories/staff-repository.js";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ data, error: z.null(), requestId: z.string() });
const error = z.object({
  data: z.null(),
  error: z.object({ code: z.string(), message: z.string() }),
  requestId: z.string(),
});
const idParam = z.object({ id: z.string().trim().min(1).max(200) });
const updated = envelope(z.object({ updated: z.literal(true) }));
const roleSchema = z.object({ id: z.string(), name: z.string() });
const staffListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  roles: z.string().nullable(),
  roleIds: z.array(z.string()),
  roleNames: z.array(z.string()),
  isSuperAdmin: z.boolean(),
});
const createStaffInputSchema = z
  .object({
    account: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    password: z.string().min(8).max(128),
    roleIds: z.array(z.string().trim().min(1)).min(1).max(20),
  })
  .strict();

const commonErrors = {
  401: {
    description: "未登录",
    content: { "application/json": { schema: error } },
  },
  403: {
    description: "无员工管理权限",
    content: { "application/json": { schema: error } },
  },
} as const;

const listRoute = createRoute({
  method: "get",
  path: "/api/admin/staff",
  operationId: "listStaff",
  responses: {
    200: {
      description: "员工列表",
      content: {
        "application/json": { schema: envelope(z.array(staffListItemSchema)) },
      },
    },
    ...commonErrors,
  },
});

const createStaffRoute = createRoute({
  method: "post",
  path: "/api/admin/staff",
  operationId: "createStaff",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: createStaffInputSchema },
      },
    },
  },
  responses: {
    201: {
      description: "员工账号已创建",
      content: {
        "application/json": { schema: envelope(staffListItemSchema) },
      },
    },
    400: {
      description: "创建员工输入无效",
      content: { "application/json": { schema: error } },
    },
    404: {
      description: "创建员工依赖的账号不存在",
      content: { "application/json": { schema: error } },
    },
    409: {
      description: "员工账号已存在或角色受保护",
      content: { "application/json": { schema: error } },
    },
    ...commonErrors,
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/admin/staff/{id}",
  operationId: "getStaff",
  request: { params: idParam },
  responses: {
    200: {
      description: "员工详情",
      content: {
        "application/json": {
          schema: envelope(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string(),
              enabled: z.boolean(),
              createdAt: z.coerce.date(),
              roles: z.array(roleSchema),
              isSuperAdmin: z.boolean(),
            }),
          ),
        },
      },
    },
    404: {
      description: "员工不存在",
      content: { "application/json": { schema: error } },
    },
    ...commonErrors,
  },
});

const rolesRoute = createRoute({
  method: "get",
  path: "/api/admin/staff-roles",
  operationId: "listStaffRoles",
  responses: {
    200: {
      description: "角色模板",
      content: {
        "application/json": {
          schema: envelope(
            z.array(
              roleSchema.extend({ permissions: z.array(z.string()) }),
            ),
          ),
        },
      },
    },
    ...commonErrors,
  },
});

const accountMutation = (
  operationId: "disableStaff" | "enableStaff",
  action: "disable" | "enable",
) =>
  createRoute({
    method: "post",
    path: `/api/admin/staff/{id}/${action}`,
    operationId,
    request: { params: idParam },
    responses: {
      200: {
        description: "员工状态已更新",
        content: { "application/json": { schema: updated } },
      },
      404: {
        description: "员工不存在",
        content: { "application/json": { schema: error } },
      },
      409: {
        description: "员工状态受保护",
        content: { "application/json": { schema: error } },
      },
      ...commonErrors,
    },
  });

const rolesMutation = createRoute({
  method: "post",
  path: "/api/admin/staff/{id}/roles",
  operationId: "updateStaffRoles",
  request: {
    params: idParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({ roleIds: z.array(z.string().trim().min(1)).max(20) })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "员工角色已更新",
      content: { "application/json": { schema: updated } },
    },
    404: {
      description: "员工不存在",
      content: { "application/json": { schema: error } },
    },
    409: {
      description: "角色修改受保护",
      content: { "application/json": { schema: error } },
    },
    ...commonErrors,
  },
});

const revokeSessionsRoute = createRoute({
  method: "post",
  path: "/api/admin/staff/{id}/sessions/revoke",
  operationId: "revokeStaffSessions",
  request: { params: idParam },
  responses: {
    200: {
      description: "员工会话已撤销",
      content: { "application/json": { schema: updated } },
    },
    404: {
      description: "员工不存在",
      content: { "application/json": { schema: error } },
    },
    409: {
      description: "会话撤销受保护",
      content: { "application/json": { schema: error } },
    },
    ...commonErrors,
  },
});

export function registerStaffRoutes(
  app: OpenAPIHono<AppEnv>,
  repository: StaffRepository,
  permissions: PermissionMiddlewareDependencies,
) {
  app.use(
    "/api/admin/staff/*",
    requirePermission("staff.manage", permissions),
  );
  app.use(
    "/api/admin/staff",
    requirePermission("staff.manage", permissions),
  );
  app.use(
    "/api/admin/staff-roles",
    requirePermission("staff.manage", permissions),
  );

  const success = (context: Context<AppEnv>) =>
    context.json(
      {
        data: { updated: true as const },
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );

  const runMutation = (
    context: Context<AppEnv>,
    operation: () => void,
  ) => {
    try {
      operation();
      return success(context);
    } catch (caught) {
      if (!(caught instanceof StaffRepositoryError)) throw caught;
      const status = caught.code === "STAFF_NOT_FOUND" ? 404 : 409;
      return context.json(
        {
          data: null,
          error: { code: caught.code, message: caught.message },
          requestId: context.get("requestId"),
        },
        status,
      );
    }
  };

  const staffError = (context: Context<AppEnv>, caught: StaffRepositoryError) => {
    const status = caught.code === "STAFF_NOT_FOUND" ? 404 : 409;
    return context.json(
      {
        data: null,
        error: { code: caught.code, message: caught.message },
        requestId: context.get("requestId"),
      },
      status,
    );
  };

  app.openapi(listRoute, (context) =>
    context.json(
      {
        data: repository.list(),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    ),
  );
  app.openapi(detailRoute, (context) => {
    const value = repository.get(context.req.valid("param").id);
    return value
      ? context.json(
          {
            data: value,
            error: null,
            requestId: context.get("requestId"),
          },
          200,
        )
      : context.json(
          {
            data: null,
            error: { code: "STAFF_NOT_FOUND", message: "未找到该员工账号" },
            requestId: context.get("requestId"),
          },
          404,
        );
  });
  app.openapi(rolesRoute, (context) =>
    context.json(
      {
        data: repository.listRoles(),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    ),
  );
  app.openapi(createStaffRoute, async (context) => {
    try {
      return context.json(
        {
          data: await repository.create(
            context.req.valid("json"),
            context.get("actor")!.user.id,
          ),
          error: null,
          requestId: context.get("requestId"),
        },
        201,
      );
    } catch (caught) {
      if (!(caught instanceof StaffRepositoryError)) throw caught;
      return staffError(context, caught);
    }
  });
  app.openapi(accountMutation("disableStaff", "disable"), (context) =>
    runMutation(context, () =>
      repository.disable(
        context.req.valid("param").id,
        context.get("actor")!.user.id,
      ),
    ),
  );
  app.openapi(accountMutation("enableStaff", "enable"), (context) =>
    runMutation(context, () =>
      repository.enable(
        context.req.valid("param").id,
        context.get("actor")!.user.id,
      ),
    ),
  );
  app.openapi(rolesMutation, (context) =>
    runMutation(context, () =>
      repository.setRoles(
        context.req.valid("param").id,
        context.req.valid("json").roleIds,
        context.get("actor")!.user.id,
      ),
    ),
  );
  app.openapi(revokeSessionsRoute, (context) =>
    runMutation(context, () =>
      repository.revokeSessions(
        context.req.valid("param").id,
        context.get("actor")!.user.id,
      ),
    ),
  );
}
