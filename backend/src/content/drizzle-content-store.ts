import { and, asc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import type { AppDatabase } from "../db/client.js";
import {
  articles,
  articleTranslations,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  certificates,
  certificateTranslations,
  heroSlides,
  heroSlideTranslations,
  pages,
  pageTranslations,
  partners,
  partnerTranslations,
  proofMetrics,
  proofMetricTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/content.js";
import type { PublicContentItem } from "./public-contract.js";
import type { PublicContentStore } from "./public-repository.js";
import { LOCALES, type Locale, type PublicCollection } from "./types.js";

type ContentStoreOptions = {
  now?: () => Date;
};

type BaseTable =
  | typeof services
  | typeof tradeLanes
  | typeof cargoTypes
  | typeof articles
  | typeof caseStudies
  | typeof pages
  | typeof heroSlides
  | typeof proofMetrics
  | typeof partners
  | typeof certificates;

type TranslationTable =
  | typeof serviceTranslations
  | typeof tradeLaneTranslations
  | typeof cargoTypeTranslations
  | typeof articleTranslations
  | typeof caseStudyTranslations
  | typeof pageTranslations
  | typeof heroSlideTranslations
  | typeof proofMetricTranslations
  | typeof partnerTranslations
  | typeof certificateTranslations;

type CollectionConfig = {
  base: BaseTable;
  translations: TranslationTable;
  path: (locale: Locale, slug: string, code: string) => string | undefined;
  requiresVerification?: boolean;
};

type PublishedRow = {
  id: string;
  code: string;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  altText: string;
  processStageId: PublicContentItem["processStageId"];
  updatedAt: Date;
  alternateLocale: Locale | null;
  alternateSlug: string | null;
};

type PublishedContent = {
  item: PublicContentItem;
  code: string;
  updatedAt: Date;
};

const STATIC_PAGE_CODES = [
  "about",
  "network",
  "contact",
  "privacy",
  "terms",
  "cookies",
] as const;
const staticPageCodes = new Set<string>(STATIC_PAGE_CODES);
const indexedCollections = [
  "services",
  "trade-lanes",
  "special-cargo",
  "insights",
  "case-studies",
] as const satisfies readonly Exclude<PublicCollection, "pages">[];

const encodeSegment = (value: string) => encodeURIComponent(value);

const collectionPath = (collection: Exclude<PublicCollection, "pages">) =>
  (locale: Locale, slug: string) =>
    `/${locale}/${collection}/${encodeSegment(slug)}`;

const pagePath = (locale: Locale, _slug: string, code: string) =>
  staticPageCodes.has(code) ? `/${locale}/${encodeSegment(code)}` : undefined;
const noPath = () => undefined;

const publicCollections: Record<PublicCollection, CollectionConfig> = {
  services: {
    base: services,
    translations: serviceTranslations,
    path: collectionPath("services"),
  },
  "trade-lanes": {
    base: tradeLanes,
    translations: tradeLaneTranslations,
    path: collectionPath("trade-lanes"),
  },
  "special-cargo": {
    base: cargoTypes,
    translations: cargoTypeTranslations,
    path: collectionPath("special-cargo"),
  },
  insights: {
    base: articles,
    translations: articleTranslations,
    path: collectionPath("insights"),
  },
  "case-studies": {
    base: caseStudies,
    translations: caseStudyTranslations,
    path: collectionPath("case-studies"),
  },
  pages: { base: pages, translations: pageTranslations, path: pagePath },
};

export function createDrizzleContentStore(
  db: AppDatabase,
  options: ContentStoreOptions = {},
): PublicContentStore {
  const now = options.now ?? (() => new Date());

  async function readPublished(
    config: CollectionConfig,
    filters: { locale?: Locale; slug?: string } = {},
  ): Promise<PublishedContent[]> {
    const alternateTranslations = alias(
      config.translations,
      "published_alternates",
    );
    const currentFilters = [
      eq(config.translations.status, "published"),
      lte(config.translations.publishedAt, now()),
      isNull(config.base.archivedAt),
    ];

    if (filters.locale) {
      currentFilters.push(eq(config.translations.locale, filters.locale));
    }
    if (filters.slug) {
      currentFilters.push(eq(config.translations.slug, filters.slug));
    }
    if (config.requiresVerification) {
      currentFilters.push(
        isNotNull(config.base.verifiedAt),
        isNotNull(config.base.verificationSource),
      );
    }

    const rows: PublishedRow[] = await db
      .select({
        id: config.base.id,
        code: config.base.code,
        locale: config.translations.locale,
        slug: config.translations.slug,
        title: config.translations.title,
        summary: config.translations.summary,
        body: config.translations.body,
        seoTitle: config.translations.seoTitle,
        seoDescription: config.translations.seoDescription,
        altText: config.translations.altText,
        processStageId: config.base.processStageId,
        updatedAt: config.translations.updatedAt,
        alternateLocale: alternateTranslations.locale,
        alternateSlug: alternateTranslations.slug,
      })
      .from(config.translations)
      .innerJoin(config.base, eq(config.base.id, config.translations.ownerId))
      .leftJoin(
        alternateTranslations,
        and(
          eq(alternateTranslations.ownerId, config.base.id),
          eq(alternateTranslations.status, "published"),
          lte(alternateTranslations.publishedAt, now()),
        ),
      )
      .where(and(...currentFilters))
      .orderBy(
        asc(config.base.sortOrder),
        asc(config.translations.locale),
        asc(alternateTranslations.locale),
      );

    const items = new Map<string, PublishedContent>();

    for (const row of rows) {
      const key = `${row.id}:${row.locale}`;
      let content = items.get(key);
      if (!content) {
        content = {
          item: {
            id: row.id,
            locale: row.locale,
            slug: row.slug,
            title: row.title,
            summary: row.summary,
            body: row.body,
            seoTitle: row.seoTitle,
            seoDescription: row.seoDescription,
            altText: row.altText,
            processStageId: row.processStageId,
            alternates: {},
            media: null,
          },
          code: row.code,
          updatedAt: row.updatedAt,
        };
        items.set(key, content);
      }

      if (row.alternateLocale && row.alternateSlug) {
        const path = config.path(
          row.alternateLocale,
          row.alternateSlug,
          row.code,
        );
        if (path) content.item.alternates[row.alternateLocale] = path;
      }
    }

    return [...items.values()];
  }

  const homeCollection = (
    base: BaseTable,
    translations: TranslationTable,
    locale: Locale,
    path: CollectionConfig["path"] = noPath,
  ) => readPublished({ base, translations, path }, { locale });

  const verifiedHomeCollection = (
    base: BaseTable,
    translations: TranslationTable,
    locale: Locale,
  ) =>
    readPublished(
      { base, translations, path: noPath, requiresVerification: true },
      { locale },
    );

  const publicItems = (content: PublishedContent[]) =>
    content.map(({ item }) => item);

  const newestDate = (
    content: PublishedContent[],
    fallback?: Date,
  ): Date | undefined => {
    const latest = content.reduce<Date | undefined>(
      (latest, entry) =>
        !latest || entry.updatedAt > latest ? entry.updatedAt : latest,
      undefined,
    );
    return latest ?? fallback;
  };

  const staticAlternates = (suffix = "") =>
    Object.fromEntries(
      LOCALES.map((locale) => [locale, `/${locale}${suffix}`]),
    ) as Partial<Record<Locale, string>>;

  return {
    async getHome(locale) {
      const [
        slides,
        homeServices,
        homeTradeLanes,
        homeCargoTypes,
        proof,
        partnersTrust,
        certificatesTrust,
        cases,
        homeArticles,
      ] = await Promise.all([
        homeCollection(heroSlides, heroSlideTranslations, locale),
        readPublished(publicCollections.services, { locale }),
        readPublished(publicCollections["trade-lanes"], { locale }),
        readPublished(publicCollections["special-cargo"], { locale }),
        verifiedHomeCollection(proofMetrics, proofMetricTranslations, locale),
        verifiedHomeCollection(partners, partnerTranslations, locale),
        verifiedHomeCollection(
          certificates,
          certificateTranslations,
          locale,
        ),
        readPublished(publicCollections["case-studies"], { locale }),
        readPublished(publicCollections.insights, { locale }),
      ]);

      return {
        locale,
        headline: slides[0]?.item.title ?? "",
        slides: publicItems(slides),
        services: publicItems(homeServices),
        tradeLanes: publicItems(homeTradeLanes),
        cargoTypes: publicItems(homeCargoTypes),
        proof: publicItems(proof),
        verifiedTrust: publicItems([...partnersTrust, ...certificatesTrust]),
        cases: publicItems(cases),
        articles: publicItems(homeArticles),
        channels: [],
      };
    },

    async listCollection(collection, locale) {
      return publicItems(
        await readPublished(publicCollections[collection], { locale }),
      );
    },

    async getBySlug(collection, locale, slug) {
      const items = await readPublished(publicCollections[collection], {
        locale,
        slug,
      });
      return items[0]?.item ?? null;
    },

    async listSitemap() {
      const collectionEntries = Object.entries(publicCollections) as Array<
        [PublicCollection, CollectionConfig]
      >;
      const collectionContent = await Promise.all(
        collectionEntries.map(async ([collection, config]) => ({
          collection,
          config,
          content: await readPublished(config),
        })),
      );
      const allContent = collectionContent.flatMap(({ content }) => content);
      const globalUpdatedAt = newestDate(allContent) ?? new Date(0);
      const localeUpdatedAt = Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          newestDate(
            allContent.filter((entry) => entry.item.locale === locale),
            globalUpdatedAt,
          ) ?? globalUpdatedAt,
        ]),
      ) as Record<Locale, Date>;

      const roots = LOCALES.map((locale) => ({
        path: `/${locale}`,
        updatedAt: localeUpdatedAt[locale].toISOString(),
        alternates: staticAlternates(),
      }));

      const indexes = indexedCollections.flatMap((collection) => {
        const entries =
          collectionContent.find((entry) => entry.collection === collection)
            ?.content ?? [];
        return LOCALES.map((locale) => ({
          path: `/${locale}/${collection}`,
          updatedAt: (
            newestDate(
              entries.filter((entry) => entry.item.locale === locale),
              localeUpdatedAt[locale],
            ) ?? localeUpdatedAt[locale]
          ).toISOString(),
          alternates: staticAlternates(`/${collection}`),
        }));
      });

      const details = collectionContent.flatMap(({ config, content }) =>
        content.flatMap(({ item, code, updatedAt }) => {
          const path = config.path(item.locale, item.slug, code);
          return path
            ? [
                {
                  path,
                  updatedAt: updatedAt.toISOString(),
                  alternates: item.alternates,
                },
              ]
            : [];
        }),
      );

      return [...roots, ...indexes, ...details];
    },
  };
}
