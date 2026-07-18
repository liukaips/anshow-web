import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { homeItem } from "./home-item.test-fixture";
import { ServiceGrid } from "./service-grid";
import { SpecialCargo } from "./special-cargo";
import { TradeLanes } from "./trade-lanes";

const item = homeItem({ id: "scoped", slug: "scoped", title: "Scoped item" });

afterEach(cleanup);

it.each([
  [
    "services",
    <ServiceGrid eyebrow="Services" items={[item]} key="services" learnMore="Open" locale="ru" pathPrefix="/preview/token" title="Services" />,
    "/preview/token/ru/services/scoped",
  ],
  [
    "trade lanes",
    <TradeLanes eyebrow="Lanes" items={[item]} key="trade-lanes" laneLabel="Lane" learnMore="Open" locale="ru" pathPrefix="/preview/token" title="Trade lanes" />,
    "/preview/token/ru/trade-lanes/scoped",
  ],
  [
    "special cargo",
    <SpecialCargo eyebrow="Cargo" items={[item]} key="special-cargo" learnMore="Open" locale="ru" pathPrefix="/preview/token" title="Special cargo" />,
    "/preview/token/ru/special-cargo/scoped",
  ],
])("keeps %s detail links inside preview", (_name, component, href) => {
  render(component);
  expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute("href", href);
});

it("renders any nonempty service list without assuming exactly seven records", () => {
  const items = Array.from({ length: 7 }, (_, index) =>
    homeItem({ id: `service-${index}`, slug: `service-${index}`, title: `Service ${index + 1}` }),
  );
  const { rerender } = render(
    <ServiceGrid eyebrow="Services" items={items} learnMore="Open" locale="en" title="Services" />,
  );

  expect(screen.getAllByRole("article")).toHaveLength(7);

  rerender(
    <ServiceGrid eyebrow="Services" items={items.slice(0, 3)} learnMore="Open" locale="en" title="Services" />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(3);
});
