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

it("fills the final service row deterministically for seven and other list sizes", () => {
  const items = Array.from({ length: 7 }, (_, index) =>
    homeItem({ id: `service-${index}`, slug: `service-${index}`, title: `Service ${index + 1}` }),
  );
  const { rerender } = render(
    <ServiceGrid eyebrow="Services" items={items} learnMore="Open" locale="en" title="Services" />,
  );

  let articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(7);
  expect(articles[6]).toHaveClass("sm:col-span-2", "xl:col-span-2");

  rerender(
    <ServiceGrid eyebrow="Services" items={items.slice(0, 3)} learnMore="Open" locale="en" title="Services" />,
  );
  articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(3);
  expect(articles[2]).toHaveClass("sm:col-span-2", "xl:col-span-2");

  rerender(
    <ServiceGrid eyebrow="Services" items={items.slice(0, 6)} learnMore="Open" locale="en" title="Services" />,
  );
  articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(6);
  expect(articles[5]).not.toHaveClass("sm:col-span-2");
  expect(articles[5]).toHaveClass("xl:col-span-3");
});
