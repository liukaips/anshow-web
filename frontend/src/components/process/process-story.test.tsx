import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProcessStory } from "./process-story";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const messages: Record<string, string | string[]> = {
      "route.title": "Route planning",
      "route.phases": ["Requirements review", "Route design", "Plan approval"],
      "pickup.title": "Pickup and handover",
      "pickup.phases": ["Pickup booking", "Cargo handover", "Origin check"],
      "customs.title": "Customs readiness",
      "customs.phases": ["Document review", "Export clearance", "Release confirmation"],
      "transit.title": "In-transit coordination",
      "transit.phases": ["Milestone monitoring", "Exception coordination", "Arrival preparation"],
      "delivery.title": "Destination delivery",
      "delivery.phases": ["Import release", "Final-mile dispatch", "Proof of delivery"],
    };
    const translate = (key: string) => String(messages[key]);
    translate.raw = (key: string) => messages[key];
    return translate;
  }),
}));

afterEach(cleanup);

describe("ProcessStory", () => {
  it("renders all five stages without requiring animation", async () => {
    render(await ProcessStory({ locale: "en", motion: "reduced", stageLabel: "Stage" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Customs readiness")).toBeVisible();
    expect(screen.getByText("Proof of delivery")).toBeVisible();
    expect(screen.getByText("Stage / 01")).toBeVisible();
  });

  it("uses a language-neutral number when no localized stage label is supplied", async () => {
    render(
      await ProcessStory({
        compact: true,
        locale: "en",
        stageIds: ["route"],
      }),
    );

    expect(screen.getByText("01")).toBeVisible();
    expect(screen.queryByText(/stage/i)).not.toBeInTheDocument();
  });
});
