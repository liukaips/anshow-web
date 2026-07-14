import { getRequestConfig } from "next-intl/server";

import type { SupportedLocale } from "../lib/app-config";
import { isLocale, routing } from "./routing";

const messageLoaders: Record<
  SupportedLocale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  en: () => import("./messages/en.json"),
  zh: () => import("./messages/zh.json"),
  ru: () => import("./messages/ru.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const candidate = await requestLocale;
  const locale = isLocale(candidate) ? candidate : routing.defaultLocale;
  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
  };
});
