import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { backupRunStatuses, backupRuns } from "./backups.js";

describe("backup persistence schema", () => {
  it("exports the backup run history table and complete status vocabulary", () => {
    expect(getTableName(backupRuns)).toBe("backup_runs");
    expect(backupRunStatuses).toEqual([
      "running",
      "succeeded",
      "failed",
      "verified",
    ]);
  });

  it("indexes status and start time for history and scheduler reads", () => {
    const indexes = getTableConfig(backupRuns).indexes.map(
      (index) => index.config.name,
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        "backup_runs_status_started_idx",
        "backup_runs_started_idx",
      ]),
    );
  });

  it("records when a verified backup has been staged for offline recovery", () => {
    const columns = getTableConfig(backupRuns).columns.map(
      (column) => column.name,
    );

    expect(columns).toContain("restore_staged_at");
  });
});
