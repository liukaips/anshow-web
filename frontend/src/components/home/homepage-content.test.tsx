import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { homeItem } from "./home-item.test-fixture";
import { HomepageContent, type HomepageLabels } from "./homepage-content";
import type { HomeContent } from "./types";

const item = homeItem({
  id: "published",
  slug: "published",
  structuredBody: {
    sections: [
      {
        items: [{ key: "founded", label: "成立年份", value: "2012" }],
        type: "fact-list",
      },
    ],
    version: 1,
  },
  summary: "Database summary",
  title: "Database item",
});

const content: HomeContent = {
  articles: [item],
  cargoTypes: [item],
  cases: [item],
  certificates: [{ ...item, id: "certificate", title: "IATA" }],
  channels: [],
  headline: "Database headline",
  locale: "zh",
  proof: [
    { ...item, id: "founded-2012" },
    { ...item, id: "exception-response", structuredBody: null },
  ],
  services: [{ ...item, id: "insurance-solutions" }],
  slides: [],
  tradeLanes: [item],
  verifiedTrust: [],
};

const labels: HomepageLabels = {
  cargo: "特殊货物",
  commitmentsEyebrow: "服务原则",
  commitmentsTitle: "四项服务承诺",
  compactQuoteCases: "查看代表性项目",
  compactQuoteCta: "获取运输报价",
  compactQuoteTitle: "先说明路线与货物，我们从这里开始。",
  evidenceAll: "查看全部案例",
  evidenceEyebrow: "项目证据",
  evidenceTitle: "真实运输项目中的关键事实",
  heroEyebrow: "国际货运代理",
  heroGoTo: "跳转轮播",
  heroNext: "下一张",
  heroPause: "暂停",
  heroPlay: "播放",
  heroPrevious: "上一张",
  heroTitle: "让复杂货运，变得确定。",
  insights: "运输洞察",
  insightsEyebrow: "实用指南",
  lane: "航线",
  lanes: "重点贸易航线",
  learnMore: "了解更多",
  process: "项目执行流程",
  quote: {
    cargoText: "说明品名、尺寸、重量和操作要求。",
    cargoTitle: "货物",
    contactText: "留下负责本次运输的联系人信息。",
    contactTitle: "联系",
    cta: "进入完整询价",
    eyebrow: "开始询价",
    routeText: "提供起运地、目的地和期望时间。",
    routeTitle: "路线",
    summary: "准备关键运输信息，便于进一步评估。",
    title: "准备您的运输需求",
  },
  routeDestination: "终点",
  routeOrigin: "起点",
  services: "七项物流服务",
  stage: "阶段",
  trustBasic: "会员 / 资质",
  trustTitle: "企业事实与资质",
  trustVerified: "已核实",
};

beforeEach(() => {
  class ObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  vi.stubGlobal("ResizeObserver", ObserverStub);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shares the approved evidence-led order and preview-scoped links", () => {
  const { container } = render(
    <HomepageContent
      content={content}
      labels={labels}
      locale="zh"
      pathPrefix="/preview/sample-token"
      processStory={<section aria-label="流程故事">流程内容</section>}
    />,
  );

  expect(screen.getByRole("heading", { level: 1, name: "让复杂货运，变得确定。" })).toBeVisible();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: "获取运输报价" })).not.toHaveLength(0);

  const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')].map(
    (link) => link.getAttribute("href"),
  );
  expect(hrefs.length).toBeGreaterThan(8);
  expect(hrefs.every((href) => href?.startsWith("/preview/sample-token/zh/"))).toBe(true);

  const pageText = container.textContent ?? "";
  const orderedLabels = [
    labels.heroTitle,
    labels.compactQuoteTitle,
    labels.trustTitle,
    labels.services,
    "流程内容",
    labels.evidenceTitle,
    labels.lanes,
    labels.cargo,
    labels.commitmentsTitle,
    labels.insights,
    labels.quote.title,
  ];
  const positions = orderedLabels.map((label) => pageText.indexOf(label));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
});

it("keeps the founded fact in trust and selects commitments by stable database IDs", () => {
  const founded = homeItem({
    id: "founded-2012",
    structuredBody: {
      sections: [
        {
          items: [{ key: "founded", label: "成立年份", value: "2012" }],
          type: "fact-list",
        },
      ],
      version: 1,
    },
    title: "成立于 2012 年",
  });
  const insurance = homeItem({ id: "insurance-solutions", title: "保险与定制方案" });
  const exception = homeItem({ id: "exception-response", title: "2 小时异常响应机制目标" });
  const transparent = homeItem({ id: "transparent-pricing", title: "报价构成透明" });
  const multilingual = homeItem({ id: "multilingual-support", title: "7x24 多语言沟通支持" });
  const unrelated = homeItem({ id: "unrelated-proof", title: "无关证明指标" });

  render(
    <HomepageContent
      content={{
        ...content,
        proof: [founded, exception, unrelated, multilingual, transparent],
        services: [{ ...item, id: "ocean-freight" }, insurance],
      }}
      labels={labels}
      locale="zh"
      processStory={<section>流程内容</section>}
    />,
  );

  const trust = screen.getByRole("region", { name: labels.trustTitle });
  const commitments = screen.getByRole("heading", { name: labels.commitmentsTitle }).closest("section")!;
  expect(within(trust).getByText("2012")).toBeVisible();
  expect(within(commitments).getByText("保险与定制方案")).toBeVisible();
  expect(within(commitments).getByText("2 小时异常响应机制目标")).toBeVisible();
  expect(within(commitments).getByText("报价构成透明")).toBeVisible();
  expect(within(commitments).getByText("7x24 多语言沟通支持")).toBeVisible();
  expect(within(commitments).queryByText("成立于 2012 年")).not.toBeInTheDocument();
  expect(within(commitments).queryByText("2012")).not.toBeInTheDocument();
  expect(within(commitments).queryByText("无关证明指标")).not.toBeInTheDocument();
});

it("renders only available commitment IDs without unrelated substitutes", () => {
  const founded = homeItem({ id: "founded-2012", title: "Founded in 2012" });
  const exception = homeItem({ id: "exception-response", title: "Exception response" });
  const unrelated = homeItem({ id: "other-proof", title: "Other proof" });

  render(
    <HomepageContent
      content={{ ...content, proof: [founded, unrelated, exception], services: [] }}
      labels={labels}
      locale="en"
      processStory={<section>Process</section>}
    />,
  );

  const commitments = screen.getByRole("heading", { name: labels.commitmentsTitle }).closest("section")!;
  const list = within(commitments).getByRole("list");
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  expect(list).toHaveClass("md:grid-cols-1", "xl:grid-cols-1");
  expect(within(commitments).getByText("Exception response")).toBeVisible();
  expect(within(commitments).queryByText("Other proof")).not.toBeInTheDocument();
  expect(within(commitments).queryByText("Founded in 2012")).not.toBeInTheDocument();
});
