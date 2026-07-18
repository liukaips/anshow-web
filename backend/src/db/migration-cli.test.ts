import { describe, expect, it } from "vitest";

import { formatMigrationFailure } from "./migration-cli.js";

describe("formatMigrationFailure", () => {
  it("includes the message from an Error", () => {
    expect(formatMigrationFailure(new Error("unable to open database"))).toBe(
      "Database migration and initialization failed: unable to open database",
    );
  });

  it("includes a safely stringified non-Error value", () => {
    expect(formatMigrationFailure("migration interrupted")).toBe(
      "Database migration and initialization failed: migration interrupted",
    );
  });

  it("does not serialize secret-like properties from thrown objects", () => {
    const thrown = {
      databasePath: "/private/database.db",
      secret: "do-not-log-this",
    };

    expect(formatMigrationFailure(thrown)).toBe(
      "Database migration and initialization failed: [object Object]",
    );
    expect(formatMigrationFailure(thrown)).not.toContain("do-not-log-this");
    expect(formatMigrationFailure(thrown)).not.toContain("/private/database.db");
  });
});
