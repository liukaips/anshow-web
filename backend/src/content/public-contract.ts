import { z } from "@hono/zod-openapi";

import {
  structuredContentBodySchema,
  type StructuredContentBody,
} from "./structured-body.js";
import {
  LOCALES,
  PUBLIC_COLLECTIONS,
  PROCESS_STAGE_IDS,
  type ProcessStageId,
} from "./types.js";

export const localeSchema = z.enum(LOCALES).openapi("PublicLocale");
export const collectionSchema = z
  .enum(PUBLIC_COLLECTIONS)
  .openapi("PublicCollection");

export const mediaSchema = z
  .object({
    alt: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    dominantColor: z.string(),
    mobileAvif: z.string().nullable(),
    avifSrcSet: z.string(),
    webpSrcSet: z.string(),
  })
  .openapi("PublicMedia");

export type PublicMedia = z.infer<typeof mediaSchema>;

export type PublicContentItem = {
  id: string;
  locale: z.infer<typeof localeSchema>;
  slug: string;
  title: string;
  summary: string;
  body: string;
  /** Existing content producers may omit this until their migration is complete. */
  structuredBody?: StructuredContentBody | null;
  seoTitle: string;
  seoDescription: string;
  altText: string;
  processStageId: ProcessStageId | null;
  alternates: Partial<Record<z.infer<typeof localeSchema>, string>>;
  media: PublicMedia | null;
};

export const publicItemSchema = (z
  .object({
    id: z.string(),
    locale: localeSchema,
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    body: z.string(),
    structuredBody: structuredContentBodySchema.nullable(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    altText: z.string(),
    processStageId: z.enum(PROCESS_STAGE_IDS).nullable(),
    alternates: z.partialRecord(localeSchema, z.string()),
    media: mediaSchema.nullable(),
  })
  .openapi("PublicContentItem") as z.ZodType<PublicContentItem>);

export const homeSchema = z
  .object({
    locale: localeSchema,
    headline: z.string(),
    slides: z.array(publicItemSchema),
    services: z.array(publicItemSchema),
    tradeLanes: z.array(publicItemSchema),
    cargoTypes: z.array(publicItemSchema),
    proof: z.array(publicItemSchema),
    verifiedTrust: z.array(publicItemSchema),
    certificates: z.array(publicItemSchema),
    cases: z.array(publicItemSchema),
    articles: z.array(publicItemSchema),
    channels: z.array(
      z.object({ id: z.string(), label: z.string(), href: z.string() }),
    ),
  })
  .openapi("PublicHome");

export const sitemapItemSchema = z
  .object({
    path: z.string(),
    updatedAt: z.string().datetime(),
    alternates: z.partialRecord(localeSchema, z.string()),
  })
  .openapi("PublicSitemapItem");

export const requestIdSchema = z.string().openapi({
  example: "71ec11f9-4be5-4305-b164-a9c30ad6207c",
});

export const apiErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("ApiError");

export const envelope = <T extends z.ZodType>(name: string, data: T) =>
  z
    .object({ data, error: z.literal(null), requestId: requestIdSchema })
    .openapi(name);

export const errorEnvelopeSchema = z
  .object({
    data: z.literal(null),
    error: apiErrorSchema,
    requestId: requestIdSchema,
  })
  .openapi("ErrorEnvelope");

export type PublicHome = z.infer<typeof homeSchema>;
export type PublicSitemapItem = z.infer<typeof sitemapItemSchema>;
