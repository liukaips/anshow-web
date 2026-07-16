import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminMediaError from "./error";

afterEach(cleanup);

describe("AdminMediaError", () => {
  it("shows a Chinese recovery action", () => {
    const reset = vi.fn();
    render(<AdminMediaError error={new Error("failed")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "媒体库加载失败" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
