import { z } from "@hono/zod-openapi";

export const paragraphSectionSchema = z
  .object({
    type: z.literal("paragraph"),
    text: z.string().max(5_000),
  })
  .strict();

export type ParagraphSection = z.infer<typeof paragraphSectionSchema>;

export const factListItemSchema = z
  .object({
    key: z.string().max(80),
    label: z.string().max(120),
    value: z.string().max(120),
    unit: z.string().max(40).optional(),
  })
  .strict();

export type FactListItem = z.infer<typeof factListItemSchema>;

export const factListSectionSchema = z
  .object({
    type: z.literal("fact-list"),
    items: z.array(factListItemSchema),
  })
  .strict();

export type FactListSection = z.infer<typeof factListSectionSchema>;

export const processStepSchema = z
  .object({
    title: z.string().max(120),
    text: z.string().max(1_000),
  })
  .strict();

export type ProcessStep = z.infer<typeof processStepSchema>;

export const processSectionSchema = z
  .object({
    type: z.literal("process"),
    steps: z.array(processStepSchema).min(1).max(8),
  })
  .strict();

export type ProcessSection = z.infer<typeof processSectionSchema>;

export const bulletListSectionSchema = z
  .object({
    type: z.literal("bullet-list"),
    title: z.string().max(160).optional(),
    items: z.array(z.string().max(500)).min(1).max(16),
  })
  .strict();

export type BulletListSection = z.infer<typeof bulletListSectionSchema>;

export const calloutSectionSchema = z
  .object({
    type: z.literal("callout"),
    title: z.string().max(160),
    text: z.string().max(1_500),
  })
  .strict();

export type CalloutSection = z.infer<typeof calloutSectionSchema>;

export const quoteCtaSectionSchema = z
  .object({
    type: z.literal("quote-cta"),
    title: z.string().max(160),
    text: z.string().max(800),
  })
  .strict();

export type QuoteCtaSection = z.infer<typeof quoteCtaSectionSchema>;

export const structuredContentSectionSchema = z.discriminatedUnion("type", [
  paragraphSectionSchema,
  factListSectionSchema,
  processSectionSchema,
  bulletListSectionSchema,
  calloutSectionSchema,
  quoteCtaSectionSchema,
]);

export type StructuredContentSection = z.infer<
  typeof structuredContentSectionSchema
>;

export const structuredContentBodySchema = z
  .object({
    version: z.literal(1),
    sections: z.array(structuredContentSectionSchema).min(1).max(24),
  })
  .strict();

export type StructuredContentBody = z.infer<
  typeof structuredContentBodySchema
>;

export type ParsedContentBody =
  | { kind: "legacy-text"; text: string }
  | { kind: "structured"; value: StructuredContentBody };

export function parseContentBody(body: string): ParsedContentBody {
  try {
    const parsed = structuredContentBodySchema.safeParse(JSON.parse(body));
    if (parsed.success) return { kind: "structured", value: parsed.data };
  } catch {
    // Plain editorial text is intentionally retained without interpretation.
  }

  return { kind: "legacy-text", text: body };
}
