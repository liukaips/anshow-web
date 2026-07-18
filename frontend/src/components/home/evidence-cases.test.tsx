import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { EvidenceCases } from "./evidence-cases";
import { homeItem } from "./home-item.test-fixture";

const cases = Array.from({ length: 5 }, (_, index) =>
  homeItem({
    id: `case-${index}`,
    slug: `case-${index}`,
    structuredBody: {
      sections: [
        { type: "paragraph", text: "Project context" },
        {
          items: [
            { key: "weight", label: "Weight", unit: "t", value: `${index + 1}` },
            { key: "duration", label: "Transit", unit: "days", value: `${index + 10}` },
          ],
          type: "fact-list",
        },
      ],
      version: 1,
    },
    summary: `Database case summary ${index}`,
    title: `Database case title ${index}`,
  }),
);

afterEach(cleanup);

it("renders the first four published cases and their structured database facts", () => {
  render(
    <EvidenceCases
      allCases="View all representative cases"
      eyebrow="Representative projects"
      items={cases}
      learnMore="View project"
      locale="en"
      title="Evidence from real freight work"
    />,
  );

  expect(screen.getByText("Database case summary 0")).toBeVisible();
  expect(screen.getByText("10")).toBeVisible();
  expect(screen.getAllByText("days")).toHaveLength(4);
  expect(screen.getByRole("link", { name: /View project.*Database case title 0/ })).toHaveAttribute(
    "href",
    "/en/case-studies/case-0",
  );
  expect(screen.queryByText("Database case title 4")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View all representative cases" })).toHaveAttribute(
    "href",
    "/en/case-studies",
  );
});

it("keeps collection and detail links inside preview", () => {
  render(
    <EvidenceCases
      allCases="查看全部代表性项目"
      eyebrow="代表性项目"
      items={cases.slice(0, 1)}
      learnMore="查看项目"
      locale="zh"
      pathPrefix="/preview/sample-token"
      title="真实项目中的执行证据"
    />,
  );

  expect(screen.getByRole("link", { name: /查看项目.*Database case title 0/ })).toHaveAttribute(
    "href",
    "/preview/sample-token/zh/case-studies/case-0",
  );
  expect(screen.getByRole("link", { name: "查看全部代表性项目" })).toHaveAttribute(
    "href",
    "/preview/sample-token/zh/case-studies",
  );
});
