import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { AppEnv } from "./http/context.js";

const API_VERSION = "0.1.0";

const RequestIdSchema = z.string().openapi({
  example: "71ec11f9-4be5-4305-b164-a9c30ad6207c",
});

const ApiErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("ApiError");

const ErrorEnvelopeSchema = z
  .object({
    data: z.literal(null),
    error: ApiErrorSchema,
    requestId: RequestIdSchema,
  })
  .openapi("ErrorEnvelope");

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
    500: {
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
      description: "The API encountered an unexpected error.",
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

function errorEnvelope(requestId: string, code: string, message: string) {
  return {
    data: null,
    error: { code, message },
    requestId,
  };
}

function errorDiagnostic(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "NonErrorThrown",
    message: String(error),
  };
}

export function createApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          errorEnvelope(
            context.get("requestId"),
            "VALIDATION_ERROR",
            "The request is invalid.",
          ),
          400,
        );
      }
    },
  });

  app.use("*", async (context, next) => {
    const requestId = crypto.randomUUID();
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

  app.onError((error, context) => {
    const requestId = context.get("requestId");
    console.error({
      event: "http.unhandled_error",
      requestId,
      error: errorDiagnostic(error),
    });

    return context.json(
      errorEnvelope(
        requestId,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred.",
      ),
      500,
    );
  });

  app.notFound((context) => {
    return context.json(
      errorEnvelope(
        context.get("requestId"),
        "NOT_FOUND",
        "The requested resource was not found.",
      ),
      404,
    );
  });

  app.doc("/api/openapi.json", OPENAPI_DOCUMENT_CONFIG);

  return app;
}
