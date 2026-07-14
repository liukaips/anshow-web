import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { SiteHeader, type SiteHeaderLabels } from "./site-header";

const englishLabels: SiteHeaderLabels = {
  about: "About AnShow",
  changeLanguage: "Change language",
  closeMenu: "Close menu",
  contact: "Contact",
  home: "AnShow home",
  insights: "Insights",
  languageMenu: "Language selection",
  mobileNavigation: "Mobile navigation",
  openMenu: "Open menu",
  primary: "Primary navigation",
  quote: "Request a quote",
  services: "Services",
  specialCargo: "Special cargo",
  tradeLanes: "Trade lanes",
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("SiteHeader", () => {
  it("renders fixed public routes and reachable quote and language actions", () => {
    render(<SiteHeader labels={englishLabels} locale="en" />);

    expect(screen.getByRole("link", { name: englishLabels.quote })).toHaveAttribute(
      "href",
      "/en/quote",
    );
    expect(
      screen.getByRole("button", { name: englishLabels.changeLanguage }),
    ).toBeVisible();
    expect(screen.getAllByRole("link", { name: englishLabels.services })[0]).toHaveAttribute(
      "href",
      "/en/services",
    );
    expect(screen.getAllByRole("link", { name: englishLabels.tradeLanes })[0]).toHaveAttribute(
      "href",
      "/en/trade-lanes",
    );
    expect(screen.getAllByRole("link", { name: englishLabels.specialCargo })[0]).toHaveAttribute(
      "href",
      "/en/special-cargo",
    );
  });

  it("renders supplied Russian labels without an English navigation fallback", () => {
    const russianLabels: SiteHeaderLabels = {
      ...englishLabels,
      about: "О компании AnShow",
      contact: "Контакты",
      insights: "Аналитика",
      quote: "Запросить расчет",
      services: "Услуги",
      specialCargo: "Специальные грузы",
      tradeLanes: "Торговые направления",
    };

    render(<SiteHeader labels={russianLabels} locale="ru" />);

    expect(screen.getAllByText("Торговые направления").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trade lanes")).not.toBeInTheDocument();
  });
});

describe("MobileMenu", () => {
  it("traps focus, closes on Escape, restores scroll, and returns focus", () => {
    document.body.style.overflow = "clip";
    render(<MobileMenu labels={englishLabels} locale="en" />);
    const trigger = screen.getByRole("button", { name: englishLabels.openMenu });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: englishLabels.mobileNavigation,
    });
    const close = screen.getByRole("button", { name: englishLabels.closeMenu });
    expect(document.body.style.overflow).toBe("hidden");
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: englishLabels.quote })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("clip");
    expect(trigger).toHaveFocus();
  });

  it("closes when a route is selected", () => {
    render(<MobileMenu labels={englishLabels} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: englishLabels.openMenu }));
    const route = screen.getByRole("link", { name: englishLabels.services });
    route.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(route);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LocaleSwitcher", () => {
  it("uses published alternates and falls back to locale homes", () => {
    render(
      <LocaleSwitcher
        alternates={{ zh: "/zh/services/hai-yun-fu-wu" }}
        current="en"
        label={englishLabels.changeLanguage}
        menuLabel={englishLabels.languageMenu}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: englishLabels.changeLanguage }),
    );

    expect(screen.getByRole("menuitem", { name: "English" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "中文" })).toHaveAttribute(
      "href",
      "/zh/services/hai-yun-fu-wu",
    );
    expect(screen.getByRole("menuitem", { name: "Русский" })).toHaveAttribute(
      "href",
      "/ru",
    );
  });

  it("closes on Escape and outside interaction with managed focus", () => {
    render(
      <LocaleSwitcher
        alternates={{}}
        current="en"
        label={englishLabels.changeLanguage}
        menuLabel={englishLabels.languageMenu}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: englishLabels.changeLanguage,
    });

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "English" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
