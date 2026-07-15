import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminContentError from "./error";

afterEach(cleanup);

describe("AdminContentError", () => {
  it("uses the Next error-boundary reset callback", () => {
    const reset = vi.fn();
    render(<AdminContentError error={new Error("failed")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
