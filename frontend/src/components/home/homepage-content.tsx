import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RouteScene } from "@/components/motion/route-scene";
import type { SupportedLocale } from "@/lib/app-config";

import { EvidenceCases } from "./evidence-cases";
import { HeroCarousel } from "./hero-carousel";
import { QuoteEntry, type QuoteEntryLabels } from "./quote-entry";
import { ServiceCommitments } from "./service-commitments";
import { ServiceGrid } from "./service-grid";
import { SpecialCargo } from "./special-cargo";
import { TradeLanes } from "./trade-lanes";
import { TrustBar } from "./trust-bar";
import { homeHref, largestSource, type HomeContent } from "./types";

export type HomepageLabels = {
  cargo: string;
  commitmentsEyebrow: string;
  commitmentsTitle: string;
  compactQuoteCases: string;
  compactQuoteCta: string;
  compactQuoteTitle: string;
  evidenceAll: string;
  evidenceEyebrow: string;
  evidenceTitle: string;
  heroEyebrow: string;
  heroGoTo: string;
  heroNext: string;
  heroPause: string;
  heroPlay: string;
  heroPrevious: string;
  heroTitle: string;
  insights: string;
  insightsEyebrow: string;
  lane: string;
  lanes: string;
  learnMore: string;
  process: string;
  quote: QuoteEntryLabels;
  routeDestination: string;
  routeOrigin: string;
  services: string;
  stage: string;
  trustBasic: string;
  trustTitle: string;
  trustVerified: string;
};

export function HomepageContent({
  content,
  labels,
  locale,
  pathPrefix = "",
  processStory,
}: {
  content: HomeContent;
  labels: HomepageLabels;
  locale: SupportedLocale;
  pathPrefix?: string;
  processStory: ReactNode;
}) {
  const quoteHref = homeHref(pathPrefix, locale, "quote");
  const slides = content.slides.map((slide) => ({
    alt: slide.media?.alt || slide.altText,
    avifSrcSet: slide.media?.avifSrcSet,
    fallback: slide.media ? largestSource(slide.media.webpSrcSet) : undefined,
    id: slide.id,
    mobileAvif: slide.media?.mobileAvif,
    summary: slide.summary,
    title: slide.title,
    webpSrcSet: slide.media?.webpSrcSet,
  }));

  return (
    <main>
      <HeroCarousel
        eyebrow={labels.heroEyebrow}
        headline={labels.heroTitle}
        labels={{
          goTo: labels.heroGoTo,
          next: labels.heroNext,
          pause: labels.heroPause,
          play: labels.heroPlay,
          previous: labels.heroPrevious,
        }}
        quoteHref={quoteHref}
        quoteLabel={labels.compactQuoteCta}
        slides={slides}
      />

      <section className="border-b border-black/10 bg-white px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-lg font-semibold leading-7">{labels.compactQuoteTitle}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link className="inline-flex min-h-11 items-center border-b border-black/25 font-semibold" href={homeHref(pathPrefix, locale, "case-studies")}>
              {labels.compactQuoteCases}
            </Link>
            <Link className="inline-flex min-h-12 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)]" href={quoteHref}>
              {labels.compactQuoteCta}
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      <TrustBar
        certificates={content.certificates}
        labels={{ basic: labels.trustBasic, verified: labels.trustVerified }}
        proof={content.proof}
        title={labels.trustTitle}
        verifiedTrust={content.verifiedTrust}
      />

      <ServiceGrid
        eyebrow="ANSHOW / 01"
        items={content.services}
        learnMore={labels.learnMore}
        locale={locale}
        pathPrefix={pathPrefix}
        title={labels.services}
      />

      <RouteScene destinationLabel={labels.routeDestination} label={labels.process} originLabel={labels.routeOrigin} />
      {processStory}

      <EvidenceCases
        allCases={labels.evidenceAll}
        eyebrow={labels.evidenceEyebrow}
        items={content.cases}
        learnMore={labels.learnMore}
        locale={locale}
        pathPrefix={pathPrefix}
        title={labels.evidenceTitle}
      />

      <TradeLanes
        eyebrow="ANSHOW / 03"
        items={content.tradeLanes}
        laneLabel={labels.lane}
        learnMore={labels.learnMore}
        locale={locale}
        pathPrefix={pathPrefix}
        title={labels.lanes}
      />

      <SpecialCargo
        eyebrow="ANSHOW / 04"
        items={content.cargoTypes}
        learnMore={labels.learnMore}
        locale={locale}
        pathPrefix={pathPrefix}
        title={labels.cargo}
      />

      <ServiceCommitments eyebrow={labels.commitmentsEyebrow} items={content.proof} title={labels.commitmentsTitle} />

      {content.articles.length ? (
        <section className="bg-[var(--color-light-surface)] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto w-full max-w-7xl">
            <p className="font-mono text-xs uppercase text-[var(--color-cyan-ink)]">{labels.insightsEyebrow}</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">{labels.insights}</h2>
            <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
              {content.articles.map((article) => (
                <article className="grid gap-4 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" key={article.id}>
                  <FileText aria-hidden="true" className="size-6 text-[var(--color-teal)]" />
                  <div>
                    <h3 className="text-xl font-semibold">{article.title}</h3>
                    <p className="mt-2 max-w-3xl leading-7 text-black/60">{article.summary}</p>
                  </div>
                  <Link className="inline-flex min-h-11 items-center gap-2 font-semibold" href={homeHref(pathPrefix, locale, "insights", article.slug)}>
                    {labels.learnMore}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <QuoteEntry labels={labels.quote} locale={locale} pathPrefix={pathPrefix} />
    </main>
  );
}
