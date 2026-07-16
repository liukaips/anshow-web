"use client";

import { CheckCircle2, ExternalLink, LoaderCircle, ScanEye, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { createAdminPreview, publishAdminPreview, type CreateAdminPreviewResult } from "../../../api/admin-previews";

const locales = [
  ["zh", "中文"],
  ["en", "英文"],
  ["ru", "俄文"],
] as const;

export function PublishCenter({ canPublish = false }: Readonly<{ canPublish?: boolean }>) {
  const [preview, setPreview] = useState<CreateAdminPreviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      setPreview(await createAdminPreview({ expiresInHours: 24 }));
      setConfirmed(false);
      setPublishedCount(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成预览失败，请重试。");
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!preview || !confirmed) return;
    setPublishPending(true);
    setError(null);
    try {
      const result = await publishAdminPreview(preview.snapshotId, {
        expectedHash: preview.contentHash,
      });
      setPublishedCount(result.publishedChanges);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发布失败，请刷新后重新生成预览。");
    } finally {
      setPublishPending(false);
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
          {preview ? <p className="text-sm font-medium text-[var(--color-teal-ink)]">预览已生成。请分别检查三种语言和页面布局。</p> : null}
        </div>
      </section>
      {preview ? (
        <section className="border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">预览链接</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {locales.map(([locale, label]) => <Link className="inline-flex min-h-11 items-center justify-between border border-neutral-300 px-4 font-semibold hover:bg-neutral-50" href={`/preview/${encodeURIComponent(preview.rawToken)}/${locale}`} key={locale} target="_blank">查看{label}预览<ExternalLink aria-hidden="true" className="size-4" /></Link>)}
          </div>
          {preview.sourceVersions.length === 0 ? (
            <p className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">当前没有已通过审核的内容变更。请先在审核中心完成审核，再重新生成预览。</p>
          ) : canPublish ? (
            <div className="mt-5 grid gap-3 border-t border-neutral-200 pt-5">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-neutral-800">
                <input checked={confirmed} className="size-5 accent-[var(--color-action)]" disabled={publishedCount !== null || publishPending} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
                我已检查中文、英文和俄文预览
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-600">将原子发布此快照中的 {preview.sourceVersions.length} 项已审核变更；内容如已更新，系统会拒绝发布。</p>
                <button className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-[var(--color-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!confirmed || publishPending || publishedCount !== null} onClick={publish} type="button">
                  {publishPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden="true" className="size-4" />}
                  {publishPending ? "正在发布..." : "发布已确认版本"}
                </button>
              </div>
              {publishedCount !== null ? <p className="flex items-center gap-2 text-sm font-medium text-emerald-800" role="status"><CheckCircle2 aria-hidden="true" className="size-4" />已成功发布 {publishedCount} 项内容变更</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
