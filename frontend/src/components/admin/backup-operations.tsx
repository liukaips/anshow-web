"use client";

import {
  BadgeCheck,
  CircleAlert,
  DatabaseBackup,
  HardDrive,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import {
  runAdminBackup,
  stageAdminBackupRestore,
  verifyAdminBackup,
  type AdminBackupRun,
} from "@/api/admin-backups";
import { AdminConfirmDialog } from "@/components/admin/ui/admin-feedback";

const statusLabels: Record<AdminBackupRun["status"], string> = {
  running: "正在备份",
  succeeded: "备份成功",
  failed: "执行失败",
  verified: "验证通过",
};

function formatBytes(value: number | null): string {
  if (value === null) return "--";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: number | null): string {
  if (value === null) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BackupOperations({
  initialRuns,
}: {
  initialRuns: AdminBackupRun[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [pending, setPending] = useState<string | null>(null);
  const [stageConfirmation, setStageConfirmation] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  async function runNow() {
    setPending("run");
    setMessage(null);
    try {
      const run = await runAdminBackup();
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setMessage({ tone: "success", text: "备份已创建并保存。" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "备份创建失败，请稍后重试。",
      });
    } finally {
      setPending(null);
    }
  }

  async function verify(id: string) {
    setPending(id);
    setMessage(null);
    try {
      const run = await verifyAdminBackup(id);
      setRuns((current) =>
        current.map((item) => (item.id === run.id ? run : item)),
      );
      setMessage({
        tone: "success",
        text: "恢复验证通过，线上数据未被修改。",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "恢复验证失败，请查看运行记录。",
      });
    } finally {
      setPending(null);
    }
  }

  async function stageRestore(id: string) {
    setStageConfirmation(null);
    setPending(`stage:${id}`);
    setMessage(null);
    try {
      const run = await stageAdminBackupRestore(id);
      setRuns((current) =>
        current.map((item) => (item.id === run.id ? run : item)),
      );
      setMessage({
        tone: "success",
        text: "恢复包已准备完成，请按部署手册停机切换。",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "恢复包准备失败，请稍后重试。",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="border border-neutral-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded bg-sky-50 text-sky-800">
            <DatabaseBackup aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              备份与恢复验证
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              手动创建恢复点，并在隔离目录中验证数据完整性。
            </p>
          </div>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => void runNow()}
          type="button"
        >
          {pending === "run" ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <HardDrive aria-hidden="true" className="size-4" />
          )}
          立即创建备份
        </button>
      </div>

      {message ? (
        <div
          className={`flex items-center gap-2 border-b border-neutral-200 px-4 py-3 text-sm font-medium sm:px-5 ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.tone === "error" ? (
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
          )}
          {message.text}
        </div>
      ) : null}

      {runs.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="font-medium text-neutral-900">尚无备份记录</p>
          <p className="mt-1 text-sm text-neutral-600">
            保存备份设置后，可立即创建第一份恢复点。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {runs.map((run) => {
            const canVerify = run.status === "succeeded" || run.status === "verified";
            return (
              <div
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(11rem,1.3fr)_minmax(8rem,0.8fr)_minmax(7rem,0.7fr)_minmax(11rem,auto)] sm:items-center sm:px-5"
                key={run.id}
              >
                <div>
                  <p className="font-semibold text-neutral-950">
                    {statusLabels[run.status]}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {formatTime(run.startedAt)}
                  </p>
                  {run.error ? (
                    <p className="mt-1 break-words text-sm text-red-700">
                      {run.error}
                    </p>
                  ) : null}
                  {run.restoreStagedAt ? (
                    <p className="mt-1 text-sm font-medium text-emerald-700">
                      已准备离线恢复包
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs text-neutral-500">存储位置</p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">
                    {run.target === "cos" ? "腾讯云 COS" : "服务器备份卷"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">备份大小</p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">
                    {formatBytes(run.sizeBytes)}
                  </p>
                </div>
                <div className="grid gap-2">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canVerify || pending !== null}
                    onClick={() => void verify(run.id)}
                    type="button"
                  >
                    {pending === run.id ? (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="size-4" />
                    )}
                    {run.status === "verified" ? "重新验证" : "验证可恢复性"}
                  </button>
                  {run.status === "verified" ? (
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={pending !== null}
                      onClick={() => setStageConfirmation(run.id)}
                      type="button"
                    >
                      {pending === `stage:${run.id}` ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <PackageCheck aria-hidden="true" className="size-4" />
                      )}
                      准备离线恢复
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AdminConfirmDialog
        confirmLabel="确认准备"
        description="系统会再次校验备份并在受保护目录中解密恢复包，不会修改当前线上数据库。准备完成后仍需按部署手册停机切换。"
        onCancel={() => setStageConfirmation(null)}
        onConfirm={() => {
          if (stageConfirmation) void stageRestore(stageConfirmation);
        }}
        open={stageConfirmation !== null}
        title="准备离线恢复包？"
      />
    </section>
  );
}
