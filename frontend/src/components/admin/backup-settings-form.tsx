"use client";

import { useState } from "react";
import type { AdminSettings, BackupSettings } from "@/api/admin-settings.server";

const defaults: BackupSettings = {
  enabled: false,
  intervalHours: 24,
  retentionDays: 30,
  target: "local",
  cosBucket: "",
  cosRegion: "",
  encryptionConfigured: false,
};

export function BackupSettingsForm({ settings }: { settings: AdminSettings }) {
  const [value, setValue] = useState<BackupSettings>({ ...defaults, ...settings.backup });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settings, backup: value }),
      });
      if (!response.ok) throw new Error("save failed");
      setMessage("Backup policy saved");
    } catch {
      setMessage("Could not save backup policy");
    } finally {
      setBusy(false);
    }
  }

  return <section className="border border-neutral-200 bg-white" aria-label="备份设置">
    <div className="border-b border-neutral-200 px-4 py-4"><h2 className="text-lg font-semibold">加密备份</h2><p className="mt-1 text-sm text-neutral-600">配置备份周期和保留策略。加密密钥由部署环境管理，页面不会显示密钥。</p></div>
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.enabled} onChange={(event) => setValue({ ...value, enabled: event.target.checked })} /> 启用定时备份</label>
      <label className="grid gap-1 text-sm font-medium">备份周期（小时）<input className="min-h-11 border border-neutral-300 px-3" type="number" min={1} max={168} value={value.intervalHours} onChange={(event) => setValue({ ...value, intervalHours: Number(event.target.value) })} /></label>
      <label className="grid gap-1 text-sm font-medium">保留天数<input className="min-h-11 border border-neutral-300 px-3" type="number" min={1} max={3650} value={value.retentionDays} onChange={(event) => setValue({ ...value, retentionDays: Number(event.target.value) })} /></label>
      <label className="grid gap-1 text-sm font-medium">存储目标<select className="min-h-11 border border-neutral-300 px-3" value={value.target} onChange={(event) => setValue({ ...value, target: event.target.value as BackupSettings["target"] })}><option value="local">服务器备份卷</option><option value="cos">腾讯云 COS</option></select></label>
      <label className="grid gap-1 text-sm font-medium">COS 存储桶<input className="min-h-11 border border-neutral-300 px-3" value={value.cosBucket} onChange={(event) => setValue({ ...value, cosBucket: event.target.value })} /></label>
      <label className="grid gap-1 text-sm font-medium">COS 地域<input className="min-h-11 border border-neutral-300 px-3" value={value.cosRegion} onChange={(event) => setValue({ ...value, cosRegion: event.target.value })} /></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-4"><p className="text-sm text-neutral-600">加密状态：<strong>{value.encryptionConfigured ? "已配置" : "未配置"}</strong></p><button className="min-h-11 bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void save()}>{busy ? "保存中..." : "保存备份策略"}</button></div>
    {message ? <p className="border-t border-neutral-200 px-4 py-3 text-sm" role="status">{message}</p> : null}
  </section>;
}
