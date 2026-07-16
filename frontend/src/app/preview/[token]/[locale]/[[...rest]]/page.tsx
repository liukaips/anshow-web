import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicPreview } from "@/api/preview-content.server";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { largestSource } from "@/components/home/types";
import { ProofStrip } from "@/components/home/proof-strip";
import { ServiceGrid } from "@/components/home/service-grid";
import { TradeLanes } from "@/components/home/trade-lanes";
import { SpecialCargo } from "@/components/home/special-cargo";
import { TrustScroller } from "@/components/home/trust-scroller";
import { CaseCarousel } from "@/components/home/case-carousel";
import { PublicCollectionPage, PublicDetailPage, QuotePage, StaticContentPage, VerificationPage } from "@/components/public/public-pages";
import type { PublicCollection } from "@/components/public/public-copy";
import { PreviewBanner } from "@/components/preview/preview-banner";
import { isLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

const collections = new Set<PublicCollection>(["services", "trade-lanes", "special-cargo", "insights", "case-studies"]);

export default async function PreviewPage({ params }: { params: Promise<{ token: string; locale: string; rest?: string[] }> }) {
  const { token, locale: candidate, rest = [] } = await params;
  if (!isLocale(candidate)) notFound();
  const locale = candidate;
  setRequestLocale(locale);
  const [preview, messages, shell] = await Promise.all([
    getPublicPreview(token, locale).catch(() => null),
    getMessages({ locale }),
    getTranslations({ locale, namespace: "Shell" }),
  ]);
  if (!preview) notFound();
  const prefix = `/preview/${encodeURIComponent(token)}`;
  let content: React.ReactNode;
  const [section, slug] = rest;

  if (!section) {
    const home = await getTranslations({ locale, namespace: "Home" });
    const common = await getTranslations({ locale, namespace: "Common" });
    const slides = preview.home.slides.map((slide) => ({ alt: slide.media?.alt || slide.altText, avifSrcSet: slide.media?.avifSrcSet, fallback: slide.media ? largestSource(slide.media.webpSrcSet) : undefined, id: slide.id, mobileAvif: slide.media?.mobileAvif, summary: slide.summary, title: slide.title, webpSrcSet: slide.media?.webpSrcSet }));
    content = <main>
      <HeroCarousel eyebrow={home("eyebrow")} headline={home("title")} labels={{ goTo: common("next"), next: common("next"), pause: common("pause"), play: common("play"), previous: common("previous") }} quoteHref={`${prefix}/${locale}/quote`} quoteLabel={home("cta")} slides={slides} />
      <ServiceGrid eyebrow="ANSHOW / 01" items={preview.home.services} learnMore={common("learnMore")} locale={locale} title={home("services")} />
      <TradeLanes eyebrow="ANSHOW / 02" items={preview.home.tradeLanes} laneLabel={home("lane")} learnMore={common("learnMore")} locale={locale} title={home("lanes")} />
      <SpecialCargo eyebrow="ANSHOW / 03" items={preview.home.cargoTypes} learnMore={common("learnMore")} locale={locale} title={home("cargo")} />
      <ProofStrip items={preview.home.proof} label={home("proof")} />
      <TrustScroller items={preview.home.verifiedTrust} labels={{ next: common("next"), previous: common("previous") }} title={home("trust")} />
      <CaseCarousel eyebrow="ANSHOW / 04" items={preview.home.cases} labels={{ next: common("next"), previous: common("previous") }} learnMore={common("learnMore")} locale={locale} title={home("cases")} />
    </main>;
  } else if (collections.has(section as PublicCollection)) {
    const collection = section as PublicCollection;
    const items = preview.collections[collection];
    if (slug) {
      const item = items.find((candidate) => candidate.slug === slug);
      if (!item) notFound();
      content = <PublicDetailPage collection={collection} item={item} locale={locale} pathPrefix={prefix} />;
    } else {
      content = <PublicCollectionPage collection={collection} items={items} locale={locale} pathPrefix={prefix} />;
    }
  } else if (["about", "network", "contact", "privacy", "terms", "cookies"].includes(section)) {
    const item = preview.collections.pages.find((candidate) => candidate.alternates[locale] === `/${locale}/${section}` || candidate.slug === section);
    if (!item) notFound();
    content = <StaticContentPage item={item} locale={locale} pathPrefix={prefix} />;
  } else if (section === "certifications") {
    content = <VerificationPage items={preview.home.certificates} locale={locale} />;
  } else if (section === "quote") {
    content = <QuotePage locale={locale} />;
  } else {
    notFound();
  }

  const nav = [["services", shell("services")], ["trade-lanes", shell("tradeLanes")], ["special-cargo", shell("specialCargo")], ["insights", shell("insights")], ["about", shell("about")]] as const;
  return <NextIntlClientProvider locale={locale} messages={messages}>
    <PreviewBanner adminHref="/admin/publish" locale={locale} />
    <header className="border-b border-white/10 bg-[var(--color-carbon)] px-5 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 py-2">
        <Link className="text-xl font-semibold" href={`${prefix}/${locale}`}>AnShow</Link>
        <nav aria-label={shell("primary")} className="flex flex-wrap items-center gap-x-5 text-sm">{nav.map(([path, label]) => <Link className="inline-flex min-h-11 items-center" href={`${prefix}/${locale}/${path}`} key={path}>{label}</Link>)}</nav>
        <div className="flex gap-2">{(["en", "zh", "ru"] as const).map((target) => <Link className={`inline-flex size-11 items-center justify-center border ${target === locale ? "border-[var(--color-cyan)]" : "border-white/20"}`} href={`${prefix}/${target}/${rest.join("/")}`} key={target}>{target.toUpperCase()}</Link>)}</div>
      </div>
    </header>
    <div className="flex-1" id="main-content">{content}</div>
  </NextIntlClientProvider>;
}
