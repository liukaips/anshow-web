import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { homeItem } from "./home-item.test-fixture";
import { TrustBar } from "./trust-bar";

const certificates = ["IATA", "NVOCC", "WCA", "JCtrans"].map((title, index) =>
  homeItem({
    id: `certificate-${index}`,
    slug: `certificate-${index}`,
    summary: `${title} database summary`,
    title,
  }),
);

const founded = homeItem({
  id: "founded",
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

afterEach(cleanup);

describe("TrustBar", () => {
  it("renders company facts and certificate claims from API props", () => {
    render(
      <TrustBar
        certificates={certificates}
        labels={{ basic: "会员 / 资质", verified: "已核实" }}
        proof={[founded]}
        title="企业事实与资质"
        verifiedTrust={[certificates[0]]}
      />,
    );

    expect(screen.getByText("2012")).toBeVisible();
    for (const title of ["IATA", "NVOCC", "WCA", "JCtrans"]) {
      expect(screen.getByText(title)).toBeVisible();
      expect(screen.getByText(`${title} database summary`)).toBeVisible();
    }
  });

  it("labels only API-verified certificate items as verified", () => {
    render(
      <TrustBar
        certificates={certificates}
        labels={{ basic: "Membership / qualification", verified: "Verified" }}
        proof={[founded]}
        title="Company facts and qualifications"
        verifiedTrust={[certificates[0]]}
      />,
    );

    const iata = screen.getByRole("listitem", { name: /IATA/ });
    const nvocc = screen.getByRole("listitem", { name: /NVOCC/ });
    expect(within(iata).getByText("Verified")).toBeVisible();
    expect(within(nvocc).getByText("Membership / qualification")).toBeVisible();
    expect(within(nvocc).queryByText("Verified")).not.toBeInTheDocument();
  });
});
