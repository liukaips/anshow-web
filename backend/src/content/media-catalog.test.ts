import { describe, expect, it } from "vitest";

import { mediaForCatalogId } from "./media-catalog.js";
import { mediaSchema } from "./public-contract.js";

describe("public media catalog", () => {
  it("exposes both portrait formats and nulls them when no mobile source exists", async () => {
    const mobile = await mediaForCatalogId("un1263-hamburg", "Regulated drums");
    const desktopOnly = await mediaForCatalogId("service-ocean", "Ocean terminal");

    expect(mobile).toMatchObject({
      mobileAvif: expect.stringContaining("/media/case-un1263-hamburg/mobile-768."),
      mobileWebp: expect.stringContaining("/media/case-un1263-hamburg/mobile-768."),
    });
    expect(desktopOnly).toMatchObject({ mobileAvif: null, mobileWebp: null });
  });

  it("keeps PPT brand assets auditable without using them as About or Contact proof", async () => {
    const [about, contact] = await Promise.all([
      mediaForCatalogId("about", "About AnShow"),
      mediaForCatalogId("contact", "Contact AnShow"),
    ]);

    expect(about?.avifSrcSet).toContain("/media/hero-ocean/");
    expect(contact?.avifSrcSet).toContain("/media/hero-ocean/");
    expect(about?.avifSrcSet).not.toContain("/media/anshow-office/");
    expect(contact?.avifSrcSet).not.toContain("/media/anshow-contact/");
  });

  it("requires an explicit nullable mobile WebP field in the public contract", () => {
    expect(
      mediaSchema.safeParse({
        alt: "Freight",
        width: 1280,
        height: 720,
        dominantColor: "rgb(10 20 30)",
        mobileAvif: null,
        avifSrcSet: "/media/example/desktop.avif 1280w",
        webpSrcSet: "/media/example/desktop.webp 1280w",
      }).success,
    ).toBe(false);
  });
});
