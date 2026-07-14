import type {
  PublicContentItem,
  PublicHome,
  PublicSitemapItem,
} from "./public-contract.js";
import type { Locale, PublicCollection } from "./types.js";

export interface PublicContentRepository {
  getHome(locale: Locale): Promise<PublicHome>;
  listCollection(
    collection: PublicCollection,
    locale: Locale,
  ): Promise<PublicContentItem[]>;
  getBySlug(
    collection: PublicCollection,
    locale: Locale,
    slug: string,
  ): Promise<PublicContentItem | null>;
  listSitemap(): Promise<PublicSitemapItem[]>;
}

export type PublicContentStore = PublicContentRepository;

export function createPublicRepository(
  store: PublicContentStore,
): PublicContentRepository {
  return {
    getHome: (locale) => store.getHome(locale),
    listCollection: (collection, locale) =>
      store.listCollection(collection, locale),
    getBySlug: (collection, locale, slug) =>
      store.getBySlug(collection, locale, slug),
    listSitemap: () => store.listSitemap(),
  };
}
