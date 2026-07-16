import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocalPointPicker } from "./focal-point-picker";

afterEach(cleanup);

describe("FocalPointPicker", () => {
  it("moves the image focus with keyboard controls", () => {
    const onChange = vi.fn();
    render(<FocalPointPicker src="/media/test.webp" value={{ x: 0.5, y: 0.5 }} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("slider", { name: "图片焦点" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ x: 0.51, y: 0.5 });
  });

  it("converts a pointer position into a clamped focus point", () => {
    const onChange = vi.fn();
    render(<FocalPointPicker src="/media/test.webp" value={{ x: 0.5, y: 0.5 }} onChange={onChange} />);
    const surface = screen.getByRole("slider", { name: "图片焦点" });
    Object.defineProperty(surface, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    });
    fireEvent.pointerDown(surface, { clientX: 160, clientY: 70 });
    expect(onChange).toHaveBeenCalledWith({ x: 0.75, y: 0.5 });
  });
});
