import { describe, expect, it } from "vitest";

import {
  articleJsonLd,
  breadcrumbJsonLd,
  contactPageJsonLd,
  organizationJsonLd,
  pageMetadata,
  serializeJsonLd,
  serviceJsonLd,
  staticLocaleAlternates,
} from "./seo";

describe("staticLocaleAlternates", () => {
  it("generates identical-path routes for every supported locale", () => {
    expect(staticLocaleAlternates("/privacy")).toEqual({
      en: "/en/privacy",
      zh: "/zh/privacy",
      ru: "/ru/privacy",
    });
  });
});

describe("pageMetadata", () => {
  it("emits clean absolute canonical and published language URLs", () => {
    expect(
      pageMetadata({
        alternates: {
          en: "/en/services/ocean-freight",
          zh: "/zh/services/hai-yun-fu-wu",
        },
        description: "International ocean freight coordination.",
        locale: "en",
        path: "/services/ocean-freight",
        siteUrl: "https://www.anshow.test",
        title: "Ocean freight",
      }),
    ).toMatchObject({
      alternates: {
        canonical: "https://www.anshow.test/en/services/ocean-freight",
        languages: {
          en: "https://www.anshow.test/en/services/ocean-freight",
          zh: "https://www.anshow.test/zh/services/hai-yun-fu-wu",
          "x-default": "https://www.anshow.test/en/services/ocean-freight",
        },
      },
      openGraph: {
        type: "website",
        url: "https://www.anshow.test/en/services/ocean-freight",
      },
      robots: { follow: true, index: true },
    });
  });

  it("falls back to the English home page when no English alternate is published", () => {
    const metadata = pageMetadata({
      alternates: { zh: "/zh/services/hai-yun-fu-wu" },
      description: "International ocean freight coordination.",
      locale: "zh",
      path: "/services/hai-yun-fu-wu",
      siteUrl: "https://www.anshow.test",
      title: "Ocean freight",
    });

    expect(metadata.alternates?.languages).toMatchObject({
      "x-default": "https://www.anshow.test/en",
    });
  });

  it("resolves root-relative public media for Open Graph and Twitter", () => {
    const metadata = pageMetadata({
      description: "International ocean freight coordination.",
      locale: "en",
      mediaUrl: "/media/service-ocean/desktop-1280.example.webp",
      path: "/services/ocean-freight",
      siteUrl: "https://www.anshow.test",
      title: "Ocean freight",
    });

    expect(metadata.openGraph?.images).toEqual([
      { url: "https://www.anshow.test/media/service-ocean/desktop-1280.example.webp" },
    ]);
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://www.anshow.test/media/service-ocean/desktop-1280.example.webp"],
    });
  });

  it("rejects absolute media URLs from content records", () => {
    expect(() =>
      pageMetadata({
        description: "Description",
        locale: "en",
        mediaUrl: "https://untrusted.test/image.webp",
        path: "/privacy",
        siteUrl: "https://www.anshow.test",
        title: "Privacy",
      }),
    ).toThrow(/root-relative/);
  });

  it("rejects alternate URLs that can escape the configured public origin", () => {
    expect(() =>
      pageMetadata({
        alternates: { zh: "https://untrusted.test/zh" },
        description: "Description",
        locale: "en",
        path: "/privacy",
        siteUrl: "https://www.anshow.test",
        title: "Privacy",
      }),
    ).toThrow(/root-relative/);
  });
});

describe("organization JSON-LD", () => {
  it("contains the approved legal identity and contact facts", () => {
    expect(organizationJsonLd("https://www.anshow.test")).toEqual({
      "@context": "https://schema.org",
      "@id": "https://www.anshow.test/#organization",
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
        url: "https://www.anshow.test/brand/route-apex-symbol.png",
      },
      name: "AnShow",
      telephone: "+86-0755-26651969 ext#201",
      url: "https://www.anshow.test/",
    });
  });

  it("escapes HTML-significant characters before script embedding", () => {
    const serialized = serializeJsonLd({ value: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });
});

describe("route JSON-LD", () => {
  const page = {
    description: "International ocean freight coordination.",
    imageUrl: "/media/service-ocean/desktop-1280.example.webp",
    locale: "en" as const,
    name: "Ocean freight",
    path: "/en/services/ocean-freight",
  };

  it("describes a published service with AnShow as its provider", () => {
    expect(serviceJsonLd("https://www.anshow.test", page)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Service",
      description: page.description,
      image: "https://www.anshow.test/media/service-ocean/desktop-1280.example.webp",
      name: page.name,
      provider: {
        "@id": "https://www.anshow.test/#organization",
        "@type": "Organization",
        name: "AnShow",
      },
      url: "https://www.anshow.test/en/services/ocean-freight",
    });
  });

  it("describes articles without inventing an author or publication date", () => {
    const article = articleJsonLd("https://www.anshow.test", {
      ...page,
      articleSection: "Representative logistics project",
    });

    expect(article).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Article",
      articleSection: "Representative logistics project",
      headline: page.name,
      inLanguage: "en",
      publisher: {
        "@id": "https://www.anshow.test/#organization",
        "@type": "Organization",
        name: "AnShow",
      },
    });
    expect(article).not.toHaveProperty("author");
    expect(article).not.toHaveProperty("datePublished");
  });

  it("builds absolute breadcrumb item URLs on the configured origin", () => {
    expect(
      breadcrumbJsonLd("https://www.anshow.test", [
        { name: "Home", path: "/en" },
        { name: "Services", path: "/en/services" },
        { name: page.name, path: page.path },
      ]),
    ).toMatchObject({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", item: "https://www.anshow.test/en", name: "Home", position: 1 },
        { "@type": "ListItem", item: "https://www.anshow.test/en/services", name: "Services", position: 2 },
        { "@type": "ListItem", item: "https://www.anshow.test/en/services/ocean-freight", name: page.name, position: 3 },
      ],
    });
  });

  it("describes the contact page as a reference to the verified Organization", () => {
    expect(contactPageJsonLd("https://www.anshow.test", page)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ContactPage",
      mainEntity: {
        "@id": "https://www.anshow.test/#organization",
        "@type": "Organization",
        name: "AnShow",
      },
      name: page.name,
      url: "https://www.anshow.test/en/services/ocean-freight",
    });
  });
});
