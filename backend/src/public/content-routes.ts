import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  collectionSchema,
  envelope,
  errorEnvelopeSchema,
  homeSchema,
  localeSchema,
  publicItemSchema,
  sitemapItemSchema,
} from "../content/public-contract.js";
import type { PublicContentRepository } from "../content/public-repository.js";
import type { AppEnv } from "../http/context.js";

const homeRoute = createRoute({
  method: "get",
  path: "/api/public/content/home/{locale}",
  operationId: "getPublicHome",
  tags: ["Public content"],
  request: { params: z.object({ locale: localeSchema }) },
  responses: {
    200: {
      description: "Published homepage content for one locale.",
      content: {
        "application/json": {
          schema: envelope("PublicHomeEnvelope", homeSchema),
        },
      },
    },
    400: {
      description: "Invalid locale.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

const sitemapRoute = createRoute({
  method: "get",
  path: "/api/public/content/sitemap",
  operationId: "listPublishedUrls",
  tags: ["Public content"],
  responses: {
    200: {
      description: "Published locale URLs and their actual alternates.",
      content: {
        "application/json": {
          schema: envelope(
            "PublicSitemapEnvelope",
            z.array(sitemapItemSchema),
          ),
        },
      },
    },
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/api/public/content/{collection}/{locale}",
  operationId: "listPublicContent",
  tags: ["Public content"],
  request: {
    params: z.object({ collection: collectionSchema, locale: localeSchema }),
  },
  responses: {
    200: {
      description: "Published items in one collection and locale.",
      content: {
        "application/json": {
          schema: envelope(
            "PublicCollectionEnvelope",
            z.array(publicItemSchema),
          ),
        },
      },
    },
    400: {
      description: "Invalid collection or locale.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/public/content/{collection}/{locale}/{slug}",
  operationId: "getPublicContent",
  tags: ["Public content"],
  request: {
    params: z.object({
      collection: collectionSchema,
      locale: localeSchema,
      slug: z.string().min(1).max(160),
    }),
  },
  responses: {
    200: {
      description: "Published item in the requested locale.",
      content: {
        "application/json": {
          schema: envelope("PublicItemEnvelope", publicItemSchema),
        },
      },
    },
    400: {
      description: "Invalid collection, locale, or slug.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    404: {
      description: "No published item exists in the requested locale.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

type PublicContentApp = OpenAPIHono<AppEnv>;

export function registerPublicContentRoutes(
  app: PublicContentApp,
  repository: PublicContentRepository,
): void {
  app.openapi(homeRoute, async (context) => {
    const { locale } = context.req.valid("param");
    return context.json(
      {
        data: await repository.getHome(locale),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.openapi(sitemapRoute, async (context) =>
    context.json(
      {
        data: await repository.listSitemap(),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    ),
  );

  app.openapi(listRoute, async (context) => {
    const { collection, locale } = context.req.valid("param");
    return context.json(
      {
        data: await repository.listCollection(collection, locale),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.openapi(detailRoute, async (context) => {
    const { collection, locale, slug } = context.req.valid("param");
    const item = await repository.getBySlug(collection, locale, slug);

    if (!item) {
      return context.json(
        {
          data: null,
          error: {
            code: "CONTENT_NOT_FOUND",
            message:
              "Published content was not found in the requested locale.",
          },
          requestId: context.get("requestId"),
        },
        404,
      );
    }

    return context.json(
      {
        data: item,
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });
}

export function createPublicContentRoutes({
  repository,
}: {
  repository: PublicContentRepository;
}): PublicContentApp {
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
    const requestId = context.get("requestId") ?? crypto.randomUUID();
    context.set("requestId", requestId);
    await next();
    context.header("x-request-id", requestId);
  });
  registerPublicContentRoutes(app, repository);
  return app;
}
