import type { Metadata } from "next";

import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./app-config";

type LocaleAlternates = Partial<Record<SupportedLocale, string>>;

function normalizedPath(path: string): string {
  if (!path) return "";
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) {
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
    },
    robots: { follow: true, index: true },
  };
}

export function organizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(siteUrl, "/brand/route-apex-symbol.png"),
    },
    name: "AnShow",
    url: absoluteUrl(siteUrl, "/"),
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
