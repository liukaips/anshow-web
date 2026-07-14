import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AnShowLogo } from "./anshow-logo";

afterEach(cleanup);

describe("AnShowLogo", () => {
  it("renders a visible wordmark with a decorative route mark", () => {
    const { container } = render(<AnShowLogo />);

    expect(screen.getByText("AnShow")).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("uses the brand name when the compact wordmark is visually hidden", () => {
    render(<AnShowLogo compact />);

    expect(screen.queryByText("AnShow")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName("AnShow");
  });
});
