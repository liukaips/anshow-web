export const APP_NAME = "AnShow";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "zh", "ru"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
