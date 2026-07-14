import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = new Headers({ cookie: "session=test" });

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders),
}));

import { getAdminSession } from "./server";

describe("getAdminSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([401, 403])("returns null for status %s", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status }));

    await expect(getAdminSession()).resolves.toBeNull();
  });
});
