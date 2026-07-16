"use client";

import { Check, ExternalLink, LoaderCircle, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { approveAdminReview, rejectAdminReview, type AdminReview } from "../../../api/admin-reviews";

const collectionLabels: Record<string, string> = { services: "服务", pages: "页面", articles: "文章", "trade-lanes": "贸易航线", "case-studies": "案例", "hero-slides": "首屏轮播", "cargo-types": "特种货物", partners: "合作伙伴", certificates: "资质证书", "proof-metrics": "证明指标", "navigation-items": "导航项目" };

export function ReviewCenter({ initialItems }: { initialItems: readonly AdminReview[] }) {
  const [items, setItems] = useState([...initialItems]);
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function approve(item: AdminReview) {
    setPending(item.id); setMessage(null);
    try { await approveAdminReview(item.id, { expectedVersion: item.sourceVersion }); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setMessage("审核已通过"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "审核操作失败"); }
    finally { setPending(null); }
  }
  async function reject(item: AdminReview) {
    const text = reason[item.id]?.trim();
    if (!text) { setMessage("请填写退回原因"); return; }
    setPending(item.id); setMessage(null);
    try { await rejectAdminReview(item.id, { expectedVersion: item.sourceVersion, reason: text }); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setMessage("已退回修改"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "审核操作失败"); }
    finally { setPending(null); }
  }

  return <div className="grid gap-4">
    <div aria-live="polite" className="min-h-6">{message ? <p className="text-sm font-medium text-[var(--color-teal-ink)]">{message}</p> : null}</div>
    {items.length === 0 ? <div className="border border-neutral-200 bg-white px-4 py-12 text-center"><h2 className="text-lg font-semibold">暂无待审核内容</h2><p className="mt-2 text-sm text-neutral-600">新的审核任务会显示在这里。</p></div> : items.map((item) => <article className="border border-neutral-200 bg-white p-5" key={item.id}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-sm font-medium text-[var(--color-cyan-ink)]">{collectionLabels[item.entityType] ?? "内容"}</p><h2 className="mt-1 text-lg font-semibold">待审核内容</h2><p className="mt-2 text-sm text-neutral-600">提交人：{item.submittedBy} · 版本 {item.sourceVersion}</p></div>
        <Link className="inline-flex min-h-11 items-center gap-2 border border-neutral-300 px-4 text-sm font-semibold" href={`/admin/content/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.entityId)}`} target="_blank">检查三语内容<ExternalLink aria-hidden="true" className="size-4" /></Link>
      </div>
      <div className="mt-5 grid gap-3 border-t border-neutral-200 pt-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <label className="text-sm font-medium">退回原因<textarea className="mt-2 min-h-20 w-full border border-neutral-300 px-3 py-2 text-base" onChange={(event) => setReason((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="明确说明需要修改的内容" value={reason[item.id] ?? ""} /></label>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-200 px-4 font-semibold text-red-700 disabled:opacity-50" disabled={pending === item.id} onClick={() => void reject(item)} type="button"><Undo2 aria-hidden="true" className="size-4" />退回修改</button>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--color-action)] px-4 font-semibold text-white disabled:opacity-50" disabled={pending === item.id} onClick={() => void approve(item)} type="button">{pending === item.id ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}审核通过</button>
      </div>
    </article>)}
  </div>;
}
