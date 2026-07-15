import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../http/context.js";
import { can, type PermissionKey } from "./permissions.js";

export type StaffSession = {
  user: {
    email: string;
    id: string;
  };
};

export type PermissionMiddlewareDependencies = {
  getPermissions: (
    userId: string,
  ) => Promise<readonly PermissionKey[]> | readonly PermissionKey[];
  getSession: (headers: Headers) => Promise<StaffSession | null>;
};

export function requirePermission(
  required: PermissionKey,
  dependencies: PermissionMiddlewareDependencies,
) {
  return createMiddleware<AppEnv>(async (context, next) => {
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
    if (!can(permissions, required)) {
      return context.json(
        {
          data: null,
          error: {
            code: "FORBIDDEN" as const,
            message: "Permission denied",
          },
          requestId,
        },
        403,
      );
    }

    context.set("actor", {
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      permissions: [...permissions],
    });
    await next();
  });
}
