import { describe, expect, it } from "vitest";

import {
  organizationJsonLd,
  pageMetadata,
  serializeJsonLd,
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
        },
      },
      openGraph: {
        type: "website",
        url: "https://www.anshow.test/en/services/ocean-freight",
      },
      robots: { follow: true, index: true },
    });
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
  it("contains only verified public identity fields", () => {
    expect(organizationJsonLd("https://www.anshow.test")).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      logo: {
        "@type": "ImageObject",
        url: "https://www.anshow.test/brand/route-apex-symbol.png",
      },
      name: "AnShow",
      url: "https://www.anshow.test/",
    });
  });

  it("escapes HTML-significant characters before script embedding", () => {
    const serialized = serializeJsonLd({ value: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });
});
