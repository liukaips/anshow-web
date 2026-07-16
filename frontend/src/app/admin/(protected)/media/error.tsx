"use client";

import { RotateCcw } from "lucide-react";

export default function AdminMediaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="px-4 py-10 sm:px-8" id="admin-main">
      <div className="mx-auto max-w-3xl border-l-4 border-[var(--color-danger)] bg-white px-5 py-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          媒体库加载失败
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          暂时无法读取媒体数据，请检查后端服务或稍后重试。
        </p>
        <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-neutral-300 px-4 text-sm font-semibold" onClick={reset} type="button">
          <RotateCcw aria-hidden="true" className="size-4" />
          重新加载
        </button>
      </div>
    </main>
  );
}
