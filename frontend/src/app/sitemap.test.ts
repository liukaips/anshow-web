import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPublishedUrls } from "../api/public-content.server";
import { getFrontendServerEnv } from "../env";

import sitemap from "./sitemap";

vi.mock("../api/public-content.server", () => ({
  listPublishedUrls: vi.fn(),
}));

vi.mock("../env", () => ({
  getFrontendServerEnv: vi.fn(),
}));

const mockedListPublishedUrls = vi.mocked(listPublishedUrls);
const mockedGetFrontendServerEnv = vi.mocked(getFrontendServerEnv);

describe("sitemap", () => {
  beforeEach(() => {
    mockedGetFrontendServerEnv.mockReturnValue({
      BACKEND_INTERNAL_URL: "http://backend:4000",
      SITE_URL: "https://www.anshow.test",
    });
  });

  it("emits absolute canonical and language URLs from published records", async () => {
    mockedListPublishedUrls.mockResolvedValue([
      {
        path: "/en/services/ocean-freight",
        updatedAt: "2026-07-14T12:00:00.000Z",
        alternates: {
          en: "/en/services/ocean-freight",
          zh: "/zh/services/hai-yun-fu-wu",
          ru: "/ru/services/morskie-perevozki",
        },
      },
    ]);

    await expect(sitemap()).resolves.toEqual([
      {
        url: "https://www.anshow.test/en/services/ocean-freight",
        lastModified: "2026-07-14T12:00:00.000Z",
        alternates: {
          languages: {
            en: "https://www.anshow.test/en/services/ocean-freight",
            zh: "https://www.anshow.test/zh/services/hai-yun-fu-wu",
            ru: "https://www.anshow.test/ru/services/morskie-perevozki",
          },
        },
      },
    ]);
    expect(mockedListPublishedUrls).toHaveBeenCalledOnce();
  });

  it("rejects paths that can escape the configured public origin", async () => {
    mockedListPublishedUrls.mockResolvedValue([
      {
        path: "https://untrusted.test/phishing",
        updatedAt: "2026-07-14T12:00:00.000Z",
        alternates: { en: "/en" },
      },
    ]);

    await expect(sitemap()).rejects.toThrow(/root-relative/);
  });
});
