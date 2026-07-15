import { describe, expect, it } from "vitest";

import {
  canPublishTranslation,
  translationInputSchema,
} from "./content-schema.js";

const completeTranslation = {
  title: "Freight service",
  slug: "freight-service",
  summary: "A complete summary.",
  body: "A complete body.",
  seoTitle: "Freight service",
  seoDescription: "A complete search description.",
  altText: "Cargo being handled at a terminal",
};

describe("administration content validation", () => {
  it.each([
    ["SEO title", { seoTitle: "" }],
    ["SEO description", { seoDescription: "" }],
    ["alternative text", { altText: "" }],
  ])("does not publish when %s is missing", (_field, incomplete) => {
    expect(
      canPublishTranslation({ ...completeTranslation, ...incomplete }),
    ).toBe(false);
  });

  it("allows incomplete translations to be saved as drafts", () => {
    expect(
      translationInputSchema.safeParse({
        title: "Working title",
        slug: "",
        summary: "",
        body: "",
        seoTitle: "",
        seoDescription: "",
        altText: "",
      }).success,
    ).toBe(true);
  });
});
