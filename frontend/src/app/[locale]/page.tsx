import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getPublicHome } from "@/api/public-content.server";
import { CaseCarousel } from "@/components/home/case-carousel";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { largestSource } from "@/components/home/types";
import { ProofStrip } from "@/components/home/proof-strip";
import { ServiceGrid } from "@/components/home/service-grid";
import { SpecialCargo } from "@/components/home/special-cargo";
import { TradeLanes } from "@/components/home/trade-lanes";
import { TrustScroller } from "@/components/home/trust-scroller";
import { RouteScene } from "@/components/motion/route-scene";
import { ProcessStory } from "@/components/process/process-story";
import { isLocale } from "@/i18n/routing";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [content, home, common] = await Promise.all([
    getPublicHome(locale),
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

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
        eyebrow={home("eyebrow")}
        headline={home("title")}
        labels={{
          goTo: common("next"),
          next: common("next"),
          pause: common("pause"),
          play: common("play"),
          previous: common("previous"),
        }}
        quoteHref={`/${locale}/quote`}
        quoteLabel={home("cta")}
        slides={slides}
      />

      <section className="border-b border-black/10 bg-white px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-lg font-semibold leading-7">{home("contact")}</p>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)]"
            href={`/${locale}/quote`}
          >
            {home("cta")}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </section>

      <ServiceGrid
        eyebrow="ANSHOW / 01"
        items={content.services}
        learnMore={common("learnMore")}
        locale={locale}
        title={home("services")}
      />

      <RouteScene
        destinationLabel={home("routeDestination")}
        label={home("process")}
        originLabel={home("routeOrigin")}
      />
      <ProcessStory
        heading={home("process")}
        locale={locale}
        stageLabel={home("stage")}
      />

      <TradeLanes
        eyebrow="ANSHOW / 02"
        items={content.tradeLanes}
        laneLabel={home("lane")}
        learnMore={common("learnMore")}
        locale={locale}
        title={home("lanes")}
      />

      <SpecialCargo
        eyebrow="ANSHOW / 03"
        items={content.cargoTypes}
        learnMore={common("learnMore")}
        locale={locale}
        title={home("cargo")}
      />

      <ProofStrip items={content.proof} label={home("proof")} />
      <TrustScroller
        items={content.verifiedTrust}
        labels={{ next: common("next"), previous: common("previous") }}
        title={home("trust")}
      />
      <CaseCarousel
        eyebrow="ANSHOW / 04"
        items={content.cases}
        labels={{ next: common("next"), previous: common("previous") }}
        learnMore={common("learnMore")}
        locale={locale}
        title={home("cases")}
      />

      {content.articles.length ? (
        <section className="bg-[var(--color-light-surface)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto w-full max-w-7xl">
            <p className="font-mono text-xs uppercase text-[var(--color-teal-ink)]">ANSHOW / 05</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
              {home("insights")}
            </h2>
            <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
              {content.articles.map((article) => (
                <article
                  className="grid gap-4 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  key={article.id}
                >
                  <FileText aria-hidden="true" className="size-6 text-[var(--color-teal)]" />
                  <div>
                    <h3 className="text-xl font-semibold">{article.title}</h3>
                    <p className="mt-2 max-w-3xl leading-7 text-black/60">{article.summary}</p>
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 font-semibold"
                    href={`/${locale}/insights/${encodeURIComponent(article.slug)}`}
                  >
                    {common("learnMore")}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-[var(--color-teal)] px-5 py-16 text-[var(--color-carbon)] sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase">ANSHOW / {home("nextMove")}</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
              {home("contact")}
            </h2>
          </div>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center gap-3 bg-[var(--color-carbon)] px-5 font-semibold text-white"
            href={`/${locale}/quote`}
          >
            {home("cta")}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
          {content.channels.length ? (
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {content.channels.map((channel) => (
                <a
                  className="inline-flex min-h-11 items-center border border-[var(--color-carbon)] px-4 font-semibold"
                  href={channel.href}
                  key={channel.id}
                >
                  {channel.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
