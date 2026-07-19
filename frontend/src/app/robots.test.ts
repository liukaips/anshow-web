import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFrontendServerEnv } from "../env";

import robots from "./robots";

vi.mock("../env", () => ({
  getFrontendServerEnv: vi.fn(),
}));

const mockedGetFrontendServerEnv = vi.mocked(getFrontendServerEnv);

describe("robots", () => {
  beforeEach(() => {
    mockedGetFrontendServerEnv.mockReturnValue({
      BACKEND_INTERNAL_URL: "http://backend:4000",
      SITE_URL: "https://www.anshow.test",
    });
  });

  it("allows the public site while excluding private application surfaces", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/preview/", "/api/"],
      },
      sitemap: "https://www.anshow.test/sitemap.xml",
    });
  });
});
