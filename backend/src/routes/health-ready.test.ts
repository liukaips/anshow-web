import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { createTestDatabase } from "../db/test-db.js";
import { createDatabaseReadinessCheck } from "./health-ready.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health/ready", () => {
  it("runs a SQLite query and returns the ready envelope", async () => {
    const testDatabase = createTestDatabase();

    try {
      const response = await createApp({
        checkReadiness: createDatabaseReadinessCheck(testDatabase.db),
      }).request("/api/health/ready");
      const requestId = response.headers.get("x-request-id");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: { status: "ready" },
        error: null,
        requestId,
      });
    } finally {
      testDatabase.close();
    }
  });

  it("returns NOT_READY without disclosing database errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await createApp({
      checkReadiness: () => {
        throw new Error("database path and SQL details");
      },
    }).request("/api/health/ready");
    const requestId = response.headers.get("x-request-id");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      data: null,
      error: {
        code: "NOT_READY",
        message: "The service is not ready.",
      },
      requestId,
    });
    expect(JSON.stringify(body)).not.toContain("database path");
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "health.readiness_failed",
        requestId,
      }),
    );
  });
});
