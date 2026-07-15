import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ApiError } from "./http";
import { refreshPublicHome } from "./public-content.browser";
import {
  getPublicContent,
  getPublicHome,
  listPublicContent,
  listPublishedUrls,
} from "./public-content.server";

const emptyHome = {
  locale: "en" as const,
  headline: "Freight connected globally",
  slides: [],
  services: [],
  tradeLanes: [],
  cargoTypes: [],
  proof: [],
  verifiedTrust: [],
  certificates: [],
  cases: [],
  articles: [],
  channels: [],
};

function jsonResponse(data: unknown, requestId = "request-1") {
  return new Response(
    JSON.stringify({ data, error: null, requestId }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public content server client", () => {
  it("uses the private backend URL with no-store caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(emptyHome));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getPublicHome("en", { baseUrl: "http://backend:4000" }),
    ).resolves.toEqual(emptyHome);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:4000/api/public/content/home/en",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("URL-encodes every dynamic path segment", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse([])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listPublicContent("special-cargo", "zh", {
      baseUrl: "http://backend:4000/base/",
    });
    await getPublicContent("services", "en", "ocean freight/priority", {
      baseUrl: "http://backend:4000/base/",
    });
    await listPublishedUrls({ baseUrl: "http://backend:4000/base/" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://backend:4000/api/public/content/special-cargo/zh",
      "http://backend:4000/api/public/content/services/en/ocean%20freight%2Fpriority",
      "http://backend:4000/api/public/content/sitemap",
    ]);
  });

  it("throws a typed API error from a structured error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: { code: "CONTENT_NOT_FOUND", message: "Not found" },
            requestId: "request-404",
          }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const error = await getPublicContent("services", "ru", "missing", {
      baseUrl: "http://backend:4000",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: "CONTENT_NOT_FOUND",
      message: "Not found",
      requestId: "request-404",
    });
  });

  it.each([
    new Response("upstream secret detail", {
      status: 502,
      headers: { "content-type": "text/plain" },
    }),
    new Response(null, { status: 503 }),
  ])("handles non-JSON and empty error responses without leaking bodies", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const error = await getPublicHome("en", {
      baseUrl: "http://backend:4000",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: response.status,
      code: "API_REQUEST_FAILED",
      message: "API request failed.",
    });
    expect(String(error)).not.toContain("upstream secret detail");
  });

  it("rejects a successful response that is missing envelope data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: null, requestId: "request-bad" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      getPublicHome("en", { baseUrl: "http://backend:4000" }),
    ).rejects.toMatchObject({
      status: 200,
      code: "API_REQUEST_FAILED",
      requestId: "request-bad",
    });
  });

  it("rejects a success envelope whose error field is not null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: emptyHome,
            error: "malformed upstream error",
            requestId: "request-malformed",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      getPublicHome("en", { baseUrl: "http://backend:4000" }),
    ).rejects.toMatchObject({
      status: 200,
      code: "API_REQUEST_FAILED",
      requestId: "request-malformed",
    });
  });
});

describe("public content browser client", () => {
  it("uses only the same-origin API path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(emptyHome));
    vi.stubGlobal("fetch", fetchMock);

    await refreshPublicHome("en");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/content/home/en",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
