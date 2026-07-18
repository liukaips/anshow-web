import type { HomeItem } from "./types";

export function homeItem(overrides: Partial<HomeItem> = {}): HomeItem {
  return {
    alternates: {},
    altText: "Freight operation",
    body: "Published body",
    id: "content-item",
    locale: "en",
    media: null,
    processStageId: null,
    seoDescription: "Published description",
    seoTitle: "Published title",
    slug: "published-item",
    structuredBody: null,
    summary: "Published summary",
    title: "Published item",
    ...overrides,
  };
}
