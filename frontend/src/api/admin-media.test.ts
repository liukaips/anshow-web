import { afterEach, describe, expect, it, vi } from "vitest";

import { retryAdminMediaCleanup } from "./admin-media";

afterEach(() => vi.unstubAllGlobals());

describe("administration media API", () => {
  it("retries cleanup through the generated same-origin operation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { attempted: 3, remaining: 1 },
          error: null,
          requestId: "request-1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryAdminMediaCleanup()).resolves.toEqual({
      attempted: 3,
      remaining: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/media/cleanup/retry",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });
});
