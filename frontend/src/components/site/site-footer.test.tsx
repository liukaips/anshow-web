import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter, type SiteFooterLabels } from "./site-footer";

const labels: SiteFooterLabels = {
  about: "About AnShow",
  contact: "Contact",
  cookies: "Cookies",
  description: "Freight forwarding coordinated with clarity across borders.",
  insights: "Insights",
  legal: "Legal",
  navigation: "Explore",
  privacy: "Privacy",
  quote: "Request a quote",
  quotePrompt: "Plan the next move with AnShow.",
  services: "Services",
  terms: "Terms",
  tradeLanes: "Trade lanes",
};

describe("SiteFooter", () => {
  it("renders localized navigation, legal, and conversion routes", () => {
    render(<SiteFooter labels={labels} locale="en" />);

    expect(screen.getByText(labels.description)).toBeVisible();
    expect(screen.getByRole("link", { name: labels.quote })).toHaveAttribute(
      "href",
      "/en/quote",
    );
    expect(screen.getByRole("link", { name: labels.privacy })).toHaveAttribute(
      "href",
      "/en/privacy",
    );
    expect(screen.getByRole("link", { name: labels.contact })).toHaveAttribute(
      "href",
      "/en/contact",
    );
  });

  it("does not fabricate contact, certification, social, partner, or metric claims", () => {
    render(<SiteFooter labels={labels} locale="en" />);
    expect(screen.queryByRole("link", { name: /facebook|linkedin|instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/certified|partners|shipments|\+\d/i)).not.toBeInTheDocument();
  });
});
