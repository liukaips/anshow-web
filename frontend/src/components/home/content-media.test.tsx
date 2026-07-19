import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { homeItem } from "./home-item.test-fixture";
import { ContentMedia } from "./content-media";
import type { HomeItem } from "./types";

const media = {
  alt: "Palletized regulated cargo",
  avifSrcSet: "/media/case/desktop-480.avif 480w, /media/case/desktop-1280.avif 1280w",
  dominantColor: "rgb(20 40 60)",
  height: 1152,
  mobileAvif: "/media/case/mobile-768.avif",
  mobileWebp: "/media/case/mobile-768.webp",
  webpSrcSet: "/media/case/desktop-480.webp 480w, /media/case/desktop-1280.webp 1280w",
  width: 2048,
} as unknown as NonNullable<HomeItem["media"]>;

afterEach(cleanup);

describe("ContentMedia", () => {
  it("orders portrait AVIF and WebP before desktop sources", () => {
    const { container } = render(
      <ContentMedia item={homeItem({ media })} />,
    );
    const sources = [...container.querySelectorAll("source")];

    expect(sources.map((source) => [source.media, source.type, source.srcset])).toEqual([
      ["(max-width: 767px)", "image/avif", media.mobileAvif],
      ["(max-width: 767px)", "image/webp", media.mobileWebp],
      ["", "image/avif", media.avifSrcSet],
      ["", "image/webp", media.webpSrcSet],
    ]);
  });

  it("falls back to desktop WebP only when no portrait source exists", () => {
    const desktopOnly = { ...media, mobileAvif: null, mobileWebp: null };
    const { container } = render(
      <ContentMedia item={homeItem({ media: desktopOnly })} />,
    );
    const sources = [...container.querySelectorAll("source")];

    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.media === "")).toBe(true);
    expect(sources.at(-1)).toHaveAttribute("type", "image/webp");
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/media/case/desktop-1280.webp",
    );
  });
});
