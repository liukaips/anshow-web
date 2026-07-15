import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { CaseCarousel } from "./case-carousel";

const item = {
  alternates: {},
  altText: "Selected shipment coordination",
  body: "Selected shipment coordination",
  id: "case-1",
  locale: "en" as const,
  media: null,
  processStageId: "delivery" as const,
  seoDescription: "Selected shipment coordination",
  seoTitle: "Selected work",
  slug: "selected-work",
  summary: "Selected shipment coordination",
  title: "Selected work",
};

it("provides explicit carousel controls when cases are published", () => {
  render(
    <CaseCarousel
      eyebrow="ANSHOW / 04"
      items={[item, { ...item, id: "case-2", slug: "selected-work-2" }]}
      labels={{ next: "Next", previous: "Previous" }}
      learnMore="Learn more"
      locale="en"
      title="Selected logistics work"
    />,
  );

  expect(screen.getByRole("button", { name: "Previous" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next" })).toBeVisible();
});
