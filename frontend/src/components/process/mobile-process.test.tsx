import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessStage } from "./process-data";
import { MobileProcess } from "./mobile-process";
import { ProcessMicroScene } from "./process-micro-scene";

const stages: readonly ProcessStage[] = [
  {
    id: "transit",
    phases: ["Milestone monitoring", "Exception coordination", "Arrival preparation"],
    title: "In-transit coordination",
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MobileProcess", () => {
  it("reveals a light-motion stage once when it enters the viewport", () => {
    let notify: IntersectionObserverCallback = () => undefined;
    const unobserve = vi.fn();

    class ObserverStub {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      disconnect() {}
      observe() {}
      unobserve = unobserve;
    }
    vi.stubGlobal("IntersectionObserver", ObserverStub);

    const { container } = render(<MobileProcess stages={stages} />);
    const step = container.querySelector<HTMLElement>("[data-process-step]");
    expect(step).toHaveAttribute("data-revealed", "false");

    act(() => {
      notify(
        [{ isIntersecting: true, target: step } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(step).toHaveAttribute("data-revealed", "true");
    expect(unobserve).toHaveBeenCalledWith(step);
  });

  it("renders reduced motion as complete without constructing an observer", () => {
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);

    const { container } = render(<MobileProcess complete stages={stages} />);

    expect(container.querySelector("[data-process-step]")).toHaveAttribute(
      "data-revealed",
      "true",
    );
    expect(observer).not.toHaveBeenCalled();
  });
});

describe("ProcessMicroScene", () => {
  it("provides ocean, air, rail, and road symbols for the transit crossfade", () => {
    const { container } = render(<ProcessMicroScene stage={stages[0]} />);

    expect(container.querySelectorAll("[data-micro-phase]")).toHaveLength(3);
    expect(
      [...container.querySelectorAll("[data-transit-mode]")].map((mode) =>
        mode.getAttribute("data-transit-mode"),
      ),
    ).toEqual(["ocean", "air", "rail", "road"]);
    expect(screen.getByText("Milestone monitoring")).toHaveClass("text-base");
  });
});
