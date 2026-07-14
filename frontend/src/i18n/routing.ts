import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../lib/app-config";

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

export function isLocale(candidate: unknown): candidate is SupportedLocale {
  return hasLocale(routing.locales, candidate);
}
