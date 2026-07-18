import "server-only";

import { getTranslations } from "next-intl/server";

import type { SupportedLocale } from "@/lib/app-config";

import type { HomepageLabels } from "./homepage-content";

export async function getHomepageLabels(locale: SupportedLocale): Promise<HomepageLabels> {
  const [home, common] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  return {
    cargo: home("cargo"),
    commitmentsEyebrow: home("commitmentsEyebrow"),
    commitmentsTitle: home("commitmentsTitle"),
    compactQuoteCases: home("compactQuoteCases"),
    compactQuoteCta: home("cta"),
    compactQuoteTitle: home("compactQuoteTitle"),
    evidenceAll: home("evidenceAll"),
    evidenceEyebrow: home("evidenceEyebrow"),
    evidenceTitle: home("evidenceTitle"),
    heroEyebrow: home("eyebrow"),
    heroGoTo: common("next"),
    heroNext: common("next"),
    heroPause: common("pause"),
    heroPlay: common("play"),
    heroPrevious: common("previous"),
    heroTitle: home("title"),
    insights: home("insights"),
    insightsEyebrow: home("insightsEyebrow"),
    lane: home("lane"),
    lanes: home("lanes"),
    learnMore: common("learnMore"),
    process: home("process"),
    quote: {
      cargoText: home("quoteEntry.cargoText"),
      cargoTitle: home("quoteEntry.cargoTitle"),
      contactText: home("quoteEntry.contactText"),
      contactTitle: home("quoteEntry.contactTitle"),
      cta: home("quoteEntry.cta"),
      eyebrow: home("quoteEntry.eyebrow"),
      routeText: home("quoteEntry.routeText"),
      routeTitle: home("quoteEntry.routeTitle"),
      summary: home("quoteEntry.summary"),
      title: home("quoteEntry.title"),
    },
    routeDestination: home("routeDestination"),
    routeOrigin: home("routeOrigin"),
    services: home("services"),
    stage: home("stage"),
    trustBasic: home("trustBasic"),
    trustTitle: home("trustTitle"),
    trustVerified: home("trustVerified"),
  };
}
