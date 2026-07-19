import type { Metadata } from "next";

import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./app-config";

type LocaleAlternates = Partial<Record<SupportedLocale, string>>;

function normalizedPath(path: string): string {
  if (!path) return "";
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new Error("SEO paths must be clean root-relative paths.");
  }
  return path === "/" ? "" : path.replace(/\/$/, "");
}

function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, `${siteUrl.replace(/\/$/, "")}/`).toString();
}

export function staticLocaleAlternates(
  pathname: string,
): Record<SupportedLocale, string> {
  const path = normalizedPath(pathname);
  return {
    en: `/en${path}`,
    zh: `/zh${path}`,
    ru: `/ru${path}`,
  };
}

export function pageMetadata(input: {
  alternates?: LocaleAlternates;
  description: string;
  locale: SupportedLocale;
  mediaUrl?: string;
  path: string;
  siteUrl: string;
  title: string;
}): Metadata {
  const path = normalizedPath(input.path);
  const canonical = absoluteUrl(input.siteUrl, `/${input.locale}${path}`);
  const relativeAlternates = input.alternates ?? staticLocaleAlternates(path);
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.flatMap((locale) => {
      const alternate = relativeAlternates[locale];
      return alternate
        ? [
            [
              locale,
              absoluteUrl(input.siteUrl, normalizedPath(alternate) || "/"),
            ] as const,
          ]
      : [];
    }),
  );
  const englishAlternate = relativeAlternates.en ?? "/en";
  languages["x-default"] = absoluteUrl(
    input.siteUrl,
    normalizedPath(englishAlternate) || "/",
  );
  const image = input.mediaUrl
    ? absoluteUrl(input.siteUrl, normalizedPath(input.mediaUrl) || "/")
    : undefined;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical, languages },
    openGraph: {
      description: input.description,
      siteName: "AnShow",
      title: input.title,
      type: "website",
      url: canonical,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    robots: { follow: true, index: true },
    ...(image
      ? {
          twitter: {
            card: "summary_large_image" as const,
            description: input.description,
            images: [image],
            title: input.title,
          },
        }
      : {}),
  };
}

export function organizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@id": `${new URL(siteUrl).origin}/#organization`,
    "@type": "Organization",
    address: {
      "@type": "PostalAddress",
      addressCountry: "CN",
      addressLocality: "Shenzhen",
      addressRegion: "Guangdong",
      streetAddress: "Tower A, Tianli Central Plaza, Nanshan District",
    },
    contactPoint: {
      "@type": "ContactPoint",
      availableLanguage: ["English", "Chinese", "Russian"],
      email: "anfisa@an-show.com",
      telephone: "+86-18998909323",
    },
    email: "anfisa@an-show.com",
    foundingDate: "2012",
    legalName: "An-Show Supply Chain (Shenzhen) Co., Ltd.",
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(siteUrl, "/brand/route-apex-symbol.png"),
    },
    name: "AnShow",
    telephone: "+86-0755-26651969 ext#201",
    url: absoluteUrl(siteUrl, "/"),
  } as const;
}

export type SeoPage = Readonly<{
  articleSection?: string;
  description: string;
  imageUrl?: string;
  locale: SupportedLocale;
  name: string;
  path: string;
}>;

function organizationReference(siteUrl: string) {
  return {
    "@id": `${new URL(siteUrl).origin}/#organization`,
    "@type": "Organization",
    name: "AnShow",
  } as const;
}

function pageUrl(siteUrl: string, path: string): string {
  return absoluteUrl(siteUrl, normalizedPath(path) || "/");
}

function pageImage(siteUrl: string, imageUrl?: string): string | undefined {
  return imageUrl
    ? absoluteUrl(siteUrl, normalizedPath(imageUrl) || "/")
    : undefined;
}

export function serviceJsonLd(siteUrl: string, page: SeoPage) {
  const image = pageImage(siteUrl, page.imageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    description: page.description,
    ...(image ? { image } : {}),
    name: page.name,
    provider: organizationReference(siteUrl),
    url: pageUrl(siteUrl, page.path),
  } as const;
}

export function articleJsonLd(siteUrl: string, page: SeoPage) {
  const image = pageImage(siteUrl, page.imageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    ...(page.articleSection ? { articleSection: page.articleSection } : {}),
    description: page.description,
    ...(image ? { image } : {}),
    headline: page.name,
    inLanguage: page.locale,
    mainEntityOfPage: pageUrl(siteUrl, page.path),
    publisher: organizationReference(siteUrl),
    url: pageUrl(siteUrl, page.path),
  } as const;
}

export function breadcrumbJsonLd(
  siteUrl: string,
  items: readonly Readonly<{ name: string; path: string }>[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: pageUrl(siteUrl, item.path),
      name: item.name,
      position: index + 1,
    })),
  } as const;
}

export function contactPageJsonLd(siteUrl: string, page: SeoPage) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    description: page.description,
    mainEntity: organizationReference(siteUrl),
    name: page.name,
    url: pageUrl(siteUrl, page.path),
  } as const;
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
