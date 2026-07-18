import { describe, expect, it } from "vitest";

import {
  parseContentBody,
  structuredContentBodySchema,
} from "./structured-body.js";

describe("structured content body", () => {
  it("accepts version 1 paragraph, fact-list, and process sections", () => {
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
});
