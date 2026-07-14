import type { SupportedLocale } from "../lib/app-config";
import type english from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: SupportedLocale;
    Messages: typeof english;
  }
}
