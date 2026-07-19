import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BusinessContentFields, parseBusinessBody } from "./business-content-fields";

describe("BusinessContentFields", () => {
  it("lets operators edit case studies through logistics questions", () => {
    const onChange = vi.fn();

    render(
      <BusinessContentFields
        collection="case-studies"
        disabled={false}
        onChange={onChange}
        value={JSON.stringify({
          version: 1,
          sections: [
            {
              type: "fact-list",
              items: [
                { key: "cargo", label: "货物类型", value: "锂电池" },
                { key: "origin", label: "起运地", value: "深圳" },
                { key: "destination", label: "目的地", value: "洛杉矶" },
              ],
            },
            { type: "paragraph", text: "项目难点：危险品资料需要提前核对。" },
            { type: "paragraph", text: "解决方案：安排合规包装和订舱。" },
            { type: "callout", title: "项目结果", text: "按计划完成交付。" },
          ],
        })}
      />,
    );

    for (const label of ["货物类型", "起运地", "目的地", "项目难点", "解决方案", "项目结果"]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.queryByText(/JSON|body|slug|code/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("目的地"), {
      target: { value: "汉堡" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("\"destination\""),
    );
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("汉堡"));
  });

  it("shows certificate verification fields without exposing schema terms", () => {
    render(
      <BusinessContentFields
        collection="certificates"
        disabled={false}
        onChange={vi.fn()}
        value="危险品运输相关能力说明。"
      />,
    );

    expect(screen.getByLabelText("证书说明")).toBeVisible();
    expect(screen.getByLabelText("证书编号（可选）")).toBeVisible();
    expect(screen.getByLabelText("有效期（可选）")).toBeVisible();
    expect(screen.getByLabelText("验证来源（可选）")).toBeVisible();
    expect(screen.queryByText(/JSON|body|code|schema/i)).not.toBeInTheDocument();
  });

  it("keeps legacy text editable as the main description", () => {
    expect(parseBusinessBody("services", "Legacy description")).toMatchObject({
      kind: "service",
      description: "Legacy description",
    });
  });
});
