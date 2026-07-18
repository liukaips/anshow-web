import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroCarousel } from "./hero-carousel";

const slides = [
  {
    alt: "Container vessel entering a freight terminal",
    fallback: "/media/hero-ocean/desktop-1280.webp",
    id: "ocean",
    mobileAvif: "/media/hero-ocean/mobile-768.avif",
    summary: "Plan containerized movements with one forwarding contact.",
    title: "Ocean freight",
  },
  {
    alt: "Cargo aircraft at an international freight apron",
    fallback: "/media/hero-air/desktop-1280.webp",
    id: "air",
    summary: "Coordinate time-sensitive air cargo.",
    title: "Air freight",
  },
];

beforeEach(() => {
  class ObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }

  vi.stubGlobal("IntersectionObserver", ObserverStub);
  vi.stubGlobal("ResizeObserver", ObserverStub);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HeroCarousel", () => {
  it("keeps one page heading and lets visitors pause autoplay", () => {
    render(
      <HeroCarousel
        eyebrow="International freight forwarding"
        headline="Move freight. Command certainty."
        labels={{
          goTo: "Go to slide",
          next: "Next slide",
          pause: "Pause carousel",
          play: "Play carousel",
          previous: "Previous slide",
        }}
        quoteHref="/en/quote"
        quoteLabel="Plan your shipment"
        slides={slides}
      />,
    );

    const headings = screen.getAllByRole("heading");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(headings[0]).toHaveProperty("tagName", "H1");
    expect(headings.slice(1).every((heading) => heading.tagName === "H2")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pause carousel" }));
    expect(screen.getByRole("button", { name: "Play carousel" })).toBeVisible();
  });

  it("prioritizes only the first responsive image", () => {
    render(
      <HeroCarousel
        eyebrow="International freight forwarding"
        headline="Move freight. Command certainty."
        labels={{
          goTo: "Go to slide",
          next: "Next slide",
          pause: "Pause carousel",
          play: "Play carousel",
          previous: "Previous slide",
        }}
        quoteHref="/en/quote"
        quoteLabel="Plan your shipment"
        slides={slides}
      />,
    );

    const images = [...document.querySelectorAll("img")];
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "lazy");
    expect(document.querySelector('source[media="(max-width: 767px)"]')).toHaveAttribute(
      "srcset",
      slides[0].mobileAvif,
    );
  });

  it("renders a stable conversion hero when no slides are published", () => {
    render(
      <HeroCarousel
        eyebrow="International freight forwarding"
        headline="Move freight. Command certainty."
        labels={{
          goTo: "Go to slide",
          next: "Next slide",
          pause: "Pause carousel",
          play: "Play carousel",
          previous: "Previous slide",
        }}
        quoteHref="/en/quote"
        quoteLabel="Plan your shipment"
        slides={[]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Move freight. Command certainty.",
    );
    expect(screen.queryByRole("button", { name: "Pause carousel" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan your shipment" })).toHaveAttribute(
      "href",
      "/en/quote",
    );
  });

  it("gates autoplay while hidden without changing the manual control", () => {
    const { container } = render(
      <HeroCarousel
        eyebrow="International freight forwarding"
        headline="Move freight. Command certainty."
        labels={{
          goTo: "Go to slide",
          next: "Next slide",
          pause: "Pause carousel",
          play: "Play carousel",
          previous: "Previous slide",
        }}
        quoteHref="/en/quote"
        quoteLabel="Plan your shipment"
        slides={slides}
      />,
    );

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("[data-autoplay-active]")).toHaveAttribute(
      "data-autoplay-active",
      "false",
    );
    expect(screen.getByRole("button", { name: "Pause carousel" })).toBeVisible();

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("[data-autoplay-active]")).toHaveAttribute(
      "data-autoplay-active",
      "true",
    );
    expect(screen.getByRole("button", { name: "Pause carousel" })).toBeVisible();
  });

  it("keeps manual pause independent from transient focus and hover pauses", () => {
    const { container } = render(
      <HeroCarousel
        eyebrow="International freight forwarding"
        headline="Move freight. Command certainty."
        labels={{
          goTo: "Go to slide",
          next: "Next slide",
          pause: "Pause carousel",
          play: "Play carousel",
          previous: "Previous slide",
        }}
        quoteHref="/en/quote"
        quoteLabel="Plan your shipment"
        slides={slides}
      />,
    );

    const region = container.querySelector("[data-autoplay-active]")!;
    fireEvent.mouseEnter(region);
    expect(region).toHaveAttribute("data-autoplay-active", "false");
    fireEvent.click(screen.getByRole("button", { name: "Pause carousel" }));
    expect(screen.getByRole("button", { name: "Play carousel" })).toBeVisible();
    fireEvent.mouseLeave(region);
    expect(region).toHaveAttribute("data-autoplay-active", "false");

    fireEvent.focus(screen.getByRole("button", { name: "Play carousel" }));
    fireEvent.click(screen.getByRole("button", { name: "Play carousel" }));
    expect(screen.getByRole("button", { name: "Pause carousel" })).toBeVisible();
    expect(region).toHaveAttribute("data-autoplay-active", "false");
  });
});
