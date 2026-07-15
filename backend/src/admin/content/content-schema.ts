import { z } from "@hono/zod-openapi";

export const ADMIN_CONTENT_COLLECTIONS = [
  "pages",
  "hero-slides",
  "services",
  "trade-lanes",
  "cargo-types",
  "case-studies",
  "articles",
  "partners",
  "certificates",
  "proof-metrics",
  "navigation-items",
] as const;

export const ADMIN_CONTENT_LOCALES = ["en", "zh", "ru"] as const;
export const ADMIN_PUBLICATION_STATES = [
  "draft",
  "scheduled",
  "published",
] as const;

export type AdminContentCollection =
  (typeof ADMIN_CONTENT_COLLECTIONS)[number];
export type AdminContentLocale = (typeof ADMIN_CONTENT_LOCALES)[number];
export type AdminPublicationState =
  (typeof ADMIN_PUBLICATION_STATES)[number];

export const adminContentCollectionSchema = z.enum(ADMIN_CONTENT_COLLECTIONS);
export const adminContentLocaleSchema = z.enum(ADMIN_CONTENT_LOCALES);
export const adminPublicationStateSchema = z.enum(ADMIN_PUBLICATION_STATES);

const draftText = (maximum: number) => z.string().trim().max(maximum);
const draftSlugSchema = draftText(200).refine(
  (slug) => slug === "" || /^[a-z0-9-]+$/.test(slug),
  "Slug must use lowercase letters, numbers, and hyphens",
);

export const translationInputSchema = z
  .object({
    title: draftText(300),
    slug: draftSlugSchema,
    summary: draftText(2_000),
    body: draftText(100_000),
    seoTitle: draftText(60),
    seoDescription: draftText(160),
    altText: draftText(500),
  })
  .strict();

export type TranslationInput = z.infer<typeof translationInputSchema>;

export const publishableTranslationSchema = translationInputSchema.extend({
  title: draftText(300).min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  summary: draftText(2_000).min(1),
  body: draftText(100_000).min(1),
  seoTitle: draftText(60).min(1),
  seoDescription: draftText(160).min(1),
  altText: draftText(500).min(1),
});

export const createContentInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9-]+$/),
    sortOrder: z.number().int().optional(),
    verified: z.boolean().optional(),
    verificationSource: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

export const scheduleTranslationInputSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true }),
  })
  .strict();

export function canPublishTranslation(input: unknown): boolean {
  return publishableTranslationSchema.safeParse(input).success;
}
