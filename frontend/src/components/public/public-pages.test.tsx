import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PublicCollectionPage,
  PublicDetailPage,
  QuotePage,
  StaticContentPage,
  VerificationPage,
} from "./public-pages";

const item = {
  id: "ocean-freight",
  locale: "en" as const,
  slug: "ocean-freight",
  title: "Ocean Freight",
  summary: "Forwarding support for containerized ocean cargo.",
  body: "Forwarding support for containerized ocean cargo.",
  structuredBody: null,
  seoTitle: "Ocean Freight | AnShow",
  seoDescription: "Forwarding support for containerized ocean cargo.",
  altText: "Ocean freight operation",
  processStageId: "transit" as const,
  alternates: {
    en: "/en/services/ocean-freight",
    zh: "/zh/services/hai-yun-fu-wu",
  },
  media: null,
};

afterEach(cleanup);

describe("public route pages", () => {
  it("renders only the published collection items it receives", () => {
    render(
      <PublicCollectionPage
        collection="services"
        items={[item]}
        locale="en"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Freight services" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Ocean Freight/ })).toHaveAttribute(
      "href",
      "/en/services/ocean-freight",
    );
    expect(screen.queryByText(/certificate/i)).not.toBeInTheDocument();
  });

  it("keeps detail context, responsive placeholder, and a short quote path", () => {
    render(
      <PublicDetailPage
        collection="services"
        item={item}
        locale="en"
      />,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    expect(screen.getByTestId("media-placeholder")).toHaveClass("aspect-[16/9]");
    expect(screen.getByRole("link", { name: "Request a quote" })).toHaveAttribute(
      "href",
      "/en/quote",
    );
  });

  it("renders structured detail content and preserves the preview quote prefix", () => {
    render(
      <PublicDetailPage
        collection="services"
        item={{
          ...item,
          structuredBody: {
            version: 1,
            sections: [
              { type: "paragraph", text: "Structured service detail." },
              { type: "quote-cta", title: "Plan this shipment", text: "Get route guidance." },
            ],
          },
        }}
        locale="en"
        pathPrefix="/preview/example-token"
      />,
    );

    expect(screen.getByText("Structured service detail.").tagName).toBe("P");
    expect(screen.getByRole("link", { name: /Plan this shipment/ })).toHaveAttribute(
      "href",
      "/preview/example-token/en/quote",
    );
  });

  it("renders structured static page content", () => {
    render(
      <StaticContentPage
        item={{
          ...item,
          structuredBody: {
            version: 1,
            sections: [{ type: "bullet-list", title: "Scope", items: ["Port-to-port"] }],
          },
        }}
        locale="en"
      />,
    );

    expect(screen.getByRole("heading", { name: "Scope" })).toBeVisible();
    expect(screen.getByText("Port-to-port").closest("ul")).toBeVisible();
  });

  it("does not invent certification records when none are configured", () => {
    render(<VerificationPage items={[]} locale="en" />);

    expect(
      screen.getByRole("heading", { name: "Certifications and qualifications" }),
    ).toBeVisible();
    expect(screen.getByText("No verified qualifications are published yet.")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders certificate records supplied by the verified public contract", () => {
    render(
      <VerificationPage
        items={[{ ...item, id: "verified-certificate", title: "Verified certificate" }]}
        locale="en"
      />,
    );

    expect(screen.getByText("Verified certificate")).toBeVisible();
    expect(screen.queryByText("No verified qualifications are published yet.")).not.toBeInTheDocument();
  });

  it("uses the public contact route by default on the quote page", () => {
    render(<QuotePage locale="en" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/contact");
  });

  it("keeps the quote contact route inside preview", () => {
    render(<QuotePage locale="ru" pathPrefix="/preview/example-token" />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/preview/example-token/ru/contact",
    );
  });
});
