import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { QuoteEntry } from "./quote-entry";

const labels = {
  cargoText: "Describe the cargo, dimensions, weight, and handling needs.",
  cargoTitle: "Cargo",
  contactText: "Add the contact details for the person coordinating the shipment.",
  contactTitle: "Contact",
  cta: "Open the full quote request",
  eyebrow: "Start an enquiry",
  routeText: "Share the origin, destination, and preferred timing.",
  routeTitle: "Route",
  summary: "A few practical details help us prepare the next step.",
  title: "Prepare your shipment details",
};

afterEach(cleanup);

it("guides a public visitor to the real quote flow without rendering a fake form", () => {
  const { container } = render(<QuoteEntry labels={labels} locale="en" />);

  expect(screen.getByText("Route")).toBeVisible();
  expect(screen.getByText("Cargo")).toBeVisible();
  expect(screen.getByText("Contact")).toBeVisible();
  expect(screen.getByRole("link", { name: labels.cta })).toHaveAttribute("href", "/en/quote");
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector("input")).toBeNull();
});

it("keeps the quote action inside preview", () => {
  render(<QuoteEntry labels={labels} locale="zh" pathPrefix="/preview/sample-token" />);

  expect(screen.getByRole("link", { name: labels.cta })).toHaveAttribute(
    "href",
    "/preview/sample-token/zh/quote",
  );
});
