import { describe, expect, it, vi } from "vitest";

import { runBackupScheduleTick } from "./backup-scheduler.js";

describe("backup scheduler", () => {
  it("delegates due-time decisions to the manager", async () => {
    const runDue = vi.fn(async () => null);

    await expect(runBackupScheduleTick({ runDue })).resolves.toBeNull();

    expect(runDue).toHaveBeenCalledOnce();
  });

  it("reports a safe diagnostic and keeps the worker alive after failure", async () => {
    const logError = vi.fn();
    const runDue = vi.fn(async () => {
      throw new Error("secret credential value");
    });

    await expect(
      runBackupScheduleTick({ runDue }, logError),
    ).resolves.toBeNull();

    expect(logError).toHaveBeenCalledWith("Backup scheduler tick failed", {
      name: "Error",
    });
    expect(JSON.stringify(logError.mock.calls)).not.toContain("credential value");
  });
});
