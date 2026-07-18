import { describe, expect, it } from "vitest";

import {
  parseContentBody,
  structuredContentBodySchema,
} from "./structured-body.js";
import { publicItemSchema } from "./public-contract.js";

describe("structured content body", () => {
  it("accepts version 1 with all supported section types", () => {
    const body = {
      version: 1,
      sections: [
        { type: "paragraph", text: "Ocean freight planning begins here." },
        {
          type: "fact-list",
          items: [
            { key: "transit-time", label: "Transit time", value: "18", unit: "days" },
          ],
        },
        {
          type: "process",
          steps: [
            { title: "Book", text: "Confirm capacity with the carrier." },
          ],
        },
        {
          type: "bullet-list",
          title: "Documents",
          items: ["Commercial invoice", "Packing list"],
        },
        {
          type: "callout",
          title: "Plan ahead",
          text: "Reserve capacity before peak season.",
        },
        {
          type: "quote-cta",
          title: "Need a rate?",
          text: "Request a tailored freight quote.",
        },
      ],
    };

    expect(structuredContentBodySchema.parse(body)).toEqual(body);
    expect(parseContentBody(JSON.stringify(body))).toEqual({
      kind: "structured",
      value: body,
    });
  });

  it("returns existing editorial text as legacy text", () => {
    expect(parseContentBody("Existing editorial paragraph")).toEqual({
      kind: "legacy-text",
      text: "Existing editorial paragraph",
    });
  });

  it("rejects arbitrary HTML sections", () => {
    const unsafeBody = {
      version: 1,
      sections: [{ type: "html", html: "<script>alert(1)</script>" }],
    };

    expect(structuredContentBodySchema.safeParse(unsafeBody).success).toBe(
      false,
    );
    expect(parseContentBody(JSON.stringify(unsafeBody))).toEqual({
      kind: "legacy-text",
      text: JSON.stringify(unsafeBody),
    });
  });

  it.each([
    ["empty sections", []],
    ["empty paragraph", [{ type: "paragraph", text: "" }]],
    ["empty fact list", [{ type: "fact-list", items: [] }]],
    [
      "13 facts",
      [
        {
          type: "fact-list",
          items: Array.from({ length: 13 }, (_, index) => ({
            key: `key-${index}`,
            label: `Label ${index}`,
            value: `${index}`,
          })),
        },
      ],
    ],
    [
      "empty fact key",
      [{ type: "fact-list", items: [{ key: "", label: "Label", value: "1" }] }],
    ],
    [
      "empty fact label",
      [{ type: "fact-list", items: [{ key: "key", label: "", value: "1" }] }],
    ],
    [
      "empty fact value",
      [{ type: "fact-list", items: [{ key: "key", label: "Label", value: "" }] }],
    ],
    [
      "empty process title",
      [{ type: "process", steps: [{ title: "", text: "Step details" }] }],
    ],
    ["empty process steps", [{ type: "process", steps: [] }]],
    [
      "empty process text",
      [{ type: "process", steps: [{ title: "Step", text: "" }] }],
    ],
    [
      "empty bullet title",
      [{ type: "bullet-list", title: "", items: ["Item"] }],
    ],
    ["empty bullet list", [{ type: "bullet-list", items: [] }]],
    ["empty bullet item", [{ type: "bullet-list", items: [""] }]],
    ["empty callout title", [{ type: "callout", title: "", text: "Text" }]],
    ["empty callout text", [{ type: "callout", title: "Title", text: "" }]],
    ["empty quote CTA title", [{ type: "quote-cta", title: "", text: "Text" }]],
    ["empty quote CTA text", [{ type: "quote-cta", title: "Title", text: "" }]],
    [
      "9 process steps",
      [
        {
          type: "process",
          steps: Array.from({ length: 9 }, (_, index) => ({
            title: `Step ${index}`,
            text: "Step details",
          })),
        },
      ],
    ],
    [
      "17 bullet items",
      [
        {
          type: "bullet-list",
          items: Array.from({ length: 17 }, (_, index) => `Item ${index}`),
        },
      ],
    ],
    [
      "25 sections",
      Array.from({ length: 25 }, () => ({ type: "paragraph", text: "Text" })),
    ],
    ["paragraph over max", [{ type: "paragraph", text: "p".repeat(5_001) }]],
    [
      "fact key over max",
      [
        {
          type: "fact-list",
          items: [{ key: "k".repeat(81), label: "Label", value: "1" }],
        },
      ],
    ],
    [
      "process text over max",
      [{ type: "process", steps: [{ title: "Step", text: "p".repeat(1_001) }] }],
    ],
    [
      "bullet item over max",
      [{ type: "bullet-list", items: ["b".repeat(501)] }],
    ],
    [
      "callout text over max",
      [{ type: "callout", title: "Title", text: "c".repeat(1_501) }],
    ],
    [
      "quote CTA text over max",
      [{ type: "quote-cta", title: "Title", text: "q".repeat(801) }],
    ],
  ])("rejects %s", (_name, sections) => {
    expect(
      structuredContentBodySchema.safeParse({ version: 1, sections }).success,
    ).toBe(false);
  });

  it("requires a nullable structured body in the public item contract", () => {
    const publicItem = {
      id: "ocean-freight",
      locale: "en",
      slug: "ocean-freight",
      title: "Ocean Freight",
      summary: "Ocean freight services.",
      body: "Existing editorial paragraph",
      structuredBody: null,
      seoTitle: "Ocean Freight | AnShow",
      seoDescription: "Ocean freight services.",
      altText: "Ocean freight scene",
      processStageId: null,
      alternates: {},
      media: null,
    };
    const missingStructuredBody = Object.fromEntries(
      Object.entries(publicItem).filter(([key]) => key !== "structuredBody"),
    );

    expect(publicItemSchema.safeParse(publicItem).success).toBe(true);
    expect(publicItemSchema.safeParse(missingStructuredBody).success).toBe(
      false,
    );
  });
});
