import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { homeItem } from "./home-item.test-fixture";
import { ServiceCommitments } from "./service-commitments";

it("renders up to four database proof items as a semantic commitment list", () => {
  const items = [
    ["Safety support", "Insurance planning from the API"],
    ["2-hour response target", "Initial exception response from the API"],
    ["Transparent pricing", "Quote composition from the API"],
    ["24/7 communication", "Multilingual coordination from the API"],
    ["Not on home", "Fifth proof item"],
  ].map(([title, summary], index) =>
    homeItem({ id: `proof-${index}`, slug: `proof-${index}`, summary, title }),
  );

  const { container } = render(
    <ServiceCommitments
      eyebrow="How we work"
      items={items}
      title="Four commitments that matter to shippers"
    />,
  );

  expect(screen.getByRole("heading", { name: "Four commitments that matter to shippers" })).toBeVisible();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText("Initial exception response from the API")).toBeVisible();
  expect(screen.queryByText("Not on home")).not.toBeInTheDocument();
  expect(container.querySelector("article")).toBeNull();
});
