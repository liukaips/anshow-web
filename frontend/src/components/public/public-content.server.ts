import "server-only";

import { cache } from "react";

import {
  getPublicHome,
  getPublicContent,
  listPublicContent,
} from "../../api/public-content.server";
import type { components } from "../../generated/api";
import type { SupportedLocale } from "../../lib/app-config";

import type { FixedPageCode, PublicCollection } from "./public-copy";

export type PublicItem = components["schemas"]["PublicContentItem"];

export function findFixedPage(
  pages: readonly PublicItem[],
  locale: SupportedLocale,
  code: FixedPageCode,
): PublicItem | undefined {
  const route = `/${locale}/${code}`;
  return pages.find((page) => page.alternates[locale] === route);
}

export const loadCollection = cache(
  (collection: PublicCollection, locale: SupportedLocale) =>
    listPublicContent(collection, locale),
);

export const loadCertificates = cache(
  async (locale: SupportedLocale) => (await getPublicHome(locale)).certificates,
);

export const loadDetail = cache(
  async (
    collection: PublicCollection,
    locale: SupportedLocale,
    slug: string,
  ): Promise<PublicItem | null> => {
    try {
      return await getPublicContent(collection, locale, slug);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 404
      ) {
        return null;
      }
      throw error;
    }
  },
);

export const loadFixedPage = cache(
  async (
    locale: SupportedLocale,
    code: FixedPageCode,
  ): Promise<PublicItem | null> => {
    const pages = await listPublicContent("pages", locale);
    return findFixedPage(pages, locale, code) ?? null;
  },
);
