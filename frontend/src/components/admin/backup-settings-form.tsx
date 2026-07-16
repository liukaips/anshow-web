"use client";

import { DatabaseBackup, KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import type {
  AdminSettings,
  BackupSettings,
} from "@/api/admin-settings.server";
import { AdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";

const defaults: BackupSettings = {
  enabled: false,
  intervalHours: 24,
  retentionDays: 30,
  target: "local",
  cosBucket: "",
  cosRegion: "",
  encryptionConfigured: false,
};

type FieldErrors = Partial<
  Record<"encryption" | "intervalHours" | "retentionDays" | "cos", string>
>;

export function BackupSettingsForm({ settings }: { settings: AdminSettings }) {
  const initial = { ...defaults, ...settings.backup };
  const [value, setValue] = useState<BackupSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (value.enabled && !initial.encryptionConfigured) {
      next.encryption = "请先在部署环境中配置备份加密密钥。";
    }
    if (!Number.isInteger(value.intervalHours) || value.intervalHours < 1 || value.intervalHours > 168) {
      next.intervalHours = "备份周期必须在 1 至 168 小时之间。";
    }
    if (!Number.isInteger(value.retentionDays) || value.retentionDays < 1 || value.retentionDays > 3650) {
      next.retentionDays = "保留时间必须在 1 至 3650 天之间。";
    }
    if (
      value.enabled &&
      value.target === "cos" &&
      (!value.cosBucket.trim() || !value.cosRegion.trim())
    ) {
      next.cos = "启用腾讯云 COS 备份前，请填写存储桶和地域。";
    }
    return next;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...settings,
          backup: {
            ...value,
            encryptionConfigured: initial.encryptionConfigured,
          },
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setMessage({ text: "备份设置已保存", tone: "success" });
    } catch {
      setMessage({
        text: "备份设置保存失败，请检查网络后重试",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label="备份设置"
      className="border border-neutral-200 bg-white"
      onSubmit={(event) => void save(event)}
    >
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded bg-sky-50 text-sky-800">
            <DatabaseBackup aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">加密备份</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              设置备份周期、保留时间和存储位置。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-neutral-900">
            <input
              checked={value.enabled}
              className="size-5 accent-[var(--color-cyan-ink)]"
              onChange={(event) => {
                setValue({ ...value, enabled: event.target.checked });
                setErrors((current) => ({ ...current, encryption: undefined }));
              }}
              type="checkbox"
            />
            启用自动备份
          </label>
          {errors.encryption ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {errors.encryption}
            </p>
          ) : null}
        </div>

        <AdminFormField
          error={errors.intervalHours}
          help="可设置为每小时至每 7 天执行一次。"
          htmlFor="backup-interval"
          label="备份周期（小时）"
        >
          <input
            className="min-h-11 rounded border border-neutral-300 px-3 text-base text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
            id="backup-interval"
            max={168}
            min={1}
            onChange={(event) =>
              setValue({ ...value, intervalHours: Number(event.target.value) })
            }
            type="number"
            value={value.intervalHours}
          />
        </AdminFormField>

        <AdminFormField
          error={errors.retentionDays}
          help="过期备份将由后台任务自动清理。"
          htmlFor="backup-retention"
          label="保留天数"
        >
          <input
            className="min-h-11 rounded border border-neutral-300 px-3 text-base text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
            id="backup-retention"
            max={3650}
            min={1}
            onChange={(event) =>
              setValue({ ...value, retentionDays: Number(event.target.value) })
            }
            type="number"
            value={value.retentionDays}
          />
        </AdminFormField>

        <AdminFormField
          help="腾讯云 COS 适合服务器之外的异地备份。"
          htmlFor="backup-target"
          label="存储位置"
        >
          <select
            className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
            id="backup-target"
            onChange={(event) =>
              setValue({
                ...value,
                target: event.target.value as BackupSettings["target"],
              })
            }
            value={value.target}
          >
            <option value="local">服务器备份卷</option>
            <option value="cos">腾讯云 COS</option>
          </select>
        </AdminFormField>

        {value.target === "cos" ? (
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
            <AdminFormField
              error={errors.cos}
              htmlFor="backup-cos-bucket"
              label="COS 存储桶"
            >
              <input
                className="min-h-11 rounded border border-neutral-300 px-3 text-base text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
                id="backup-cos-bucket"
                onChange={(event) =>
                  setValue({ ...value, cosBucket: event.target.value })
                }
                value={value.cosBucket}
              />
            </AdminFormField>
            <AdminFormField
              htmlFor="backup-cos-region"
              label="COS 地域"
            >
              <input
                className="min-h-11 rounded border border-neutral-300 px-3 text-base text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
                id="backup-cos-region"
                onChange={(event) =>
                  setValue({ ...value, cosRegion: event.target.value })
                }
                value={value.cosRegion}
              />
            </AdminFormField>
          </div>
        ) : null}
      </div>

      <div className="grid gap-px border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2">
        <div className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 sm:px-5">
          <KeyRound aria-hidden="true" className="size-5 text-neutral-600" />
          <div>
            <p className="text-xs text-neutral-500">加密密钥</p>
            <p className="text-sm font-medium text-neutral-900">
              {initial.encryptionConfigured ? "已安全配置" : "尚未配置"}
            </p>
          </div>
        </div>
        <div className="flex min-h-16 items-center gap-3 bg-white px-4 py-3 sm:px-5">
          <ShieldCheck aria-hidden="true" className="size-5 text-neutral-600" />
          <div>
            <p className="text-xs text-neutral-500">恢复校验</p>
            <p className="text-sm font-medium text-neutral-900">
              加密签名、清单和文件校验和
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-sm leading-6 text-neutral-600">
          密钥由部署环境管理，不会显示或保存在浏览器中。
        </p>
        <button
          className="min-h-11 shrink-0 rounded bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "正在保存..." : "保存备份设置"}
        </button>
      </div>
      {message ? (
        <div className="border-t border-neutral-200 p-3">
          <AdminToast message={message.text} tone={message.tone} />
        </div>
      ) : null}
    </form>
  );
}
