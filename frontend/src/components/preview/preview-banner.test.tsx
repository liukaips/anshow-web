import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PreviewBanner } from "./preview-banner";

afterEach(cleanup);

describe("PreviewBanner", () => {
  it("clearly identifies an unpublished website preview", () => {
    render(<PreviewBanner locale="zh" adminHref="/admin/publish" />);
    expect(screen.getByText("网站预览环境")).toBeVisible();
    expect(screen.getByText("此页面不会被搜索引擎收录，也不会影响正式网站。")).toBeVisible();
    expect(screen.getByRole("link", { name: "返回发布中心" })).toHaveAttribute("href", "/admin/publish");
  });
});
