import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import { BackupManagerError, type BackupRun } from "../../backup/backup-manager.js";

const NOW = new Date("2026-07-16T10:00:00.000Z");
const RUN: BackupRun = {
  id: "run-1",
  status: "succeeded",
  target: "local",
  storageKey: "backups/2026/07/run-1.backup",
  sizeBytes: 1234,
  sha256: "aa".repeat(32),
  actorId: "admin-1",
  startedAt: NOW,
  completedAt: NOW,
  verifiedAt: null,
  restoreStagedAt: null,
  error: null,
};

function manager() {
  return {
    list: vi.fn(() => [RUN]),
    runNow: vi.fn(async () => RUN),
    verify: vi.fn(async () => ({ ...RUN, status: "verified" as const, verifiedAt: NOW })),
    stageRestore: vi.fn(async () => ({ ...RUN, status: "verified" as const, verifiedAt: NOW, restoreStagedAt: NOW })),
  };
}

const getSession = async () => ({
  user: { id: "admin-1", email: "admin@example.test" },
});

describe("admin backup routes", () => {
  it.each([
    ["GET", "/api/admin/backups"],
    ["POST", "/api/admin/backups/run"],
    ["POST", "/api/admin/backups/run-1/verify"],
    ["POST", "/api/admin/backups/run-1/stage-restore"],
  ])("requires settings.manage for %s %s", async (method, path) => {
    const backupManager = manager();
    const app = createApp({ backupManager, getSession, getPermissions: () => [] });

    const response = await app.request(path, { method });

    expect(response.status).toBe(403);
    expect(backupManager.list).not.toHaveBeenCalled();
    expect(backupManager.runNow).not.toHaveBeenCalled();
    expect(backupManager.verify).not.toHaveBeenCalled();
    expect(backupManager.stageRestore).not.toHaveBeenCalled();
  });

  it("lists safe run metadata as timestamps", async () => {
    const backupManager = manager();
    const app = createApp({
      backupManager,
      getSession,
      getPermissions: () => ["settings.manage"],
    });

    const response = await app.request("/api/admin/backups?limit=20");

    expect(response.status).toBe(200);
    expect(backupManager.list).toHaveBeenCalledWith(20);
    expect(await response.json()).toMatchObject({
      data: [{ id: "run-1", startedAt: NOW.getTime(), completedAt: NOW.getTime() }],
    });
  });

  it("runs, verifies, and stages backups with the authenticated actor", async () => {
    const backupManager = manager();
    const app = createApp({
      backupManager,
      getSession,
      getPermissions: () => ["settings.manage"],
    });

    expect((await app.request("/api/admin/backups/run", { method: "POST" })).status).toBe(200);
    expect((await app.request("/api/admin/backups/run-1/verify", { method: "POST" })).status).toBe(200);
    expect((await app.request("/api/admin/backups/run-1/stage-restore", { method: "POST" })).status).toBe(200);
    expect(backupManager.runNow).toHaveBeenCalledWith("admin-1");
    expect(backupManager.verify).toHaveBeenCalledWith("run-1", "admin-1");
    expect(backupManager.stageRestore).toHaveBeenCalledWith("run-1", "admin-1");
  });

  it("returns a Chinese safe domain error without leaking storage details", async () => {
    const backupManager = manager();
    backupManager.runNow.mockRejectedValue(
      new BackupManagerError(
        "BACKUP_RUN_FAILED",
        "备份执行失败，请查看运行记录",
      ),
    );
    const app = createApp({
      backupManager,
      getSession,
      getPermissions: () => ["settings.manage"],
    });

    const response = await app.request("/api/admin/backups/run", { method: "POST" });

    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("备份执行失败，请查看运行记录");
    expect(body).not.toContain("secret");
  });

  it("maps missing runs and concurrent operations to their public status codes", async () => {
    const backupManager = manager();
    backupManager.verify.mockRejectedValueOnce(
      new BackupManagerError("BACKUP_RUN_NOT_FOUND", "备份记录不存在"),
    );
    backupManager.runNow.mockRejectedValueOnce(
      new BackupManagerError("BACKUP_ALREADY_RUNNING", "已有备份任务正在执行"),
    );
    const app = createApp({
      backupManager,
      getSession,
      getPermissions: () => ["settings.manage"],
    });

    expect((await app.request("/api/admin/backups/missing/verify", { method: "POST" })).status).toBe(404);
    expect((await app.request("/api/admin/backups/run", { method: "POST" })).status).toBe(409);
  });
});
