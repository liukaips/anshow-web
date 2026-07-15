import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../http/context.js";
import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "./permission-middleware.js";

function createPermissionApp(
  dependencies: PermissionMiddlewareDependencies,
) {
  const handler = vi.fn((context) =>
    context.json({ data: context.get("actor"), error: null }),
  );
  const app = new Hono<AppEnv>();

  app.use("*", async (context, next) => {
    context.set("requestId", "request-test-1");
    await next();
  });
  app.get(
    "/protected",
    requirePermission("content.write", dependencies),
    handler,
  );

  return { app, handler };
}

describe("requirePermission", () => {
  it("returns an unauthenticated envelope before the handler runs", async () => {
    const { app, handler } = createPermissionApp({
      getPermissions: () => [],
      getSession: async () => null,
    });

    const response = await app.request("/protected");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      data: null,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
      requestId: "request-test-1",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns forbidden before the handler runs when permission is absent", async () => {
    const { app, handler } = createPermissionApp({
      getPermissions: () => ["content.read"],
      getSession: async () => ({
        user: { id: "user-1", email: "editor@anshow.example" },
      }),
    });

    const response = await app.request("/protected");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      data: null,
      error: { code: "FORBIDDEN", message: "Permission denied" },
      requestId: "request-test-1",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sets the authenticated actor before the protected handler runs", async () => {
    const { app, handler } = createPermissionApp({
      getPermissions: () => ["content.read", "content.write"],
      getSession: async () => ({
        user: { id: "user-1", email: "editor@anshow.example" },
      }),
    });

    const response = await app.request("/protected");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        user: { id: "user-1", email: "editor@anshow.example" },
        permissions: ["content.read", "content.write"],
      },
      error: null,
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
