import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const locales = ["en", "zh", "ru"] as const;
const publicationStatuses = ["draft", "scheduled", "published"] as const;
const processStages = [
  "route",
  "pickup",
  "customs",
  "transit",
  "delivery",
] as const;

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" });
const requiredCreatedAt = () =>
  timestamp("created_at")
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();
const requiredUpdatedAt = () =>
  timestamp("updated_at")
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull();

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  dominantColor: text("dominant_color").notNull(),
  focalX: real("focal_x").notNull().default(0.5),
  focalY: real("focal_y").notNull().default(0.5),
  createdAt: requiredCreatedAt(),
  replacedAt: timestamp("replaced_at"),
});

export const mediaAssetTranslations = sqliteTable(
  "media_asset_translations",
  {
    mediaId: text("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: locales }).notNull(),
    altText: text("alt_text").notNull(),
    updatedAt: requiredUpdatedAt(),
  },
  (table) => [primaryKey({ columns: [table.mediaId, table.locale] })],
);

export const mediaDerivatives = sqliteTable(
  "media_derivatives",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    format: text("format", { enum: ["avif", "webp"] }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: integer("byte_size").notNull(),
    url: text("url").notNull().unique(),
  },
  (table) => [
    uniqueIndex("media_derivatives_variant_unique").on(
      table.mediaId,
      table.format,
      table.width,
      table.height,
    ),
  ],
);

export const mediaUsage = sqliteTable(
  "media_usage",
  {
    mediaId: text("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.mediaId, table.entityType, table.entityId, table.field],
    }),
  ],
);

function localizedCollection(
  baseName: string,
  translationName: string,
  foreignKeyName: string,
) {
  const base = sqliteTable(baseName, {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    mediaId: text("media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    processStageId: text("process_stage_id", { enum: processStages }),
    archivedAt: timestamp("archived_at"),
    verifiedAt: timestamp("verified_at"),
    verificationSource: text("verification_source"),
    createdAt: requiredCreatedAt(),
    updatedAt: requiredUpdatedAt(),
  });

  const translations = sqliteTable(
    translationName,
    {
      ownerId: text(foreignKeyName)
        .notNull()
        .references(() => base.id, { onDelete: "cascade" }),
      locale: text("locale", { enum: locales }).notNull(),
      status: text("status", { enum: publicationStatuses })
        .notNull()
        .default("draft"),
      scheduledAt: timestamp("scheduled_at"),
      publishedAt: timestamp("published_at"),
      slug: text("slug").notNull(),
      title: text("title").notNull(),
      summary: text("summary").notNull(),
      body: text("body").notNull(),
      seoTitle: text("seo_title").notNull(),
      seoDescription: text("seo_description").notNull(),
      altText: text("alt_text").notNull(),
      updatedAt: requiredUpdatedAt(),
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.locale] }),
      uniqueIndex(`${translationName}_locale_slug_unique`).on(
        table.locale,
        table.slug,
      ),
    ],
  );

  return { base, translations };
}

const serviceTables = localizedCollection(
  "services",
  "service_translations",
  "service_id",
);
const heroSlideTables = localizedCollection(
  "hero_slides",
  "hero_slide_translations",
  "hero_slide_id",
);
const tradeLaneTables = localizedCollection(
  "trade_lanes",
  "trade_lane_translations",
  "trade_lane_id",
);
const cargoTypeTables = localizedCollection(
  "cargo_types",
  "cargo_type_translations",
  "cargo_type_id",
);
const caseStudyTables = localizedCollection(
  "case_studies",
  "case_study_translations",
  "case_study_id",
);
const articleTables = localizedCollection(
  "articles",
  "article_translations",
  "article_id",
);
const partnerTables = localizedCollection(
  "partners",
  "partner_translations",
  "partner_id",
);
const certificateTables = localizedCollection(
  "certificates",
  "certificate_translations",
  "certificate_id",
);
const proofMetricTables = localizedCollection(
  "proof_metrics",
  "proof_metric_translations",
  "proof_metric_id",
);
const pageTables = localizedCollection(
  "pages",
  "page_translations",
  "page_id",
);
const navigationItemTables = localizedCollection(
  "navigation_items",
  "navigation_item_translations",
  "navigation_item_id",
);

export const services = serviceTables.base;
export const serviceTranslations = serviceTables.translations;
export const heroSlides = heroSlideTables.base;
export const heroSlideTranslations = heroSlideTables.translations;
export const tradeLanes = tradeLaneTables.base;
export const tradeLaneTranslations = tradeLaneTables.translations;
export const cargoTypes = cargoTypeTables.base;
export const cargoTypeTranslations = cargoTypeTables.translations;
export const caseStudies = caseStudyTables.base;
export const caseStudyTranslations = caseStudyTables.translations;
export const articles = articleTables.base;
export const articleTranslations = articleTables.translations;
export const partners = partnerTables.base;
export const partnerTranslations = partnerTables.translations;
export const certificates = certificateTables.base;
export const certificateTranslations = certificateTables.translations;
export const proofMetrics = proofMetricTables.base;
export const proofMetricTranslations = proofMetricTables.translations;
export const pages = pageTables.base;
export const pageTranslations = pageTables.translations;
export const navigationItems = navigationItemTables.base;
export const navigationItemTranslations = navigationItemTables.translations;
