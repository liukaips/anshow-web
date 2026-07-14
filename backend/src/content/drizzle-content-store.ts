import { and, eq, isNull, lte } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import {
  services,
  serviceTranslations,
} from "../db/schema/content.js";
import type { PublicContentStore } from "./public-repository.js";

type ContentStoreOptions = {
  now?: () => Date;
};

export function createDrizzleContentStore(
  db: AppDatabase,
  options: ContentStoreOptions = {},
): PublicContentStore {
  const now = options.now ?? (() => new Date());

  return {
    async findPublishedService(locale, slug) {
      const rows = db
        .select({
          id: services.id,
          code: services.code,
          sortOrder: services.sortOrder,
          mediaId: services.mediaId,
          processStageId: services.processStageId,
          verifiedAt: services.verifiedAt,
          verificationSource: services.verificationSource,
          locale: serviceTranslations.locale,
          slug: serviceTranslations.slug,
          title: serviceTranslations.title,
          summary: serviceTranslations.summary,
          body: serviceTranslations.body,
          seoTitle: serviceTranslations.seoTitle,
          seoDescription: serviceTranslations.seoDescription,
          altText: serviceTranslations.altText,
          publishedAt: serviceTranslations.publishedAt,
        })
        .from(serviceTranslations)
        .innerJoin(services, eq(services.id, serviceTranslations.ownerId))
        .where(
          and(
            eq(serviceTranslations.locale, locale),
            eq(serviceTranslations.slug, slug),
            eq(serviceTranslations.status, "published"),
            lte(serviceTranslations.publishedAt, now()),
            isNull(services.archivedAt),
          ),
        )
        .limit(1)
        .all();

      const service = rows[0];
      if (!service?.publishedAt) return null;
      return { ...service, publishedAt: service.publishedAt };
    },
  };
}
