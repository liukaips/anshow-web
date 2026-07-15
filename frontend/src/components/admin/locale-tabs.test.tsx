import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleTabs } from "./locale-tabs";

const translations = {
  en: {
    title: "Freight service",
    slug: "freight-service",
    summary: "Summary",
    body: "Body",
    seoTitle: "Freight service",
    seoDescription: "Search description",
    altText: "Cargo at a terminal",
    status: "draft" as const,
  },
  ru: {
    title: "",
    slug: "",
    summary: "",
    body: "",
    seoTitle: "",
    seoDescription: "",
    altText: "",
    status: "draft" as const,
  },
};

afterEach(cleanup);

describe("LocaleTabs", () => {
  it("exposes accessible tabs with visible completeness and publication state", () => {
    const onSelect = vi.fn();
    render(
      <LocaleTabs
        activeLocale="en"
        onSelect={onSelect}
        translations={translations}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Translations" })).toBeVisible();
    const english = screen.getByRole("tab", { name: /English.*Complete.*Draft/i });
    const russian = screen.getByRole("tab", {
      name: /Russian.*Needs attention.*Draft/i,
    });
    expect(english).toHaveAttribute("aria-selected", "true");
    expect(russian).toHaveAttribute("aria-selected", "false");

    fireEvent.click(russian);
    expect(onSelect).toHaveBeenCalledWith("ru");
  });

  it("allows long Russian status text to wrap without fixed-width tabs", () => {
    render(
      <LocaleTabs
        activeLocale="ru"
        onSelect={() => undefined}
        translations={translations}
      />,
    );

    const russian = screen.getByRole("tab", { name: /Russian/i });
    expect(russian.className).toContain("min-w-0");
    expect(russian.className).toContain("break-words");
    expect(russian.className).not.toMatch(/w-\[/);
  });
});
