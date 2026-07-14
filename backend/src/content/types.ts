export const LOCALES = ["en", "zh", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const PUBLICATION_STATUSES = [
  "draft",
  "scheduled",
  "published",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PROCESS_STAGE_IDS = [
  "route",
  "pickup",
  "customs",
  "transit",
  "delivery",
] as const;
export type ProcessStageId = (typeof PROCESS_STAGE_IDS)[number];

export type PublicContentBase = {
  id: string;
  code: string;
  sortOrder: number;
  mediaId: string | null;
  processStageId: ProcessStageId | null;
  verifiedAt: Date | null;
  verificationSource: string | null;
};

export type PublishedTranslation = {
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  altText: string;
  publishedAt: Date;
};

export type PublicService = PublicContentBase & PublishedTranslation;
