import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleMatrix } from "./role-matrix";

afterEach(cleanup);

describe("RoleMatrix", () => {
  it("shows Chinese business labels instead of internal role and permission keys", () => {
    render(
      <RoleMatrix
        roles={[
          {
            id: "content-reviewer",
            name: "Content Reviewer",
            permissions: ["content.read", "content.review", "preview.share"],
          },
        ]}
      />,
    );

    expect(screen.getByText("内容审核")).toBeVisible();
    expect(screen.getByText("审核内容")).toBeVisible();
    expect(screen.getByText("分享网站预览")).toBeVisible();
    expect(screen.queryByText("Content Reviewer")).toBeNull();
    expect(screen.queryByText("content.review")).toBeNull();
  });
});
