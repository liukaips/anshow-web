import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type {
  AdminContentItem,
  AdminContentLocale,
} from "../../../api/admin-content";

let ContentList: typeof import("./content-list").ContentList;
const originalTimezone = process.env.TZ;

beforeAll(async () => {
  process.env.TZ = "UTC";
  vi.resetModules();
  ({ ContentList } = await import("./content-list"));
});

afterAll(() => {
  process.env.TZ = originalTimezone;
});

function completeTranslation(locale: AdminContentLocale, title: string) {
  return {
    altText: `${title}图片说明`,
    body: `${title}详细说明`,
    locale,
    publishedAt: "2026-07-15T04:00:00.000Z",
    scheduledAt: null,
    seoDescription: `${title}搜索说明`,
    seoTitle: `${title} | AnShow`,
    slug: `${locale}-ocean-freight`,
    status: "published" as const,
    summary: `${title}一句话介绍`,
    title,
    updatedAt: "2026-07-15T04:00:00.000Z",
  };
}

const item: AdminContentItem = {
  id: "service-1",
  code: "ocean-freight",
  sortOrder: 1,
  archivedAt: null,
  verified: false,
  verificationSource: null,
  createdAt: "2026-07-15T04:00:00.000Z",
  updatedAt: "2026-07-15T04:00:00.000Z",
  translations: {
    zh: completeTranslation("zh", "海运服务"),
    en: completeTranslation("en", "Ocean Freight"),
    ru: completeTranslation("ru", "Морские перевозки"),
  },
};

afterEach(cleanup);

describe("ContentList", () => {
  it("presents content in operator language without exposing internal codes", () => {
    render(<ContentList canWrite collection="services" items={[item]} />);

    expect(
      screen.getByRole("columnheader", { name: "内容名称" }),
    ).toBeVisible();
    expect(screen.getAllByText("海运服务").length).toBeGreaterThan(0);
    expect(screen.getAllByText("三语已完成").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未分配").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已发布").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026年7月15日 12:00").length).toBeGreaterThan(0);
    expect(screen.queryByText("ocean-freight")).toBeNull();
    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.getAllByRole("link", { name: "编辑" }).length).toBeGreaterThan(0);
  });

  it("falls back to a safe business name and read-only action", () => {
    render(
      <ContentList
        canWrite={false}
        collection="services"
        items={[{ ...item, translations: {} }]}
      />,
    );

    expect(screen.getAllByText("未命名内容").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0/3 已完成").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "查看" }).length).toBeGreaterThan(0);
  });

  it.each([
    [
      "only Chinese published",
      { zh: completeTranslation("zh", "海运服务") },
      "草稿",
    ],
    [
      "one language scheduled",
      {
        zh: completeTranslation("zh", "海运服务"),
        en: {
          ...completeTranslation("en", "Ocean Freight"),
          publishedAt: null,
          scheduledAt: "2026-07-16T04:00:00.000Z",
          status: "scheduled" as const,
        },
      },
      "定时发布",
    ],
    [
      "archived content",
      item.translations,
      "已归档",
    ],
  ])("derives %s without overstating publication", (_case, translations, label) => {
    render(
      <ContentList
        canWrite
        collection="services"
        items={[
          {
            ...item,
            archivedAt: _case === "archived content" ? item.updatedAt : null,
            translations,
          },
        ]}
      />,
    );

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
});
