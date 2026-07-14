import type { Locale, PublicService } from "./types.js";

export interface PublicContentStore {
  findPublishedService(
    locale: Locale,
    slug: string,
  ): Promise<PublicService | null>;
}

export function createPublicRepository(store: PublicContentStore) {
  return {
    getServiceBySlug(locale: Locale, slug: string) {
      return store.findPublishedService(locale, slug);
    },
  };
}
