import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";

describe("GET /api/admin/session", () => {
  it("returns the shared request identifier when unauthenticated", async () => {
    const response = await createApp().request("/api/admin/session");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      data: null,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
      requestId,
    });
  });

  it("returns a minimal staff identity and deduplicated permissions", async () => {
    const response = await createApp({
      getSession: async () => ({
        user: { id: "user-1", email: "staff@anshow.example" },
      }),
      getPermissions: () => ["content.read", "content.publish"],
    }).request("/api/admin/session");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        user: { id: "user-1", email: "staff@anshow.example" },
        permissions: ["content.read", "content.publish"],
      },
      error: null,
      requestId,
    });
  });

  it("rejects an authenticated user without staff permissions", async () => {
    const response = await createApp({
      getSession: async () => ({
        user: { id: "user-2", email: "visitor@anshow.example" },
      }),
      getPermissions: () => [],
    }).request("/api/admin/session");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "Staff access required",
      },
      requestId,
    });
  });
});
