import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  registerSettingsRoutes,
  type SettingsRouteDependencies,
} from "./admin/routes/settings.js";
import { DEFAULT_SITE_SETTINGS } from "./admin/repositories/settings-repository.js";
import {
  registerContentRoutes,
  type ContentRouteDependencies,
} from "./admin/routes/content.js";
import {
  errorEnvelopeSchema,
  requestIdSchema,
} from "./content/public-contract.js";
import type { PublicContentRepository } from "./content/public-repository.js";
import type { AppEnv } from "./http/context.js";
import { registerPublicContentRoutes } from "./public/content-routes.js";
import {
  registerAdminSessionRoute,
  type AdminSessionDependencies,
} from "./routes/admin-session.js";
import {
  registerHealthReadyRoute,
  type ReadinessCheck,
} from "./routes/health-ready.js";

const API_VERSION = "0.1.0";

const HealthStatusSchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("HealthStatus");

const HealthLiveResponseSchema = z
  .object({
    data: HealthStatusSchema,
    error: z.literal(null),
    requestId: requestIdSchema,
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
          schema: errorEnvelopeSchema,
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

export type AppDependencies = AdminSessionDependencies &
  SettingsRouteDependencies &
  ContentRouteDependencies & {
    checkReadiness: ReadinessCheck;
    handleAuthRequest: (request: Request) => Promise<Response>;
    publicContentRepository: PublicContentRepository;
  };

const defaultDependencies: AppDependencies = {
  checkReadiness: () => {
    throw new Error("Readiness check is not configured");
  },
  getPermissions: () => [],
  getSession: async () => null,
  handleAuthRequest: async () =>
    Response.json(
      { code: "AUTH_NOT_CONFIGURED", message: "Authentication unavailable" },
      { status: 503 },
    ),
  publicContentRepository: {
    getHome: async (locale) => ({
      locale,
      headline: "",
      slides: [],
      services: [],
      tradeLanes: [],
      cargoTypes: [],
      proof: [],
      verifiedTrust: [],
      certificates: [],
      cases: [],
      articles: [],
      channels: [],
    }),
    listCollection: async () => [],
    getBySlug: async () => null,
    listSitemap: async () => [],
  },
  settingsRepository: {
    getSettings: async () => structuredClone(DEFAULT_SITE_SETTINGS),
    saveSettings: async (settings) => settings,
    listContactChannels: async () => [],
    saveContactChannels: async (channels) => [...channels],
  },
  contentRepository: {
    list: async () => [],
    get: async () => {
      throw new Error("Content repository is not configured");
    },
    create: async () => {
      throw new Error("Content repository is not configured");
    },
    saveDraft: async () => {
      throw new Error("Content repository is not configured");
    },
    publish: async () => {
      throw new Error("Content repository is not configured");
    },
    schedule: async () => {
      throw new Error("Content repository is not configured");
    },
    archive: async () => {
      throw new Error("Content repository is not configured");
    },
  },
};

export function createApp(
  dependencies: Partial<AppDependencies> = {},
): OpenAPIHono<AppEnv> {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
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

  registerHealthReadyRoute(app, resolvedDependencies.checkReadiness);

  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    resolvedDependencies.handleAuthRequest(context.req.raw),
  );
  registerAdminSessionRoute(app, resolvedDependencies);
  registerSettingsRoutes(app, resolvedDependencies);
  registerContentRoutes(app, resolvedDependencies);
  registerPublicContentRoutes(app, resolvedDependencies.publicContentRepository);

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
