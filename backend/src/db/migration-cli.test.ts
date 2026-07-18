import { describe, expect, it, vi } from "vitest";

import { formatMigrationFailure } from "./migration-cli.js";

describe("formatMigrationFailure", () => {
  it("includes the message from an Error", () => {
    const error = Object.assign(new Error("unable to open database"), {
      secret: "do-not-log-this",
    });

    expect(formatMigrationFailure(error)).toBe(
      "Database migration and initialization failed: unable to open database",
    );
    expect(formatMigrationFailure(error)).not.toContain("do-not-log-this");
  });

  it("uses the Error name when its message is empty", () => {
    const error = new Error("");
    error.name = "DatabaseError";

    expect(formatMigrationFailure(error)).toBe(
      "Database migration and initialization failed: DatabaseError",
    );
  });

  it.each([
    ["migration interrupted", "migration interrupted"],
    [42, "42"],
    [true, "true"],
    [12n, "12"],
    [undefined, "undefined"],
    [null, "null"],
  ])("formats the safe primitive %s", (thrown, expected) => {
    expect(formatMigrationFailure(thrown)).toBe(
      `Database migration and initialization failed: ${expected}`,
    );
  });

  it("does not invoke a thrown object's custom toString", () => {
    const toString = vi.fn(() => "secret-from-toString");

    const result = formatMigrationFailure({ toString });

    expect(result).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
    expect(result).not.toContain("secret-from-toString");
    expect(toString).not.toHaveBeenCalled();
  });

  it("does not invoke a thrown object's Symbol.toPrimitive", () => {
    const toPrimitive = vi.fn(() => "secret-from-toPrimitive");

    const result = formatMigrationFailure({ [Symbol.toPrimitive]: toPrimitive });

    expect(result).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
    expect(result).not.toContain("secret-from-toPrimitive");
    expect(toPrimitive).not.toHaveBeenCalled();
  });

  it("does not throw when object coercion methods throw", () => {
    const thrown = {
      toString: () => {
        throw new Error("secret-from-toString");
      },
      valueOf: () => {
        throw new Error("secret-from-valueOf");
      },
      [Symbol.toPrimitive]: () => {
        throw new Error("secret-from-toPrimitive");
      },
    };

    expect(() => formatMigrationFailure(thrown)).not.toThrow();
    const result = formatMigrationFailure(thrown);
    expect(result).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
    expect(result).not.toContain("secret");
  });

  it("uses a fixed placeholder for functions", () => {
    expect(formatMigrationFailure(() => "secret-from-function")).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
  });

  it("uses a fixed placeholder for symbols without exposing the description", () => {
    expect(formatMigrationFailure(Symbol("secret-symbol-description"))).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
  });

  it("uses a fixed placeholder for non-finite numbers", () => {
    expect(formatMigrationFailure(Number.POSITIVE_INFINITY)).toBe(
      "Database migration and initialization failed: [non-Error thrown value]",
    );
  });
});
