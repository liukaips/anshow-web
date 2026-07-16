import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminContentError from "./error";

afterEach(cleanup);

describe("AdminContentError", () => {
  it("uses the Next error-boundary reset callback", () => {
    const reset = vi.fn();
    render(<AdminContentError error={new Error("failed")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "内容加载失败" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
