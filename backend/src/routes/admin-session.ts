import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import type { AppEnv } from "../http/context.js";
import type { PermissionKey } from "../auth/permissions.js";

export type StaffSession = {
  user: {
    email: string;
    id: string;
  };
};

export type AdminSessionDependencies = {
  getPermissions: (
    userId: string,
  ) => Promise<readonly PermissionKey[]> | readonly PermissionKey[];
  getSession: (headers: Headers) => Promise<StaffSession | null>;
};

const AdminSessionDataSchema = z
  .object({
    user: z.object({ id: z.string(), email: z.string().email() }),
    permissions: z.array(z.string()),
  })
  .openapi("AdminSessionData");

const AdminSessionResponseSchema = z
  .object({
    data: AdminSessionDataSchema,
    error: z.null(),
    requestId: z.string(),
  })
  .openapi("AdminSessionResponse");

const UnauthenticatedResponseSchema = z
  .object({
    data: z.null(),
    error: z.object({
      code: z.literal("UNAUTHENTICATED"),
      message: z.string(),
    }),
    requestId: z.string(),
  })
  .openapi("UnauthenticatedResponse");

const ForbiddenResponseSchema = z
  .object({
    data: z.null(),
    error: z.object({
      code: z.literal("FORBIDDEN"),
      message: z.string(),
    }),
    requestId: z.string(),
  })
  .openapi("ForbiddenResponse");

const route = createRoute({
  method: "get",
  path: "/api/admin/session",
  operationId: "getAdminSession",
  tags: ["Administration"],
  responses: {
    200: {
      content: {
        "application/json": { schema: AdminSessionResponseSchema },
      },
      description: "Current authenticated staff session.",
    },
    401: {
      content: {
        "application/json": { schema: UnauthenticatedResponseSchema },
      },
      description: "No authenticated staff session.",
    },
    403: {
      content: {
        "application/json": { schema: ForbiddenResponseSchema },
      },
      description: "The authenticated user is not authorized for staff access.",
    },
  },
});

export function registerAdminSessionRoute(
  app: OpenAPIHono<AppEnv>,
  dependencies: AdminSessionDependencies,
) {
  app.openapi(route, async (context) => {
    const requestId = context.get("requestId");
    const session = await dependencies.getSession(context.req.raw.headers);

    if (!session) {
      return context.json(
        {
          data: null,
          error: {
            code: "UNAUTHENTICATED" as const,
            message: "Authentication required",
          },
          requestId,
        },
        401,
      );
    }

    const permissions = await dependencies.getPermissions(session.user.id);
    if (permissions.length === 0) {
      return context.json(
        {
          data: null,
          error: {
            code: "FORBIDDEN" as const,
            message: "Staff access required",
          },
          requestId,
        },
        403,
      );
    }

    return context.json(
      {
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          permissions: [...permissions],
        },
        error: null,
        requestId,
      },
      200,
    );
  });
}
