import { afterEach, describe, expect, it, vi } from "vitest";

const requestHeaders = new Headers({ cookie: "session=admin-test" });

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders),
}));

import {
  publishAdminContentTranslation,
  saveAdminContentDraft,
  scheduleAdminContentTranslation,
} from "./admin-content";
import { listAdminContent } from "./admin-content.server";

const item = {
  id: "content-1",
  code: "freight-service",
  sortOrder: 0,
  archivedAt: null,
  verified: false,
  verificationSource: null,
  createdAt: "2026-07-15T04:00:00.000Z",
  updatedAt: "2026-07-15T04:00:00.000Z",
  translations: {},
};

function jsonResponse(data: unknown) {
  return new Response(
    JSON.stringify({ data, error: null, requestId: "request-1" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("administration content API", () => {
  it("reads through the private backend URL and forwards request cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([item]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listAdminContent("services", { baseUrl: "http://backend:4000" }),
    ).resolves.toEqual([item]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:4000/api/admin/content/services",
      expect.objectContaining({
        cache: "no-store",
        headers: { cookie: "session=admin-test" },
      }),
    );
  });

  it("writes through same-origin admin paths with JSON bodies", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse(item)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      title: "Freight service",
      slug: "freight-service",
      summary: "Summary",
      body: "Body",
      seoTitle: "Freight service",
      seoDescription: "Search description",
      altText: "Cargo at a terminal",
    };

    await saveAdminContentDraft("services", "content-1", "ru", input);
    await publishAdminContentTranslation("services", "content-1", "ru", input);
    await scheduleAdminContentTranslation("services", "content-1", "ru", {
      ...input,
      scheduledAt: "2026-07-16T04:00:00.000Z",
    });

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [
        "/api/admin/content/services/content-1/translations/ru",
        "PUT",
      ],
      [
        "/api/admin/content/services/content-1/translations/ru/publish",
        "POST",
      ],
      [
        "/api/admin/content/services/content-1/translations/ru/schedule",
        "POST",
      ],
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify(input),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      body: JSON.stringify({
        ...input,
        scheduledAt: "2026-07-16T04:00:00.000Z",
      }),
    });
  });

  it("retains safe validation fields from an API error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "VALIDATION_ERROR",
              message: "The request is invalid.",
              fields: { seoTitle: ["SEO title is invalid."] },
            },
            requestId: "request-validation",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = await saveAdminContentDraft(
      "services",
      "content-1",
      "en",
      {
        title: "Title",
        slug: "title",
        summary: "Summary",
        body: "Body",
        seoTitle: "",
        seoDescription: "Description",
        altText: "Alt",
      },
    ).catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      fields: { seoTitle: ["SEO title is invalid."] },
      requestId: "request-validation",
    });
  });
});
