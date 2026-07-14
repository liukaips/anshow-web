import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import type { AppEnv } from "../http/context.js";

export type ReadinessCheck = () => void | Promise<void>;

const readyRoute = createRoute({
  method: "get",
  path: "/api/health/ready",
  operationId: "getHealthReady",
  tags: ["Health"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z
            .object({
              data: z.object({ status: z.literal("ready") }),
              error: z.literal(null),
              requestId: z.string(),
            })
            .openapi("HealthReadyResponse"),
        },
      },
      description: "The API and its SQLite database are ready.",
    },
    503: {
      content: {
        "application/json": {
          schema: z
            .object({
              data: z.literal(null),
              error: z.object({
                code: z.literal("NOT_READY"),
                message: z.string(),
              }),
              requestId: z.string(),
            })
            .openapi("HealthNotReadyResponse"),
        },
      },
      description: "The API database is not ready.",
    },
  },
});

export function createDatabaseReadinessCheck(
  database: AppDatabase,
): ReadinessCheck {
  return () => {
    database.get(sql`select 1`);
  };
}

export function registerHealthReadyRoute(
  app: OpenAPIHono<AppEnv>,
  checkReadiness: ReadinessCheck,
): void {
  app.openapi(readyRoute, async (context) => {
    const requestId = context.get("requestId");

    try {
      await checkReadiness();
      return context.json(
        { data: { status: "ready" }, error: null, requestId },
        200,
      );
    } catch (error) {
      console.error({
        event: "health.readiness_failed",
        requestId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "NonErrorThrown", message: String(error) },
      });
      return context.json(
        {
          data: null,
          error: {
            code: "NOT_READY" as const,
            message: "The service is not ready.",
          },
          requestId,
        },
        503,
      );
    }
  });
}
