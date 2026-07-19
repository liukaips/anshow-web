import "server-only";

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { largestSource } from "@/components/home/types";
import { ProcessStory } from "@/components/process/process-story";
import { getFrontendServerEnv } from "@/env";
import { isLocale } from "@/i18n/routing";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  contactPageJsonLd,
  pageMetadata,
  serializeJsonLd,
  serviceJsonLd,
  staticLocaleAlternates,
  type SeoPage,
} from "@/lib/seo";

import {
  loadCollection,
  loadCertificates,
  loadDetail,
  loadFixedPage,
  type PublicItem,
} from "./public-content.server";
import {
  getPublicCopy,
  type FixedPageCode,
  type PublicCollection,
} from "./public-copy";
import {
  PublicCollectionPage,
  PublicDetailPage,
  QuotePage,
  StaticContentPage,
  VerificationPage,
} from "./public-pages";

type LocaleParams = Promise<{ locale: string }>;
type DetailParams = Promise<{ locale: string; slug: string }>;

function requireLocale(locale: string) {
  if (!isLocale(locale)) notFound();
  return locale;
}

function metadata(input: {
  alternates?: Partial<Record<"en" | "zh" | "ru", string>>;
  description: string;
  locale: "en" | "zh" | "ru";
  mediaUrl?: string;
  path: string;
  title: string;
}): Metadata {
  return pageMetadata({
    ...input,
    siteUrl: getFrontendServerEnv().SITE_URL,
  });
}

function publicMediaUrl(item: PublicItem): string | undefined {
  return item.media
    ? largestSource(item.media.webpSrcSet) ?? largestSource(item.media.avifSrcSet)
    : undefined;
}

function jsonLd(value: unknown, key: string) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }}
      key={key}
      type="application/ld+json"
    />
  );
}

export async function collectionRouteMetadata(
  params: LocaleParams,
  collection: PublicCollection,
): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  const section = getPublicCopy(locale).collections[collection];
  return metadata({
    alternates: staticLocaleAlternates(`/${collection}`),
    description: section.description,
    locale,
    path: `/${collection}`,
    title: section.title,
  });
}

export async function renderCollectionRoute(
  params: LocaleParams,
  collection: PublicCollection,
) {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  setRequestLocale(locale);
  const items = await loadCollection(collection, locale);
  return (
    <PublicCollectionPage
      collection={collection}
      items={items}
      locale={locale}
    />
  );
}

export async function detailRouteMetadata(
  params: DetailParams,
  collection: PublicCollection,
): Promise<Metadata> {
  const { locale: candidate, slug } = await params;
  const locale = requireLocale(candidate);
  const item = await loadDetail(collection, locale, slug);
  if (!item) return { title: getPublicCopy(locale).collections[collection].title };
  return metadata({
    alternates: item.alternates,
    description: item.seoDescription,
    locale,
    mediaUrl: publicMediaUrl(item),
    path: `/${collection}/${encodeURIComponent(item.slug)}`,
    title: item.seoTitle,
  });
}

export async function renderDetailRoute(
  params: DetailParams,
  collection: PublicCollection,
) {
  const { locale: candidate, slug } = await params;
  const locale = requireLocale(candidate);
  setRequestLocale(locale);
  const item = await loadDetail(collection, locale, slug);
  if (!item) notFound();

  const process = item.processStageId ? (
    <ProcessStory
      compact
      locale={locale}
      stageIds={[item.processStageId]}
    />
  ) : undefined;

  const siteUrl = getFrontendServerEnv().SITE_URL;
  const path = `/${locale}/${collection}/${encodeURIComponent(item.slug)}`;
  const page: SeoPage = {
    description: item.seoDescription,
    imageUrl: publicMediaUrl(item),
    locale,
    name: item.title,
    path,
  };
  const labels = getPublicCopy(locale);
  const schemas: Array<readonly [string, unknown]> = [
    [
      "breadcrumb",
      breadcrumbJsonLd(siteUrl, [
        { name: labels.home, path: `/${locale}` },
        {
          name: labels.collections[collection].title,
          path: `/${locale}/${collection}`,
        },
        { name: item.title, path },
      ]),
    ],
  ];

  if (collection === "services" || collection === "special-cargo") {
    schemas.unshift(["service", serviceJsonLd(siteUrl, page)]);
  } else if (collection === "insights" || collection === "case-studies") {
    schemas.unshift([
      "article",
      articleJsonLd(siteUrl, {
        ...page,
        ...(collection === "case-studies"
          ? { articleSection: "Representative logistics project" }
          : {}),
      }),
    ]);
  }

  return (
    <>
      <PublicDetailPage
        collection={collection}
        item={item}
        locale={locale}
        process={process}
      />
      {schemas.map(([key, value]) => jsonLd(value, key))}
    </>
  );
}

export async function fixedPageMetadata(
  params: LocaleParams,
  code: FixedPageCode,
): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  const item = await loadFixedPage(locale, code);
  if (!item) return { title: "AnShow" };
  return metadata({
    alternates: item.alternates,
    description: item.seoDescription,
    locale,
    mediaUrl: publicMediaUrl(item),
    path: `/${code}`,
    title: item.seoTitle,
  });
}

export async function renderFixedPageRoute(
  params: LocaleParams,
  code: FixedPageCode,
) {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  setRequestLocale(locale);
  const item = await loadFixedPage(locale, code);
  if (!item) notFound();
  if (code !== "contact") return <StaticContentPage item={item} locale={locale} />;

  const siteUrl = getFrontendServerEnv().SITE_URL;
  return (
    <>
      <StaticContentPage item={item} locale={locale} />
      {jsonLd(
        contactPageJsonLd(siteUrl, {
          description: item.seoDescription,
          imageUrl: publicMediaUrl(item),
          locale,
          name: item.title,
          path: `/${locale}/contact`,
        }),
        "contact-page",
      )}
    </>
  );
}

export async function quoteRouteMetadata(params: LocaleParams): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  const quote = getPublicCopy(locale).quote;
  return metadata({
    alternates: staticLocaleAlternates("/quote"),
    description: quote.description,
    locale,
    path: "/quote",
    title: quote.title,
  });
}

export async function renderQuoteRoute(params: LocaleParams) {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  setRequestLocale(locale);
  return <QuotePage locale={locale} />;
}

export async function certificationsRouteMetadata(
  params: LocaleParams,
): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  const certifications = getPublicCopy(locale).certifications;
  return metadata({
    alternates: staticLocaleAlternates("/certifications"),
    description: certifications.description,
    locale,
    path: "/certifications",
    title: certifications.title,
  });
}

export async function renderCertificationsRoute(params: LocaleParams) {
  const { locale: candidate } = await params;
  const locale = requireLocale(candidate);
  setRequestLocale(locale);

  const certificates = await loadCertificates(locale);
  return <VerificationPage items={certificates} locale={locale} />;
}
