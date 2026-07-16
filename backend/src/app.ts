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
  registerMediaRoutes,
  type MediaRouteDependencies,
} from "./admin/routes/media.js";
import { registerStaffRoutes } from "./admin/routes/staff.js";
import type { StaffRepository } from "./admin/repositories/staff-repository.js";
import { registerAuditRoutes, type AuditRouteDependencies } from "./admin/routes/audit.js";
import { registerTranslationRoutes, type TranslationRouteDependencies } from "./admin/routes/translation.js";
import { registerPreviewRoutes, type PreviewRouteDependencies } from "./admin/routes/previews.js";
import { registerReviewRoutes, type ReviewRouteDependencies } from "./admin/routes/reviews.js";
import { registerPublicPreviewRoutes } from "./public/preview-routes.js";
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

function errorEnvelope(
  requestId: string,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return {
    data: null,
    error: { code, message, ...(fields ? { fields } : {}) },
    requestId,
  };
}

function validationFields(error: z.ZodError): Record<string, string[]> {
  const fieldErrors = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) => {
      const safeMessages = (messages ?? []).filter(
        (message): message is string => typeof message === "string",
      );
      return safeMessages.length > 0 ? [[field, safeMessages]] : [];
    }),
  );
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
    auditRepository: AuditRouteDependencies["auditRepository"];
    translationService: TranslationRouteDependencies["translationService"];
    previewService: PreviewRouteDependencies["previewService"];
    reviewRepository: ReviewRouteDependencies["reviewRepository"];
    mediaService: MediaRouteDependencies["mediaService"];
    checkReadiness: ReadinessCheck;
    handleAuthRequest: (request: Request) => Promise<Response>;
  publicContentRepository: PublicContentRepository;
    staffRepository: StaffRepository;
  };

const defaultDependencies: AppDependencies = {
  auditRepository: {
    list: () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
    detail: () => null,
  },
  translationService: {
    generate: async () => { throw new Error("Translation service is not configured"); },
    listJobs: () => [],
  },
  previewService: {
    createSnapshot: async () => { throw new Error("Preview service is not configured"); },
    readSnapshot: () => null,
    revoke: () => undefined,
    list: () => [],
  },
  reviewRepository: {
    list: () => [],
    submit: async () => { throw new Error("Review repository is not configured"); },
    approve: () => { throw new Error("Review repository is not configured"); },
    reject: () => { throw new Error("Review repository is not configured"); },
    workflow: () => undefined,
  },
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
    saveSettings: async (settings) => ({
      ...settings,
      backup: settings.backup
        ? { ...settings.backup, encryptionConfigured: false }
        : undefined,
    }),
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
    updateVerification: async () => {
      throw new Error("Content repository is not configured");
    },
    archive: async () => {
      throw new Error("Content repository is not configured");
    },
  },
  mediaService: {
    list: async () => [],
    get: async () => {
      throw new Error("Media service is not configured");
    },
    upload: async () => {
      throw new Error("Media service is not configured");
    },
    updateMetadata: async () => {
      throw new Error("Media service is not configured");
    },
    replace: async () => {
      throw new Error("Media service is not configured");
    },
    delete: async () => {
      throw new Error("Media service is not configured");
    },
    retryCleanup: async () => ({ attempted: 0, remaining: 0 }),
  },
  staffRepository: {
    list: () => [],
    get: () => null,
    listRoles: () => [],
    disable: () => undefined,
    enable: () => undefined,
    setRoles: () => undefined,
    deleteSessions: () => undefined,
  } as unknown as StaffRepository,
};

export function createApp(
  dependencies: Partial<AppDependencies> = {},
): OpenAPIHono<AppEnv> {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, context) => {
      if (!result.success) {
        const fields = validationFields(result.error);
        return context.json(
          errorEnvelope(
            context.get("requestId"),
            "VALIDATION_ERROR",
            "The request is invalid.",
            Object.keys(fields).length > 0 ? fields : undefined,
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
  registerTranslationRoutes(app, resolvedDependencies);
  registerPreviewRoutes(app, resolvedDependencies);
  registerReviewRoutes(app, resolvedDependencies);
  registerMediaRoutes(app, resolvedDependencies);
  registerStaffRoutes(app, resolvedDependencies.staffRepository, resolvedDependencies);
  registerAuditRoutes(app, resolvedDependencies);
  registerPublicContentRoutes(app, resolvedDependencies.publicContentRepository);
  registerPublicPreviewRoutes(app, resolvedDependencies.previewService);

  app.onError((error, context) => {
    const requestId = context.get("requestId");
    if (
      "status" in error &&
      error.status === 409 &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return context.json(
        errorEnvelope(requestId, error.code, error.message),
        409,
      );
    }
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
