import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PublicCollectionPage,
  PublicDetailPage,
  VerificationPage,
} from "./public-pages";

const item = {
  id: "ocean-freight",
  locale: "en" as const,
  slug: "ocean-freight",
  title: "Ocean Freight",
  summary: "Forwarding support for containerized ocean cargo.",
  body: "Forwarding support for containerized ocean cargo.",
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
});
