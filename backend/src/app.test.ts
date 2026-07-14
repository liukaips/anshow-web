import { createRoute, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { createApp, OPENAPI_DOCUMENT_CONFIG } from "./app.js";

describe("GET /api/health/live", () => {
  it("returns a stable success envelope and request identifier", async () => {
    const response = await createApp().request("/api/health/live");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toEqual(expect.any(String));
    expect(await response.json()).toEqual({
      data: { status: "ok" },
      error: null,
      requestId: expect.any(String),
    });
  });

  it("documents the success error field as a literal null", () => {
    const document = createApp().getOpenAPIDocument(OPENAPI_DOCUMENT_CONFIG);
    const responseSchema = document.components?.schemas?.HealthLiveResponse;

    expect(responseSchema).toMatchObject({
      properties: {
        error: {
          enum: [null],
          nullable: true,
        },
      },
    });
  });

  it("preserves a caller-provided request identifier", async () => {
    const response = await createApp().request("/api/health/live", {
      headers: { "x-request-id": "upstream-request-id" },
    });

    expect(response.headers.get("x-request-id")).toBe("upstream-request-id");
    expect(await response.json()).toMatchObject({
      requestId: "upstream-request-id",
    });
  });
});

describe("API error envelopes", () => {
  it("returns a stable validation error without exposing validator details", async () => {
    const app = createApp();
    const route = createRoute({
      method: "get",
      path: "/__test/validated",
      request: {
        query: z.object({ count: z.coerce.number().int().positive() }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ data: z.object({ accepted: z.literal(true) }) }),
            },
          },
          description: "Test-only validation route.",
        },
      },
    });

    app.openapi(route, (context) => {
      context.req.valid("query");
      return context.json({ data: { accepted: true as const } }, 200);
    });

    const response = await app.request("/__test/validated?count=0");
    const body = await response.json();
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(400);
    expect(requestId).toEqual(expect.any(String));
    expect(body).toEqual({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
      },
      requestId,
    });
  });

  it("returns a safe envelope for unexpected errors", async () => {
    const app = createApp();
    app.get("/__test/error", () => {
      throw new Error("sensitive implementation detail");
    });

    const response = await app.request("/__test/error");
    const body = await response.json();
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(500);
    expect(requestId).toEqual(expect.any(String));
    expect(body).toEqual({
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
      requestId,
    });
    expect(JSON.stringify(body)).not.toContain("sensitive implementation detail");
  });
});
