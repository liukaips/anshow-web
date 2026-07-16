"use client";

import { ExternalLink, LoaderCircle, ScanEye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { createAdminPreview, type CreateAdminPreviewResult } from "../../../api/admin-previews";

const locales = [
  ["zh", "中文"],
  ["en", "英文"],
  ["ru", "俄文"],
] as const;

export function PublishCenter() {
  const [preview, setPreview] = useState<CreateAdminPreviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      setPreview(await createAdminPreview({ expiresInHours: 24 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成预览失败，请重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">整站预览</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">生成当前所有草稿的固定快照。链接 24 小时内有效，之后修改内容不会改变这份预览。</p>
          </div>
          <button className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} onClick={create} type="button">
            {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ScanEye aria-hidden="true" className="size-4" />}
            生成整站预览
          </button>
        </div>
        <div aria-live="polite" className="mt-4 min-h-6">
          {error ? <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p> : null}
          {preview ? <p className="text-sm font-medium text-[var(--color-teal-ink)]">预览已生成。请分别检查三种语言后再提交审核。</p> : null}
        </div>
      </section>
      {preview ? (
        <section className="border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">预览链接</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {locales.map(([locale, label]) => <Link className="inline-flex min-h-11 items-center justify-between border border-neutral-300 px-4 font-semibold hover:bg-neutral-50" href={`/preview/${encodeURIComponent(preview.rawToken)}/${locale}`} key={locale} target="_blank">查看{label}预览<ExternalLink aria-hidden="true" className="size-4" /></Link>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
