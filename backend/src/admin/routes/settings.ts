import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import {
  requirePermission,
  type PermissionMiddlewareDependencies,
} from "../../auth/permission-middleware.js";
import {
  envelope,
  errorEnvelopeSchema,
} from "../../content/public-contract.js";
import type { AppEnv } from "../../http/context.js";
import {
  CONTACT_CHANNEL_KINDS,
  siteSettingsSchema,
  type SettingsRepository,
} from "../repositories/settings-repository.js";

const SiteSettingsSchema = siteSettingsSchema.openapi("SiteSettings");

const ContactChannelSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    kind: z.enum(CONTACT_CHANNEL_KINDS),
    label: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(500),
    enabled: z.boolean(),
    sortOrder: z.number().int(),
  })
  .strict()
  .openapi("AdminContactChannel");

const SaveSiteSettingsInputSchema = siteSettingsSchema.openapi(
  "SaveSiteSettingsInput",
);
const SaveContactChannelsInputSchema = z
  .object({
    channels: z.array(ContactChannelSchema).max(50),
  })
  .strict()
  .refine(
    ({ channels }) =>
      new Set(channels.map((channel) => channel.id)).size === channels.length,
    { message: "Contact channel identifiers must be unique" },
  )
  .openapi("SaveContactChannelsInput");

const getSettingsRoute = createRoute({
  method: "get",
  path: "/api/admin/settings",
  operationId: "getAdminSettings",
  tags: ["Administration"],
  responses: {
    200: {
      description: "Allowlisted public site configuration.",
      content: {
        "application/json": {
          schema: envelope("AdminSettingsResponse", SiteSettingsSchema),
        },
      },
    },
    401: {
      description: "No authenticated staff session.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    403: {
      description: "The staff member cannot manage settings.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

const saveSettingsRoute = createRoute({
  method: "put",
  path: "/api/admin/settings",
  operationId: "updateAdminSettings",
  tags: ["Administration"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: SaveSiteSettingsInputSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Saved allowlisted public site configuration.",
      content: {
        "application/json": {
          schema: envelope("SaveAdminSettingsResponse", SiteSettingsSchema),
        },
      },
    },
    400: {
      description: "The settings input is invalid.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    401: {
      description: "No authenticated staff session.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    403: {
      description: "The staff member cannot manage settings.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

const getContactChannelsRoute = createRoute({
  method: "get",
  path: "/api/admin/contact-channels",
  operationId: "listAdminContactChannels",
  tags: ["Administration"],
  responses: {
    200: {
      description: "All configured contact channels, including disabled ones.",
      content: {
        "application/json": {
          schema: envelope(
            "AdminContactChannelsResponse",
            z.array(ContactChannelSchema),
          ),
        },
      },
    },
    401: {
      description: "No authenticated staff session.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    403: {
      description: "The staff member cannot manage settings.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

const saveContactChannelsRoute = createRoute({
  method: "put",
  path: "/api/admin/contact-channels",
  operationId: "replaceAdminContactChannels",
  tags: ["Administration"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: SaveContactChannelsInputSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Saved contact channels.",
      content: {
        "application/json": {
          schema: envelope(
            "SaveAdminContactChannelsResponse",
            z.array(ContactChannelSchema),
          ),
        },
      },
    },
    400: {
      description: "The contact channel input is invalid.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    401: {
      description: "No authenticated staff session.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
    403: {
      description: "The staff member cannot manage settings.",
      content: { "application/json": { schema: errorEnvelopeSchema } },
    },
  },
});

export type SettingsRouteDependencies = PermissionMiddlewareDependencies & {
  settingsRepository: SettingsRepository;
};

export function registerSettingsRoutes(
  app: OpenAPIHono<AppEnv>,
  dependencies: SettingsRouteDependencies,
): void {
  app.use(
    "/api/admin/settings",
    requirePermission("settings.manage", dependencies),
  );
  app.use(
    "/api/admin/contact-channels",
    requirePermission("settings.manage", dependencies),
  );

  app.openapi(getSettingsRoute, async (context) =>
    context.json(
      {
        data: await dependencies.settingsRepository.getSettings(),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    ),
  );

  app.openapi(saveSettingsRoute, async (context) => {
    const actor = context.get("actor");
    if (!actor) {
      throw new Error("Permission middleware did not provide an actor");
    }
    const settings = context.req.valid("json");

    return context.json(
      {
        data: await dependencies.settingsRepository.saveSettings(
          settings,
          actor.user.id,
        ),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.openapi(getContactChannelsRoute, async (context) =>
    context.json(
      {
        data: await dependencies.settingsRepository.listContactChannels(),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    ),
  );

  app.openapi(saveContactChannelsRoute, async (context) => {
    const actor = context.get("actor");
    if (!actor) {
      throw new Error("Permission middleware did not provide an actor");
    }
    const { channels } = context.req.valid("json");

    return context.json(
      {
        data: await dependencies.settingsRepository.saveContactChannels(
          channels,
          actor.user.id,
        ),
        error: null,
        requestId: context.get("requestId"),
      },
      200,
    );
  });
}
