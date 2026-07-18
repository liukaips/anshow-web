import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { components } from "../../generated/api";
import { StructuredContent } from "./structured-content";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StructuredContent", () => {
  it("renders legacy body text when structured content is absent", () => {
    render(
      <StructuredContent
        body="Legacy paragraph"
        quoteHref="/en/quote"
        structuredBody={null}
      />,
    );

    expect(screen.getByText("Legacy paragraph")).toBeVisible();
    expect(screen.getByText("Legacy paragraph").tagName).toBe("P");
  });

  it("falls back to body text when the structured section list is empty", () => {
    render(
      <StructuredContent
        body="Fallback paragraph"
        quoteHref="/en/quote"
        structuredBody={{ version: 1, sections: [] }}
      />,
    );

    expect(screen.getByText("Fallback paragraph").tagName).toBe("P");
  });

  it("renders every version-one section semantically without interpreting content as HTML", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const structuredBody = {
      version: 1,
      sections: [
        { type: "paragraph", text: "A practical route plan." },
        {
          type: "fact-list",
          items: [
            { key: "transit", label: "Transit time", value: "30", unit: "days" },
            { key: "departure", label: "Transit time", value: "Weekly" },
          ],
        },
        {
          type: "process",
          steps: [
            { title: "Book cargo", text: "Confirm capacity and collection." },
            { title: "Book cargo", text: "Receive the shipment milestone plan." },
          ],
        },
        {
          type: "bullet-list",
          title: "Included support",
          items: ["Documentation review", "<script>not executable</script>"],
        },
        { type: "callout", title: "Planning note", text: "Allow time for customs." },
        { type: "quote-cta", title: "Ready to ship?", text: "Discuss your next move." },
      ],
    } satisfies NonNullable<components["schemas"]["PublicContentItem"]["structuredBody"]>;

    render(
      <StructuredContent
        body="Fallback body"
        quoteHref="/preview/token/en/quote"
        structuredBody={structuredBody}
      />,
    );

    expect(screen.getByText("A practical route plan.").tagName).toBe("P");
    expect(screen.getAllByText("Transit time")).toHaveLength(2);
    expect(screen.getAllByText("Transit time")[0].closest("dl")).toBeVisible();
    expect(screen.getAllByText("Transit time")[0].tagName).toBe("DT");
    expect(screen.getByText("30").tagName).toBe("SPAN");
    expect(screen.getByText("days").tagName).toBe("SPAN");
    expect(screen.getAllByRole("heading", { name: "Book cargo" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Book cargo" })[0]).toHaveProperty("tagName", "H2");
    expect(screen.getByText("Confirm capacity and collection.").closest("ol")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Included support" }).tagName).toBe("H2");
    expect(screen.getByText("Documentation review").closest("ul")).not.toBeNull();
    expect(screen.queryByRole("script")).not.toBeInTheDocument();
    expect(screen.getByText("<script>not executable</script>")).toBeVisible();
    expect(screen.getByText("Planning note").tagName).toBe("STRONG");
    expect(screen.getByText("Allow time for customs.").closest("aside")).toBeVisible();
    expect(screen.getByText("Ready to ship?").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: /Ready to ship/ })).toHaveAttribute(
      "href",
      "/preview/token/en/quote",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });
});
