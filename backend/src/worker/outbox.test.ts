import { describe, expect, it } from "vitest";
import { nextRetryAt } from "./outbox.js";

describe("outbox retry policy", () => {
  it("uses bounded exponential retry windows", () => {
    const base = new Date("2026-07-14T00:00:00Z");
    expect(nextRetryAt(base, 1).toISOString()).toBe("2026-07-14T00:01:00.000Z");
    expect(nextRetryAt(base, 3).toISOString()).toBe("2026-07-14T00:15:00.000Z");
    expect(nextRetryAt(base, 99).toISOString()).toBe("2026-07-14T06:00:00.000Z");
  });
});
