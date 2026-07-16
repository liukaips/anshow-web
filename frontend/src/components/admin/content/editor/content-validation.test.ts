import { describe, expect, it } from "vitest";

import { validateChineseContent, validatePublishableContent } from "./content-validation";

describe("content validation", () => {
  it("explains missing Chinese business content in operator language", () => {
    expect(
      validateChineseContent({ title: "", summary: "", body: "" }),
    ).toEqual({
      title: "请填写内容名称",
      summary: "请填写一句话介绍",
      body: "请填写详细说明",
    });
  });

  it("keeps advanced publishing limits in Chinese", () => {
    expect(
      validatePublishableContent({
        title: "完整标题",
        slug: "Invalid Slug",
        summary: "完整介绍",
        body: "完整说明",
        seoTitle: "标".repeat(61),
        seoDescription: "描".repeat(161),
        altText: "货物装卸现场",
      }),
    ).toMatchObject({
      slug: "网址别名只能使用小写英文字母、数字和连字符",
      seoTitle: "SEO 标题不能超过 60 个字符",
      seoDescription: "SEO 描述不能超过 160 个字符",
    });
  });
});
