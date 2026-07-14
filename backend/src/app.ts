import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { AppEnv } from "./http/context.js";

const API_VERSION = "0.1.0";

const RequestIdSchema = z.string().openapi({
  example: "71ec11f9-4be5-4305-b164-a9c30ad6207c",
});

const HealthStatusSchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("HealthStatus");

const HealthLiveResponseSchema = z
  .object({
    data: HealthStatusSchema,
    error: z.literal(null),
    requestId: RequestIdSchema,
  })
  .openapi("HealthLiveResponse");

const liveRoute = createRoute({
  method: "get",
  path: "/api/health/live",
  operationId: "getHealthLive",
  tags: ["Health"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: HealthLiveResponseSchema,
        },
      },
      description: "The API process is running.",
    },
  },
});

export const OPENAPI_DOCUMENT_CONFIG = {
  openapi: "3.0.0",
  info: {
    title: "AnShow API",
    version: API_VERSION,
  },
} as const;

function requestIdFromHeader(value: string | undefined): string {
  const requestId = value?.trim();
  return requestId || crypto.randomUUID();
}

export function createApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          {
            data: null,
            error: {
              code: "VALIDATION_ERROR",
              message: "The request is invalid.",
            },
            requestId: context.get("requestId"),
          },
          400,
        );
      }
    },
  });

  app.use("*", async (context, next) => {
    const requestId = requestIdFromHeader(context.req.header("x-request-id"));
    context.set("requestId", requestId);

    await next();

    context.header("x-request-id", requestId);
  });

  app.openapi(liveRoute, (context) => {
    return context.json(
      {
        data: { status: "ok" },
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.onError((_error, context) => {
    return context.json(
      {
        data: null,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
        requestId: context.get("requestId"),
      },
      500,
    );
  });

  app.doc("/api/openapi.json", OPENAPI_DOCUMENT_CONFIG);

  return app;
}
