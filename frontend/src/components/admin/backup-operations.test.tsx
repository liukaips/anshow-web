import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminBackupRun } from "@/api/admin-backups";

const { runBackup, stageRestore, verifyBackup } = vi.hoisted(() => ({
  runBackup: vi.fn(),
  stageRestore: vi.fn(),
  verifyBackup: vi.fn(),
}));

vi.mock("@/api/admin-backups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/admin-backups")>()),
  runAdminBackup: runBackup,
  stageAdminBackupRestore: stageRestore,
  verifyAdminBackup: verifyBackup,
}));

import { BackupOperations } from "./backup-operations";

const RUN: AdminBackupRun = {
  id: "run-1",
  status: "succeeded",
  target: "local",
  storageKey: "backups/2026/07/run-1.backup",
  sizeBytes: 2048,
  sha256: "aa".repeat(32),
  actorId: "admin-1",
  startedAt: Date.parse("2026-07-16T10:00:00.000Z"),
  completedAt: Date.parse("2026-07-16T10:01:00.000Z"),
  verifiedAt: null,
  restoreStagedAt: null,
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  runBackup.mockResolvedValue({ ...RUN, id: "run-2" });
  verifyBackup.mockResolvedValue({
    ...RUN,
    status: "verified",
    verifiedAt: Date.parse("2026-07-16T10:02:00.000Z"),
  });
  stageRestore.mockResolvedValue({
    ...RUN,
    status: "verified",
    verifiedAt: Date.parse("2026-07-16T10:02:00.000Z"),
    restoreStagedAt: Date.parse("2026-07-16T10:03:00.000Z"),
  });
});

afterEach(cleanup);

describe("BackupOperations", () => {
  it("shows Chinese backup history without exposing internal storage metadata", () => {
    render(<BackupOperations initialRuns={[RUN]} />);

    expect(screen.getByRole("heading", { name: "备份与恢复验证" })).toBeVisible();
    expect(screen.getByText("备份成功")).toBeVisible();
    expect(screen.getByText("服务器备份卷")).toBeVisible();
    expect(screen.getByText("2 KB")).toBeVisible();
    expect(screen.queryByText(RUN.storageKey!)).toBeNull();
    expect(screen.queryByText(RUN.sha256!)).toBeNull();
  });

  it("creates a backup and adds it to the history", async () => {
    render(<BackupOperations initialRuns={[RUN]} />);

    fireEvent.click(screen.getByRole("button", { name: "立即创建备份" }));

    await waitFor(() => expect(runBackup).toHaveBeenCalledOnce());
    expect(await screen.findByText("备份已创建并保存。")).toBeVisible();
    expect(screen.getAllByText("备份成功")).toHaveLength(2);
  });

  it("verifies a backup in isolation and updates its status", async () => {
    render(<BackupOperations initialRuns={[RUN]} />);

    fireEvent.click(screen.getByRole("button", { name: "验证可恢复性" }));

    await waitFor(() => expect(verifyBackup).toHaveBeenCalledWith("run-1"));
    expect(await screen.findByText("恢复验证通过，线上数据未被修改。")).toBeVisible();
    expect(screen.getByText("验证通过")).toBeVisible();
  });

  it("keeps a safe Chinese error visible when an operation fails", async () => {
    runBackup.mockRejectedValueOnce(new Error("已有备份任务正在执行"));
    render(<BackupOperations initialRuns={[RUN]} />);

    fireEvent.click(screen.getByRole("button", { name: "立即创建备份" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已有备份任务正在执行",
    );
  });

  it("requires confirmation before preparing a verified backup for offline recovery", async () => {
    render(
      <BackupOperations
        initialRuns={[{
          ...RUN,
          status: "verified",
          verifiedAt: Date.parse("2026-07-16T10:02:00.000Z"),
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "准备离线恢复" }));
    expect(screen.getByRole("alertdialog", { name: "准备离线恢复包？" })).toBeVisible();
    expect(stageRestore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认准备" }));

    await waitFor(() => expect(stageRestore).toHaveBeenCalledWith("run-1"));
    expect(await screen.findByText("恢复包已准备完成，请按部署手册停机切换。")).toBeVisible();
    expect(screen.getByText("已准备离线恢复包")).toBeVisible();
  });
});
