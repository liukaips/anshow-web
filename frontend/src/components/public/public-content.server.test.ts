import { describe, expect, it } from "vitest";

import { findFixedPage } from "./public-content.server";

const base = {
  id: "about",
  locale: "zh" as const,
  slug: "a-custom-editorial-slug",
  title: "关于 AnShow",
  summary: "了解我们的协同方式。",
  body: "了解我们的协同方式。",
  seoTitle: "关于 AnShow | AnShow",
  seoDescription: "了解我们的协同方式。",
  altText: "关于 AnShow",
  processStageId: null,
  structuredBody: null,
  media: null,
};

describe("findFixedPage", () => {
  it("identifies static pages by the backend alternate instead of guessing localized slugs", () => {
    expect(
      findFixedPage(
        [
          {
            ...base,
            alternates: { zh: "/zh/about" },
          },
        ],
        "zh",
        "about",
      )?.slug,
    ).toBe("a-custom-editorial-slug");
  });

  it("does not substitute another page when the requested fixed code is absent", () => {
    expect(
      findFixedPage(
        [
          {
            ...base,
            alternates: { zh: "/zh/network" },
          },
        ],
        "zh",
        "about",
      ),
    ).toBeUndefined();
  });
});
