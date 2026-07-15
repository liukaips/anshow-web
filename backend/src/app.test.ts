import { createRoute, z } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp, OPENAPI_DOCUMENT_CONFIG } from "./app.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("generates a request identifier instead of trusting caller input", async () => {
    const response = await createApp().request("/api/health/live", {
      headers: { "x-request-id": "upstream-request-id" },
    });
    const body = await response.json();
    const requestId = response.headers.get("x-request-id");

    expect(requestId).not.toBe("upstream-request-id");
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(body).toMatchObject({
      requestId,
    });
  });

  it("documents a reusable server-error envelope without a validation response", () => {
    const document = createApp().getOpenAPIDocument(OPENAPI_DOCUMENT_CONFIG);
    const operation = document.paths["/api/health/live"]?.get;

    expect(operation?.responses).not.toHaveProperty("400");
    expect(operation?.responses).toMatchObject({
      500: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
          },
        },
      },
    });
    expect(document.components?.schemas).toMatchObject({
      ApiError: {
        required: ["code", "message"],
        properties: {
          fields: {
            additionalProperties: {
              items: { type: "string" },
              type: "array",
            },
            type: "object",
          },
        },
      },
      ErrorEnvelope: {
        properties: {
          data: { enum: [null], nullable: true },
          error: { $ref: "#/components/schemas/ApiError" },
          requestId: { type: "string" },
        },
      },
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
        fields: { count: [expect.any(String)] },
        message: "The request is invalid.",
      },
      requestId,
    });
  });

  it("returns a safe envelope for unexpected errors", async () => {
    const app = createApp();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(errorLog).toHaveBeenCalledOnce();
    expect(errorLog).toHaveBeenCalledWith({
      event: "http.unhandled_error",
      requestId,
      error: expect.objectContaining({
        message: "sensitive implementation detail",
        name: "Error",
        stack: expect.any(String),
      }),
    });
  });

  it.each(["/missing", "/api/missing"])(
    "returns a JSON error envelope for unknown path %s",
    async (path) => {
      const response = await createApp().request(path);
      const body = await response.json();
      const requestId = response.headers.get("x-request-id");

      expect(response.status).toBe(404);
      expect(requestId).toEqual(expect.any(String));
      expect(body).toEqual({
        data: null,
        error: {
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        },
        requestId,
      });
    },
  );
});
